import { useEffect, type ReactNode } from "react";
import { applyTheme, useThemeStore } from "@/stores/theme-store";

export function ThemeController({ children }: { children: ReactNode }) {
  const theme = useThemeStore((state) => state.theme);

  useEffect(() => {
    applyTheme(theme);
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const syncSystemTheme = () => theme === "system" && applyTheme(theme);
    query.addEventListener("change", syncSystemTheme);
    return () => query.removeEventListener("change", syncSystemTheme);
  }, [theme]);

  return <>{children}</>;
}
