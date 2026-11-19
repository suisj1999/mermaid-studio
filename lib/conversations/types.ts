/**
 * Data-transfer shapes shared by the client and the server.
 *
 * These types describe what crosses the wire, so they deliberately omit
 * server-only fields (notably `owner`) — the owning column is an
 * implementation detail of the storage layer and is never exposed.
 */

export type ChatRole = "user" | "assistant";

export type LlmRole = "user" | "assistant";

/** One turn in a provider chat request. */
export interface LlmMessage {
  role: LlmRole;
  content: string;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  /** Epoch milliseconds. */
  createdAt: number;
}

/**
 * Card-sized view of a conversation, used by the home page list. It carries
 * a truncated source preview so the list can show what each diagram is
 * without loading every full source into the page.
 */
export interface ConversationSummary {
  id: string;
  title: string;
  /** True when a human renamed the conversation — a generated title never overwrites it. */
  titleEdited: boolean;
  sourcePreview: string;
  messageCount: number;
  /** Epoch milliseconds. */
  createdAt: number;
  /** Epoch milliseconds. */
  updatedAt: number;
}

/** Full state of one conversation: the current source plus its transcript. */
export interface ConversationSnapshot {
  id: string;
  title: string;
  titleEdited: boolean;
  /** The one stored copy of the current Mermaid source. */
  source: string;
  messages: ChatMessage[];
  /** Epoch milliseconds. */
  createdAt: number;
  /** Epoch milliseconds. */
  updatedAt: number;
}
