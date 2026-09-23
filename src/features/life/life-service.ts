import { invoke } from "@tauri-apps/api/core";
export type TaskStatus = "TODO" | "ACTIVE" | "DONE" | "CANCELLED";
export type TaskPriority = "NORMAL" | "IMPORTANT" | "URGENT";
export interface DailyTask {
    id: string;
    title: string;
    note: string;
    status: TaskStatus;
    priority: TaskPriority;
    plannedDay: string | null;
    dueAt: number | null;
    projectId: string | null;
    projectTitle: string | null;
    parentId: string | null;
    sourceItemId: string | null;
    completedAt: number | null;
    childCount: number;
    createdAt: number;
    updatedAt: number;
}
export interface DailyTaskInput {
    title: string;
    note: string;
    status: TaskStatus;
    priority: TaskPriority;
    plannedDay: string | null;
    dueAt: number | null;
    projectId: string | null;
    parentId: string | null;
}
export interface DailyEvent {
    id: string;
    title: string;
    allDay: boolean;
    dayKey: string | null;
    startsAt: number | null;
    endsAt: number | null;
    location: string;
    note: string;
    createdAt: number;
    updatedAt: number;
}
export interface DailyEventInput {
    title: string;
    allDay: boolean;
    dayKey: string | null;
    startsAt: number | null;
    endsAt: number | null;
    location: string;
    note: string;
}
export interface KnowledgeNote {
    id: string;
    title: string;
    body: string;
    tags: string;
    isPinned: boolean;
    isArchived: boolean;
    deletedAt: number | null;
    projectId: string | null;
    projectTitle: string | null;
    taskId: string | null;
    taskTitle: string | null;
    createdAt: number;
    updatedAt: number;
}
export interface KnowledgeNoteInput {
    title: string;
    body: string;
    tags: string;
    isPinned: boolean;
    isArchived: boolean;
    projectId: string | null;
    taskId: string | null;
}
export interface TodaySummary {
    tasks: DailyTask[];
    events: DailyEvent[];
    overdueCount: number;
    plannedExpenses: Array<{
        id: string;
        title: string;
        amount: number;
        plannedDate: number;
    }>;
    projects: Array<{
        id: string;
        title: string;
        progress: number;
        accent: string;
        isPinned: boolean;
    }>;
}
const desktop = () => { if (!("__TAURI_INTERNALS__" in window))
    throw new Error("此功能需要在桌面应用中使用"); };
const call = async <T>(command: string, args?: Record<string, unknown>) => { desktop(); try {
    return await invoke<T>(command, args);
}
catch (reason) {
    throw new Error(reason instanceof Error ? reason.message : typeof reason === "string" ? reason : "操作失败");
} };
export const listTasks = (view = "ALL", projectId?: string) => call<DailyTask[]>("list_daily_tasks", { view, projectId: projectId ?? null });
export const saveTask = (input: DailyTaskInput, idOpt?: string) => call<string>("save_daily_task", { input, idOpt });
export const setTaskStatus = (id: string, status: TaskStatus) => call<void>("set_daily_task_status", { id, status });
export const deleteTask = (id: string) => call<void>("delete_daily_task", { id });
export const convertJourneyItem = (itemId: string) => call<string>("convert_journey_item_to_task", { itemId });
export const listEvents = (fromDay: string, toDay: string, fromAt: number, toAt: number) => call<DailyEvent[]>("list_daily_events", { fromDay, toDay, fromAt, toAt });
export const saveEvent = (input: DailyEventInput, idOpt?: string) => call<string>("save_daily_event", { input, idOpt });
export const deleteEvent = (id: string) => call<void>("delete_daily_event", { id });
export const listNotes = (view = "ACTIVE", query = "", projectId?: string) => call<KnowledgeNote[]>("list_knowledge_notes", { view, query, projectId: projectId ?? null });
export const getNote = (id: string) => call<KnowledgeNote>("get_knowledge_note", { id });
export const saveNote = (input: KnowledgeNoteInput, idOpt?: string) => call<string>("save_knowledge_note", { input, idOpt });
export const setNoteState = (id: string, action: "ARCHIVE" | "UNARCHIVE" | "TRASH" | "RESTORE") => call<void>("set_knowledge_note_state", { id, action });
export const deleteNotePermanently = (id: string) => call<void>("delete_knowledge_note_permanently", { id });
export const getToday = (dayKey: string, startAt: number, endAt: number) => call<TodaySummary>("get_today_summary", { dayKey, startAt, endAt });
export const pinTodayProject = (projectId: string, pinned: boolean) => call<void>("set_today_project_pinned", { projectId, pinned });
export const localDay = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
