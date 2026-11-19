import type { DatabaseSync } from "node:sqlite";

/**
 * Schema migrations for the conversation store.
 *
 * Migrations are plain SQL strings applied in order and tracked with
 * `PRAGMA user_version`, so there is no separate migration file to keep in
 * sync — the version number *is* the migration list. Every statement is
 * idempotent (`IF NOT EXISTS`) so re-running the whole set against an
 * existing database is a no-op.
 */
interface Migration {
  version: number;
  sql: string;
}

const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    sql: `
      CREATE TABLE IF NOT EXISTS conversations (
        id           TEXT PRIMARY KEY,
        owner        TEXT NOT NULL DEFAULT 'default',
        title        TEXT NOT NULL DEFAULT '',
        title_edited INTEGER NOT NULL DEFAULT 0,
        source       TEXT NOT NULL DEFAULT '',
        created_at   INTEGER NOT NULL,
        updated_at   INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS messages (
        id              TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        role            TEXT NOT NULL CHECK (role IN ('user','assistant')),
        content         TEXT NOT NULL,
        created_at      INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_messages_conversation
        ON messages (conversation_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_conversations_owner_updated
        ON conversations (owner, updated_at DESC);
    `,
  },
];

/**
 * Apply every migration the database has not seen yet, in a transaction.
 * Safe to call on every open.
 */
export function applyMigrations(db: DatabaseSync): void {
  const current = db.prepare("PRAGMA user_version").get() as
    | { user_version: number }
    | undefined;
  const from = current?.user_version ?? 0;

  for (const migration of MIGRATIONS) {
    if (migration.version <= from) continue;
    db.exec("BEGIN");
    try {
      db.exec(migration.sql);
      db.exec(`PRAGMA user_version = ${migration.version}`);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }
}
