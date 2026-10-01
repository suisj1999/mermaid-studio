import { useCallback, useEffect, useRef } from "react";

/**
 * Stable callback whose body always sees the latest props/state.
 *
 * React 19's `useEffectEvent` is still experimental and not exported from the
 * stable build. This is a small polyfill that achieves the same thing: a
 * function reference that never changes, but reads from a ref that's updated
 * on every render. Use it inside event handlers (not effects) so that changing
 * the underlying value does not retrigger effects that depend on the wrapper.
 */
export function useEffectEvent<T extends (...args: never[]) => unknown>(
  fn: T,
): T {
  const ref = useRef(fn);
  useEffect(() => {
    ref.current = fn;
  });
  return useCallback(((...args: Parameters<T>) => {
    return ref.current(...args);
  }) as T, []);
}
