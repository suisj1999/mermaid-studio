"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";

export interface ToastState {
  message: string;
  /** Visual tone — `"ok"` for confirmations, `"error"` for failures. */
  tone: "ok" | "error";
}

export interface ToastAction {
  type: "show" | "dismiss";
  payload?: ToastState;
}

export interface UseToastOptions {
  /** Auto-dismiss delay in ms. Defaults to 2000. */
  dismissAfter?: number;
}

export interface UseToastHandle {
  toast: ToastState | null;
  showToast: (state: ToastState) => void;
  dismissToast: () => void;
}

/**
 * Pure reducer for toast transitions.
 *
 * - `show` always replaces the current toast (the latest message wins).
 * - `dismiss` clears it (used by the timer and the imperative `dismissToast`).
 *
 * Lives outside the hook so the policy is unit-testable without React state.
 */
export function toastReducer(
  _state: ToastState | null,
  action: ToastAction,
): ToastState | null {
  switch (action.type) {
    case "show":
      return action.payload ?? null;
    case "dismiss":
      return null;
  }
}

/**
 * Toast state + auto-dismiss. The hook owns one imperative timer; showing a
 * new toast while another is up resets the timer rather than stacking. Timer
 * is cancelled on unmount so a fast unmount during a pending dismiss doesn't
 * warn about setting state on an unmounted component.
 */
export function useToast({ dismissAfter = 2000 }: UseToastOptions = {}): UseToastHandle {
  const [toast, dispatch] = useReducer(toastReducer, null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismissToast = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    dispatch({ type: "dismiss" });
  }, []);

  const showToast = useCallback(
    (state: ToastState) => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
      dispatch({ type: "show", payload: state });
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        dispatch({ type: "dismiss" });
      }, dismissAfter);
    },
    [dismissAfter],
  );

  useEffect(
    () => () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    },
    [],
  );

  return { toast, showToast, dismissToast };
}
