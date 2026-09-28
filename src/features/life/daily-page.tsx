import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSearchParams } from "react-router-dom";
import { CalendarBoard } from "./calendar-board";
import { TaskFilters } from "./task-filters";
import { emptyTaskFilter, filterTasks } from "./task-filter-model";
import { TaskDialog, EventDialog } from "./daily-dialogs";
import { TaskList } from "./task-list";
import { RoutineManager } from "./routine-manager";
import { getJourneyDashboard } from "@/features/journey/journey-service";
import type { JourneyProject } from "@/features/journey/types";
import { LifeShell } from "./life-shell";
import {
  getEvent,
  deleteTask,
  completeTaskTree,
  listTasks,
  localDay,
  setTaskStatus,
  type DailyEvent,
  type DailyTask,
} from "./life-service";
type View = "TODAY" | "INBOX" | "UPCOMING" | "ALL" | "COMPLETED" | "EVENTS";
export function DailyPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [view, setView] = useState<View>("TODAY"),
    [tasks, setTasks] = useState<DailyTask[]>([]),
    [projects, setProjects] = useState<JourneyProject[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [taskEdit, setTaskEdit] = useState<DailyTask | "new" | null>(null),
    [eventEdit, setEventEdit] = useState<DailyEvent | "new" | null>(null);
  const [month, setMonth] = useState(() => localDay().slice(0, 7)),
    [defaultProject, setDefaultProject] = useState<string | null>(null);
  const loadVersion = useRef(0);
  const [filter, setFilter] = useState(emptyTaskFilter),
    [eventDay, setEventDay] = useState(localDay());
  const load = useCallback(async () => {
    const request = ++loadVersion.current;
    setLoading(true);
    setError("");
    try {
      const [all, journey] = await Promise.allSettled([
        listTasks("ALL"),
        getJourneyDashboard(),
      ]);
      if (request !== loadVersion.current) return;
      if (all.status === "fulfilled") setTasks(all.value);
      if (journey.status === "fulfilled") setProjects(journey.value.projects);
      const failures = [all, journey].filter((r) => r.status === "rejected");
      if (failures.length)
        setError(
          failures
            .map((r) => (r.status === "rejected" ? String(r.reason) : ""))
            .join("；"),
        );
    } catch (e) {
      if (request === loadVersion.current)
        setError(e instanceof Error ? e.message : "读取失败");
    } finally {
      if (request === loadVersion.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    const version = loadVersion;
    void load();
    const refresh = () => void load();
    window.addEventListener("focus", refresh);
    const timer = setInterval(refresh, 60000);
    return () => {
      version.current++;
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [load]);
  useEffect(() => {
    if (searchParams.get("new") === "task") {
      setDefaultProject(searchParams.get("project"));
      setTaskEdit("new");
      setSearchParams({}, { replace: true });
    } else if (searchParams.get("new") === "event") {
      setEventEdit("new");
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);
  useEffect(() => {
    if (searchParams.get("view") === "EVENTS") {
      setView("EVENTS");
      if (!searchParams.get("event")) setSearchParams({}, { replace: true });
    }
    const id = searchParams.get("task");
    if (id && tasks.length) {
      const task = tasks.find((t) => t.id === id);
      if (task) {
        setView("ALL");
        setTaskEdit(task);
        setSearchParams({}, { replace: true });
      }
    }
  }, [searchParams, setSearchParams, tasks]);
  useEffect(() => {
    const id = searchParams.get("event");
    if (!id) return;
    let active = true;
    void getEvent(id)
      .then((event) => {
        if (!active) return;
        const day =
          event.dayKey ||
          (event.startsAt ? localDay(new Date(event.startsAt)) : localDay());
        setView("EVENTS");
        setMonth(day.slice(0, 7));
        setEventDay(day);
        setEventEdit(event);
        setSearchParams({}, { replace: true });
      })
      .catch((e) => {
        if (active) {
          setError(e.message);
          setSearchParams({}, { replace: true });
        }
      });
    return () => {
      active = false;
    };
  }, [searchParams, setSearchParams]);
  const baseVisible = useMemo(() => {
    const today = localDay(),
      start = new Date().setHours(0, 0, 0, 0),
      end = start + 86400000;
    if (view === "TODAY")
      return tasks.filter(
        (t) =>
          t.status !== "DONE" &&
          t.status !== "CANCELLED" &&
          (t.plannedDay === today || (t.dueAt !== null && t.dueAt < end)),
      );
    if (view === "UPCOMING")
      return tasks.filter(
        (t) =>
          t.status !== "DONE" &&
          t.status !== "CANCELLED" &&
          ((t.plannedDay && t.plannedDay > today) ||
            (t.dueAt !== null && t.dueAt >= end)),
      );
    if (view === "INBOX")
      return tasks.filter(
        (t) =>
          ["TODO", "ACTIVE"].includes(t.status) &&
          !t.plannedDay &&
          t.dueAt === null,
      );
    if (view === "COMPLETED") return tasks.filter((t) => t.status === "DONE");
    return tasks;
  }, [tasks, view]);
  const visible = useMemo(
    () => filterTasks(baseVisible, filter),
    [baseVisible, filter],
  );
  const act = async (work: Promise<unknown>) => {
    try {
      await work;
      await load();
      window.dispatchEvent(new Event("life-data-changed"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败");
    }
  };
  return (
    <LifeShell
      eyebrow="03 · DAILY"
      title="日常事务"
      description="收集任务、安排日期，并管理生活日程。"
      action={
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setEventEdit("new")}>
            <CalendarDays className="size-4" />
            新建日程
          </Button>
          <Button
            onClick={() => {
              setDefaultProject(null);
              setTaskEdit("new");
            }}
          >
            <Plus className="size-4" />
            添加任务
          </Button>
        </div>
      }
    >
      <nav className="journey-tabs" aria-label="日常事务视图">
        {(
          ["TODAY", "INBOX", "UPCOMING", "ALL", "COMPLETED", "EVENTS"] as View[]
        ).map((x) => (
          <button
            key={x}
            className={view === x ? "journey-tab-active" : ""}
            onClick={() => setView(x)}
          >
            {x === "TODAY"
              ? "今天"
              : x === "INBOX"
                ? "收集箱"
                : x === "UPCOMING"
                  ? "即将到期"
                  : x === "ALL"
                    ? "全部任务"
                    : x === "COMPLETED"
                      ? "已完成"
                      : "日程"}
          </button>
        ))}
      </nav>
      {view === "EVENTS" && (
        <label className="form-label mt-4">
          日程月份
          <input
            aria-label="日程月份"
            className="form-control"
            type="month"
            min="1900-01"
            value={month}
            onChange={(e) => {
              if (e.target.value) setMonth(e.target.value);
            }}
          />
        </label>
      )}
      {view !== "EVENTS" && (
        <TaskFilters value={filter} onChange={setFilter} projects={projects} />
      )}
      {error && (
        <div className="journey-error flex justify-between">
          {error}
          <button onClick={() => void load()}>重试</button>
        </div>
      )}
      {view !== "EVENTS" && loading ? (
        <p className="py-14 text-center text-sm text-[var(--text-secondary)]">
          正在整理…
        </p>
      ) : view === "EVENTS" ? (
        <CalendarBoard
          month={month}
          onMonth={setMonth}
          onEdit={setEventEdit}
          onNew={(day) => {
            setEventDay(day);
            setEventEdit("new");
          }}
        />
      ) : (
        <TaskList
          tasks={visible}
          onEdit={setTaskEdit}
          onStatus={(id, status) => {
            const t = tasks.find((t) => t.id === id);
            if (status === "DONE" && t?.childCount) {
              const children = confirm(
                "此任务有子任务。确定：同时完成全部未完成子任务；取消：只完成父任务。",
              );
              void act(completeTaskTree(id, status, children));
            } else void act(setTaskStatus(id, status));
          }}
          onDelete={(task) => {
            if (
              window.confirm(
                task.childCount
                  ? `删除此任务及其全部子任务？（直接子任务 ${task.childCount} 个）`
                  : "删除此任务？",
              )
            )
              void act(deleteTask(task.id));
          }}
        />
      )}
      <TaskDialog
        key={`task-${taskEdit === null ? "closed" : taskEdit === "new" ? "new" : taskEdit.id}`}
        defaultProject={defaultProject}
        open={taskEdit !== null}
        task={taskEdit === "new" ? null : taskEdit}
        tasks={tasks}
        projects={projects}
        onClose={() => setTaskEdit(null)}
        onSaved={() => {
          setTaskEdit(null);
          setView("ALL");
          window.dispatchEvent(new Event("life-data-changed"));
          void load();
        }}
      />
      <EventDialog
        defaultDay={eventDay}
        key={`event-${eventEdit === null ? "closed" : eventEdit === "new" ? "new" : eventEdit.id}`}
        open={eventEdit !== null}
        event={eventEdit === "new" ? null : eventEdit}
        onClose={() => setEventEdit(null)}
        onSaved={(day) => {
          setEventEdit(null);
          setView("EVENTS");
          setMonth(day.slice(0, 7));
          window.dispatchEvent(new Event("life-data-changed"));
          void load();
        }}
      />
      <RoutineManager projects={projects} onChanged={() => void load()} />
    </LifeShell>
  );
}
