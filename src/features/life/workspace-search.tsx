import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LifeShell } from "./life-shell";
import { searchWorkspace, type SearchHit } from "./workspace-service";
export function WorkspaceSearch() {
  const navigate = useNavigate(),
    [retry, setRetry] = useState(0),
    [query, setQuery] = useState(""),
    [kind, setKind] = useState("ALL"),
    [rows, setRows] = useState<SearchHit[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    version = useRef(0);
  useEffect(() => {
    const request = ++version.current;
    if (!query.trim()) {
      setRows([]);
      setError("");
      setLoading(false);
      return;
    }
    setRows([]);
    setLoading(true);
    const timer = setTimeout(
      () =>
        void searchWorkspace(query, kind)
          .then((v) => {
            if (request === version.current) {
              setRows(v);
              setError("");
            }
          })
          .catch((e) => {
            if (request === version.current) setError(e.message);
          })
          .finally(() => {
            if (request === version.current) setLoading(false);
          }),
      250,
    );
    return () => {
      clearTimeout(timer);
    };
  }, [query, kind, retry]);
  return (
    <LifeShell
      eyebrow="SEARCH"
      title="全局搜索"
      description="搜索任务、日程、项目、财务和普通笔记，结果直接进入记录。"
    >
      <div className="mt-6 flex gap-3">
        <input
          autoFocus
          className="form-control"
          placeholder="输入标题、正文或标签"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          className="form-control w-auto"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
        >
          <option value="ALL">全部</option>
          <option value="TASK">任务</option>
          <option value="PROJECT">项目</option>
          <option value="NOTE">笔记</option>
          <option value="EVENT">日程</option>
          <option value="TRANSACTION">财务交易</option>
          <option value="PLANNED">计划支出</option>
        </select>
      </div>
      {error && (
        <p role="alert">
          {error}
          <button
            onClick={() => setRetry((n) => n + 1)}
            className="ml-3 text-[var(--accent)]"
          >
            重试搜索
          </button>
        </p>
      )}
      {loading && <p>搜索中…</p>}
      <div className="content-card mt-5">
        {rows.map((r) => (
          <button
            key={`${r.kind}-${r.id}`}
            className="block w-full border-b border-[var(--border)] py-4 text-left"
            onClick={() => navigate(r.url)}
          >
            <p>
              {r.title} ·{" "}
              {
                {
                  TASK: "任务",
                  PROJECT: "项目",
                  NOTE: "笔记",
                  EVENT: "日程",
                  TRANSACTION: "财务交易",
                  PLANNED: "计划支出",
                }[r.kind]
              }
            </p>
            <p className="truncate text-sm text-[var(--text-secondary)]">
              {r.detail}
            </p>
          </button>
        ))}
        {query && !loading && !rows.length && <p>没有匹配结果</p>}
      </div>
    </LifeShell>
  );
}
