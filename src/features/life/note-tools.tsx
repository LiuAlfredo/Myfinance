import { useCallback, useEffect, useState } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { flushNote, discardPendingNote } from "./note-save-queue";
import {
  discardDraft,
  noteResources,
  restoreVersion,
  workspaceCall,
  type NoteResource,
} from "./workspace-service";
import {
  noteRevision,
  type KnowledgeNote,
  type KnowledgeNoteInput,
} from "./life-service";

export function DraftRecovery({
  onDiscard,
  onRecover,
}: {
  onDiscard: (noteId: string) => Promise<void>;
  onRecover: (noteId: string, input: KnowledgeNoteInput) => Promise<void>;
}) {
  const [drafts, setDrafts] = useState<NoteResource[]>([]),
    [error, setError] = useState("");
  const load = useCallback(() => {
    void noteResources("DRAFTS")
      .then(setDrafts)
      .catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);
  if (!drafts.length && !error) return null;
  return (
    <section className="content-card mt-4 space-y-2">
      <p>检测到未完成保存的草稿。恢复前可以在对应笔记查看正式正文。</p>
      {error && <p role="alert">{error}</p>}
      {drafts.map((d) => (
        <div key={d.id} className="flex flex-wrap gap-2">
          <span>
            {JSON.parse(d.payload ?? "{}").title} ·{" "}
            {new Date(d.createdAt).toLocaleString()}
          </span>
          <Button
            size="sm"
            onClick={() =>
              void onRecover(
                d.noteId,
                JSON.parse(d.payload ?? "{}") as KnowledgeNoteInput,
              )
                .then(load)
                .catch((e) => setError(e.message))
            }
          >
            恢复草稿
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              if (confirm("丢弃此未保存草稿？"))
                void discardPendingNote(d.noteId)
                  .then(() => discardDraft(d.noteId))
                  .then(() => onDiscard(d.noteId))
                  .then(load)
                  .catch((e) => setError(e.message));
            }}
          >
            丢弃
          </Button>
        </div>
      ))}
    </section>
  );
}

export function MarkdownPreview({ body }: { body: string }) {
  return (
    <div className="markdown-content rounded-xl border border-[var(--border)] p-4">
      <Markdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                if (!confirm("在浏览器中打开此链接？")) e.preventDefault();
              }}
            >
              {children}
            </a>
          ),
          img: () => <span>外部图片已隐藏</span>,
        }}
      >
        {body}
      </Markdown>
    </div>
  );
}

export function NoteTools({
  note,
  onReload,
  onBusyChange,
}: {
  note: KnowledgeNote;
  onBusyChange: (busy: boolean) => void;
  onReload: () => Promise<void>;
}) {
  const [versions, setVersions] = useState<NoteResource[]>([]),
    [attachments, setAttachments] = useState<NoteResource[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [preview, setPreview] = useState<NoteResource | null>(null);
  const load = useCallback(async () => {
    try {
      const [v, a] = await Promise.all([
        noteResources("VERSIONS", note.id),
        noteResources("ATTACHMENTS", note.id),
      ]);
      setVersions(v);
      setAttachments(a);
    } catch (e) {
      setError(String(e));
    }
  }, [note.id]);
  useEffect(() => {
    void load();
  }, [load, note.updatedAt]);
  const action = async (work: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    onBusyChange(true);
    setError("");
    try {
      await flushNote(note.id);
      await work();
      await load();
      await flushNote(note.id);
      await onReload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      onBusyChange(false);
    }
  };
  return (
    <div className="mt-5 space-y-4 border-t border-[var(--border)] pt-4">
      {error && (
        <p role="alert" className="text-[var(--danger)]">
          {error}
        </p>
      )}
      <details>
        <summary>附件（{attachments.length}）</summary>
        <Button
          disabled={busy || note.deletedAt !== null}
          size="sm"
          onClick={() =>
            void action(async () => {
              const path = await open({ multiple: false });
              if (typeof path === "string")
                await workspaceCall("import_note_attachment", {
                  noteId: note.id,
                  path,
                });
            })
          }
        >
          添加附件（最多 20 MB）
        </Button>
        {attachments.map((a) => (
          <div
            key={a.id}
            className="flex flex-wrap items-center gap-3 py-2 text-sm"
          >
            <span>
              {a.name} · {(a.size / 1024).toFixed(1)} KB
            </span>
            <Button
              disabled={busy}
              variant="ghost"
              size="sm"
              onClick={() =>
                void action(async () => {
                  const destination = await save({ defaultPath: a.name });
                  if (destination)
                    await workspaceCall("export_note_attachment", {
                      id: a.id,
                      destination,
                    });
                })
              }
            >
              导出
            </Button>
            <Button
              disabled={busy || note.deletedAt !== null}
              variant="ghost"
              size="sm"
              onClick={() => {
                if (confirm("删除此附件？完整备份中的副本仍会保留。"))
                  void action(() =>
                    workspaceCall("delete_note_attachment", { id: a.id }),
                  );
              }}
            >
              删除
            </Button>
          </div>
        ))}
      </details>
      <details>
        <summary>历史版本（最多 50 个）</summary>
        {versions.map((v) => (
          <div key={v.id} className="flex items-center gap-3 py-2 text-sm">
            <span>
              版本 {v.revision} · {new Date(v.createdAt).toLocaleString()}
            </span>
            <Button size="sm" variant="ghost" onClick={() => setPreview(v)}>
              查看
            </Button>
            <Button
              disabled={busy || note.deletedAt !== null}
              size="sm"
              variant="ghost"
              onClick={() => {
                if (confirm("恢复此版本？当前内容会保留在历史中。"))
                  void action(() =>
                    restoreVersion(note.id, v.id, noteRevision(note.id)),
                  );
              }}
            >
              恢复为新版本
            </Button>
          </div>
        ))}
      </details>
      {preview && (
        <section>
          <Button size="sm" variant="ghost" onClick={() => setPreview(null)}>
            关闭版本预览
          </Button>
          <MarkdownPreview
            body={JSON.parse(preview.payload ?? "{}").body ?? ""}
          />
        </section>
      )}
    </div>
  );
}
