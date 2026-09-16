"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  applyTheme,
  readStoredTheme,
  resolveTheme,
  storeTheme,
  systemTheme,
  type ResolvedTheme,
  type ThemePreference,
} from "@/lib/theme";

interface ThemeContextValue {
  /** What the user chose, which may be "system". */
  preference: ThemePreference;
  /** What is actually on screen. */
  theme: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
  /** Flips light ↔ dark and pins the choice, ignoring "system" from then on. */
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Theme state.
 *
 * The document attribute is already set by the boot script in the layout, so the
 * first paint is correct; this provider only keeps React in sync and persists
 * changes. `T` anywhere in the app flips it (see KeyboardShortcutsProvider) —
 * there is deliberately no button in the UI.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const [theme, setTheme] = useState<ResolvedTheme>("light");

  // Adopt whatever the boot script decided, then keep listening for the OS
  // flipping while the preference is "system".
  useEffect(() => {
    const stored = readStoredTheme();
    const resolved = resolveTheme(stored);
    setPreferenceState(stored);
    setTheme(resolved);
    applyTheme(resolved);
  }, []);

  useEffect(() => {
    if (preference !== "system" || typeof window === "undefined") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const next = systemTheme();
      setTheme(next);
      applyTheme(next);
    };

    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [preference]);

  const setPreference = useCallback((next: ThemePreference) => {
    const resolved = resolveTheme(next);
    setPreferenceState(next);
    setTheme(resolved);
    storeTheme(next);
    applyTheme(resolved);
  }, []);

  const toggle = useCallback(() => {
    const next: ResolvedTheme = resolveTheme(preference) === "dark" ? "light" : "dark";
    setPreference(next);
  }, [preference, setPreference]);

  const value = useMemo<ThemeContextValue>(
    () => ({ preference, theme, setPreference, toggle }),
    [preference, theme, setPreference, toggle],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside a ThemeProvider");
  return context;
}
