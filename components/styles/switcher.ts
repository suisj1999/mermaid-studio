"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  DEFAULT_STYLE_ID,
  isKnownStyleId,
  type StyleId,
} from "./registry";

/**
 * Read the active UI style from the `?ui-style=` URL parameter. Falls back
 * to the default style when the param is missing or unknown — the same
 * fallback `app/page.tsx` applies before the page even renders, so this
 * hook is the page-level mirror of that contract.
 */
export function useCurrentStyle(): StyleId {
  const params = useSearchParams();
  const raw = params.get("ui-style");
  return isKnownStyleId(raw) ? raw : DEFAULT_STYLE_ID;
}

/**
 * Navigate to the URL for `id`. The default style's URL is `/` (no query),
 * every other style is `/?ui-style=<id>`. Uses `replace` (not `push`) so
 * the back button doesn't accumulate style swaps.
 */
export function navigateToStyle(
  router: ReturnType<typeof useRouter>,
  id: StyleId,
) {
  const target = id === DEFAULT_STYLE_ID ? "/" : `/?ui-style=${id}`;
  router.replace(target);
}