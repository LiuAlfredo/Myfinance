import { RelatedTaskNotes } from "./related-task-notes";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { JourneyProject } from "@/features/journey/types";
import {
  deleteEvent,
  saveEvent,
  saveTask,
  type DailyEvent,
  type DailyTask,
  type DailyTaskInput,
  type TaskStatus,
} from "./life-service";
export function TaskDialog({
  defaultProject,
  open,
  task,
  tasks,
  projects,
  onClose,
  onSaved,
}: {
  defaultProject: string | null;
  open: boolean;
  task: DailyTask | null;
  tasks: DailyTask[];
  projects: JourneyProject[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [project, setProject] = useState(
    task?.projectId || defaultProject || "",
  );
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    const d = new FormData(e.currentTarget),
      due = String(d.get("due"));
    setBusy(true);
    setError("");
    void saveTask(
      {
        title: String(d.get("title")),
        note: String(d.get("note")),
        status: String(d.get("status")) as TaskStatus,
        priority: String(d.get("priority")) as DailyTaskInput["priority"],
        plannedDay: String(d.get("plannedDay")) || null,
        dueAt: due ? new Date(due).getTime() : null,
        projectId: project || null,
        parentId: String(d.get("parentId")) || null,
        includeChildren:
          String(d.get("status")) === "DONE" &&
          !!task?.childCount &&
          confirm("同时完成所有尚未结束的子任务？取消则只完成当前任务。"),
      },
      task?.id,
    )
      .then(onSaved)
      .catch((x) => setError(x.message))
      .finally(() => {
        submitting.current = false;
        setBusy(false);
      });
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(x) => !x && !busy && onClose()}
      title={task ? "编辑任务" : "添加任务"}
    >
      <form className="space-y-3" onSubmit={submit}>
        <label className="form-label">
          标题
          <input
            className="form-control"
            name="title"
            required
            defaultValue={task?.title}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="form-label">
            状态
            <select
              className="form-control"
              name="status"
              defaultValue={task?.status || "TODO"}
            >
              <option value="TODO">待处理</option>
              <option value="ACTIVE">进行中</option>
              <option value="DONE">已完成</option>
              <option value="CANCELLED">已取消</option>
            </select>
          </label>
          <label className="form-label">
            优先级
            <select
              className="form-control"
              name="priority"
              defaultValue={task?.priority || "NORMAL"}
            >
              <option value="NORMAL">普通</option>
              <option value="IMPORTANT">重要</option>
              <option value="URGENT">紧急</option>
            </select>
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="form-label">
            计划日期
            <input
              className="form-control"
              type="date"
              name="plannedDay"
              defaultValue={task?.plannedDay || ""}
            />
          </label>
          <label className="form-label">
            截止时间
            <input
              className="form-control"
              type="datetime-local"
              name="due"
              defaultValue={
                task?.dueAt
                  ? new Date(
                      task.dueAt -
                        new Date(task.dueAt).getTimezoneOffset() * 60000,
                    )
                      .toISOString()
                      .slice(0, 16)
                  : ""
              }
            />
          </label>
        </div>
        <label className="form-label">
          关联项目
          <select
            className="form-control"
            name="projectId"
            value={project}
            onChange={(e) => setProject(e.target.value)}
          >
            <option value="">无</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </label>
        <label className="form-label">
          父任务
          <select
            className="form-control"
            name="parentId"
            defaultValue={task?.parentId || ""}
          >
            <option value="">无</option>
            {tasks
              .filter(
                (x) =>
                  x.id !== task?.id &&
                  (x.parentId === null || x.id === task?.parentId),
              )
              .map((x) => (
                <option key={x.id} value={x.id}>
                  {x.title}
                </option>
              ))}
          </select>
        </label>
        <label className="form-label">
          备注
          <textarea
            className="form-control"
            name="note"
            rows={3}
            defaultValue={task?.note}
          />
        </label>
        {task && <RelatedTaskNotes taskId={task.id} />}
        {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={onClose}
          >
            取消
          </Button>
          <Button disabled={busy}>{busy ? "保存中…" : "保存"}</Button>
        </div>
      </form>
    </Dialog>
  );
}
export function EventDialog({
  defaultDay,
  open,
  event,
  onClose,
  onSaved,
}: {
  open: boolean;
  event: DailyEvent | null;
  defaultDay: string;
  onClose: () => void;
  onSaved: (day: string) => void;
}) {
  const [allDay, setAllDay] = useState(event?.allDay ?? true),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  useEffect(() => setAllDay(event?.allDay ?? true), [event]);
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    const d = new FormData(e.currentTarget),
      start = String(d.get("start")),
      end = String(d.get("end"));
    void saveEvent(
      {
        title: String(d.get("title")),
        allDay,
        dayKey: allDay ? String(d.get("day")) : null,
        startsAt: !allDay ? new Date(start).getTime() : null,
        endsAt: !allDay ? new Date(end).getTime() : null,
        location: String(d.get("location")),
        note: String(d.get("note")),
      },
      event?.id,
    )
      .then(() => onSaved(allDay ? String(d.get("day")) : start.slice(0, 10)))
      .catch((x) => setError(x.message))
      .finally(() => {
        submitting.current = false;
        setBusy(false);
      });
  };
  const local = (n: number | null) =>
    n
      ? new Date(n - new Date(n).getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16)
      : "";
  return (
    <Dialog
      open={open}
      onOpenChange={(x) => !x && !busy && onClose()}
      title={event ? "编辑日程" : "新建日程"}
    >
      <form className="space-y-3" onSubmit={submit}>
        <label className="form-label">
          标题
          <input
            className="form-control"
            name="title"
            required
            defaultValue={event?.title}
          />
        </label>
        <label className="flex gap-2 text-sm">
          <input
            type="checkbox"
            checked={allDay}
            onChange={(e) => setAllDay(e.target.checked)}
          />
          全天事项
        </label>
        {allDay ? (
          <label className="form-label">
            日期
            <input
              className="form-control"
              type="date"
              name="day"
              required
              defaultValue={event?.dayKey || defaultDay}
            />
          </label>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <label className="form-label">
              开始
              <input
                className="form-control"
                type="datetime-local"
                name="start"
                required
                defaultValue={local(event?.startsAt ?? null)}
              />
            </label>
            <label className="form-label">
              结束
              <input
                className="form-control"
                type="datetime-local"
                name="end"
                required
                defaultValue={local(event?.endsAt ?? null)}
              />
            </label>
          </div>
        )}
        <label className="form-label">
          地点
          <input
            className="form-control"
            name="location"
            defaultValue={event?.location}
          />
        </label>
        <label className="form-label">
          备注
          <textarea
            className="form-control"
            name="note"
            rows={3}
            defaultValue={event?.note}
          />
        </label>
        {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
        <div className="flex justify-end gap-2">
          {event && (
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => {
                if (submitting.current || !confirm("删除此日程？")) return;
                submitting.current = true;
                setBusy(true);
                void deleteEvent(event.id)
                  .then(() => onSaved(event.dayKey || defaultDay))
                  .catch((e) => setError(e.message))
                  .finally(() => {
                    submitting.current = false;
                    setBusy(false);
                  });
              }}
            >
              删除日程
            </Button>
          )}
          <Button disabled={busy}>{busy ? "保存中…" : "保存"}</Button>
        </div>
      </form>
    </Dialog>
  );
}
