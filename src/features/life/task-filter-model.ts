import type { DailyTask } from "./life-service";
export interface TaskFilter {
  query: string;
  project: string;
  status: string;
  priority: string;
  from: string;
  to: string;
  sort: string;
  dateField: string;
}
export const emptyTaskFilter: TaskFilter = {
  query: "",
  project: "",
  status: "",
  priority: "",
  from: "",
  to: "",
  sort: "DUE",
  dateField: "PLANNED",
};
export function filterTasks(tasks: DailyTask[], filter: TaskFilter) {
  const day = (t: DailyTask) =>
    filter.dateField === "DUE"
      ? t.dueAt
        ? new Date(t.dueAt).getFullYear() +
          "-" +
          String(new Date(t.dueAt).getMonth() + 1).padStart(2, "0") +
          "-" +
          String(new Date(t.dueAt).getDate()).padStart(2, "0")
        : null
      : t.plannedDay;
  const q = filter.query.trim().toLocaleLowerCase();
  const weight = { URGENT: 0, IMPORTANT: 1, NORMAL: 2 };
  return tasks
    .filter(
      (t) =>
        (!q || `${t.title} ${t.note}`.toLocaleLowerCase().includes(q)) &&
        (!filter.project || t.projectId === filter.project) &&
        (!filter.status || t.status === filter.status) &&
        (!filter.priority || t.priority === filter.priority) &&
        (!filter.from || (day(t) !== null && day(t)! >= filter.from)) &&
        (!filter.to || (day(t) !== null && day(t)! <= filter.to)),
    )
    .sort((a, b) =>
      filter.sort === "PRIORITY"
        ? weight[a.priority] - weight[b.priority]
        : filter.sort === "CREATED"
          ? b.createdAt - a.createdAt
          : filter.sort === "UPDATED"
            ? b.updatedAt - a.updatedAt
            : (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity),
    );
}
