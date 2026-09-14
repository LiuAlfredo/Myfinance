import { Laptop, Moon, Sun } from "lucide-react";
import { useThemeStore, type ThemePreference } from "@/stores/theme-store";

const options: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "浅色", icon: Sun },
  { value: "dark", label: "深色", icon: Moon },
  { value: "system", label: "跟随系统", icon: Laptop },
];

export function ThemeSwitcher() {
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);

  return (
    <div className="inline-flex rounded-xl bg-[var(--surface-muted)] p-1" aria-label="主题设置">
      {options.map(({ value, label, icon: Icon }) => (
        <button
          aria-label={label}
          className={`flex size-8 items-center justify-center rounded-lg transition ${theme === value ? "bg-[var(--surface)] text-[var(--text)] shadow-sm" : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"}`}
          key={value}
          onClick={() => setTheme(value)}
          title={label}
          type="button"
        >
          <Icon className="size-4" />
        </button>
      ))}
    </div>
  );
}
