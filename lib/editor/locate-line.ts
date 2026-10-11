/**
 * Pure: character offset where `line` (1-indexed) begins in `source`.
 *
 * Returns 0 when `line <= 1`; if `line` is past the end, returns the offset
 * of the last existing line (the caller clamps selection length to 0).
 * Both styles share this so the line math stays in one place — adding
 * tests here is the only way to verify behavior across styles.
 */
export function getLineStartOffset(source: string, line: number): number {
  if (line <= 1) return 0;
  const lines = source.split("\n");
  let start = 0;
  const upTo = Math.min(line - 1, lines.length);
  for (let i = 0; i < upTo; i++) {
    start += lines[i].length + 1;
  }
  return start;
}

/**
 * Move a textarea's caret to `line` (1-indexed) and scroll it into view,
 * then notify the host so it can drive the editor's current-line marker.
 *
 * The math is delegated to `getLineStartOffset`; this routine owns the DOM
 * mutations. `lineHeight` reads the live `line-height` from CSS, falling
 * back to 20 px when the property is `normal` (unparseable) or 0.
 */
export function locateTextareaLine(
  textarea: HTMLTextAreaElement,
  source: string,
  line: number,
  onLine?: (line: number) => void,
) {
  const start = getLineStartOffset(source, line);
  const lines = source.split("\n");
  const lineLength = lines[line - 1]?.length ?? 0;
  textarea.setSelectionRange(start, start + lineLength);
  const lineHeight =
    parseFloat(getComputedStyle(textarea).lineHeight) || 20;
  textarea.scrollTop = Math.max(0, (line - 3) * lineHeight);
  onLine?.(line);
}