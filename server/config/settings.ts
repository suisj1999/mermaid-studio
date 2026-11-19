/**
 * Environment-derived settings shared by the server and the editor page.
 *
 * These are read on the server rather than baked into the client bundle,
 * so changing them does not require a rebuild.
 */

/** Default owner for conversations; the app is single-user today. */
export const DEFAULT_OWNER_ID = "default";

/** Auto-save delay used when `AUTOSAVE_INTERVAL_MS` is unset. */
export const DEFAULT_AUTOSAVE_INTERVAL_MS = 2000;

/** Shortest auto-save delay we accept — below this the server sees a write per keystroke. */
export const MIN_AUTOSAVE_INTERVAL_MS = 500;

/**
 * The owner every conversation belongs to.
 *
 * The `owner` column exists so a multi-user build can filter rows per
 * account; today there is only one account.
 */
export function defaultOwnerId(): string {
  return process.env.DEFAULT_OWNER_ID?.trim() || DEFAULT_OWNER_ID;
}

/**
 * Auto-save interval in milliseconds.
 *
 * `0` disables auto-save entirely (the user then saves manually); any
 * other value is clamped to at least {@link MIN_AUTOSAVE_INTERVAL_MS}.
 */
export function autosaveIntervalMs(): number {
  const raw = process.env.AUTOSAVE_INTERVAL_MS?.trim();
  if (!raw) return DEFAULT_AUTOSAVE_INTERVAL_MS;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return DEFAULT_AUTOSAVE_INTERVAL_MS;
  if (parsed === 0) return 0;

  return Math.max(MIN_AUTOSAVE_INTERVAL_MS, parsed);
}
