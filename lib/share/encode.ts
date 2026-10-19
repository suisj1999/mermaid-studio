import lzString from "lz-string";

/**
 * Wire format version. Bump when the payload schema changes incompatibly;
 * unknown-version hashes are rejected by `decodeShareState` so old links
 * fail loudly instead of silently decoding into garbage.
 */
const SHARE_VERSION = 1;

/**
 * Hard ceiling on the source length we're willing to decode. 100 KB is far
 * past any reasonable Mermaid source; anything larger is treated as a DoS
 * attempt and rejected. Compressed payloads of a few hundred KB decode
 * down to ~10 KB of source, so this is a real, not nominal, limit.
 */
const MAX_SOURCE_LENGTH = 100_000;

/**
 * Payload carried in a `#s=<encoded>` URL hash. All fields except `s` and
 * `v` are optional — recipients fall back to defaults when they're missing.
 */
export interface ShareState {
  /** Schema version, always 1. */
  v: 1;
  /** The Mermaid source being shared. */
  s: string;
  /** Optional theme hint (light / dark) so the recipient gets the same look. */
  t?: "light" | "dark";
  /** Optional `ui-style` id so the recipient sees the sender's style choice. */
  u?: string;
}

/**
 * Encode a `ShareState` into the URL-hash payload form: a version prefix
 * followed by an LZ-string + base64url-encoded JSON blob. The result is
 * safe to drop between `#` and the next fragment separator.
 */
export function encodeShareState(state: ShareState): string {
  return `v${SHARE_VERSION}.${lzString.compressToEncodedURIComponent(
    JSON.stringify(state),
  )}`;
}

/**
 * Decode a URL-hash payload (with or without the leading `#s=` prefix).
 * Returns `null` for any malformed input — wrong version, bad prefix,
 * non-string source, or source past the size ceiling. Callers can render
 * a "this link is invalid" state without try/catching.
 */
export function decodeShareState(input: string): ShareState | null {
  const trimmed = input.startsWith("#s=") ? input.slice(3) : input;
  const match = /^v(\d+)\.(.+)$/.exec(trimmed);
  if (!match) return null;
  if (Number(match[1]) !== SHARE_VERSION) return null;

  let json: string | null;
  try {
    json = lzString.decompressFromEncodedURIComponent(match[2]);
  } catch {
    return null;
  }
  if (!json) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }

  if (!isShareState(parsed)) return null;
  return parsed;
}

/**
 * Build a full shareable URL pointing at the deployed app. Default style
 * keeps the URL clean (`/` with no query); any other style sets
 * `?ui-style=<id>` so the recipient lands on the sender's chosen UI.
 *
 * `baseUrl` must be absolute. Any query it already carries is preserved,
 * and an existing `ui-style` is replaced rather than duplicated — the
 * caller's URL usually already reflects the current style, so appending
 * blindly would yield `?ui-style=newspaper?ui-style=newspaper`, which the
 * receiver reads as one unknown style and silently falls back.
 */
export function formatShareUrl(
  baseUrl: string,
  uiStyle: string | null,
  state: ShareState,
): string {
  const parsed = new URL(baseUrl);
  if (uiStyle && uiStyle !== "neo-brutalism") {
    parsed.searchParams.set("ui-style", uiStyle);
  }
  return `${parsed.origin}${parsed.pathname}${parsed.search}#s=${encodeShareState(state)}`;
}

/**
 * Convenience wrapper that parses a full share URL (or just its hash) and
 * returns the decoded state plus the `ui-style` query param. Either part
 * may be missing — the receiver still gets the source from a hash-only
 * URL, and a query-only URL is just the regular style selector.
 */
export function decodeFromUrl(
  url: string | URL,
): { state: ShareState; uiStyle: string | null } | null {
  const parsed = typeof url === "string" ? new URL(url) : url;
  const hash = parsed.hash.startsWith("#")
    ? parsed.hash.slice(1)
    : parsed.hash;
  const payload = hash.startsWith("s=") ? hash.slice(2) : hash;
  const state = decodeShareState(payload);
  if (!state) return null;
  const uiStyle = parsed.searchParams.get("ui-style");
  return { state, uiStyle };
}

function isShareState(value: unknown): value is ShareState {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  if (candidate.v !== 1) return false;
  if (typeof candidate.s !== "string") return false;
  if (candidate.s.length > MAX_SOURCE_LENGTH) return false;
  if (candidate.t !== undefined && candidate.t !== "light" && candidate.t !== "dark") {
    return false;
  }
  if (candidate.u !== undefined && typeof candidate.u !== "string") {
    return false;
  }
  return true;
}