import { Menu, Plus, Search } from "lucide-react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { useUiStore } from "@/stores/ui-store";

const pageTitles: Record<string, string> = {
  "/overview": "总览",
  "/accounts": "账户",
  "/transactions": "交易",
  "/planning": "计划",
  "/installments": "分期",
  "/budgets": "预算",
  "/statistics": "统计",
  "/forecast": "预测",
  "/settings": "设置",
  "/purchase-check": "我能买这个吗？",
};

export function AppHeader() {
  const { pathname } = useLocation();
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);
  const setNewTransactionOpen = useUiStore((state) => state.setNewTransactionOpen);
  const setCommandPaletteOpen = useUiStore((state) => state.setCommandPaletteOpen);

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-[var(--border)] bg-[color:var(--surface)/.72] px-4 backdrop-blur-xl md:px-7">
      <div className="flex items-center gap-3">
        <Button aria-label="折叠侧边栏" variant="ghost" size="icon" onClick={toggleSidebar}>
          <Menu className="size-5" />
        </Button>
        <h1 className="text-lg font-semibold tracking-tight text-[var(--text)]">{pageTitles[pathname] ?? "MyFinance"}</h1>
      </div>
      <div className="flex items-center gap-2">
        <Button className="hidden sm:inline-flex" variant="secondary" onClick={() => setCommandPaletteOpen(true)}>
          <Search className="size-4" />
          搜索 <kbd className="ml-2 rounded bg-[var(--surface)] px-1.5 py-0.5 text-[10px] text-[var(--text-tertiary)]">Ctrl K</kbd>
        </Button>
        <ThemeSwitcher />
        <Button onClick={() => setNewTransactionOpen(true)}>
          <Plus className="size-4" />
          <span className="hidden sm:inline">新建交易</span>
        </Button>
      </div>
    </header>
  );
}
