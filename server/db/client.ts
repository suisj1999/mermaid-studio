import fs from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";

import { applyMigrations } from "./schema";

/**
 * SQLite connection for the conversation store.
 *
 * `node:sqlite` is a Node builtin (Node >= 22.5), so there is no native
 * module to compile and nothing to add to `serverExternalPackages`. The
 * tradeoff: Bun does not implement `node:sqlite`, so this module only
 * works when Next runs under Node. `bun run dev` / `bun run build` resolve
 * `node_modules/.bin/next` through its `#!/usr/bin/env node` shebang and
 * therefore run under Node — but `bun run --bun dev` would not, and
 * `bun test` (which runs under Bun) must never import this file.
 */
interface DatabaseGlobals {
  __mermaidStudioDb?: DatabaseSync;
}

const globals = globalThis as unknown as DatabaseGlobals;

/**
 * Resolve the on-disk location of the database. `DATABASE_PATH` overrides
 * it; the default keeps the file inside the project so a self-hosted
 * deployment persists across restarts.
 */
function resolveDatabasePath(): string {
  const configured = process.env.DATABASE_PATH?.trim();
  if (configured) return configured;
  return path.join(process.cwd(), "data", "mermaid-studio.db");
}

/**
 * Load the `node:sqlite` builtin on demand.
 *
 * A static `import` would load the builtin — and print Node's experimental
 * warning — as soon as any module imports this file, including during
 * `next build`. Going through `process.getBuiltinModule` defers both the
 * load and the warning to the moment a database is actually opened.
 */
function loadSqlite(): { DatabaseSync: new (path: string) => DatabaseSync } {
  const sqlite = process.getBuiltinModule("node:sqlite") as
    | { DatabaseSync: new (path: string) => DatabaseSync }
    | undefined;
  if (!sqlite) {
    throw new Error(
      "node:sqlite is unavailable — Node 22.5 or newer is required",
    );
  }
  return sqlite;
}

function openDatabase(): DatabaseSync {
  const file = resolveDatabasePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });

  const { DatabaseSync } = loadSqlite();
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA busy_timeout = 5000");
  applyMigrations(db);
  return db;
}

/**
 * Lazily open (once) and return the shared database handle.
 *
 * The handle is cached on `globalThis` rather than in a module-level
 * variable: Next's dev server reloads modules on every edit, and a
 * module-level singleton would leak a file handle per reload. The lookup is
 * lazy so importing this module never touches the filesystem — `next build`
 * imports route modules while collecting page data, and must not create a
 * database file as a side effect.
 */
export function getDb(): DatabaseSync {
  if (!globals.__mermaidStudioDb) {
    globals.__mermaidStudioDb = openDatabase();
  }
  return globals.__mermaidStudioDb;
}
