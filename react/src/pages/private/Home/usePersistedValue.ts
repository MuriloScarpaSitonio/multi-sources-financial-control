import { useEffect, useRef, useState } from "react";

/**
 * Debounce + shared-skeleton coordination for sliders/inputs whose change
 * persists via an API call.
 *
 * When `enabled` is true (the control is bound to a persisted field on the
 * active strategy): the raw value tracks the thumb/keystrokes live and the
 * commit (`onChange`) is debounced — collapsing a drag into a single PATCH and,
 * since the indicator's useMemos key off the committed value, debouncing the
 * heavy bootstrap recompute too.
 *
 * `isPersisting` is a single shared loading flag (the strategy's one mutation):
 * once any persisted slider commits, EVERY control wired with this flag shows a
 * skeleton until the save settles — including the local what-if inputs, so the
 * whole panel freezes together while the simulation recomputes. `enabled` only
 * governs debounce: local inputs (`enabled` false) commit immediately but still
 * skeleton with the rest. On an inactive strategy nothing persists, so
 * `isPersisting` stays false and nothing skeletons.
 */
export const usePersistedValue = (
  value: number,
  onChange: (value: number) => void,
  {
    enabled = false,
    isPersisting = false,
    debounceMs = 400,
  }: { enabled?: boolean; isPersisting?: boolean; debounceMs?: number },
) => {
  const [raw, setRaw] = useState(value);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  // Re-sync to the committed/persisted value when it changes externally (reset,
  // server refetch). Skip while a save is in flight — the control is a skeleton
  // then anyway, and syncing mid-save would fight the optimistic raw value.
  useEffect(() => {
    if (!isPersisting) setRaw(value);
  }, [value, isPersisting]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const commit = (next: number) => {
    setRaw(next);
    if (!enabled) {
      onChange(next);
      return;
    }
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onChange(next), debounceMs);
  };

  // Cancels a pending debounced commit. Callers must invoke this before any
  // external reset that bypasses `commit` (e.g. a Resetar button) — otherwise a
  // mid-drag timer can fire after the reset and reapply the dragged value.
  const cancel = () => {
    clearTimeout(timerRef.current);
    timerRef.current = undefined;
  };

  return { raw, commit, cancel, showSkeleton: isPersisting };
};
