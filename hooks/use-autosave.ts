"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

export interface UseAutosaveOptions<T> {
  /** The value to persist. */
  value: T;
  /**
   * Identity of `value`. The hook compares it against the identity of the
   * last persisted value to decide whether there is anything to save, so it
   * must change exactly when `value` changes in a way worth storing.
   */
  key: string;
  /** Debounce in milliseconds. `0` disables auto-save. */
  intervalMs: number;
  /** Performs the write. Rejecting puts the hook into the `error` state. */
  save: (value: T) => Promise<void>;
}

export interface UseAutosaveResult {
  saveState: SaveState;
  /** Epoch milliseconds of the last successful save. */
  lastSavedAt: number | null;
  /** Save right now, cancelling the pending debounce. */
  flush: () => void;
  /**
   * Declare a value as already persisted. Used when the server wrote the
   * data itself — a generated diagram, for instance — so the hook does not
   * write it back.
   */
  markPersisted: (key: string) => void;
  /**
   * Adopt a value as the baseline without claiming it was saved. Used for
   * values that replace the editor's content but must not overwrite what
   * is stored — a diagram arriving through a share link, for instance.
   */
  suppressChange: (key: string) => void;
}

/**
 * Debounced auto-save.
 *
 * Writes are trailing: every change restarts the timer, so a burst of
 * edits results in one write once the user pauses. A pending write is also
 * flushed when the tab is hidden or the component unmounts, which is what
 * keeps the last keystroke from being lost when the tab is closed.
 */
export function useAutosave<T>({
  value,
  key,
  intervalMs,
  save,
}: UseAutosaveOptions<T>): UseAutosaveResult {
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  const valueRef = useRef(value);
  valueRef.current = value;
  const keyRef = useRef(key);
  keyRef.current = key;

  const persistedKeyRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);
  const saveRef = useRef(save);
  saveRef.current = save;

  const runSave = useCallback(async () => {
    if (savingRef.current) return;
    if (persistedKeyRef.current === keyRef.current) return;

    savingRef.current = true;
    setSaveState("saving");

    const savingKey = keyRef.current;
    try {
      await saveRef.current(valueRef.current);
      // Only report success when nothing changed while the write was in
      // flight; otherwise the newer value still needs saving.
      if (keyRef.current === savingKey) {
        persistedKeyRef.current = savingKey;
        setSaveState("saved");
        setLastSavedAt(Date.now());
      }
    } catch {
      setSaveState("error");
    } finally {
      savingRef.current = false;
    }
  }, []);

  // Seed the baseline before the change-detection effect below runs, so the
  // value a component starts with is never mistaken for an unsaved edit.
  useEffect(() => {
    if (persistedKeyRef.current === null) {
      persistedKeyRef.current = keyRef.current;
    }
  }, []);

  useEffect(() => {
    if (persistedKeyRef.current === keyRef.current) return;

    setSaveState("dirty");
    if (timerRef.current) clearTimeout(timerRef.current);
    if (intervalMs > 0) {
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        void runSave();
      }, intervalMs);
    }
  }, [key, intervalMs, runSave]);

  // A pending write must survive the tab being hidden or the component
  // going away, otherwise the last edit before closing is lost.
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") void runSave();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      void runSave();
    };
  }, [runSave]);

  const flush = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    void runSave();
  }, [runSave]);

  const markPersisted = useCallback((persistedKey: string) => {
    persistedKeyRef.current = persistedKey;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setSaveState("saved");
    setLastSavedAt(Date.now());
  }, []);

  const suppressChange = useCallback((persistedKey: string) => {
    persistedKeyRef.current = persistedKey;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  return { saveState, lastSavedAt, flush, markPersisted, suppressChange };
}
