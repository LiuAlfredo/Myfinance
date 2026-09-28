import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { JourneyProject } from "@/features/journey/types";
import { localDay } from "./life-service";
import { workspaceCall } from "./workspace-service";
interface Routine {
  id: string;
  title: string;
  note: string;
  projectId: string | null;
  frequency: string;
  weekdays: string;
  anchorDay: string;
  nextDay: string;
  missedPolicy: string;
  active: boolean;
}
interface History {
  routineId: string;
  day: string;
  taskId: string | null;
  skipped: boolean;
  status: string | null;
  title: string;
}
export function RoutineManager({
  projects,
  onChanged,
}: {
  projects: JourneyProject[];
  onChanged: () => void;
}) {
  const navigate = useNavigate(),
    [rules, setRules] = useState<Routine[]>([]),
    [history, setHistory] = useState<History[]>([]),
    [editing, setEditing] = useState<Routine | "new" | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    submitting = useRef(false);
  const load = useCallback(async () => {
    if (!("__TAURI_INTERNALS__" in window)) return;
    try {
      const [r, h] = await Promise.all([
        workspaceCall<Routine[]>("list_task_routines"),
        workspaceCall<History[]>("list_routine_history"),
      ]);
      setRules(r);
      setHistory(h);
    } catch (e) {
      setError(String(e));
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const action = async (work: () => Promise<unknown>) => {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      await work();
      await load();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };
  const record = editing === "new" ? null : editing;
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    void action(async () => {
      await workspaceCall("save_task_routine", {
        idOpt: record?.id ?? null,
        input: {
          title: String(form.get("title")),
          note: String(form.get("note")),
          projectId: String(form.get("project")) || null,
          frequency: String(form.get("frequency")),
          weekdays: String(form.get("weekdays")),
          anchorDay: String(form.get("anchor")),
          nextDay: String(form.get("next")),
          missedPolicy: String(form.get("policy")),
          active: form.get("active") === "on",
        },
      });
      await workspaceCall("generate_routine_tasks");
      setEditing(null);
    });
  };
  return (
    <section className="content-card mt-6">
      <div className="flex justify-between">
        <h2 className="font-semibold">重复任务与习惯</h2>
        <Button size="sm" onClick={() => setEditing("new")}>
          添加重复规则
        </Button>
      </div>
      <p className="mt-2 text-sm text-[var(--text-secondary)]">
        规则管理未来周期；已生成任务单独编辑。启动与运行期间生成到期任务，历史周期不会重复生成。
      </p>
      {error && (
        <p role="alert" className="text-[var(--danger)]">
          {error}
        </p>
      )}
      {rules.map((r) => (
        <div
          key={r.id}
          className="flex items-center justify-between border-t border-[var(--border)] py-3"
        >
          <div>
            {r.title} · {r.active ? "启用" : "暂停"}
            <p className="text-xs">
              {r.frequency} · 下次 {r.nextDay}
            </p>
          </div>
          <Button
            disabled={busy}
            size="sm"
            variant="ghost"
            onClick={() => setEditing(r)}
          >
            编辑整个规则
          </Button>
        </div>
      ))}
      <p className="mt-3 text-sm">
        最近 500 次周期中的近 30 天：完成{" "}
        {
          history.filter(
            (h) =>
              h.day >= localDay(new Date(Date.now() - 29 * 86400000)) &&
              h.status === "DONE",
          ).length
        }{" "}
        次，跳过{" "}
        {
          history.filter(
            (h) =>
              h.day >= localDay(new Date(Date.now() - 29 * 86400000)) &&
              h.skipped,
          ).length
        }{" "}
        次
      </p>
      <details className="mt-4">
        <summary>周期历史（最近 500 次）</summary>
        {history.map((h) => (
          <div
            key={`${h.routineId}-${h.day}`}
            className="flex flex-wrap gap-3 py-2 text-sm"
          >
            <span>
              {h.day} · {h.title} ·{" "}
              {h.skipped ? "已跳过" : (h.status ?? "任务已删除")}
            </span>
            {h.taskId && (
              <button onClick={() => navigate(`/daily?task=${h.taskId}`)}>
                打开本次任务
              </button>
            )}
            {!h.skipped && h.status !== "DONE" && (
              <button
                disabled={busy}
                onClick={() =>
                  void action(() =>
                    workspaceCall("skip_routine_occurrence", {
                      routineId: h.routineId,
                      day: h.day,
                    }),
                  )
                }
              >
                跳过本次
              </button>
            )}
          </div>
        ))}
      </details>
      <Dialog
        open={editing !== null}
        onOpenChange={(v) => {
          if (!v && !busy) setEditing(null);
        }}
        title={record ? "修改重复规则" : "新建重复规则"}
      >
        {editing && (
          <form
            key={record?.id ?? "new"}
            onSubmit={submit}
            className="space-y-3"
          >
            <label className="form-label">
              名称
              <input
                className="form-control"
                name="title"
                required
                defaultValue={record?.title}
              />
            </label>
            <label className="form-label">
              周期
              <select
                className="form-control"
                name="frequency"
                defaultValue={record?.frequency ?? "DAILY"}
              >
                <option value="DAILY">每日</option>
                <option value="WEEKLY">每周</option>
                <option value="MONTHLY">每月</option>
              </select>
            </label>
            <label className="form-label">
              每周指定星期（1–7，逗号分隔；留空按起始星期）
              <input
                className="form-control"
                name="weekdays"
                defaultValue={record?.weekdays}
              />
            </label>
            <label className="form-label">
              起始日期
              <input
                className="form-control"
                name="anchor"
                type="date"
                required
                defaultValue={record?.anchorDay ?? localDay()}
              />
            </label>
            <label className="form-label">
              下一次生成日期
              <input
                className="form-control"
                name="next"
                type="date"
                required
                defaultValue={record?.nextDay ?? localDay()}
              />
            </label>
            <label className="form-label">
              错过周期
              <select
                className="form-control"
                name="policy"
                defaultValue={record?.missedPolicy ?? "SKIP"}
              >
                <option value="SKIP">跳过过去周期</option>
                <option value="CATCH_UP">补生成过去任务</option>
              </select>
            </label>
            <label className="form-label">
              项目
              <select
                className="form-control"
                name="project"
                defaultValue={record?.projectId ?? ""}
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
              备注
              <textarea
                className="form-control"
                name="note"
                defaultValue={record?.note}
              />
            </label>
            <label>
              <input
                type="checkbox"
                name="active"
                defaultChecked={record?.active ?? true}
              />
              启用
            </label>
            {error && (
              <p role="alert" className="text-[var(--danger)]">
                {error}
              </p>
            )}
            <Button disabled={busy}>
              {busy ? "保存中…" : "保存并生成到期任务"}
            </Button>
          </form>
        )}
      </Dialog>
    </section>
  );
}
