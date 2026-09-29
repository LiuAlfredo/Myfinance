import { TagPicker } from "./tag-picker";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Archive,
  Download,
  FilePlus2,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DraftRecovery, MarkdownPreview, NoteTools } from "./note-tools";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getJourneyDashboard } from "@/features/journey/journey-service";
import type { JourneyProject } from "@/features/journey/types";
import { LifeShell } from "./life-shell";
import {
  deleteNotePermanently,
  getNote,
  listNotes,
  listTasks,
  saveNote,
  setNoteState,
  type DailyTask,
  type KnowledgeNote,
  type KnowledgeNoteInput,
} from "./life-service";
import {
  discardPendingNote,
  flushAllNotes,
  flushNote,
  pendingNote,
  persistNote,
  scheduleNote,
} from "./note-save-queue";
type View = "ACTIVE" | "ARCHIVED" | "TRASH";
const empty: KnowledgeNoteInput = {
  title: "未命名笔记",
  body: "",
  tags: "",
  isPinned: false,
  isArchived: false,
  projectId: null,
  taskId: null,
};
export function KnowledgePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [editorMode, setEditorMode] = useState<"EDIT" | "PREVIEW" | "SPLIT">(
    "EDIT",
  );
  const [official, setOfficial] = useState<KnowledgeNote | null>(null);
  const [view, setView] = useState<View>("ACTIVE"),
    [query, setQuery] = useState(""),
    [notes, setNotes] = useState<KnowledgeNote[]>([]),
    [selected, setSelected] = useState<KnowledgeNote | null>(null),
    [draft, replaceDraft] = useState<KnowledgeNoteInput | null>(null),
    [projects, setProjects] = useState<JourneyProject[]>([]),
    [tasks, setTasks] = useState<DailyTask[]>([]),
    [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle"),
    [error, setError] = useState(""),
    revision = useRef(0);
  const [transitioning, setTransitioning] = useState(false);
  const transitioningRef = useRef(false);
  const loadingVersion = useRef(0),
    creating = useRef(false),
    handled = useRef("");
  const load = useCallback(async () => {
    const request = ++loadingVersion.current;
    try {
      const [n, j, t] = await Promise.all([
        listNotes(view, query),
        getJourneyDashboard(),
        listTasks("ALL"),
      ]);
      if (request !== loadingVersion.current) return;
      setNotes(n);
      setProjects(j.projects);
      setTasks(t);
    } catch (e) {
      if (request === loadingVersion.current)
        setError(e instanceof Error ? e.message : "读取失败");
    }
  }, [view, query]);
  useEffect(() => {
    const version = loadingVersion;
    const timer = setTimeout(() => void load(), 250);
    return () => {
      clearTimeout(timer);
      version.current++;
    };
  }, [load]);
  useEffect(
    () => () => {
      revision.current++;
      void flushAllNotes();
    },
    [],
  );
  const setDraft = (next: KnowledgeNoteInput) => {
    replaceDraft(next);
    if (!selected) return;
    const request = ++revision.current;
    setState("saving");
    void scheduleNote(selected.id, next)
      .then(() => {
        if (request !== revision.current) return;
        setState("saved");
        setError("");
        void load();
      })
      .catch((e) => {
        if (request === revision.current) {
          setState("error");
          setError(e.message);
        }
      });
  };
  const choose = async (n: KnowledgeNote) => {
    if (selected?.id === n.id || transitioningRef.current) return;
    transitioningRef.current = true;
    setTransitioning(true);
    try {
      if (selected) await flushNote(selected.id);
      const fresh = await getNote(n.id);
      revision.current++;
      setSelected(fresh);
      const d = pendingNote(n.id) ?? {
        title: fresh.title,
        body: fresh.body,
        tags: fresh.tags,
        isPinned: fresh.isPinned,
        isArchived: fresh.isArchived,
        projectId: fresh.projectId,
        taskId: fresh.taskId,
      };
      replaceDraft(d);
      setState(pendingNote(n.id) ? "error" : "idle");
      setError(pendingNote(n.id) ? "已恢复未保存草稿，请重试保存" : "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "读取失败");
    } finally {
      transitioningRef.current = false;
      setTransitioning(false);
    }
  };
  const create = async (
    projectId: string | null = null,
    taskId: string | null = null,
  ) => {
    if (creating.current || transitioningRef.current) return;
    creating.current = true;
    try {
      if (selected) await flushNote(selected.id);
      const id = await saveNote({ ...empty, projectId, taskId });
      const found = await getNote(id);
      setView("ACTIVE");
      setQuery("");
      await choose(found);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "创建失败");
    } finally {
      creating.current = false;
    }
  };
  useEffect(() => {
    const key = searchParams.toString();
    if (!key) {
      handled.current = "";
      return;
    }
    if (handled.current === key) return;
    handled.current = key;
    if (searchParams.get("new") === "1") {
      const projectId = searchParams.get("project"),
        taskId = searchParams.get("task");
      setSearchParams({}, { replace: true });
      void create(projectId, taskId);
    } else if (searchParams.get("note")) {
      const id = searchParams.get("note")!;
      void getNote(id)
        .then((n) => {
          setView(
            n.deletedAt !== null
              ? "TRASH"
              : n.isArchived
                ? "ARCHIVED"
                : "ACTIVE",
          );
          return choose(n);
        })
        .catch((e) => setError(e.message));
      setSearchParams({}, { replace: true });
    }
    // URL actions are consumed once; editor state must not recreate a note.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, setSearchParams]);
  const changeView = async (next: View) => {
    if (transitioningRef.current) return;
    transitioningRef.current = true;
    setTransitioning(true);
    try {
      if (selected) await flushNote(selected.id);
      revision.current++;
      setView(next);
      setSelected(null);
      replaceDraft(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败，请重试");
    } finally {
      transitioningRef.current = false;
      setTransitioning(false);
    }
  };
  const action = async (
    kind: "ARCHIVE" | "UNARCHIVE" | "TRASH" | "RESTORE",
  ) => {
    if (!selected || transitioningRef.current) return;
    transitioningRef.current = true;
    setTransitioning(true);
    try {
      await flushNote(selected.id);
      await setNoteState(selected.id, kind);
      revision.current++;
      setSelected(null);
      replaceDraft(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败");
    } finally {
      transitioningRef.current = false;
      setTransitioning(false);
    }
  };
  const reloadSelected = async () => {
    if (!selected) return;
    const fresh = await getNote(selected.id);
    setSelected(fresh);
    replaceDraft({
      title: fresh.title,
      body: fresh.body,
      tags: fresh.tags,
      isPinned: fresh.isPinned,
      isArchived: fresh.isArchived,
      projectId: fresh.projectId,
      taskId: fresh.taskId,
    });
    setState("saved");
  };
  const recover = async (noteId: string, input: KnowledgeNoteInput) => {
    if (selected && selected.id !== noteId) await flushNote(selected.id);
    const fresh = await getNote(noteId);
    if (fresh.deletedAt !== null) throw new Error("请先从回收站恢复笔记");
    if (
      input.expectedRevision !== (fresh.revision ?? 1) &&
      !confirm("正式正文已发生变化。将草稿恢复为新版本？当前内容会保留在历史。")
    )
      return;
    const { expectedRevision: _, ...content } = input;
    void _;
    if (content.projectId || content.taskId) {
      const [journey, knownTasks] = await Promise.all([
        getJourneyDashboard(),
        listTasks("ALL"),
      ]);
      if (
        content.projectId &&
        !journey.projects.some((p) => p.id === content.projectId)
      )
        content.projectId = null;
      if (content.taskId && !knownTasks.some((t) => t.id === content.taskId))
        content.taskId = null;
    }
    await discardPendingNote(noteId);
    await persistNote(noteId, content);
    const saved = await getNote(noteId);
    setSelected(saved);
    replaceDraft(content);
    setView(saved.isArchived ? "ARCHIVED" : "ACTIVE");
    setState("saved");
    setError("");
    await load();
  };
  const exportMarkdown = () => {
    if (!draft) return;
    const blob = new Blob([`# ${draft.title}\n\n${draft.body}`], {
        type: "text/markdown;charset=utf-8",
      }),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = `${draft.title.replace(/[\\/:*?"<>|]/g, "_")}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <LifeShell
      eyebrow="04 · KNOWLEDGE"
      title="生活资料"
      description="记录笔记、资料和生活过程，并与项目或任务关联。"
      action={
        <Button onClick={() => void create()}>
          <FilePlus2 className="size-4" />
          新建笔记
        </Button>
      }
    >
      <DraftRecovery
        onRecover={recover}
        onDiscard={async (id) => {
          if (selected?.id === id) await reloadSelected();
        }}
      />
      <div className="mt-7 flex flex-wrap gap-2">
        <div className="flex min-w-60 flex-1 items-center gap-2 rounded-xl border border-[var(--border)] px-3">
          <Search className="size-4" />
          <input
            className="w-full bg-transparent py-2.5 outline-none"
            placeholder="搜索标题、正文或标签"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {(["ACTIVE", "ARCHIVED", "TRASH"] as View[]).map((x) => (
          <button
            className={
              view === x
                ? "button-primary rounded-xl px-4"
                : "rounded-xl border border-[var(--border)] px-4"
            }
            key={x}
            onClick={() => void changeView(x)}
          >
            {x === "ACTIVE" ? "笔记" : x === "ARCHIVED" ? "归档" : "回收站"}
          </button>
        ))}
      </div>
      {error && (
        <div className="journey-error">
          {error}
          {selected && draft && state === "error" && (
            <>
              <Button
                variant="ghost"
                onClick={() =>
                  void getNote(selected.id)
                    .then(setOfficial)
                    .catch((e) => setError(e.message))
                }
              >
                查看最新正式正文
              </Button>
              <Button
                variant="ghost"
                onClick={() =>
                  void recover(selected.id, draft).catch((e) =>
                    setError(e.message),
                  )
                }
              >
                恢复当前草稿为新版本
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            onClick={() => {
              if (draft) setDraft(draft);
              else void load();
            }}
          >
            重试
          </Button>
        </div>
      )}
      {official && (
        <section className="content-card mt-4">
          <Button variant="ghost" onClick={() => setOfficial(null)}>
            关闭正式版本预览
          </Button>
          <p>
            正式版本 {official.revision} · {official.title}
          </p>
          <MarkdownPreview body={official.body} />
        </section>
      )}
      <div className="mt-5 grid min-h-[540px] gap-4 md:grid-cols-[280px_1fr]">
        <aside className="content-card overflow-y-auto">
          {notes.map((n) => (
            <button
              key={n.id}
              className={`mb-2 block w-full rounded-xl p-3 text-left ${selected?.id === n.id ? "bg-[var(--accent-soft)]" : "hover:bg-[var(--surface-muted)]"}`}
              onClick={() => choose(n)}
            >
              <div className="flex justify-between">
                <strong className="truncate">
                  {n.isPinned ? "📌 " : ""}
                  {n.title}
                </strong>
                <small className="text-[var(--text-tertiary)]">
                  {new Date(n.updatedAt).toLocaleDateString("zh-CN")}
                </small>
              </div>
              <p className="mt-1 truncate text-xs text-[var(--text-secondary)]">
                {n.tags || n.body || "空笔记"}
              </p>
            </button>
          ))}
          {!notes.length && (
            <p className="py-12 text-center text-sm text-[var(--text-secondary)]">
              暂无笔记
            </p>
          )}
        </aside>
        <section className="content-card">
          {draft && selected ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] pb-3">
                <span
                  className={`text-xs ${state === "error" ? "text-[var(--danger)]" : "text-[var(--text-tertiary)]"}`}
                >
                  {state === "saving"
                    ? "正在保存…"
                    : state === "saved"
                      ? "已保存"
                      : state === "error"
                        ? "保存失败，草稿已保留"
                        : "自动保存"}
                </span>
                <div className="flex gap-1">
                  {selected.deletedAt ? (
                    <>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => void action("RESTORE")}
                      >
                        <RotateCcw className="size-4" />
                        恢复
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          if (confirm("永久删除后无法恢复，继续吗？"))
                            void deleteNotePermanently(selected.id)
                              .then(() => {
                                setSelected(null);
                                replaceDraft(null);
                                void load();
                              })
                              .catch((e) => setError(e.message));
                        }}
                      >
                        <Trash2 className="size-4" />
                        永久删除
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={exportMarkdown}
                      >
                        <Download className="size-4" />
                        Markdown
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          void action(
                            selected.isArchived ? "UNARCHIVE" : "ARCHIVE",
                          )
                        }
                      >
                        <Archive className="size-4" />
                        {selected.isArchived ? "取消归档" : "归档"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void action("TRASH")}
                      >
                        <Trash2 className="size-4" />
                        回收站
                      </Button>
                    </>
                  )}
                </div>
              </div>
              <div className="my-3 flex flex-wrap gap-2">
                {(["EDIT", "PREVIEW", "SPLIT"] as const).map((mode) => (
                  <Button
                    key={mode}
                    size="sm"
                    variant={editorMode === mode ? "secondary" : "ghost"}
                    onClick={() => setEditorMode(mode)}
                  >
                    {mode === "EDIT"
                      ? "编辑"
                      : mode === "PREVIEW"
                        ? "预览"
                        : "分屏"}
                  </Button>
                ))}
                <select
                  disabled={selected.deletedAt !== null || transitioning}
                  aria-label="笔记模板"
                  className="form-control w-auto"
                  defaultValue=""
                  onChange={(e) => {
                    const templates: Record<string, string> = {
                      project: "## 项目目标\n\n## 进展\n\n## 下一步",
                      review: "## 本周完成\n\n## 收支与变化\n\n## 下周计划",
                      item: "## 物品信息\n\n## 购买与保修\n\n## 维护记录",
                    };
                    if (e.target.value && confirm("用模板替换当前正文？"))
                      setDraft({ ...draft, body: templates[e.target.value] });
                    e.target.value = "";
                  }}
                >
                  <option value="">应用模板</option>
                  <option value="project">项目记录</option>
                  <option value="review">周复盘</option>
                  <option value="item">物品资料</option>
                </select>
              </div>
              <fieldset
                disabled={selected.deletedAt !== null || transitioning}
                className="mt-4 space-y-3"
              >
                <input
                  className="w-full bg-transparent text-2xl font-semibold outline-none"
                  value={draft.title}
                  onChange={(e) =>
                    setDraft({ ...draft, title: e.target.value })
                  }
                />
                <div className="grid gap-3 md:grid-cols-3">
                  <TagPicker
                    value={draft.tags}
                    suggestions={notes.flatMap((n) =>
                      n.tags
                        .split(/[,，]/)
                        .map((t) => t.trim())
                        .filter(Boolean),
                    )}
                    onChange={(tags) => setDraft({ ...draft, tags })}
                  />
                  <select
                    className="form-control"
                    value={draft.projectId || ""}
                    onChange={(e) =>
                      setDraft({ ...draft, projectId: e.target.value || null })
                    }
                  >
                    <option value="">不关联项目</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                  <select
                    className="form-control"
                    value={draft.taskId || ""}
                    onChange={(e) =>
                      setDraft({ ...draft, taskId: e.target.value || null })
                    }
                  >
                    <option value="">不关联任务</option>
                    {tasks.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                  </select>
                </div>
                <label className="flex gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.isPinned}
                    onChange={(e) =>
                      setDraft({ ...draft, isPinned: e.target.checked })
                    }
                  />
                  置顶
                </label>
                <div
                  className={
                    editorMode === "SPLIT" ? "grid gap-3 lg:grid-cols-2" : ""
                  }
                >
                  {editorMode !== "PREVIEW" && (
                    <textarea
                      className="form-control min-h-[370px] resize-y font-mono leading-7"
                      placeholder="使用 Markdown 记录内容…"
                      value={draft.body}
                      onChange={(e) =>
                        setDraft({ ...draft, body: e.target.value })
                      }
                    />
                  )}
                  {editorMode !== "EDIT" && (
                    <MarkdownPreview body={draft.body} />
                  )}
                </div>
              </fieldset>
              <div className="flex gap-3 text-sm">
                {draft.projectId && (
                  <button
                    onClick={() =>
                      navigate(`/journey?project=${draft.projectId}`)
                    }
                  >
                    打开关联项目
                  </button>
                )}
                {draft.taskId && (
                  <button
                    onClick={() => navigate(`/daily?task=${draft.taskId}`)}
                  >
                    打开关联任务
                  </button>
                )}
              </div>
              <NoteTools
                note={selected}
                onBusyChange={(busy) => {
                  transitioningRef.current = busy;
                  setTransitioning(busy);
                }}
                onReload={reloadSelected}
              />
            </>
          ) : (
            <div className="grid h-full place-items-center text-sm text-[var(--text-secondary)]">
              选择一篇笔记开始阅读或编辑
            </div>
          )}
        </section>
      </div>
    </LifeShell>
  );
}
