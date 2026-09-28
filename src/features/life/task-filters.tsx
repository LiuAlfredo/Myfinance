import type { JourneyProject } from "@/features/journey/types";
import { emptyTaskFilter, type TaskFilter } from "./task-filter-model";
export function TaskFilters({
  value,
  onChange,
  projects,
}: {
  value: TaskFilter;
  onChange: (value: TaskFilter) => void;
  projects: JourneyProject[];
}) {
  return (
    <div className="mt-4 grid gap-2 md:grid-cols-4">
      <input
        className="form-control"
        placeholder="搜索任务"
        value={value.query}
        onChange={(e) => onChange({ ...value, query: e.target.value })}
      />
      <select
        aria-label="项目筛选"
        className="form-control"
        value={value.project}
        onChange={(e) => onChange({ ...value, project: e.target.value })}
      >
        <option value="">全部项目</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.title}
          </option>
        ))}
      </select>
      <select
        aria-label="状态筛选"
        className="form-control"
        value={value.status}
        onChange={(e) => onChange({ ...value, status: e.target.value })}
      >
        <option value="">全部状态</option>
        <option value="TODO">待处理</option>
        <option value="ACTIVE">进行中</option>
        <option value="DONE">已完成</option>
        <option value="CANCELLED">已取消</option>
      </select>
      <select
        aria-label="优先级筛选"
        className="form-control"
        value={value.priority}
        onChange={(e) => onChange({ ...value, priority: e.target.value })}
      >
        <option value="">全部优先级</option>
        <option value="NORMAL">普通</option>
        <option value="IMPORTANT">重要</option>
        <option value="URGENT">紧急</option>
      </select>
      <select
        aria-label="日期范围类型"
        className="form-control"
        value={value.dateField}
        onChange={(e) => onChange({ ...value, dateField: e.target.value })}
      >
        <option value="PLANNED">按计划日期筛选</option>
        <option value="DUE">按截止日期筛选</option>
      </select>
      <label className="form-label">
        日期起
        <input
          className="form-control"
          type="date"
          value={value.from}
          onChange={(e) => onChange({ ...value, from: e.target.value })}
        />
      </label>
      <label className="form-label">
        日期止
        <input
          className="form-control"
          type="date"
          value={value.to}
          onChange={(e) => onChange({ ...value, to: e.target.value })}
        />
      </label>
      <select
        aria-label="任务排序"
        className="form-control"
        value={value.sort}
        onChange={(e) => onChange({ ...value, sort: e.target.value })}
      >
        <option value="DUE">截止时间</option>
        <option value="PRIORITY">优先级</option>
        <option value="CREATED">创建时间</option>
        <option value="UPDATED">最近修改</option>
      </select>
      <button onClick={() => onChange(emptyTaskFilter)}>清除筛选</button>
    </div>
  );
}
