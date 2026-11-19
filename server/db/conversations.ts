import { randomUUID } from "node:crypto";

import type {
  ChatMessage,
  ChatRole,
  ConversationSnapshot,
  ConversationSummary,
} from "~/lib/conversations/types";

import { getDb } from "./client";

/**
 * Storage for conversations.
 *
 * Every read and write is scoped by `owner`. Today the app is single-user
 * and the owner is a fixed id from the environment, but keeping the column
 * in every statement means adding real accounts later is a matter of
 * threading the owner through instead of restructuring the schema.
 *
 * The current Mermaid source is stored exactly once, in
 * `conversations.source`. The `messages` table holds the conversation
 * transcript (user prompts and short assistant acknowledgements), not a
 * second copy of the diagram.
 */

const SOURCE_PREVIEW_LENGTH = 140;

interface ConversationRow {
  id: string;
  title: string;
  title_edited: number;
  source: string;
  created_at: number;
  updated_at: number;
}

interface MessageRow {
  id: string;
  role: string;
  content: string;
  created_at: number;
}

function toMessage(row: MessageRow): ChatMessage {
  return {
    id: row.id,
    role: row.role as ChatRole,
    content: row.content,
    createdAt: row.created_at,
  };
}

function toSummary(row: ConversationRow & { message_count: number }): ConversationSummary {
  return {
    id: row.id,
    title: row.title,
    titleEdited: row.title_edited === 1,
    sourcePreview: buildSourcePreview(row.source),
    messageCount: row.message_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Trim a source down to a single-line excerpt for the card list. */
function buildSourcePreview(source: string): string {
  const flattened = source.replace(/\s+/g, " ").trim();
  if (flattened.length <= SOURCE_PREVIEW_LENGTH) return flattened;
  return `${flattened.slice(0, SOURCE_PREVIEW_LENGTH - 1)}…`;
}

/**
 * List every conversation owned by `owner`, most recently updated first.
 */
export function listConversationSummaries(owner: string): ConversationSummary[] {
  const rows = getDb()
    .prepare(
      `SELECT c.id, c.title, c.title_edited, c.source, c.created_at, c.updated_at,
              (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) AS message_count
         FROM conversations c
        WHERE c.owner = ?
        ORDER BY c.updated_at DESC`,
    )
    .all(owner) as unknown as (ConversationRow & { message_count: number })[];

  return rows.map(toSummary);
}

/**
 * Load one conversation with its full transcript, or `null` when it does
 * not exist or belongs to someone else.
 */
export function getConversationSnapshot(
  id: string,
  owner: string,
): ConversationSnapshot | null {
  const row = getDb()
    .prepare(
      `SELECT id, title, title_edited, source, created_at, updated_at
         FROM conversations
        WHERE id = ? AND owner = ?`,
    )
    .get(id, owner) as ConversationRow | undefined;

  if (!row) return null;

  return {
    id: row.id,
    title: row.title,
    titleEdited: row.title_edited === 1,
    source: row.source,
    messages: listMessages(row.id),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Create an empty conversation. A title passed in here has been typed by a
 * human, so it locks the title against later generation.
 */
export function createConversation(
  owner: string,
  init?: { title?: string; source?: string },
): ConversationSnapshot {
  const id = randomUUID();
  const now = Date.now();
  const title = init?.title ?? "";
  const source = init?.source ?? "";

  getDb()
    .prepare(
      `INSERT INTO conversations
         (id, owner, title, title_edited, source, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(id, owner, title, title ? 1 : 0, source, now, now);

  return {
    id,
    title,
    titleEdited: title.length > 0,
    source,
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Apply a partial update to a conversation.
 *
 * Writing `title` marks it as human-edited, which permanently stops the
 * server from replacing it with a generated one. Writing `source` is a
 * plain overwrite — the source is always the latest, and there is only one
 * copy of it.
 */
export function updateConversation(
  id: string,
  owner: string,
  patch: { title?: string; source?: string },
): ConversationSnapshot | null {
  const db = getDb();
  const now = Date.now();

  if (patch.title !== undefined) {
    db.prepare(
      `UPDATE conversations
          SET title = ?, title_edited = 1, updated_at = ?
        WHERE id = ? AND owner = ?`,
    ).run(patch.title, now, id, owner);
  }

  if (patch.source !== undefined) {
    db.prepare(
      `UPDATE conversations
          SET source = ?, updated_at = ?
        WHERE id = ? AND owner = ?`,
    ).run(patch.source, now, id, owner);
  }

  return getConversationSnapshot(id, owner);
}

/**
 * Store a title produced by the model.
 *
 * The write is conditional: it only lands when the conversation still has
 * no title and nobody has renamed it. A manual edit that lands while the
 * title request is still in flight therefore wins.
 */
export function setGeneratedTitle(id: string, title: string): boolean {
  const result = getDb()
    .prepare(
      `UPDATE conversations
          SET title = ?, updated_at = ?
        WHERE id = ? AND title = '' AND title_edited = 0`,
    )
    .run(title, Date.now(), id);

  return result.changes > 0;
}

/** Delete a conversation and (via cascade) its messages. */
export function deleteConversation(id: string, owner: string): boolean {
  const result = getDb()
    .prepare("DELETE FROM conversations WHERE id = ? AND owner = ?")
    .run(id, owner);
  return result.changes > 0;
}

/** Append one turn to a conversation's transcript. */
export function appendMessage(
  conversationId: string,
  role: ChatRole,
  content: string,
): ChatMessage {
  const id = randomUUID();
  const createdAt = Date.now();

  getDb()
    .prepare(
      `INSERT INTO messages (id, conversation_id, role, content, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(id, conversationId, role, content, createdAt);

  return { id, role, content, createdAt };
}

/** Read a conversation's transcript, oldest turn first. */
export function listMessages(conversationId: string): ChatMessage[] {
  const rows = getDb()
    .prepare(
      `SELECT id, role, content, created_at
         FROM messages
        WHERE conversation_id = ?
        ORDER BY created_at ASC, rowid ASC`,
    )
    .all(conversationId) as unknown as MessageRow[];

  return rows.map(toMessage);
}

/** True when the conversation exists (regardless of owner). */
export function conversationExists(id: string): boolean {
  const row = getDb()
    .prepare("SELECT 1 AS present FROM conversations WHERE id = ?")
    .get(id) as { present: number } | undefined;
  return row !== undefined;
}
