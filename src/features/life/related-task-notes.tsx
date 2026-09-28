import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listNotes, type KnowledgeNote } from "./life-service";
export function RelatedTaskNotes({ taskId }: { taskId: string }) {
  const [notes, setNotes] = useState<KnowledgeNote[]>([]),
    [error, setError] = useState("");
  const navigate = useNavigate();
  useEffect(() => {
    let active = true;
    void listNotes()
      .then((rows) => {
        if (active) setNotes(rows.filter((n) => n.taskId === taskId));
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [taskId]);
  return (
    <details>
      <summary>关联笔记（{notes.length}）</summary>
      {error && <p role="alert">{error}</p>}
      {notes.map((n) => (
        <button
          key={n.id}
          type="button"
          className="block py-1 text-[var(--accent)]"
          onClick={() => navigate(`/knowledge?note=${n.id}`)}
        >
          {n.title}
        </button>
      ))}
      <button
        type="button"
        onClick={() => navigate(`/knowledge?task=${taskId}&new=1`)}
      >
        为任务新建笔记
      </button>
    </details>
  );
}
