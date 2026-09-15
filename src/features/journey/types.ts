export type ProjectType = "WORK" | "PERSONAL";
export type ProjectStatus = "PLANNING" | "ACTIVE" | "PAUSED" | "COMPLETED" | "ARCHIVED";
export type ItemStatus = "TODO" | "ACTIVE" | "DONE" | "BLOCKED";
export type IdeaStatus = "NEW" | "RESEARCH" | "WAITING" | "CONVERTED" | "DROPPED";
export type GoalHorizon = "YEAR" | "THREE_YEARS" | "FIVE_YEARS" | "LIFETIME";
export type GoalStatus = "ACTIVE" | "PAUSED" | "ACHIEVED";
export type LogKind = "NOTE" | "DECISION" | "PROBLEM" | "DISCOVERY" | "SUMMARY";

export interface JourneyProject {
  id: string; title: string; projectType: ProjectType; summary: string; description: string;
  status: ProjectStatus; progress: number; currentGoal: string; targetDate: number | null;
  accent: string; createdAt: number; updatedAt: number;
}

export type JourneyProjectInput = Omit<JourneyProject, "id" | "createdAt" | "updatedAt">;

export interface JourneyProjectItem {
  id: string; projectId: string; title: string; description: string; status: ItemStatus;
  progress: number; priority: "LOW" | "MEDIUM" | "HIGH"; targetDate: number | null; sortOrder: number;
}

export interface JourneyMilestone {
  id: string; projectId: string; title: string; targetDate: number | null; isCompleted: boolean; sortOrder: number;
}

export interface JourneyLog {
  id: string; projectId: string; kind: LogKind; content: string; createdAt: number;
}

export interface JourneyIdea {
  id: string; title: string; description: string; status: IdeaStatus; tags: string;
  valueScore: number; convertedProjectId: string | null; createdAt: number; updatedAt: number;
}

export interface JourneyGoal {
  id: string; title: string; reason: string; horizon: GoalHorizon; progress: number;
  targetDate: number | null; nextAction: string; linkedProjectIds: string[];
  status: GoalStatus; createdAt: number; updatedAt: number;
}

export interface JourneyDashboard { projects: JourneyProject[]; ideas: JourneyIdea[]; goals: JourneyGoal[] }
export interface JourneyProjectDetail { project: JourneyProject; items: JourneyProjectItem[]; milestones: JourneyMilestone[]; logs: JourneyLog[] }
