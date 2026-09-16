"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { AUTOSAVE_DELAY_MS } from "@/lib/constants";

export type AutosaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

interface UseAutosaveOptions {
  /** Debounce window before a save is sent. */
  delay?: number;
  /** How long the "Saved" confirmation lingers. */
  savedFor?: number;
  /** Persists the value. Rejections flip the status to `error`. */
  onSave: (value: string) => Promise<unknown> | unknown;
}

/**
 * Autosave for an inline text field.
 *
 * The hook owns the draft value so typing stays instantaneous while the store
 * write is debounced. Three rules keep it from fighting the server:
 *
 * 1. `value` is adopted only when this field is not dirty, so a background
 *    refresh cannot overwrite what someone is mid-way through typing.
 * 2. A save is skipped when nothing changed since the last one.
 * 3. Unmounting flushes the pending draft, so closing a drawer never loses an
 *    edit — the "autosave drafts" promise is kept at the edges, not just the
 *    happy path.
 */
export function useAutosave(
  initialValue: string,
  { delay = AUTOSAVE_DELAY_MS, savedFor = 1400, onSave }: UseAutosaveOptions,
) {
  const [value, setValue] = useState(initialValue);
  const [status, setStatus] = useState<AutosaveStatus>("idle");

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedRef = useRef(initialValue);
  const valueRef = useRef(initialValue);
  const dirtyRef = useRef(false);
  const onSaveRef = useRef(onSave);

  valueRef.current = value;

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  const clearTimer = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const commit = useCallback(async () => {
    clearTimer();

    const next = valueRef.current;
    if (!dirtyRef.current || next === savedRef.current) {
      dirtyRef.current = false;
      setStatus("idle");
      return;
    }

    setStatus("saving");
    try {
      await onSaveRef.current(next);
      savedRef.current = next;
      dirtyRef.current = false;
      setStatus("saved");
    } catch {
      // The store rolls the value back and surfaces the error; keep the draft
      // so the reviewer can retry without retyping.
      dirtyRef.current = true;
      setStatus("error");
    }
  }, [clearTimer]);

  const update = useCallback(
    (next: string) => {
      setValue(next);
      dirtyRef.current = next !== savedRef.current;

      if (!dirtyRef.current) {
        clearTimer();
        setStatus("idle");
        return;
      }

      setStatus("dirty");
      clearTimer();
      timer.current = setTimeout(() => void commit(), delay);
    },
    [clearTimer, commit, delay],
  );

  /** Adopts an external value when the field is clean (post switch, rollback). */
  useEffect(() => {
    if (dirtyRef.current) return;
    setValue(initialValue);
    savedRef.current = initialValue;
  }, [initialValue]);

  // "Saved" is a receipt, not a state — retire it so the field goes quiet again.
  useEffect(() => {
    if (status !== "saved") return;
    const timeout = setTimeout(() => setStatus("idle"), savedFor);
    return () => clearTimeout(timeout);
  }, [status, savedFor]);

  useEffect(() => {
    return () => {
      if (dirtyRef.current) void onSaveRef.current(valueRef.current);
      if (timer.current !== null) clearTimeout(timer.current);
    };
  }, []);

  return {
    value,
    status,
    isDirty: status === "dirty" || status === "error",
    isSaving: status === "saving",
    update,
    flush: commit,
    /** Forces a server commit on the next flush, even for an unchanged value. */
    markDirty: () => {
      dirtyRef.current = true;
      setStatus("dirty");
    },
  } as const;
}
