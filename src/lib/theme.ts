export const THEME_STORAGE_KEY = "factory-os.theme";

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

/**
 * Runs before the app paints, so a dark-mode user never sees a white flash.
 * Kept as a string because it has to be inlined into the document head — it
 * cannot import anything or wait for React.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{
var stored=localStorage.getItem("${THEME_STORAGE_KEY}");
var prefersDark=window.matchMedia("(prefers-color-scheme: dark)").matches;
var theme=stored==="light"||stored==="dark"?stored:(prefersDark?"dark":"light");
var root=document.documentElement;
root.dataset.theme=theme;
root.style.colorScheme=theme;
}catch(error){}})();`;

export function readStoredTheme(): ThemePreference {
  if (typeof window === "undefined") return "system";
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return stored === "light" || stored === "dark" || stored === "system"
    ? stored
    : "system";
}

export function systemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  return preference === "system" ? systemTheme() : preference;
}

/** Applies the theme to the document and keeps `color-scheme` in sync. */
export function applyTheme(theme: ResolvedTheme) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export function storeTheme(preference: ThemePreference) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(THEME_STORAGE_KEY, preference);
}
