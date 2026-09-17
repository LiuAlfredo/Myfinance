mod models;

use crate::database::{connect, id, now};
use models::*;
use rusqlite::{params, Connection, OptionalExtension};

const PROJECT_TYPES: &[&str] = &["WORK", "PERSONAL"];
const PROJECT_STATUSES: &[&str] = &["PLANNING", "ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"];
const ITEM_STATUSES: &[&str] = &["TODO", "ACTIVE", "DONE", "BLOCKED"];
const PRIORITIES: &[&str] = &["LOW", "MEDIUM", "HIGH"];
const IDEA_STATUSES: &[&str] = &["NEW", "RESEARCH", "WAITING", "CONVERTED", "DROPPED"];
const GOAL_HORIZONS: &[&str] = &["YEAR", "THREE_YEARS", "FIVE_YEARS", "LIFETIME"];
const GOAL_STATUSES: &[&str] = &["ACTIVE", "PAUSED", "ACHIEVED"];
const LOG_KINDS: &[&str] = &["NOTE", "DECISION", "PROBLEM", "DISCOVERY", "SUMMARY"];

fn required(value: &str, label: &str, maximum: usize) -> Result<String, String> {
    let value = value.trim();
    if value.is_empty() {
        return Err(format!("{label}不能为空"));
    }
    if value.chars().count() > maximum {
        return Err(format!("{label}不能超过 {maximum} 个字符"));
    }
    Ok(value.to_string())
}

fn one_of(value: &str, values: &[&str], label: &str) -> Result<(), String> {
    if values.contains(&value) {
        Ok(())
    } else {
        Err(format!("{label}无效"))
    }
}

fn checked_progress(value: i64) -> Result<i64, String> {
    if (0..=100).contains(&value) {
        Ok(value)
    } else {
        Err("完成度必须在 0 到 100 之间".to_string())
    }
}

fn project_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<JourneyProject> {
    Ok(JourneyProject {
        id: row.get(0)?,
        title: row.get(1)?,
        project_type: row.get(2)?,
        summary: row.get(3)?,
        description: row.get(4)?,
        status: row.get(5)?,
        progress: row.get(6)?,
        current_goal: row.get(7)?,
        target_date: row.get(8)?,
        accent: row.get(9)?,
        created_at: row.get(10)?,
        updated_at: row.get(11)?,
    })
}

fn select_project(connection: &Connection, project_id: &str) -> Result<JourneyProject, String> {
    connection.query_row("SELECT id,title,project_type,summary,description,status,progress,current_goal,target_date,accent,created_at,updated_at FROM journey_projects WHERE id=?1", [project_id], project_from_row)
        .optional().map_err(|error| error.to_string())?.ok_or_else(|| "项目不存在".to_string())
}

fn select_projects(connection: &Connection) -> Result<Vec<JourneyProject>, String> {
    let mut query = connection.prepare("SELECT id,title,project_type,summary,description,status,progress,current_goal,target_date,accent,created_at,updated_at FROM journey_projects ORDER BY CASE status WHEN 'ACTIVE' THEN 0 WHEN 'PLANNING' THEN 1 WHEN 'PAUSED' THEN 2 WHEN 'COMPLETED' THEN 3 ELSE 4 END,updated_at DESC").map_err(|e| e.to_string())?;
    let projects = query
        .query_map([], project_from_row)
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(projects)
}

fn select_ideas(connection: &Connection) -> Result<Vec<JourneyIdea>, String> {
    let mut query = connection.prepare("SELECT id,title,description,status,tags,value_score,converted_project_id,created_at,updated_at FROM journey_ideas ORDER BY updated_at DESC").map_err(|e| e.to_string())?;
    let ideas = query
        .query_map([], |row| {
            Ok(JourneyIdea {
                id: row.get(0)?,
                title: row.get(1)?,
                description: row.get(2)?,
                status: row.get(3)?,
                tags: row.get(4)?,
                value_score: row.get(5)?,
                converted_project_id: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(ideas)
}

fn select_goals(connection: &Connection) -> Result<Vec<JourneyGoal>, String> {
    let mut query = connection.prepare("SELECT id,title,reason,horizon,progress,target_date,next_action,linked_project_ids,status,created_at,updated_at FROM journey_goals ORDER BY CASE status WHEN 'ACTIVE' THEN 0 WHEN 'PAUSED' THEN 1 ELSE 2 END,updated_at DESC").map_err(|e| e.to_string())?;
    let rows = query
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, i64>(4)?,
                row.get::<_, Option<i64>>(5)?,
                row.get::<_, String>(6)?,
                row.get::<_, String>(7)?,
                row.get::<_, String>(8)?,
                row.get::<_, i64>(9)?,
                row.get::<_, i64>(10)?,
            ))
        })
        .map_err(|e| e.to_string())?;
    let mut goals = Vec::new();
    for row in rows {
        let (
            id,
            title,
            reason,
            horizon,
            progress,
            target_date,
            next_action,
            linked,
            status,
            created_at,
            updated_at,
        ) = row.map_err(|e| e.to_string())?;
        goals.push(JourneyGoal {
            id,
            title,
            reason,
            horizon,
            progress,
            target_date,
            next_action,
            linked_project_ids: serde_json::from_str(&linked).unwrap_or_default(),
            status,
            created_at,
            updated_at,
        });
    }
    Ok(goals)
}

#[tauri::command]
pub fn get_journey_dashboard(app: tauri::AppHandle) -> Result<JourneyDashboard, String> {
    let connection = connect(&app).map_err(|e| e.to_string())?;
    Ok(JourneyDashboard {
        projects: select_projects(&connection)?,
        ideas: select_ideas(&connection)?,
        goals: select_goals(&connection)?,
    })
}

#[tauri::command]
pub fn get_journey_project(
    app: tauri::AppHandle,
    id: String,
) -> Result<JourneyProjectDetail, String> {
    let connection = connect(&app).map_err(|e| e.to_string())?;
    let project = select_project(&connection, &id)?;
    let mut item_query = connection.prepare("SELECT id,project_id,title,description,status,progress,priority,target_date,sort_order FROM journey_project_items WHERE project_id=?1 ORDER BY sort_order,created_at").map_err(|e| e.to_string())?;
    let items = item_query
        .query_map([&id], |r| {
            Ok(JourneyProjectItem {
                id: r.get(0)?,
                project_id: r.get(1)?,
                title: r.get(2)?,
                description: r.get(3)?,
                status: r.get(4)?,
                progress: r.get(5)?,
                priority: r.get(6)?,
                target_date: r.get(7)?,
                sort_order: r.get(8)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    let mut milestone_query = connection.prepare("SELECT id,project_id,title,target_date,is_completed,sort_order FROM journey_milestones WHERE project_id=?1 ORDER BY sort_order,created_at").map_err(|e| e.to_string())?;
    let milestones = milestone_query
        .query_map([&id], |r| {
            Ok(JourneyMilestone {
                id: r.get(0)?,
                project_id: r.get(1)?,
                title: r.get(2)?,
                target_date: r.get(3)?,
                is_completed: r.get::<_, i64>(4)? != 0,
                sort_order: r.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    let mut log_query = connection.prepare("SELECT id,project_id,kind,content,created_at FROM journey_logs WHERE project_id=?1 ORDER BY created_at DESC").map_err(|e| e.to_string())?;
    let logs = log_query
        .query_map([&id], |r| {
            Ok(JourneyLog {
                id: r.get(0)?,
                project_id: r.get(1)?,
                kind: r.get(2)?,
                content: r.get(3)?,
                created_at: r.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    let source_idea = connection
        .query_row(
            "SELECT id, title FROM journey_ideas WHERE converted_project_id=?1",
            [&id],
            |r| Ok(JourneyIdeaSummary { id: r.get(0)?, title: r.get(1)? }),
        )
        .optional()
        .map_err(|e| e.to_string())?;

    let mut goals_query = connection
        .prepare("SELECT id, title, horizon, linked_project_ids FROM journey_goals ORDER BY updated_at DESC")
        .map_err(|e| e.to_string())?;
    let goal_rows = goals_query
        .query_map([], |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, String>(2)?,
                r.get::<_, String>(3)?,
            ))
        })
        .map_err(|e| e.to_string())?;
    let mut linked_goals = Vec::new();
    for row in goal_rows {
        let (g_id, g_title, g_horizon, g_linked) = row.map_err(|e| e.to_string())?;
        let ids: Vec<String> = serde_json::from_str(&g_linked).unwrap_or_default();
        if ids.contains(&id) {
            linked_goals.push(JourneyGoalSummary {
                id: g_id,
                title: g_title,
                horizon: g_horizon,
            });
        }
    }

    Ok(JourneyProjectDetail {
        project,
        items,
        milestones,
        logs,
        source_idea,
        linked_goals,
    })
}


#[tauri::command]
pub fn save_journey_project(
    app: tauri::AppHandle,
    input: JourneyProjectInput,
    id_opt: Option<String>,
) -> Result<JourneyProject, String> {
    let title = required(&input.title, "项目名称", 120)?;
    one_of(&input.project_type, PROJECT_TYPES, "项目类型")?;
    one_of(&input.status, PROJECT_STATUSES, "项目状态")?;
    let progress = checked_progress(input.progress)?;
    let project_id = id_opt.unwrap_or_else(id);
    let timestamp = now();
    let connection = connect(&app).map_err(|e| e.to_string())?;
    connection.execute("INSERT INTO journey_projects(id,title,project_type,summary,description,status,progress,current_goal,target_date,accent,created_at,updated_at) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?11) ON CONFLICT(id) DO UPDATE SET title=excluded.title,project_type=excluded.project_type,summary=excluded.summary,description=excluded.description,status=excluded.status,progress=excluded.progress,current_goal=excluded.current_goal,target_date=excluded.target_date,accent=excluded.accent,updated_at=excluded.updated_at", params![project_id,title,input.project_type,input.summary.trim(),input.description.trim(),input.status,progress,input.current_goal.trim(),input.target_date,input.accent,timestamp]).map_err(|e| e.to_string())?;
    select_project(&connection, &project_id)
}

#[tauri::command]
pub fn delete_journey_project(app: tauri::AppHandle, id: String) -> Result<(), String> {
    let mut connection = connect(&app).map_err(|e| e.to_string())?;
    let transaction = connection.transaction().map_err(|e| e.to_string())?;
    transaction
        .execute(
            "UPDATE journey_ideas SET converted_project_id=NULL,status=CASE WHEN status='CONVERTED' THEN 'WAITING' ELSE status END,updated_at=?2 WHERE converted_project_id=?1",
            params![id, now()],
        )
        .map_err(|e| e.to_string())?;
    let goal_links = {
        let mut query = transaction
            .prepare("SELECT id,linked_project_ids FROM journey_goals")
            .map_err(|e| e.to_string())?;
        let links = query
            .query_map([], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        links
    };
    for (goal_id, linked_json) in goal_links {
        let mut linked: Vec<String> = serde_json::from_str(&linked_json).unwrap_or_default();
        let original_length = linked.len();
        linked.retain(|project_id| project_id != &id);
        if linked.len() != original_length {
            transaction
                .execute(
                    "UPDATE journey_goals SET linked_project_ids=?2,updated_at=?3 WHERE id=?1",
                    params![
                        goal_id,
                        serde_json::to_string(&linked).map_err(|e| e.to_string())?,
                        now()
                    ],
                )
                .map_err(|e| e.to_string())?;
        }
    }
    let changed = transaction
        .execute("DELETE FROM journey_projects WHERE id=?1", [&id])
        .map_err(|e| e.to_string())?;
    if changed == 0 {
        return Err("项目不存在".to_string());
    }
    transaction.commit().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn save_journey_project_item(
    app: tauri::AppHandle,
    input: JourneyProjectItemInput,
    id_opt: Option<String>,
) -> Result<(), String> {
    let title = required(&input.title, "功能名称", 120)?;
    one_of(&input.status, ITEM_STATUSES, "功能状态")?;
    one_of(&input.priority, PRIORITIES, "优先级")?;
    let progress = checked_progress(input.progress)?;
    let connection = connect(&app).map_err(|e| e.to_string())?;
    select_project(&connection, &input.project_id)?;
    connection.execute("INSERT INTO journey_project_items(id,project_id,title,description,status,progress,priority,target_date,sort_order,created_at,updated_at) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?10) ON CONFLICT(id) DO UPDATE SET title=excluded.title,description=excluded.description,status=excluded.status,progress=excluded.progress,priority=excluded.priority,target_date=excluded.target_date,sort_order=excluded.sort_order,updated_at=excluded.updated_at", params![id_opt.unwrap_or_else(id),input.project_id,title,input.description.trim(),input.status,progress,input.priority,input.target_date,input.sort_order,now()]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn save_journey_milestone(
    app: tauri::AppHandle,
    input: JourneyMilestoneInput,
    id_opt: Option<String>,
) -> Result<(), String> {
    let title = required(&input.title, "里程碑名称", 120)?;
    let connection = connect(&app).map_err(|e| e.to_string())?;
    select_project(&connection, &input.project_id)?;
    connection.execute("INSERT INTO journey_milestones(id,project_id,title,target_date,is_completed,sort_order,created_at,updated_at) VALUES(?1,?2,?3,?4,?5,?6,?7,?7) ON CONFLICT(id) DO UPDATE SET title=excluded.title,target_date=excluded.target_date,is_completed=excluded.is_completed,sort_order=excluded.sort_order,updated_at=excluded.updated_at", params![id_opt.unwrap_or_else(id),input.project_id,title,input.target_date,input.is_completed as i64,input.sort_order,now()]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn toggle_journey_milestone(
    app: tauri::AppHandle,
    id: String,
    completed: bool,
) -> Result<(), String> {
    let connection = connect(&app).map_err(|e| e.to_string())?;
    if connection
        .execute(
            "UPDATE journey_milestones SET is_completed=?2,updated_at=?3 WHERE id=?1",
            params![id, completed as i64, now()],
        )
        .map_err(|e| e.to_string())?
        == 0
    {
        Err("里程碑不存在".to_string())
    } else {
        Ok(())
    }
}

#[tauri::command]
pub fn add_journey_log(app: tauri::AppHandle, input: JourneyLogInput) -> Result<(), String> {
    one_of(&input.kind, LOG_KINDS, "记录类型")?;
    let content = required(&input.content, "记录内容", 2000)?;
    let connection = connect(&app).map_err(|e| e.to_string())?;
    select_project(&connection, &input.project_id)?;
    connection.execute("INSERT INTO journey_logs(id,project_id,kind,content,created_at) VALUES(?1,?2,?3,?4,?5)", params![id(),input.project_id,input.kind,content,now()]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]

pub fn delete_journey_project_item(app: tauri::AppHandle, id: String) -> Result<(), String> {
    let connection = connect(&app).map_err(|e| e.to_string())?;
    let changed = connection
        .execute("DELETE FROM journey_project_items WHERE id=?1", [&id])
        .map_err(|e| e.to_string())?;
    if changed == 0 {
        Err("任务不存在".to_string())
    } else {
        Ok(())
    }
}

#[tauri::command]
pub fn delete_journey_milestone(app: tauri::AppHandle, id: String) -> Result<(), String> {
    let connection = connect(&app).map_err(|e| e.to_string())?;
    let changed = connection
        .execute("DELETE FROM journey_milestones WHERE id=?1", [&id])
        .map_err(|e| e.to_string())?;
    if changed == 0 {
        Err("里程碑不存在".to_string())
    } else {
        Ok(())
    }
}

#[tauri::command]
pub fn delete_journey_log(app: tauri::AppHandle, id: String) -> Result<(), String> {
    let connection = connect(&app).map_err(|e| e.to_string())?;
    let changed = connection
        .execute("DELETE FROM journey_logs WHERE id=?1", [&id])
        .map_err(|e| e.to_string())?;
    if changed == 0 {
        Err("项目记录不存在".to_string())
    } else {
        Ok(())
    }
}

#[tauri::command]
pub fn update_journey_log(
    app: tauri::AppHandle,
    id: String,
    kind: String,
    content: String,
) -> Result<(), String> {
    one_of(&kind, LOG_KINDS, "记录类型")?;
    let content = required(&content, "记录内容", 2000)?;
    let connection = connect(&app).map_err(|e| e.to_string())?;
    let changed = connection
        .execute(
            "UPDATE journey_logs SET kind=?2, content=?3 WHERE id=?1",
            params![id, kind, content],
        )
        .map_err(|e| e.to_string())?;
    if changed == 0 {
        Err("项目记录不存在".to_string())
    } else {
        Ok(())
    }
}

#[tauri::command]
pub fn save_journey_idea(
    app: tauri::AppHandle,
    input: JourneyIdeaInput,
    id_opt: Option<String>,
) -> Result<(), String> {
    let title = required(&input.title, "想法标题", 120)?;
    one_of(&input.status, IDEA_STATUSES, "想法状态")?;
    if !(1..=5).contains(&input.value_score) {
        return Err("价值评分必须在 1 到 5 之间".to_string());
    }
    let connection = connect(&app).map_err(|e| e.to_string())?;
    let timestamp = now();
    connection.execute("INSERT INTO journey_ideas(id,title,description,status,tags,value_score,created_at,updated_at) VALUES(?1,?2,?3,?4,?5,?6,?7,?7) ON CONFLICT(id) DO UPDATE SET title=excluded.title,description=excluded.description,status=excluded.status,tags=excluded.tags,value_score=excluded.value_score,updated_at=excluded.updated_at", params![id_opt.unwrap_or_else(id),title,input.description.trim(),input.status,input.tags.trim(),input.value_score,timestamp]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_journey_idea(app: tauri::AppHandle, id: String) -> Result<(), String> {
    let connection = connect(&app).map_err(|e| e.to_string())?;
    let changed = connection
        .execute("DELETE FROM journey_ideas WHERE id=?1", [&id])
        .map_err(|e| e.to_string())?;
    if changed == 0 {
        Err("想法不存在".to_string())
    } else {
        Ok(())
    }
}

#[tauri::command]
pub fn convert_journey_idea(app: tauri::AppHandle, idea_id: String) -> Result<String, String> {
    let mut connection = connect(&app).map_err(|e| e.to_string())?;
    let transaction = connection.transaction().map_err(|e| e.to_string())?;
    let idea = transaction
        .query_row(
            "SELECT title,description,converted_project_id FROM journey_ideas WHERE id=?1",
            [&idea_id],
            |r| {
                Ok((
                    r.get::<_, String>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, Option<String>>(2)?,
                ))
            },
        )
        .optional()
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "想法不存在".to_string())?;
    if let Some(existing) = idea.2 {
        return Ok(existing);
    }
    let project_id = id();
    let timestamp = now();
    transaction.execute("INSERT INTO journey_projects(id,title,project_type,summary,description,status,progress,current_goal,accent,created_at,updated_at) VALUES(?1,?2,'PERSONAL',?3,?3,'PLANNING',0,'明确第一步','#8b5cf6',?4,?4)", params![project_id,idea.0,idea.1,timestamp]).map_err(|e| e.to_string())?;
    transaction.execute("UPDATE journey_ideas SET status='CONVERTED',converted_project_id=?2,updated_at=?3 WHERE id=?1", params![idea_id,project_id,timestamp]).map_err(|e| e.to_string())?;
    transaction.commit().map_err(|e| e.to_string())?;
    Ok(project_id)
}

#[tauri::command]
pub fn save_journey_goal(
    app: tauri::AppHandle,
    input: JourneyGoalInput,
    id_opt: Option<String>,
) -> Result<(), String> {
    let title = required(&input.title, "目标名称", 120)?;
    one_of(&input.horizon, GOAL_HORIZONS, "目标期限")?;
    one_of(&input.status, GOAL_STATUSES, "目标状态")?;
    let progress = checked_progress(input.progress)?;
    let linked = serde_json::to_string(&input.linked_project_ids).map_err(|e| e.to_string())?;
    let connection = connect(&app).map_err(|e| e.to_string())?;
    let timestamp = now();
    connection.execute("INSERT INTO journey_goals(id,title,reason,horizon,progress,target_date,next_action,linked_project_ids,status,created_at,updated_at) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?10) ON CONFLICT(id) DO UPDATE SET title=excluded.title,reason=excluded.reason,horizon=excluded.horizon,progress=excluded.progress,target_date=excluded.target_date,next_action=excluded.next_action,linked_project_ids=excluded.linked_project_ids,status=excluded.status,updated_at=excluded.updated_at", params![id_opt.unwrap_or_else(id),title,input.reason.trim(),input.horizon,progress,input.target_date,input.next_action.trim(),linked,input.status,timestamp]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_journey_goal(app: tauri::AppHandle, id: String) -> Result<(), String> {
    let connection = connect(&app).map_err(|e| e.to_string())?;
    let changed = connection
        .execute("DELETE FROM journey_goals WHERE id=?1", [&id])
        .map_err(|e| e.to_string())?;
    if changed == 0 {
        Err("长期目标不存在".to_string())
    } else {
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;
    #[test]
    fn validates_progress_boundaries() {
        assert!(checked_progress(0).is_ok());
        assert!(checked_progress(100).is_ok());
        assert!(checked_progress(-1).is_err());
        assert!(checked_progress(101).is_err());
    }
    #[test]
    fn rejects_unknown_enums() {
        assert!(one_of("ACTIVE", PROJECT_STATUSES, "状态").is_ok());
        assert!(one_of("UNKNOWN", PROJECT_STATUSES, "状态").is_err());
    }

    #[test]
    fn journey_migration_creates_all_module_tables() {
        let connection = Connection::open_in_memory().expect("database should open");
        connection
            .execute_batch("CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY, applied_at INTEGER NOT NULL);")
            .expect("migration table should be created");
        connection
            .execute_batch(include_str!("../../migrations/003_journey.sql"))
            .expect("journey migration should succeed");
        for table in [
            "journey_projects",
            "journey_project_items",
            "journey_milestones",
            "journey_logs",
            "journey_ideas",
            "journey_goals",
        ] {
            let count: i64 = connection
                .query_row(
                    "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=?1",
                    [table],
                    |row| row.get(0),
                )
                .expect("table lookup should succeed");
            assert_eq!(count, 1, "{table} should exist");
        }
    }
}
