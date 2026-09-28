import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  CalendarDays,
  Check,
  ChevronRight,
  Eye,
  EyeOff,
  FilePlus2,
  Grid2X2,
  ListTodo,
  Pin,
  Plus,
  RefreshCw,
  WalletCards,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useUiStore } from "@/stores/ui-store";
import { Button } from "@/components/ui/button";
import { ThemeSwitcher } from "@/components/theme-switcher";
import {
  getTodaySection,
  type TodaySectionKey,
  getToday,
  localDay,
  pinTodayProject,
  setTaskStatus,
  type TodaySummary,
} from "./life-service";
import { ProjectFocus } from "./project-focus";
import { workspaceCall } from "./workspace-service";
import type { Subscription } from "./subscription-panel";
export function TodayPage() {
  const loadVersion = useRef(0);
  const retries = useRef<Partial<Record<TodaySectionKey, number>>>({});
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const setNewTransactionOpen = useUiStore((s) => s.setNewTransactionOpen);
  const [completed, setCompleted] = useState<{
    id: string;
    status: "TODO" | "ACTIVE";
  } | null>(null);
  const navigate = useNavigate(),
    [data, setData] = useState<TodaySummary | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [showMoney, setShowMoney] = useState(
      () => localStorage.getItem("today:show-money") !== "false",
    );
  const load = useCallback(async () => {
    const now = new Date(),
      start = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
      ).getTime();
    const request = ++loadVersion.current;
    setLoading(true);
    try {
      const next = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
      ).getTime();
      const value = await getToday(localDay(now), start, next);
      if (request !== loadVersion.current) return;
      setData(value);
      if ("__TAURI_INTERNALS__" in window)
        void workspaceCall<Subscription[]>("list_subscriptions")
          .then((rows) => {
            if (request === loadVersion.current) setSubscriptions(rows);
          })
          .catch((e) => {
            if (request === loadVersion.current) setError(String(e));
          });
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "今日数据读取失败");
    } finally {
      if (request === loadVersion.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    const version = loadVersion;
    void load();
    let day = localDay();
    const refresh = () => void load(),
      check = () => {
        if (localDay() !== day) {
          day = localDay();
          void load();
        }
      };
    window.addEventListener("focus", refresh);
    window.addEventListener("life-data-changed", refresh);
    window.addEventListener("finance-data-changed", refresh);
    const timer = setInterval(check, 60000);
    return () => {
      version.current++;
      window.removeEventListener("focus", refresh);
      window.removeEventListener("life-data-changed", refresh);
      window.removeEventListener("finance-data-changed", refresh);
      clearInterval(timer);
    };
  }, [load]);
  const retry = async (key: TodaySectionKey) => {
    const generation = loadVersion.current,
      request = (retries.current[key] ?? 0) + 1;
    retries.current[key] = request;
    const date = new Date(),
      start = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
      ).getTime(),
      end = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate() + 1,
      ).getTime();
    try {
      const update = await getTodaySection(key, localDay(date), start, end);
      if (
        generation !== loadVersion.current ||
        retries.current[key] !== request
      )
        return;
      setData((current) =>
        current
          ? {
              ...current,
              ...update,
              errors: { ...current.errors, [key]: undefined },
            }
          : current,
      );
    } catch (e) {
      if (
        generation !== loadVersion.current ||
        retries.current[key] !== request
      )
        return;
      setData((current) =>
        current
          ? {
              ...current,
              errors: {
                ...current.errors,
                [key]: e instanceof Error ? e.message : String(e),
              },
            }
          : current,
      );
    }
  };
  const money = (amount: number, currency = "CNY") =>
    showMoney
      ? new Intl.NumberFormat("zh-CN", {
          style: "currency",
          currency,
        }).format(amount / 100)
      : "••••";
  const complete = async (id: string) => {
    try {
      const previous = data?.tasks.find((t) => t.id === id);
      await setTaskStatus(id, "DONE");
      setCompleted({
        id,
        status: previous?.status === "ACTIVE" ? "ACTIVE" : "TODO",
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "完成失败");
    }
  };
  const now = new Date();
  return (
    <main className="modules-screen">
      <header className="modules-header">
        <div>
          <p className="text-sm font-semibold">My Personal Affairs</p>
          <p className="text-xs text-[var(--text-tertiary)]">今日首页</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => navigate("/modules")}>
            <Grid2X2 className="size-4" />
            全部模块
          </Button>
          <Button variant="ghost" onClick={() => navigate("/search")}>
            搜索
          </Button>
          <ThemeSwitcher />
        </div>
      </header>
      <div className="mx-auto w-full max-w-6xl px-5 py-10 md:py-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="entry-eyebrow">TODAY · {localDay(now)}</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-[-.045em]">
              {now.toLocaleDateString("zh-CN", {
                month: "long",
                day: "numeric",
                weekday: "long",
              })}
            </h1>
            <p className="mt-3 text-sm text-[var(--text-secondary)]">
              {data?.errors?.tasks
                ? "今日任务暂时未能读取"
                : data
                  ? `今天有 ${data.tasks.length} 项待处理任务${data.overdueCount ? `，其中 ${data.overdueCount} 项已逾期` : ""}`
                  : "整理今天最重要的事情。"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                navigate("/finance/transactions");
                setNewTransactionOpen(true);
              }}
            >
              <WalletCards className="size-4" />
              快速记账
            </Button>
            <Button
              variant="secondary"
              onClick={() => navigate("/knowledge?new=1")}
            >
              <FilePlus2 className="size-4" />
              写笔记
            </Button>
            <Button onClick={() => navigate("/daily?new=task")}>
              <Plus className="size-4" />
              添加任务
            </Button>
          </div>
        </div>
        {completed && (
          <div className="mt-4">
            任务已完成{" "}
            <Button
              variant="ghost"
              onClick={() =>
                void setTaskStatus(completed.id, completed.status)
                  .then(() => {
                    setCompleted(null);
                    return load();
                  })
                  .catch((e) => setError(e.message))
              }
            >
              撤销完成
            </Button>
          </div>
        )}
        {error && (
          <div className="journey-error flex justify-between">
            {error}
            <Button size="sm" variant="ghost" onClick={() => void load()}>
              <RefreshCw className="size-4" />
              重试
            </Button>
          </div>
        )}
        {loading && !data ? (
          <p className="py-16 text-center text-sm text-[var(--text-secondary)]">
            正在准备今日安排…
          </p>
        ) : data ? (
          <div className="mt-7 grid gap-5 lg:grid-cols-[1.45fr_.8fr]">
            <div className="space-y-5">
              <Card
                error={data.errors?.tasks}
                onRetry={() => void retry("tasks")}
                title="今日任务"
                action={() => navigate("/daily")}
                icon={<ListTodo className="size-4" />}
              >
                {data.tasks.length > 8 && (
                  <p className="text-xs">
                    展示前 8 项，共 {data.tasks.length} 项
                  </p>
                )}
                {data.tasks.slice(0, 8).map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between gap-3 border-t border-[var(--border)] py-3 first:border-0"
                  >
                    <div>
                      <button
                        className="font-medium"
                        onClick={() => navigate(`/daily?task=${t.id}`)}
                      >
                        {t.title}
                      </button>
                      <p
                        className={`mt-1 text-xs ${t.dueAt && t.dueAt < Date.now() ? "text-[var(--danger)]" : "text-[var(--text-secondary)]"}`}
                      >
                        {t.dueAt
                          ? new Date(t.dueAt).toLocaleString("zh-CN")
                          : t.plannedDay || "今日计划"}
                        {t.projectTitle ? ` · ${t.projectTitle}` : ""}
                      </p>
                    </div>
                    <Button size="sm" onClick={() => void complete(t.id)}>
                      <Check className="size-4" />
                      完成
                    </Button>
                  </div>
                ))}
                {!data.tasks.length && (
                  <Empty text="今天没有待办，给自己留一点从容。" />
                )}
              </Card>
              <Card
                error={data.errors?.events}
                onRetry={() => void retry("events")}
                title="今日日程"
                action={() => navigate("/daily?view=EVENTS")}
                icon={<CalendarDays className="size-4" />}
              >
                {data.events.map((e) => (
                  <div
                    key={e.id}
                    className="border-t border-[var(--border)] py-3 first:border-0"
                  >
                    <button
                      className="font-medium"
                      onClick={() =>
                        navigate(`/daily?view=EVENTS&event=${e.id}`)
                      }
                    >
                      {e.title}
                    </button>
                    <p className="mt-1 text-xs text-[var(--text-secondary)]">
                      {e.allDay
                        ? "全天"
                        : e.startsAt
                          ? new Date(e.startsAt).toLocaleTimeString("zh-CN", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : ""}
                      {e.location ? ` · ${e.location}` : ""}
                    </p>
                  </div>
                ))}
                {!data.events.length && <Empty text="今天没有日程安排。" />}
              </Card>
            </div>
            <div className="space-y-5">
              <Card
                error={data.errors?.plannedExpenses}
                onRetry={() => void retry("plannedExpenses")}
                title="需要处理"
                action={() => navigate("/finance/planning")}
                icon={<WalletCards className="size-4" />}
                extra={
                  <button
                    aria-label={showMoney ? "隐藏金额" : "显示金额"}
                    onClick={() => {
                      const next = !showMoney;
                      setShowMoney(next);
                      localStorage.setItem("today:show-money", String(next));
                    }}
                  >
                    {showMoney ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                }
              >
                {data.plannedExpenses.map((x) => (
                  <div
                    key={x.id}
                    className="flex justify-between border-t border-[var(--border)] py-3 first:border-0"
                  >
                    <div>
                      <button
                        className="font-medium"
                        onClick={() =>
                          navigate(`/finance/planning?planned=${x.id}`)
                        }
                      >
                        {x.title}
                      </button>
                      <p className="mt-1 text-xs text-[var(--text-secondary)]">
                        {new Date(x.plannedDate).toLocaleDateString("zh-CN")}
                      </p>
                    </div>
                    <strong className="text-[var(--danger)]">
                      {money(x.amount, x.currency)}
                    </strong>
                  </div>
                ))}
                {!data.plannedExpenses.length && (
                  <Empty text="未来七天没有计划支出。" />
                )}
              </Card>
              <Card
                error={data.errors?.projects}
                onRetry={() => void retry("projects")}
                title="重点项目"
                action={() => navigate("/journey")}
                icon={<Pin className="size-4" />}
                extra={<ProjectFocus onChanged={load} />}
              >
                {data.projects.map((p) => (
                  <div
                    key={p.id}
                    className="border-t border-[var(--border)] py-3 first:border-0"
                  >
                    <div className="flex justify-between">
                      <button
                        className="font-medium"
                        onClick={() => navigate(`/journey?project=${p.id}`)}
                      >
                        {p.title}
                      </button>
                      <button
                        className={
                          p.isPinned
                            ? "text-[var(--accent)]"
                            : "text-[var(--text-tertiary)]"
                        }
                        aria-label={
                          p.isPinned ? "取消重点项目" : "设为重点项目"
                        }
                        onClick={() =>
                          void pinTodayProject(p.id, !p.isPinned)
                            .then(load)
                            .catch((e) => setError(e.message))
                        }
                      >
                        <Pin className="size-4" />
                      </button>
                    </div>
                    <div className="mt-2 h-1.5 rounded-full bg-[var(--surface-muted)]">
                      <span
                        className="block h-full rounded-full"
                        style={{
                          width: `${p.progress}%`,
                          background: p.accent,
                        }}
                      />
                    </div>
                  </div>
                ))}
                {!data.projects.length && (
                  <Empty text="Journey 中还没有进行中的项目。" />
                )}
              </Card>
            </div>
          </div>
        ) : null}
        {subscriptions
          .filter(
            (s) =>
              s.status === "ACTIVE" &&
              new Date(`${s.nextDay}T00:00:00`).getTime() - Date.now() <=
                s.reminderDays * 86400000,
          )
          .map((s) => (
            <button
              key={s.id}
              className="content-card mt-4 block w-full text-left"
              onClick={() => navigate(`/finance/planning?subscription=${s.id}`)}
            >
              续费提醒：{s.title} · {s.nextDay} ·{" "}
              {showMoney
                ? `${s.currency} ${(s.amount / 100).toFixed(2)}`
                : "••••"}
            </button>
          ))}
      </div>
    </main>
  );
}
function Card({
  error,
  onRetry,
  title,
  icon,
  action,
  extra,
  children,
}: {
  error?: string;
  onRetry: () => void;
  title: string;
  icon: ReactNode;
  action: () => void;
  extra?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="content-card">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 font-semibold">
          {icon}
          {title}
        </div>
        <div className="flex items-center gap-3">
          {extra}
          <button
            className="flex items-center text-xs text-[var(--accent)]"
            onClick={action}
          >
            查看全部
            <ChevronRight className="size-3" />
          </button>
        </div>
      </div>
      {error ? (
        <div role="alert">
          {error}
          <Button size="sm" onClick={onRetry}>
            重试此区域
          </Button>
        </div>
      ) : (
        children
      )}
    </section>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <p className="py-7 text-center text-sm text-[var(--text-secondary)]">
      {text}
    </p>
  );
}
