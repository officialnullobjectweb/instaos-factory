"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Reads after mount so server and client markup stay identical, then keeps the
 * value in sync with localStorage.
 */
export function useLocalStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(initialValue);
  const [hydrated, setHydrated] = useState(false);
  const keyRef = useRef(key);

  useEffect(() => {
    keyRef.current = key;
  }, [key]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(keyRef.current);
      if (raw !== null) setValue(JSON.parse(raw) as T);
    } catch {
      // Ignore unreadable or malformed values and fall back to the default.
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(keyRef.current, JSON.stringify(value));
    } catch {
      // Storage can be unavailable (private mode) — preferences just won't persist.
    }
  }, [value, hydrated]);

  const reset = useCallback(() => setValue(initialValue), [initialValue]);

  return { value, setValue, hydrated, reset } as const;
}
