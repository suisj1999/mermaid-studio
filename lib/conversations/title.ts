/**
 * Title helpers.
 *
 * The model is asked for a title inside a `<title>` tag, but it does not
 * always comply — it may wrap the tag in quotes, add a trailing period, or
 * return the tag without ever closing it. Everything the model produces is
 * therefore scrubbed before it reaches the database.
 */

/** Longest title we keep. Longer titles are truncated with an ellipsis. */
export const MAX_TITLE_LENGTH = 60;

/**
 * Turn raw model output into a clean single-line title.
 *
 * Returns an empty string when nothing usable survives, which tells the
 * caller to fall back rather than store a title made of punctuation.
 */
export function sanitizeTitle(raw: string): string {
  // The model is asked for `<title>…</title>`; the caller usually extracts
  // the section first, but unwrap it here too so a tagged title never
  // reaches the database with its markup in it.
  const tagged = raw.match(/<title>([\s\S]*?)<\/title>/i);
  const source = tagged ? tagged[1] : raw;

  const firstLine = source
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  if (!firstLine) return "";

  let title = firstLine
    .replace(/^[<`'"\s*_]+/, "")
    .replace(/[<>'"`*_]+$/, "")
    .replace(/\s+/g, " ")
    .trim();

  title = title.replace(/[.\s]+$/, "");

  if (title.length > MAX_TITLE_LENGTH) {
    title = `${title.slice(0, MAX_TITLE_LENGTH - 1).trimEnd()}…`;
  }

  return title;
}

/**
 * Title used when the model fails to produce one. Takes the opening of the
 * user's own request, which is usually more useful than "Untitled".
 */
export function deriveFallbackTitle(prompt: string): string {
  const flattened = prompt.replace(/\s+/g, " ").trim();
  if (!flattened) return "";
  if (flattened.length <= 40) return flattened;
  return `${flattened.slice(0, 39).trimEnd()}…`;
}
