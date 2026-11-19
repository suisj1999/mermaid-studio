"use client";

import { useRouter } from "next/navigation";

import type { StyleId } from "./ids";
import { styleEditorHref, styleHomeHref } from "./urls";

/**
 * Navigate to the editor for `id`, optionally opening a saved
 * conversation. Uses `replace` (not `push`) so the back button doesn't
 * accumulate style swaps.
 */
export function navigateToStyle(
  router: ReturnType<typeof useRouter>,
  id: StyleId,
  conversationId?: string | null,
) {
  router.replace(styleEditorHref(id, conversationId));
}

/**
 * Navigate to the home page in the given style.
 */
export function navigateToHomeStyle(
  router: ReturnType<typeof useRouter>,
  id: StyleId,
) {
  router.replace(styleHomeHref(id));
}
