import type { GoalHorizon, IdeaStatus, ItemStatus, LogKind, ProjectStatus } from "@/features/journey/types";

export const projectStatusLabels: Record<ProjectStatus, string> = { PLANNING: "计划中", ACTIVE: "进行中", PAUSED: "暂停", COMPLETED: "已完成", ARCHIVED: "已归档" };
export const itemStatusLabels: Record<ItemStatus, string> = { TODO: "待开始", ACTIVE: "进行中", DONE: "已完成", BLOCKED: "受阻" };
export const ideaStatusLabels: Record<IdeaStatus, string> = { NEW: "刚刚想到", RESEARCH: "值得研究", WAITING: "等待时机", CONVERTED: "已转为项目", DROPPED: "暂时放弃" };
export const horizonLabels: Record<GoalHorizon, string> = { YEAR: "一年目标", THREE_YEARS: "三年目标", FIVE_YEARS: "五年目标", LIFETIME: "长期愿景" };
export const logKindLabels: Record<LogKind, string> = { NOTE: "项目记录", DECISION: "重要决定", PROBLEM: "当前困难", DISCOVERY: "新发现", SUMMARY: "阶段总结" };

export function dateInputValue(timestamp: number | null) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function timestampFromDate(value: FormDataEntryValue | null) {
  const text = String(value ?? "");
  return text ? new Date(`${text}T12:00:00`).getTime() : null;
}

export function displayDate(timestamp: number | null) {
  return timestamp ? new Date(timestamp).toLocaleDateString("zh-CN", { year: "numeric", month: "short", day: "numeric" }) : "未设日期";
}
