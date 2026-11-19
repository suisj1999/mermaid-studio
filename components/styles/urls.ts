import { DEFAULT_STYLE_ID, type StyleId } from "./ids";

/**
 * URL builders for the two routes the app has:
 *
 * - `/` is the home page, a list of saved conversations.
 * - `/editor` is the editor, optionally opened on a saved conversation.
 *
 * The style travels in `?ui-style=` and the conversation in `?c=`. The
 * default style is omitted from the URL so the common case stays clean.
 */
export function styleEditorHref(
  styleId: StyleId,
  conversationId?: string | null,
): string {
  const params = new URLSearchParams();
  if (styleId !== DEFAULT_STYLE_ID) params.set("ui-style", styleId);
  if (conversationId) params.set("c", conversationId);

  const query = params.toString();
  return query ? `/editor?${query}` : "/editor";
}

export function styleHomeHref(styleId: StyleId): string {
  return styleId === DEFAULT_STYLE_ID ? "/" : `/?ui-style=${styleId}`;
}
