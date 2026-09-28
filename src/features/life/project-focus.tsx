import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { localDay, pinTodayProject, type TodaySummary } from "./life-service";
import { workspaceCall } from "./workspace-service";
export function ProjectFocus({
  onChanged,
}: {
  onChanged: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false),
    [projects, setProjects] = useState<TodaySummary["projects"]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const load = async () => {
    const now = new Date(),
      start = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
      ).getTime();
    try {
      setProjects(
        await workspaceCall("get_today_section", {
          section: "ALL_PROJECTS",
          dayKey: localDay(),
          startAt: start,
          endAt: start + 86400000,
        }),
      );
    } catch (e) {
      setError(String(e));
    }
  };
  useEffect(() => {
    if (open) void load();
  }, [open]);
  const change = async (work: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    try {
      await work();
      await load();
      await onChanged();
      setError("");
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };
  const move = (id: string, direction: number) => {
    const ids = projects.filter((p) => p.isPinned).map((p) => p.id),
      at = ids.indexOf(id),
      to = at + direction;
    if (to < 0 || to >= ids.length) return;
    [ids[at], ids[to]] = [ids[to], ids[at]];
    void change(() => workspaceCall("reorder_today_projects", { ids }));
  };
  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        管理关注项目
      </Button>
      <Dialog open={open} onOpenChange={setOpen} title="重点项目与顺序">
        <p className="text-sm">
          首页展示前四项。已关注项目优先，并可调整顺序。
        </p>
        {error && <p role="alert">{error}</p>}
        {projects.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between gap-2 py-2"
          >
            <label>
              <input
                disabled={busy}
                type="checkbox"
                checked={p.isPinned}
                onChange={(e) =>
                  void change(() => pinTodayProject(p.id, e.target.checked))
                }
              />{" "}
              {p.title}
            </label>
            {p.isPinned && (
              <div>
                <Button
                  disabled={busy}
                  size="sm"
                  variant="ghost"
                  onClick={() => move(p.id, -1)}
                >
                  上移
                </Button>
                <Button
                  disabled={busy}
                  size="sm"
                  variant="ghost"
                  onClick={() => move(p.id, 1)}
                >
                  下移
                </Button>
              </div>
            )}
          </div>
        ))}
      </Dialog>
    </>
  );
}
