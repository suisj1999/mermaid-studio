"use client";

import { useEffect } from "react";
import { decodeShareState } from "~/lib/share/encode";
import { useEffectEvent } from "./use-effect-event";

/**
 * On mount, read the `#s=` hash payload, decode it, and pass the embedded
 * source string to `apply`. Runs exactly once — the URL is treated as
 * "where this view came from", not "current state", so subsequent edits
 * don't react to later hash changes.
 *
 * If no `#s=` is present, or the payload is malformed, this is a no-op:
 * the page keeps its default source.
 */
export function useSharedSource(apply: (source: string) => void): void {
  const applyLatest = useEffectEvent(apply);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    if (!hash.startsWith("#s=")) return;
    const decoded = decodeShareState(hash);
    if (!decoded) return;
    applyLatest(decoded.s);
  }, [applyLatest]);
}
