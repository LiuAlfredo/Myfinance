import { useState } from "react";
import { Check, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DailyTask, TaskStatus } from "./life-service";
export function TaskList({
  tasks,
  onEdit,
  onStatus,
  onDelete,
}: {
  tasks: DailyTask[];
  onEdit: (t: DailyTask) => void;
  onStatus: (id: string, s: TaskStatus) => void;
  onDelete: (t: DailyTask) => void;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const taskIds = new Set(tasks.map((t) => t.id)),
    seen = new Set<string>(),
    ordered: Array<{ task: DailyTask; depth: number }> = [];
  const visit = (task: DailyTask, depth: number) => {
    if (seen.has(task.id)) return;
    seen.add(task.id);
    ordered.push({ task, depth });
    if (!collapsed.has(task.id))
      tasks
        .filter((t) => t.parentId === task.id)
        .forEach((t) => visit(t, depth + 1));
  };
  tasks
    .filter((t) => !t.parentId || !taskIds.has(t.parentId))
    .forEach((t) => visit(t, 0));
  const visible = ordered;
  return (
    <div className="content-card mt-5 divide-y divide-[var(--border)]">
      {visible.map(({ task: t, depth }) => (
        <article
          key={t.id}
          className="flex flex-wrap items-center justify-between gap-3 py-4"
        >
          <div
            className="min-w-0"
            style={{ paddingLeft: Math.min(depth, 6) * 24 }}
          >
            {t.parentId && (
              <p className="text-xs text-[var(--text-tertiary)]">
                子任务 ·{" "}
                {tasks.find((p) => p.id === t.parentId)?.title ??
                  "父任务在其他视图"}
              </p>
            )}
            <div className="flex items-center gap-2">
              {tasks.some((c) => c.parentId === t.id) && (
                <button
                  aria-label={collapsed.has(t.id) ? "展开子任务" : "收起子任务"}
                  onClick={() =>
                    setCollapsed((current) => {
                      const next = new Set(current);
                      if (next.has(t.id)) next.delete(t.id);
                      else next.add(t.id);
                      return next;
                    })
                  }
                >
                  {collapsed.has(t.id) ? "▸" : "▾"}
                </button>
              )}
              <span
                className={`size-2 rounded-full ${t.priority === "URGENT" ? "bg-[var(--danger)]" : t.priority === "IMPORTANT" ? "bg-[var(--warning)]" : "bg-[var(--accent)]"}`}
              />
              <p
                className={
                  t.status === "DONE"
                    ? "line-through text-[var(--text-tertiary)]"
                    : "font-medium text-[var(--text)]"
                }
              >
                {t.title}
              </p>
            </div>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              {t.plannedDay || "未安排"}
              {t.dueAt
                ? ` · 截止 ${new Date(t.dueAt).toLocaleString("zh-CN")}`
                : ""}
              {t.projectTitle ? ` · ${t.projectTitle}` : ""}
              {t.childCount ? ` · ${t.childCount} 个子任务` : ""}
            </p>
          </div>
          <div className="flex gap-2">
            {t.status === "CANCELLED" ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onStatus(t.id, "TODO")}
              >
                重新启用
              </Button>
            ) : t.status === "DONE" ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => onStatus(t.id, "TODO")}
              >
                <RotateCcw className="size-4" />
                撤销
              </Button>
            ) : (
              <Button size="sm" onClick={() => onStatus(t.id, "DONE")}>
                <Check className="size-4" />
                完成
              </Button>
            )}
            <Button
              size="icon"
              variant="ghost"
              aria-label="编辑任务"
              onClick={() => onEdit(t)}
            >
              <Pencil className="size-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              aria-label="删除任务"
              onClick={() => onDelete(t)}
            >
              <Trash2 className="size-4 text-[var(--danger)]" />
            </Button>
          </div>
        </article>
      ))}
      {!tasks.length && (
        <p className="py-12 text-center text-sm text-[var(--text-secondary)]">
          这里还没有内容，可以添加第一项任务。
        </p>
      )}
    </div>
  );
}
