import { useCallback, useEffect, useRef, useState } from "react";
import { Archive, Download, FilePlus2, RotateCcw, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSearchParams } from "react-router-dom";
import { getJourneyDashboard } from "@/features/journey/journey-service";
import type { JourneyProject } from "@/features/journey/types";
import { LifeShell } from "./life-shell";
import { deleteNotePermanently, getNote, listNotes, listTasks, saveNote, setNoteState, type DailyTask, type KnowledgeNote, type KnowledgeNoteInput } from "./life-service";
import { flushNote, pendingNote, persistNote } from "./note-save-queue";
type View = "ACTIVE" | "ARCHIVED" | "TRASH";
const empty: KnowledgeNoteInput = { title: "未命名笔记", body: "", tags: "", isPinned: false, isArchived: false, projectId: null, taskId: null };
export function KnowledgePage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const [view, setView] = useState<View>("ACTIVE"), [query, setQuery] = useState(""), [notes, setNotes] = useState<KnowledgeNote[]>([]), [selected, setSelected] = useState<KnowledgeNote | null>(null), [draft, replaceDraft] = useState<KnowledgeNoteInput | null>(null), [projects, setProjects] = useState<JourneyProject[]>([]), [tasks, setTasks] = useState<DailyTask[]>([]), [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle"), [error, setError] = useState(""), revision = useRef(0);
    const [transitioning, setTransitioning] = useState(false);
    const transitioningRef = useRef(false);
    const loadingVersion = useRef(0), creating = useRef(false), handled = useRef("");
    const load = useCallback(async () => { const request = ++loadingVersion.current; try {
        const [n, j, t] = await Promise.all([listNotes(view, query), getJourneyDashboard(), listTasks("ALL")]);
        if (request !== loadingVersion.current)
            return;
        setNotes(n);
        setProjects(j.projects);
        setTasks(t);
    }
    catch (e) {
        if (request === loadingVersion.current)
            setError(e instanceof Error ? e.message : "读取失败");
    } }, [view, query]);
    useEffect(() => { const version = loadingVersion; const timer = setTimeout(() => void load(), 250); return () => { clearTimeout(timer); version.current++; }; }, [load]);
    useEffect(() => () => { revision.current++; }, []);
    const setDraft = (next: KnowledgeNoteInput) => { replaceDraft(next); if (!selected)
        return; const request = ++revision.current; setState("saving"); void persistNote(selected.id, next).then(() => { if (request !== revision.current)
        return; setState("saved"); setError(""); void load(); }).catch(e => { if (request === revision.current) {
        setState("error");
        setError(e.message);
    } }); };
    const choose = async (n: KnowledgeNote) => { if (selected?.id === n.id || transitioningRef.current)
        return; transitioningRef.current = true; setTransitioning(true); try {
        if (selected)
            await flushNote(selected.id);
        const fresh = await getNote(n.id);
        revision.current++;
        setSelected(fresh);
        const d = pendingNote(n.id) ?? { title: fresh.title, body: fresh.body, tags: fresh.tags, isPinned: fresh.isPinned, isArchived: fresh.isArchived, projectId: fresh.projectId, taskId: fresh.taskId };
        replaceDraft(d);
        setState(pendingNote(n.id) ? "error" : "idle");
        setError(pendingNote(n.id) ? "已恢复未保存草稿，请重试保存" : "");
    }
    catch (e) {
        setError(e instanceof Error ? e.message : "读取失败");
    }
    finally {
        transitioningRef.current = false;
        setTransitioning(false);
    } };
    const create = async (projectId: string | null = null) => { if (creating.current)
        return; creating.current = true; try {
        if (selected)
            await flushNote(selected.id);
        const id = await saveNote({ ...empty, projectId });
        const found = await getNote(id);
        setView("ACTIVE");
        setQuery("");
        await choose(found);
        await load();
    }
    catch (e) {
        setError(e instanceof Error ? e.message : "创建失败");
    }
    finally {
        creating.current = false;
    } };
    useEffect(() => {
        const key = searchParams.toString();
        if (!key) {
            handled.current = "";
            return;
        }
        if (handled.current === key)
            return;
        handled.current = key;
        if (searchParams.get("new") === "1") {
            const projectId = searchParams.get("project");
            setSearchParams({}, { replace: true });
            void create(projectId);
        }
        else if (searchParams.get("note")) {
            const id = searchParams.get("note")!;
            void getNote(id).then(n => { setView(n.deletedAt !== null ? "TRASH" : n.isArchived ? "ARCHIVED" : "ACTIVE"); return choose(n); }).catch(e => setError(e.message));
            setSearchParams({}, { replace: true });
        }
        // URL actions are consumed once; editor state must not recreate a note.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams, setSearchParams]);
    const changeView = async (next: View) => { if (transitioningRef.current)
        return; transitioningRef.current = true; setTransitioning(true); try {
        if (selected)
            await flushNote(selected.id);
        revision.current++;
        setView(next);
        setSelected(null);
        replaceDraft(null);
    }
    catch (e) {
        setError(e instanceof Error ? e.message : "保存失败，请重试");
    }
    finally {
        transitioningRef.current = false;
        setTransitioning(false);
    } };
    const action = async (kind: "ARCHIVE" | "UNARCHIVE" | "TRASH" | "RESTORE") => { if (!selected || transitioningRef.current)
        return; transitioningRef.current = true; setTransitioning(true); try {
        await flushNote(selected.id);
        await setNoteState(selected.id, kind);
        revision.current++;
        setSelected(null);
        replaceDraft(null);
        await load();
    }
    catch (e) {
        setError(e instanceof Error ? e.message : "操作失败");
    }
    finally {
        transitioningRef.current = false;
        setTransitioning(false);
    } };
    const exportMarkdown = () => { if (!draft)
        return; const blob = new Blob([`# ${draft.title}\n\n${draft.body}`], { type: "text/markdown;charset=utf-8" }), url = URL.createObjectURL(blob), a = document.createElement("a"); a.href = url; a.download = `${draft.title.replace(/[\\/:*?"<>|]/g, "_")}.md`; a.click(); URL.revokeObjectURL(url); };
    return <LifeShell eyebrow="04 · KNOWLEDGE" title="生活资料" description="记录笔记、资料和生活过程，并与项目或任务关联。" action={<Button onClick={() => void create()}><FilePlus2 className="size-4"/>新建笔记</Button>}>
  <div className="mt-7 flex flex-wrap gap-2"><div className="flex min-w-60 flex-1 items-center gap-2 rounded-xl border border-[var(--border)] px-3"><Search className="size-4"/><input className="w-full bg-transparent py-2.5 outline-none" placeholder="搜索标题、正文或标签" value={query} onChange={e => setQuery(e.target.value)}/></div>{(["ACTIVE", "ARCHIVED", "TRASH"] as View[]).map(x => <button className={view === x ? "button-primary rounded-xl px-4" : "rounded-xl border border-[var(--border)] px-4"} key={x} onClick={() => void changeView(x)}>{x === "ACTIVE" ? "笔记" : x === "ARCHIVED" ? "归档" : "回收站"}</button>)}</div>
  {error && <div className="journey-error">{error}<Button variant="ghost" onClick={() => { if (draft)
        setDraft(draft);
    else
        void load(); }}>重试</Button></div>}
  <div className="mt-5 grid min-h-[540px] gap-4 md:grid-cols-[280px_1fr]"><aside className="content-card overflow-y-auto">{notes.map(n => <button key={n.id} className={`mb-2 block w-full rounded-xl p-3 text-left ${selected?.id === n.id ? "bg-[var(--accent-soft)]" : "hover:bg-[var(--surface-muted)]"}`} onClick={() => choose(n)}><div className="flex justify-between"><strong className="truncate">{n.isPinned ? "📌 " : ""}{n.title}</strong><small className="text-[var(--text-tertiary)]">{new Date(n.updatedAt).toLocaleDateString("zh-CN")}</small></div><p className="mt-1 truncate text-xs text-[var(--text-secondary)]">{n.tags || n.body || "空笔记"}</p></button>)}{!notes.length && <p className="py-12 text-center text-sm text-[var(--text-secondary)]">暂无笔记</p>}</aside><section className="content-card">{draft && selected ? <><div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] pb-3"><span className={`text-xs ${state === "error" ? "text-[var(--danger)]" : "text-[var(--text-tertiary)]"}`}>{state === "saving" ? "正在保存…" : state === "saved" ? "已保存" : state === "error" ? "保存失败，草稿已保留" : "自动保存"}</span><div className="flex gap-1">{selected.deletedAt ? <><Button size="sm" variant="secondary" onClick={() => void action("RESTORE")}><RotateCcw className="size-4"/>恢复</Button><Button size="sm" variant="secondary" onClick={() => { if (confirm("永久删除后无法恢复，继续吗？"))
        void deleteNotePermanently(selected.id).then(() => { setSelected(null); replaceDraft(null); void load(); }).catch(e => setError(e.message)); }}><Trash2 className="size-4"/>永久删除</Button></> : <><Button size="sm" variant="ghost" onClick={exportMarkdown}><Download className="size-4"/>Markdown</Button><Button size="sm" variant="ghost" onClick={() => void action(selected.isArchived ? "UNARCHIVE" : "ARCHIVE")}><Archive className="size-4"/>{selected.isArchived ? "取消归档" : "归档"}</Button><Button size="sm" variant="ghost" onClick={() => void action("TRASH")}><Trash2 className="size-4"/>回收站</Button></>}</div></div><fieldset disabled={selected.deletedAt !== null || transitioning} className="mt-4 space-y-3"><input className="w-full bg-transparent text-2xl font-semibold outline-none" value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })}/><div className="grid gap-3 md:grid-cols-3"><input className="form-control" placeholder="标签，用逗号分隔" value={draft.tags} onChange={e => setDraft({ ...draft, tags: e.target.value })}/><select className="form-control" value={draft.projectId || ""} onChange={e => setDraft({ ...draft, projectId: e.target.value || null })}><option value="">不关联项目</option>{projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}</select><select className="form-control" value={draft.taskId || ""} onChange={e => setDraft({ ...draft, taskId: e.target.value || null })}><option value="">不关联任务</option>{tasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}</select></div><label className="flex gap-2 text-sm"><input type="checkbox" checked={draft.isPinned} onChange={e => setDraft({ ...draft, isPinned: e.target.checked })}/>置顶</label><textarea className="form-control min-h-[370px] resize-y font-mono leading-7" placeholder="使用 Markdown 记录内容…" value={draft.body} onChange={e => setDraft({ ...draft, body: e.target.value })}/></fieldset></> : <div className="grid h-full place-items-center text-sm text-[var(--text-secondary)]">选择一篇笔记开始阅读或编辑</div>}</section></div>
 </LifeShell>;
}
