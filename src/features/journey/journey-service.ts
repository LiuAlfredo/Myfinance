import { invoke } from "@tauri-apps/api/core";
import type {
  JourneyDashboard, JourneyGoal, JourneyIdea, JourneyProject, JourneyProjectDetail,
  JourneyProjectInput, JourneyProjectItem, JourneyMilestone, LogKind,
} from "@/features/journey/types";

function requireDesktop() {
  if (!("__TAURI_INTERNALS__" in window)) throw new Error("我的进程只能在 My Personal Affairs 桌面应用中使用");
}

export async function getJourneyDashboard(): Promise<JourneyDashboard> { requireDesktop(); return invoke("get_journey_dashboard"); }
export async function getJourneyProject(id: string): Promise<JourneyProjectDetail> { requireDesktop(); return invoke("get_journey_project", { id }); }
export async function saveJourneyProject(input: JourneyProjectInput, projectId?: string): Promise<JourneyProject> { requireDesktop(); return invoke("save_journey_project", { input, idOpt: projectId }); }
export async function deleteJourneyProject(projectId: string): Promise<void> { requireDesktop(); await invoke("delete_journey_project", { id: projectId }); }
export async function saveJourneyProjectItem(input: Omit<JourneyProjectItem, "id">, itemId?: string): Promise<void> { requireDesktop(); await invoke("save_journey_project_item", { input, idOpt: itemId }); }
export async function saveJourneyMilestone(input: Omit<JourneyMilestone, "id">, milestoneId?: string): Promise<void> { requireDesktop(); await invoke("save_journey_milestone", { input, idOpt: milestoneId }); }
export async function toggleJourneyMilestone(id: string, completed: boolean): Promise<void> { requireDesktop(); await invoke("toggle_journey_milestone", { id, completed }); }
export async function addJourneyLog(projectId: string, kind: LogKind, content: string): Promise<void> { requireDesktop(); await invoke("add_journey_log", { input: { projectId, kind, content } }); }
export async function saveJourneyIdea(input: Omit<JourneyIdea, "id" | "convertedProjectId" | "createdAt" | "updatedAt">, ideaId?: string): Promise<void> { requireDesktop(); await invoke("save_journey_idea", { input, idOpt: ideaId }); }
export async function deleteJourneyIdea(ideaId: string): Promise<void> { requireDesktop(); await invoke("delete_journey_idea", { id: ideaId }); }
export async function convertJourneyIdea(ideaId: string): Promise<string> { requireDesktop(); return invoke("convert_journey_idea", { ideaId }); }
export async function saveJourneyGoal(input: Omit<JourneyGoal, "id" | "createdAt" | "updatedAt">, goalId?: string): Promise<void> { requireDesktop(); await invoke("save_journey_goal", { input, idOpt: goalId }); }
