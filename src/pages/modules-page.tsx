import {
  ArrowRight,
  CalendarDays,
  CheckSquare2,
  FileText,
  FolderKanban,
  LogOut,
  LockKeyhole,
  WalletCards,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth-store";

const modules = [
  {
    number: "01",
    name: "MyFinance",
    description: "管理账户、收支、预算、计划与未来现金流。",
    icon: WalletCards,
    available: true,
    to: "/finance/overview",
  },
  {
    number: "02",
    name: "My Journey",
    description: "管理工作项目、个人项目、灵感与长期目标。",
    icon: FolderKanban,
    available: true,
    to: "/journey",
  },
  {
    number: "03",
    name: "日常事务",
    description: "收集任务、安排日期并管理生活日程。",
    icon: CheckSquare2,
    available: true,
    to: "/daily",
  },
  {
    number: "04",
    name: "生活资料",
    description: "保存笔记、资料，并关联项目或任务。",
    icon: FileText,
    available: true,
    to: "/knowledge",
  },
  {
    number: "05",
    name: "私密日历",
    description: "以加密日历记录私密日期、姓名与地点。",
    icon: CalendarDays,
    available: true,
    to: "/private-calendar",
  },
  {
    number: "06",
    name: "密码与安全",
    description: "修改软件密码并加密保存其他平台的密码记录。",
    icon: LockKeyhole,
    available: true,
    to: "/personal-settings",
  },
];

export function ModulesPage() {
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();

  return (
    <main className="modules-screen">
      <header className="modules-header">
        <div className="flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded-xl bg-[var(--accent)] font-bold text-white shadow-sm">P</div>
          <div>
            <p className="text-sm font-semibold text-[var(--text)]">My Personal Affairs</p>
            <p className="text-xs text-[var(--text-tertiary)]">Personal workspace</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => navigate("/today")}>今日首页</Button>
          <ThemeSwitcher />
          <Button
            variant="ghost"
            onClick={() => {
              void logout().then(() => navigate("/login", { replace: true }));
            }}
          >
            <LogOut className="size-4" />
            退出
          </Button>
        </div>
      </header>

      <div className="modules-content">
        <div className="max-w-2xl">
          <p className="entry-eyebrow">MODULES</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.045em] text-[var(--text)]">选择一个模块</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
            从今日首页进入每天的行动，也可以打开全部模块管理各类生活信息。
          </p>
        </div>

        <div className="modules-grid">
          {modules.map((module) => {
            const Icon = module.icon;
            return (
              <button
                key={module.number}
                type="button"
                className={`module-card ${module.available ? "module-card-active" : "module-card-disabled"}`}
                disabled={!module.available}
                onClick={() => module.available && navigate(module.to)}
              >
                <div className="flex items-start justify-between gap-4">
                  <span className="module-icon"><Icon className="size-5" /></span>
                  <span className="module-number">{module.number}</span>
                </div>
                <div className="mt-8 text-left">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-[var(--text)]">{module.name}</h2>
                    {!module.available ? <span className="module-soon">即将推出</span> : null}
                  </div>
                  <p className="mt-2 min-h-10 text-sm leading-5 text-[var(--text-secondary)]">{module.description}</p>
                </div>
                <div className="mt-5 flex items-center justify-between text-xs font-semibold">
                  <span>{module.available ? "进入模块" : "暂不可用"}</span>
                  {module.available ? <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" /> : null}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </main>
  );
}
