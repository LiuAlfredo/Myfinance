import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { CalendarDays, Check, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSearchParams } from "react-router-dom";
import { Dialog } from "@/components/ui/dialog";
import { getJourneyDashboard } from "@/features/journey/journey-service";
import type { JourneyProject } from "@/features/journey/types";
import { LifeShell } from "./life-shell";
import { deleteEvent, deleteTask, listEvents, listTasks, localDay, saveEvent, saveTask, setTaskStatus, type DailyEvent, type DailyTask, type DailyTaskInput, type TaskStatus } from "./life-service";
type View = "TODAY" | "INBOX" | "UPCOMING" | "ALL" | "COMPLETED" | "EVENTS";
export function DailyPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const [view, setView] = useState<View>("TODAY"), [tasks, setTasks] = useState<DailyTask[]>([]), [events, setEvents] = useState<DailyEvent[]>([]), [projects, setProjects] = useState<JourneyProject[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState(""), [taskEdit, setTaskEdit] = useState<DailyTask | "new" | null>(null), [eventEdit, setEventEdit] = useState<DailyEvent | "new" | null>(null);
    const [month, setMonth] = useState(() => localDay().slice(0, 7)), [defaultProject, setDefaultProject] = useState<string | null>(null);
    const loadVersion = useRef(0);
    const load = useCallback(async () => { const request = ++loadVersion.current; setLoading(true); setError(""); try {
        const [year, m] = month.split("-").map(Number), from = new Date(year, m - 1, 1), to = new Date(year, m, 1);
        const [all, calendar, journey] = await Promise.all([listTasks("ALL"), listEvents(localDay(from), localDay(new Date(to.getTime() - 1)), from.getTime(), to.getTime()), getJourneyDashboard()]);
        if (request !== loadVersion.current)
            return;
        setTasks(all);
        setEvents(calendar);
        setProjects(journey.projects);
    }
    catch (e) {
        if (request === loadVersion.current)
            setError(e instanceof Error ? e.message : "读取失败");
    }
    finally {
        if (request === loadVersion.current)
            setLoading(false);
    } }, [month]);
    useEffect(() => { const version = loadVersion; void load(); const refresh = () => void load(); window.addEventListener("focus", refresh); const timer = setInterval(refresh, 60000); return () => { version.current++; clearInterval(timer); window.removeEventListener("focus", refresh); }; }, [load]);
    useEffect(() => { if (searchParams.get("new") === "task") {
        setDefaultProject(searchParams.get("project"));
        setTaskEdit("new");
        setSearchParams({}, { replace: true });
    }
    else if (searchParams.get("new") === "event") {
        setEventEdit("new");
        setSearchParams({}, { replace: true });
    } }, [searchParams, setSearchParams]);
    useEffect(() => { if (searchParams.get("view") === "EVENTS") {
        setView("EVENTS");
        if (!searchParams.get("event")) setSearchParams({}, { replace: true });
    } const id = searchParams.get("task"); if (id && tasks.length) {
        const task = tasks.find(t => t.id === id);
        if (task) {
            setView("ALL");
            setTaskEdit(task);
            setSearchParams({}, { replace: true });
        }
    } const eventId = searchParams.get("event"); if (eventId && events.length) {
        const event = events.find(e => e.id === eventId);
        if (event) {
            setView("EVENTS");
            setEventEdit(event);
            setSearchParams({}, { replace: true });
        }
    } }, [searchParams, setSearchParams, tasks, events]);
    const visible = useMemo(() => { const today = localDay(), start = new Date().setHours(0, 0, 0, 0), end = start + 86400000; if (view === "TODAY")
        return tasks.filter(t => t.status !== "DONE" && t.status !== "CANCELLED" && (t.plannedDay === today || (t.dueAt !== null && t.dueAt < end))); if (view === "UPCOMING")
        return tasks.filter(t => t.status !== "DONE" && t.status !== "CANCELLED" && ((t.plannedDay && t.plannedDay > today) || (t.dueAt !== null && t.dueAt >= end))); if (view === "INBOX")
        return tasks.filter(t => ["TODO", "ACTIVE"].includes(t.status) && !t.plannedDay && t.dueAt === null); if (view === "COMPLETED")
        return tasks.filter(t => t.status === "DONE"); return tasks; }, [tasks, view]);
    const act = async (work: Promise<unknown>) => { try {
        await work;
        await load();
        window.dispatchEvent(new Event("life-data-changed"));
    }
    catch (e) {
        setError(e instanceof Error ? e.message : "操作失败");
    } };
    return <LifeShell eyebrow="03 · DAILY" title="日常事务" description="收集任务、安排日期，并管理生活日程。" action={<div className="flex gap-2"><Button variant="secondary" onClick={() => setEventEdit("new")}><CalendarDays className="size-4"/>新建日程</Button><Button onClick={() => { setDefaultProject(null); setTaskEdit("new"); }}><Plus className="size-4"/>添加任务</Button></div>}>
  <nav className="journey-tabs" aria-label="日常事务视图">{(["TODAY", "INBOX", "UPCOMING", "ALL", "COMPLETED", "EVENTS"] as View[]).map(x => <button key={x} className={view === x ? "journey-tab-active" : ""} onClick={() => setView(x)}>{x === "TODAY" ? "今天" : x === "INBOX" ? "收集箱" : x === "UPCOMING" ? "即将到期" : x === "ALL" ? "全部任务" : x === "COMPLETED" ? "已完成" : "日程"}</button>)}</nav>
  {view === "EVENTS" && <label className="form-label mt-4">日程月份<input aria-label="日程月份" className="form-control" type="month" min="1900-01" value={month} onChange={e => { if (e.target.value)
        setMonth(e.target.value); }}/></label>}
  {error && <div className="journey-error flex justify-between">{error}<button onClick={() => void load()}>重试</button></div>}
  {loading ? <p className="py-14 text-center text-sm text-[var(--text-secondary)]">正在整理…</p> : view === "EVENTS" ? <EventList events={events} onEdit={setEventEdit} onDelete={id => void act(deleteEvent(id))}/> : <TaskList tasks={visible} onEdit={setTaskEdit} onStatus={(id, status) => void act(setTaskStatus(id, status))} onDelete={(task) => { if (window.confirm(task.childCount ? `删除此任务及其全部子任务？（直接子任务 ${task.childCount} 个）` : "删除此任务？"))
        void act(deleteTask(task.id)); }}/>}
  <TaskDialog key={`task-${taskEdit === null ? "closed" : taskEdit === "new" ? "new" : taskEdit.id}`} defaultProject={defaultProject} open={taskEdit !== null} task={taskEdit === "new" ? null : taskEdit} tasks={tasks} projects={projects} onClose={() => setTaskEdit(null)} onSaved={() => { setTaskEdit(null); setView("ALL"); void load(); }}/>
  <EventDialog key={`event-${eventEdit === null ? "closed" : eventEdit === "new" ? "new" : eventEdit.id}`} open={eventEdit !== null} event={eventEdit === "new" ? null : eventEdit} onClose={() => setEventEdit(null)} onSaved={day => { setEventEdit(null); setView("EVENTS"); setMonth(day.slice(0, 7)); void load(); }}/>
 </LifeShell>;
}
function TaskList({ tasks, onEdit, onStatus, onDelete }: {
    tasks: DailyTask[];
    onEdit: (t: DailyTask) => void;
    onStatus: (id: string, s: TaskStatus) => void;
    onDelete: (t: DailyTask) => void;
}) { return <div className="content-card mt-5 divide-y divide-[var(--border)]">{tasks.map(t => <article key={t.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div className="min-w-0"><div className="flex items-center gap-2"><span className={`size-2 rounded-full ${t.priority === "URGENT" ? "bg-[var(--danger)]" : t.priority === "IMPORTANT" ? "bg-[var(--warning)]" : "bg-[var(--accent)]"}`}/><p className={t.status === "DONE" ? "line-through text-[var(--text-tertiary)]" : "font-medium text-[var(--text)]"}>{t.title}</p></div><p className="mt-1 text-xs text-[var(--text-secondary)]">{t.plannedDay || "未安排"}{t.dueAt ? ` · 截止 ${new Date(t.dueAt).toLocaleString("zh-CN")}` : ""}{t.projectTitle ? ` · ${t.projectTitle}` : ""}{t.childCount ? ` · ${t.childCount} 个子任务` : ""}</p></div><div className="flex gap-2">{t.status === "DONE" ? <Button size="sm" variant="secondary" onClick={() => onStatus(t.id, "TODO")}><RotateCcw className="size-4"/>撤销</Button> : <Button size="sm" onClick={() => onStatus(t.id, "DONE")}><Check className="size-4"/>完成</Button>}<Button size="icon" variant="ghost" aria-label="编辑任务" onClick={() => onEdit(t)}><Pencil className="size-4"/></Button><Button size="icon" variant="ghost" aria-label="删除任务" onClick={() => onDelete(t)}><Trash2 className="size-4 text-[var(--danger)]"/></Button></div></article>)}{!tasks.length && <p className="py-12 text-center text-sm text-[var(--text-secondary)]">这里还没有内容，可以添加第一项任务。</p>}</div>; }
function EventList({ events, onEdit, onDelete }: {
    events: DailyEvent[];
    onEdit: (e: DailyEvent) => void;
    onDelete: (id: string) => void;
}) { return <div className="content-card mt-5 divide-y divide-[var(--border)]">{events.map(e => <article key={e.id} className="flex justify-between gap-4 py-4"><div><p className="font-medium">{e.title}</p><p className="mt-1 text-xs text-[var(--text-secondary)]">{e.allDay ? `${e.dayKey} · 全天` : e.startsAt ? new Date(e.startsAt).toLocaleString("zh-CN") : ""}{e.location ? ` · ${e.location}` : ""}</p></div><div className="flex"><Button size="icon" variant="ghost" onClick={() => onEdit(e)}><Pencil className="size-4"/></Button><Button size="icon" variant="ghost" onClick={() => { if (confirm("删除此日程？"))
    onDelete(e.id); }}><Trash2 className="size-4 text-[var(--danger)]"/></Button></div></article>)}{!events.length && <p className="py-12 text-center text-sm text-[var(--text-secondary)]">暂无日程</p>}</div>; }
function TaskDialog({ defaultProject, open, task, tasks, projects, onClose, onSaved }: {
    defaultProject: string | null;
    open: boolean;
    task: DailyTask | null;
    tasks: DailyTask[];
    projects: JourneyProject[];
    onClose: () => void;
    onSaved: () => void;
}) { const [project, setProject] = useState(task?.projectId || defaultProject || ""); const [error, setError] = useState(""), [busy, setBusy] = useState(false); const submitting = useRef(false); const submit = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); if (submitting.current)
    return; submitting.current = true; const d = new FormData(e.currentTarget), due = String(d.get("due")); setBusy(true); setError(""); void saveTask({ title: String(d.get("title")), note: String(d.get("note")), status: String(d.get("status")) as TaskStatus, priority: String(d.get("priority")) as DailyTaskInput["priority"], plannedDay: String(d.get("plannedDay")) || null, dueAt: due ? new Date(due).getTime() : null, projectId: project || null, parentId: String(d.get("parentId")) || null }, task?.id).then(onSaved).catch(x => setError(x.message)).finally(() => { submitting.current = false; setBusy(false); }); }; return <Dialog open={open} onOpenChange={x => !x && !busy && onClose()} title={task ? "编辑任务" : "添加任务"}><form className="space-y-3" onSubmit={submit}><label className="form-label">标题<input className="form-control" name="title" required defaultValue={task?.title}/></label><div className="grid grid-cols-2 gap-3"><label className="form-label">状态<select className="form-control" name="status" defaultValue={task?.status || "TODO"}><option value="TODO">待处理</option><option value="ACTIVE">进行中</option><option value="DONE">已完成</option><option value="CANCELLED">已取消</option></select></label><label className="form-label">优先级<select className="form-control" name="priority" defaultValue={task?.priority || "NORMAL"}><option value="NORMAL">普通</option><option value="IMPORTANT">重要</option><option value="URGENT">紧急</option></select></label></div><div className="grid grid-cols-2 gap-3"><label className="form-label">计划日期<input className="form-control" type="date" name="plannedDay" defaultValue={task?.plannedDay || ""}/></label><label className="form-label">截止时间<input className="form-control" type="datetime-local" name="due" defaultValue={task?.dueAt ? new Date(task.dueAt - new Date(task.dueAt).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ""}/></label></div><label className="form-label">关联项目<select className="form-control" name="projectId" value={project} onChange={e => setProject(e.target.value)}><option value="">无</option>{projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}</select></label><label className="form-label">父任务<select className="form-control" name="parentId" defaultValue={task?.parentId || ""}><option value="">无</option>{tasks.filter(x => x.id !== task?.id && (x.parentId === null || x.id === task?.parentId)).map(x => <option key={x.id} value={x.id}>{x.title}</option>)}</select></label><label className="form-label">备注<textarea className="form-control" name="note" rows={3} defaultValue={task?.note}/></label>{error && <p className="text-sm text-[var(--danger)]">{error}</p>}<div className="flex justify-end gap-2"><Button type="button" variant="secondary" disabled={busy} onClick={onClose}>取消</Button><Button disabled={busy}>{busy ? "保存中…" : "保存"}</Button></div></form></Dialog>; }
function EventDialog({ open, event, onClose, onSaved }: {
    open: boolean;
    event: DailyEvent | null;
    onClose: () => void;
    onSaved: (day: string) => void;
}) { const [allDay, setAllDay] = useState(event?.allDay ?? true), [error, setError] = useState(""), [busy, setBusy] = useState(false); const submitting = useRef(false); useEffect(() => setAllDay(event?.allDay ?? true), [event]); const submit = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); if (submitting.current)
    return; submitting.current = true; setBusy(true); setError(""); const d = new FormData(e.currentTarget), start = String(d.get("start")), end = String(d.get("end")); void saveEvent({ title: String(d.get("title")), allDay, dayKey: allDay ? String(d.get("day")) : null, startsAt: !allDay ? new Date(start).getTime() : null, endsAt: !allDay ? new Date(end).getTime() : null, location: String(d.get("location")), note: String(d.get("note")) }, event?.id).then(() => onSaved(allDay ? String(d.get("day")) : start.slice(0, 10))).catch(x => setError(x.message)).finally(() => { submitting.current = false; setBusy(false); }); }; const local = (n: number | null) => n ? new Date(n - new Date(n).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ""; return <Dialog open={open} onOpenChange={x => !x && !busy && onClose()} title={event ? "编辑日程" : "新建日程"}><form className="space-y-3" onSubmit={submit}><label className="form-label">标题<input className="form-control" name="title" required defaultValue={event?.title}/></label><label className="flex gap-2 text-sm"><input type="checkbox" checked={allDay} onChange={e => setAllDay(e.target.checked)}/>全天事项</label>{allDay ? <label className="form-label">日期<input className="form-control" type="date" name="day" required defaultValue={event?.dayKey || localDay()}/></label> : <div className="grid grid-cols-2 gap-3"><label className="form-label">开始<input className="form-control" type="datetime-local" name="start" required defaultValue={local(event?.startsAt ?? null)}/></label><label className="form-label">结束<input className="form-control" type="datetime-local" name="end" required defaultValue={local(event?.endsAt ?? null)}/></label></div>}<label className="form-label">地点<input className="form-control" name="location" defaultValue={event?.location}/></label><label className="form-label">备注<textarea className="form-control" name="note" rows={3} defaultValue={event?.note}/></label>{error && <p className="text-sm text-[var(--danger)]">{error}</p>}<div className="flex justify-end"><Button disabled={busy}>{busy ? "保存中…" : "保存"}</Button></div></form></Dialog>; }
