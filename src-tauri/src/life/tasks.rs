use super::shared::*;
use crate::database::{connect, id, now};
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DailyTask {
    id: String,
    title: String,
    note: String,
    status: String,
    priority: String,
    planned_day: Option<String>,
    due_at: Option<i64>,
    project_id: Option<String>,
    project_title: Option<String>,
    parent_id: Option<String>,
    source_item_id: Option<String>,
    completed_at: Option<i64>,
    child_count: i64,
    created_at: i64,
    updated_at: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DailyTaskInput {
    title: String,
    #[serde(default)]
    note: String,
    status: String,
    priority: String,
    planned_day: Option<String>,
    due_at: Option<i64>,
    project_id: Option<String>,
    parent_id: Option<String>,
    include_children: Option<bool>,
}

pub(super) fn task_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<DailyTask> {
    Ok(DailyTask {
        id: row.get(0)?,
        title: row.get(1)?,
        note: row.get(2)?,
        status: row.get(3)?,
        priority: row.get(4)?,
        planned_day: row.get(5)?,
        due_at: row.get(6)?,
        project_id: row.get(7)?,
        project_title: row.get(8)?,
        parent_id: row.get(9)?,
        source_item_id: row.get(10)?,
        completed_at: row.get(11)?,
        child_count: row.get(12)?,
        created_at: row.get(13)?,
        updated_at: row.get(14)?,
    })
}

#[tauri::command]
pub fn list_daily_tasks(
    app: tauri::AppHandle,
    view: Option<String>,
    project_id: Option<String>,
) -> Result<Vec<DailyTask>, String> {
    let connection = connect(&app).map_err(|e| e.to_string())?;
    let filter = match view.as_deref().unwrap_or("ALL") {
        "INBOX" => "t.status IN ('TODO','ACTIVE') AND t.planned_day IS NULL AND t.due_at IS NULL",
        "OPEN" => "t.status IN ('TODO','ACTIVE')",
        "COMPLETED" => "t.status='DONE'",
        "CANCELLED" => "t.status='CANCELLED'",
        "TRASH" => "0",
        _ => "1",
    };
    let sql=format!("SELECT t.id,t.title,t.note,t.status,t.priority,t.planned_day,t.due_at,t.project_id,p.title,t.parent_id,t.source_item_id,t.completed_at,(SELECT COUNT(*) FROM daily_tasks c WHERE c.parent_id=t.id),t.created_at,t.updated_at FROM daily_tasks t LEFT JOIN journey_projects p ON p.id=t.project_id WHERE {filter} AND (?1 IS NULL OR t.project_id=?1) ORDER BY CASE t.status WHEN 'ACTIVE' THEN 0 WHEN 'TODO' THEN 1 WHEN 'DONE' THEN 2 ELSE 3 END,CASE t.priority WHEN 'URGENT' THEN 0 WHEN 'IMPORTANT' THEN 1 ELSE 2 END,COALESCE(t.due_at,9223372036854775807),t.updated_at DESC");
    let mut statement = connection.prepare(&sql).map_err(|e| e.to_string())?;
    let result = statement
        .query_map([project_id], task_from_row)
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string());
    result
}

pub(super) fn would_create_task_cycle(
    connection: &rusqlite::Connection,
    task: &str,
    parent: &str,
) -> Result<bool, String> {
    connection.query_row(
        "WITH RECURSIVE descendants(id) AS (SELECT id FROM daily_tasks WHERE id=?1 UNION SELECT t.id FROM daily_tasks t JOIN descendants d ON t.parent_id=d.id) SELECT EXISTS(SELECT 1 FROM descendants WHERE id=?2)",
        params![task,parent], |r| r.get(0)).map_err(|e|e.to_string())
}

#[tauri::command]
pub fn save_daily_task(
    app: tauri::AppHandle,
    input: DailyTaskInput,
    id_opt: Option<String>,
) -> Result<String, String> {
    let title = required(&input.title, "任务标题", 200)?;
    if input.note.chars().count() > 8000 {
        return Err("任务备注过长".into());
    }
    if !TASK_STATUSES.contains(&input.status.as_str()) {
        return Err("任务状态无效".into());
    }
    if !PRIORITIES.contains(&input.priority.as_str()) {
        return Err("任务优先级无效".into());
    }
    if input.planned_day.as_deref().is_some_and(|d| !valid_day(d)) {
        return Err("计划日期无效".into());
    }
    let mut connection = connect(&app).map_err(|e| e.to_string())?;
    ensure_project(&connection, &input.project_id)?;
    let timestamp = now();
    let task_id = id_opt.clone().unwrap_or_else(id);
    if input.parent_id.as_deref() == Some(&task_id) {
        return Err("任务不能成为自己的子任务".into());
    }
    if let Some(parent) = &input.parent_id {
        let exists: bool = connection
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM daily_tasks WHERE id=?1)",
                [parent],
                |r| r.get(0),
            )
            .map_err(|e| e.to_string())?;
        if !exists {
            return Err("父任务不存在".into());
        }
        let cycle = would_create_task_cycle(&connection, &task_id, parent)?;
        if cycle {
            return Err("不能将任务移到自己的子任务下".into());
        }
    }
    let completed = if input.status == "DONE" {
        Some(timestamp)
    } else {
        None
    };
    let tx = connection.transaction().map_err(|e| e.to_string())?;
    if id_opt.is_some() {
        let changed=tx.execute("UPDATE daily_tasks SET title=?2,note=?3,status=?4,priority=?5,planned_day=?6,due_at=?7,project_id=?8,parent_id=?9,completed_at=CASE WHEN ?4='DONE' THEN COALESCE(completed_at,?10) ELSE NULL END,updated_at=?10 WHERE id=?1",params![task_id,title,input.note.trim(),input.status,input.priority,input.planned_day,input.due_at,input.project_id,input.parent_id,timestamp]).map_err(|e|e.to_string())?;
        if changed == 0 {
            return Err("任务不存在".into());
        }
    } else {
        tx.execute("INSERT INTO daily_tasks(id,title,note,status,priority,planned_day,due_at,project_id,parent_id,completed_at,created_at,updated_at) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?11)",params![task_id,title,input.note.trim(),input.status,input.priority,input.planned_day,input.due_at,input.project_id,input.parent_id,completed,timestamp]).map_err(|e|e.to_string())?;
    }
    if ["DONE", "TODO", "ACTIVE"].contains(&input.status.as_str()) {
        tx.execute("UPDATE journey_project_items SET status=CASE ?2 WHEN 'DONE' THEN 'DONE' WHEN 'ACTIVE' THEN 'ACTIVE' ELSE 'TODO' END,progress=CASE WHEN ?2='DONE' THEN 100 WHEN ?2='TODO' THEN 0 ELSE progress END,updated_at=?3 WHERE id=(SELECT source_item_id FROM daily_tasks WHERE id=?1)",params![task_id,input.status,timestamp]).map_err(|e|e.to_string())?;
    }
    if input.include_children.unwrap_or(false) && input.status == "DONE" {
        tx.execute("WITH RECURSIVE children(id) AS (SELECT id FROM daily_tasks WHERE parent_id=?1 UNION SELECT t.id FROM daily_tasks t JOIN children c ON t.parent_id=c.id) UPDATE daily_tasks SET status='DONE',completed_at=?2,updated_at=?2 WHERE id IN (SELECT id FROM children) AND status IN ('TODO','ACTIVE')",params![task_id,timestamp]).map_err(|e|e.to_string())?;
    }
    tx.commit().map_err(|e| e.to_string())?;
    Ok(task_id)
}

#[tauri::command]
pub fn set_daily_task_status(
    app: tauri::AppHandle,
    id: String,
    status: String,
    include_children: Option<bool>,
) -> Result<(), String> {
    if !TASK_STATUSES.contains(&status.as_str()) {
        return Err("任务状态无效".into());
    }
    let connection = connect(&app).map_err(|e| e.to_string())?;
    let timestamp = now();
    let tx = connection
        .unchecked_transaction()
        .map_err(|e| e.to_string())?;
    let changed=tx.execute("UPDATE daily_tasks SET status=?2,completed_at=CASE WHEN ?2='DONE' THEN COALESCE(completed_at,?3) ELSE NULL END,updated_at=?3 WHERE id=?1",params![id,status,timestamp]).map_err(|e|e.to_string())?;
    if changed == 0 {
        return Err("任务不存在".into());
    }
    if ["DONE", "TODO", "ACTIVE"].contains(&status.as_str()) {
        tx.execute("UPDATE journey_project_items SET status=CASE ?2 WHEN 'DONE' THEN 'DONE' WHEN 'ACTIVE' THEN 'ACTIVE' ELSE 'TODO' END,progress=CASE WHEN ?2='DONE' THEN 100 WHEN ?2='TODO' THEN 0 ELSE progress END,updated_at=?3 WHERE id=(SELECT source_item_id FROM daily_tasks WHERE id=?1)",params![id,status,timestamp]).map_err(|e|e.to_string())?;
    }
    if include_children.unwrap_or(false) {
        tx.execute("WITH RECURSIVE children(id) AS (SELECT id FROM daily_tasks WHERE parent_id=?1 UNION SELECT t.id FROM daily_tasks t JOIN children c ON t.parent_id=c.id) UPDATE daily_tasks SET status=?2,completed_at=CASE WHEN ?2='DONE' THEN COALESCE(completed_at,?3) ELSE NULL END,updated_at=?3 WHERE id IN (SELECT id FROM children) AND status NOT IN ('DONE','CANCELLED')",params![id,status,timestamp]).map_err(|e|e.to_string())?;
        if ["DONE", "TODO", "ACTIVE"].contains(&status.as_str()) {
            tx.execute("WITH RECURSIVE children(id) AS (SELECT id FROM daily_tasks WHERE parent_id=?1 UNION SELECT t.id FROM daily_tasks t JOIN children c ON t.parent_id=c.id) UPDATE journey_project_items SET status=CASE ?2 WHEN 'DONE' THEN 'DONE' WHEN 'ACTIVE' THEN 'ACTIVE' ELSE 'TODO' END,progress=CASE WHEN ?2='DONE' THEN 100 WHEN ?2='TODO' THEN 0 ELSE progress END,updated_at=?3 WHERE id IN (SELECT source_item_id FROM daily_tasks WHERE id IN (SELECT id FROM children) AND source_item_id IS NOT NULL)",params![id,status,timestamp]).map_err(|e|e.to_string())?;
        }
    }
    tx.commit().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_daily_task(app: tauri::AppHandle, id: String) -> Result<(), String> {
    let connection = connect(&app).map_err(|e| e.to_string())?;
    let changed = connection
        .execute("DELETE FROM daily_tasks WHERE id=?1", [id])
        .map_err(|e| e.to_string())?;
    if changed == 0 {
        return Err("任务不存在".into());
    }
    Ok(())
}

#[tauri::command]
pub fn convert_journey_item_to_task(
    app: tauri::AppHandle,
    item_id: String,
) -> Result<String, String> {
    let connection = connect(&app).map_err(|e| e.to_string())?;
    if let Some(existing) = connection
        .query_row(
            "SELECT id FROM daily_tasks WHERE source_item_id=?1",
            [&item_id],
            |r| r.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?
    {
        return Ok(existing);
    }
    let row=connection.query_row("SELECT title,description,project_id,target_date,priority FROM journey_project_items WHERE id=?1",[&item_id],|r|Ok((r.get::<_,String>(0)?,r.get::<_,String>(1)?,r.get::<_,String>(2)?,r.get::<_,Option<i64>>(3)?,r.get::<_,String>(4)?))).optional().map_err(|e|e.to_string())?.ok_or("项目事项不存在")?;
    let task_id = id();
    let priority = match row.4.as_str() {
        "HIGH" => "IMPORTANT",
        "LOW" => "NORMAL",
        _ => "NORMAL",
    };
    let timestamp = now();
    connection.execute("INSERT INTO daily_tasks(id,title,note,status,priority,due_at,project_id,source_item_id,created_at,updated_at) VALUES(?1,?2,?3,'TODO',?4,?5,?6,?7,?8,?8)",params![task_id,row.0,row.1,priority,row.3,row.2,item_id,timestamp]).map_err(|e|e.to_string())?;
    Ok(task_id)
}
