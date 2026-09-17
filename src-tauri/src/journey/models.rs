use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JourneyProject {
    pub id: String,
    pub title: String,
    pub project_type: String,
    pub summary: String,
    pub description: String,
    pub status: String,
    pub progress: i64,
    pub current_goal: String,
    pub target_date: Option<i64>,
    pub accent: String,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JourneyProjectInput {
    pub title: String,
    pub project_type: String,
    #[serde(default)]
    pub summary: String,
    #[serde(default)]
    pub description: String,
    pub status: String,
    pub progress: i64,
    #[serde(default)]
    pub current_goal: String,
    pub target_date: Option<i64>,
    #[serde(default = "default_accent")]
    pub accent: String,
}

fn default_accent() -> String {
    "#5b6ee1".to_string()
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JourneyProjectItem {
    pub id: String,
    pub project_id: String,
    pub title: String,
    pub description: String,
    pub status: String,
    pub progress: i64,
    pub priority: String,
    pub target_date: Option<i64>,
    pub sort_order: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JourneyProjectItemInput {
    pub project_id: String,
    pub title: String,
    #[serde(default)]
    pub description: String,
    pub status: String,
    pub progress: i64,
    pub priority: String,
    pub target_date: Option<i64>,
    #[serde(default)]
    pub sort_order: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JourneyMilestone {
    pub id: String,
    pub project_id: String,
    pub title: String,
    pub target_date: Option<i64>,
    pub is_completed: bool,
    pub sort_order: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JourneyMilestoneInput {
    pub project_id: String,
    pub title: String,
    pub target_date: Option<i64>,
    #[serde(default)]
    pub is_completed: bool,
    #[serde(default)]
    pub sort_order: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JourneyLog {
    pub id: String,
    pub project_id: String,
    pub kind: String,
    pub content: String,
    pub created_at: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JourneyLogInput {
    pub project_id: String,
    pub kind: String,
    pub content: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JourneyIdea {
    pub id: String,
    pub title: String,
    pub description: String,
    pub status: String,
    pub tags: String,
    pub value_score: i64,
    pub converted_project_id: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JourneyIdeaInput {
    pub title: String,
    #[serde(default)]
    pub description: String,
    pub status: String,
    #[serde(default)]
    pub tags: String,
    pub value_score: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JourneyGoal {
    pub id: String,
    pub title: String,
    pub reason: String,
    pub horizon: String,
    pub progress: i64,
    pub target_date: Option<i64>,
    pub next_action: String,
    pub linked_project_ids: Vec<String>,
    pub status: String,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JourneyGoalInput {
    pub title: String,
    #[serde(default)]
    pub reason: String,
    pub horizon: String,
    pub progress: i64,
    pub target_date: Option<i64>,
    #[serde(default)]
    pub next_action: String,
    #[serde(default)]
    pub linked_project_ids: Vec<String>,
    pub status: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JourneyIdeaSummary {
    pub id: String,
    pub title: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JourneyGoalSummary {
    pub id: String,
    pub title: String,
    pub horizon: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JourneyDashboard {
    pub projects: Vec<JourneyProject>,
    pub ideas: Vec<JourneyIdea>,
    pub goals: Vec<JourneyGoal>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JourneyProjectDetail {
    pub project: JourneyProject,
    pub items: Vec<JourneyProjectItem>,
    pub milestones: Vec<JourneyMilestone>,
    pub logs: Vec<JourneyLog>,
    pub source_idea: Option<JourneyIdeaSummary>,
    pub linked_goals: Vec<JourneyGoalSummary>,
}
