import { create } from "zustand";

export type ThemePreference = "light" | "dark" | "system";

interface ThemeState {
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
}

const storageKey = "myfinance-theme";

export function getEffectiveTheme(theme: ThemePreference): "light" | "dark" {
  if (theme !== "system") return theme;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(theme: ThemePreference) {
  document.documentElement.dataset.theme = getEffectiveTheme(theme);
}

function initialTheme(): ThemePreference {
  const storedTheme = window.localStorage.getItem(storageKey);
  return storedTheme === "light" || storedTheme === "dark" || storedTheme === "system" ? storedTheme : "system";
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: initialTheme(),
  setTheme: (theme) => {
    window.localStorage.setItem(storageKey, theme);
    applyTheme(theme);
    set({ theme });
  },
}));
