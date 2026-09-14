import {
  BarChart3, CreditCard, LayoutDashboard, ListTodo, PieChart, PlaneTakeoff, ReceiptText, Settings, WalletCards, CalendarClock, CircleDollarSign,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import type { ComponentType } from "react";
import type { NavigationItem } from "@/types/navigation";
import { useUiStore } from "@/stores/ui-store";

const financeItems: NavigationItem[] = [
  { label: "账户", to: "/accounts", icon: "accounts" },
  { label: "交易", to: "/transactions", icon: "transactions" },
  { label: "计划", to: "/planning", icon: "planning" },
  { label: "分期", to: "/installments", icon: "installments" },
  { label: "预算", to: "/budgets", icon: "budgets" },
  { label: "统计", to: "/statistics", icon: "statistics" },
  { label: "预测", to: "/forecast", icon: "forecast" },
  { label: "我能买这个吗？", to: "/purchase-check", icon: "purchase" },
];

const iconMap: Record<NavigationItem["icon"], ComponentType<{ className?: string }>> = {
  overview: LayoutDashboard,
  accounts: WalletCards,
  transactions: ReceiptText,
  planning: CalendarClock,
  installments: CreditCard,
  budgets: PieChart,
  statistics: BarChart3,
  forecast: PlaneTakeoff,
  settings: Settings,
  purchase: CircleDollarSign,
};

function NavigationLink({ item }: { item: NavigationItem }) {
  const Icon = iconMap[item.icon];
  const collapsed = useUiStore((state) => state.isSidebarCollapsed);
  return (
    <NavLink className={({ isActive }) => `sidebar-link ${isActive ? "sidebar-link-active" : ""}`} to={item.to} title={collapsed ? item.label : undefined}>
      <Icon className="size-[18px] shrink-0" />
      <span className="sidebar-label">{item.label}</span>
    </NavLink>
  );
}

export function AppSidebar() {
  const collapsed = useUiStore((state) => state.isSidebarCollapsed);

  return (
    <aside className={`sidebar ${collapsed ? "sidebar-collapsed" : ""}`}>
      <div className="flex h-14 items-center gap-3 px-4">
        <div className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-[var(--accent)] text-sm font-bold text-white shadow-sm">M</div>
        <span className="sidebar-brand">MyFinance</span>
      </div>
      <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-2 py-3" aria-label="主导航">
        <NavigationLink item={{ label: "总览", to: "/overview", icon: "overview" }} />
        <p className="sidebar-section">财务</p>
        {financeItems.map((item) => <NavigationLink item={item} key={item.to} />)}
        <div className="mt-auto pt-4">
          <p className="sidebar-section">偏好</p>
          <NavigationLink item={{ label: "设置", to: "/settings", icon: "settings" }} />
        </div>
      </nav>
      <div className="m-2 rounded-xl bg-[var(--surface-muted)] p-3 text-xs text-[var(--text-secondary)]">
        <ListTodo className="mb-2 size-4 text-[var(--accent)]" />
        <p className="sidebar-future-title">更多模块，敬请期待</p>
        <p className="sidebar-future-copy">任务、项目、笔记与日历将保持独立扩展。</p>
      </div>
    </aside>
  );
}
