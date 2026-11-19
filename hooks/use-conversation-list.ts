"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { ConversationSummary } from "~/lib/conversations/types";

/** How long the delete button stays in its "press again to confirm" state. */
const CONFIRM_TIMEOUT_MS = 5000;

export interface UseConversationListResult {
  items: ConversationSummary[];
  /** Id of the conversation currently being deleted, or `null`. */
  deletingId: string | null;
  /** Id whose delete button is waiting for a second click. */
  pendingDeleteId: string | null;
  error: string | null;
  /** Short status line announced to assistive tech. */
  notice: string | null;
  /** Arm the delete button; the next call to `confirmDelete` removes it. */
  requestDelete: (id: string, label: string) => void;
  /** Disarm the delete button. */
  cancelDelete: () => void;
  /** Delete the conversation and drop it from the list. */
  confirmDelete: (id: string, label: string) => Promise<void>;
  dismissError: () => void;
}

/**
 * The home page's list of saved conversations.
 *
 * The list arrives from the server already rendered; deleting a card is the
 * only mutation, so the list is kept in local state and the card is dropped
 * once the server confirms the delete.
 *
 * Deletion is a two-step interaction: the first click arms the button, the
 * second one deletes. A native `confirm()` would block the page, cannot be
 * themed, and renders with the OS chrome in dark mode.
 */
export function useConversationList(
  initial: ConversationSummary[],
): UseConversationListResult {
  const [items, setItems] = useState(initial);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // A pending confirmation must not survive unmount.
  useEffect(() => clearTimer, [clearTimer]);

  const requestDelete = useCallback(
    (id: string, label: string) => {
      clearTimer();
      setPendingDeleteId(id);
      setNotice(`Press delete again to remove ${label}.`);
      timerRef.current = setTimeout(() => {
        setPendingDeleteId((current) => (current === id ? null : current));
        timerRef.current = null;
      }, CONFIRM_TIMEOUT_MS);
    },
    [clearTimer],
  );

  const cancelDelete = useCallback(() => {
    clearTimer();
    setPendingDeleteId(null);
    setNotice(null);
  }, [clearTimer]);

  const confirmDelete = useCallback(
    async (id: string, label: string) => {
      clearTimer();
      setPendingDeleteId(null);
      setDeletingId(id);
      setError(null);
      try {
        const response = await fetch(`/api/conversations/${id}`, {
          method: "DELETE",
        });
        if (!response.ok && response.status !== 404) {
          throw new Error(`Delete failed (HTTP ${response.status})`);
        }
        setItems((current) => current.filter((item) => item.id !== id));
        setNotice(`Removed ${label}.`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Delete failed");
        setNotice(null);
      } finally {
        setDeletingId(null);
      }
    },
    [clearTimer],
  );

  const dismissError = useCallback(() => setError(null), []);

  return {
    items,
    deletingId,
    pendingDeleteId,
    error,
    notice,
    requestDelete,
    cancelDelete,
    confirmDelete,
    dismissError,
  };
}
