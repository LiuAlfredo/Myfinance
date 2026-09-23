use crate::database::{connect, id, now};
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};

const TASK_STATUSES: &[&str] = &["TODO", "ACTIVE", "DONE", "CANCELLED"];
const PRIORITIES: &[&str] = &["NORMAL", "IMPORTANT", "URGENT"];

fn required(value: &str, label: &str, max: usize) -> Result<String, String> {
    let value = value.trim();
    if value.is_empty() {
        return Err(format!("{label}不能为空"));
    }
    if value.chars().count() > max {
        return Err(format!("{label}不能超过 {max} 个字符"));
    }
    Ok(value.to_string())
}

fn valid_day(value: &str) -> bool {
    let bytes = value.as_bytes();
    if bytes.len() != 10 || !value.is_ascii() || bytes[4] != b'-' || bytes[7] != b'-' {
        return false;
    }
    let Ok(year) = value[0..4].parse::<i32>() else {
        return false;
    };
    let Ok(month) = value[5..7].parse::<u32>() else {
        return false;
    };
    let Ok(day) = value[8..10].parse::<u32>() else {
        return false;
    };
    if year < 1900 || !(1..=12).contains(&month) || day == 0 {
        return false;
    }
    let leap = year % 4 == 0 && (year % 100 != 0 || year % 400 == 0);
    let days = [
        31,
        if leap { 29 } else { 28 },
        31,
        30,
        31,
        30,
        31,
        31,
        30,
        31,
        30,
        31,
    ];
    day <= days[(month - 1) as usize]
}

fn ensure_project(
    connection: &rusqlite::Connection,
    project: &Option<String>,
) -> Result<(), String> {
    if let Some(project) = project {
        let exists: bool = connection
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM journey_projects WHERE id=?1)",
                [project],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;
        if !exists {
            return Err("关联项目不存在".into());
        }
    }
    Ok(())
}

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
}

fn task_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<DailyTask> {
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

fn would_create_task_cycle(
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
    tx.commit().map_err(|e| e.to_string())?;
    Ok(task_id)
}

#[tauri::command]
pub fn set_daily_task_status(
    app: tauri::AppHandle,
    id: String,
    status: String,
) -> Result<(), String> {
    if !TASK_STATUSES.contains(&status.as_str()) {
        return Err("任务状态无效".into());
    }
    let connection = connect(&app).map_err(|e| e.to_string())?;
    let timestamp = now();
    let changed=connection.execute("UPDATE daily_tasks SET status=?2,completed_at=CASE WHEN ?2='DONE' THEN ?3 ELSE NULL END,updated_at=?3 WHERE id=?1",params![id,status,timestamp]).map_err(|e|e.to_string())?;
    if changed == 0 {
        return Err("任务不存在".into());
    }
    Ok(())
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

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DailyEvent {
    id: String,
    title: String,
    all_day: bool,
    day_key: Option<String>,
    starts_at: Option<i64>,
    ends_at: Option<i64>,
    location: String,
    note: String,
    created_at: i64,
    updated_at: i64,
}
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DailyEventInput {
    title: String,
    all_day: bool,
    day_key: Option<String>,
    starts_at: Option<i64>,
    ends_at: Option<i64>,
    #[serde(default)]
    location: String,
    #[serde(default)]
    note: String,
}
fn event_from_row(r: &rusqlite::Row<'_>) -> rusqlite::Result<DailyEvent> {
    Ok(DailyEvent {
        id: r.get(0)?,
        title: r.get(1)?,
        all_day: r.get::<_, i64>(2)? != 0,
        day_key: r.get(3)?,
        starts_at: r.get(4)?,
        ends_at: r.get(5)?,
        location: r.get(6)?,
        note: r.get(7)?,
        created_at: r.get(8)?,
        updated_at: r.get(9)?,
    })
}
#[tauri::command]
pub fn list_daily_events(
    app: tauri::AppHandle,
    from_day: String,
    to_day: String,
    from_at: i64,
    to_at: i64,
) -> Result<Vec<DailyEvent>, String> {
    if !valid_day(&from_day) || !valid_day(&to_day) || from_day > to_day || from_at >= to_at {
        return Err("日期范围无效".into());
    }
    let connection = connect(&app).map_err(|e| e.to_string())?;
    let mut s=connection.prepare("SELECT id,title,all_day,day_key,starts_at,ends_at,location,note,created_at,updated_at FROM daily_events WHERE (all_day=1 AND day_key BETWEEN ?1 AND ?2) OR (all_day=0 AND starts_at<?4 AND ends_at>?3) ORDER BY COALESCE(day_key,date(starts_at/1000,'unixepoch','localtime')),all_day DESC,COALESCE(starts_at,0)").map_err(|e|e.to_string())?;
    let result = s
        .query_map(params![from_day, to_day, from_at, to_at], event_from_row)
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string());
    result
}
#[tauri::command]
pub fn save_daily_event(
    app: tauri::AppHandle,
    input: DailyEventInput,
    id_opt: Option<String>,
) -> Result<String, String> {
    let title = required(&input.title, "日程标题", 200)?;
    if input.location.chars().count() > 500 || input.note.chars().count() > 8000 {
        return Err("日程内容过长".into());
    }
    if input.all_day {
        if !input.day_key.as_deref().is_some_and(valid_day) {
            return Err("全天日期无效".into());
        }
    } else if input.starts_at.is_none() || input.ends_at <= input.starts_at {
        return Err("结束时间必须晚于开始时间".into());
    }
    let connection = connect(&app).map_err(|e| e.to_string())?;
    let event_id = id_opt.clone().unwrap_or_else(id);
    let timestamp = now();
    if id_opt.is_some() {
        if connection.execute("UPDATE daily_events SET title=?2,all_day=?3,day_key=?4,starts_at=?5,ends_at=?6,location=?7,note=?8,updated_at=?9 WHERE id=?1",params![event_id,title,input.all_day,input.day_key,input.starts_at,input.ends_at,input.location.trim(),input.note.trim(),timestamp]).map_err(|e|e.to_string())?==0{return Err("日程不存在".into())}
    } else {
        connection
            .execute(
                "INSERT INTO daily_events VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?9)",
                params![
                    event_id,
                    title,
                    input.all_day,
                    input.day_key,
                    input.starts_at,
                    input.ends_at,
                    input.location.trim(),
                    input.note.trim(),
                    timestamp
                ],
            )
            .map_err(|e| e.to_string())?;
    }
    Ok(event_id)
}
#[tauri::command]
pub fn delete_daily_event(app: tauri::AppHandle, id: String) -> Result<(), String> {
    let c = connect(&app).map_err(|e| e.to_string())?;
    if c.execute("DELETE FROM daily_events WHERE id=?1", [id])
        .map_err(|e| e.to_string())?
        == 0
    {
        return Err("日程不存在".into());
    }
    Ok(())
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeNote {
    id: String,
    title: String,
    body: String,
    tags: String,
    is_pinned: bool,
    is_archived: bool,
    deleted_at: Option<i64>,
    project_id: Option<String>,
    project_title: Option<String>,
    task_id: Option<String>,
    task_title: Option<String>,
    created_at: i64,
    updated_at: i64,
}
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeNoteInput {
    title: String,
    #[serde(default)]
    body: String,
    #[serde(default)]
    tags: String,
    #[serde(default)]
    is_pinned: bool,
    #[serde(default)]
    is_archived: bool,
    project_id: Option<String>,
    task_id: Option<String>,
}
fn note_from_row(r: &rusqlite::Row<'_>) -> rusqlite::Result<KnowledgeNote> {
    Ok(KnowledgeNote {
        id: r.get(0)?,
        title: r.get(1)?,
        body: r.get(2)?,
        tags: r.get(3)?,
        is_pinned: r.get::<_, i64>(4)? != 0,
        is_archived: r.get::<_, i64>(5)? != 0,
        deleted_at: r.get(6)?,
        project_id: r.get(7)?,
        project_title: r.get(8)?,
        task_id: r.get(9)?,
        task_title: r.get(10)?,
        created_at: r.get(11)?,
        updated_at: r.get(12)?,
    })
}
const NOTE_SELECT:&str="SELECT n.id,n.title,n.body,n.tags,n.is_pinned,n.is_archived,n.deleted_at,n.project_id,p.title,n.task_id,t.title,n.created_at,n.updated_at FROM knowledge_notes n LEFT JOIN journey_projects p ON p.id=n.project_id LEFT JOIN daily_tasks t ON t.id=n.task_id";
#[tauri::command]
pub fn list_knowledge_notes(
    app: tauri::AppHandle,
    view: Option<String>,
    query: Option<String>,
    project_id: Option<String>,
) -> Result<Vec<KnowledgeNote>, String> {
    let c = connect(&app).map_err(|e| e.to_string())?;
    let state = match view.as_deref().unwrap_or("ACTIVE") {
        "TRASH" => "n.deleted_at IS NOT NULL",
        "ARCHIVED" => "n.deleted_at IS NULL AND n.is_archived=1",
        _ => "n.deleted_at IS NULL AND n.is_archived=0",
    };
    let q = format!("%{}%", query.unwrap_or_default().trim());
    let sql=format!("{NOTE_SELECT} WHERE {state} AND (?1='%%' OR n.title LIKE ?1 OR n.body LIKE ?1 OR n.tags LIKE ?1) AND (?2 IS NULL OR n.project_id=?2) ORDER BY n.is_pinned DESC,n.updated_at DESC");
    let mut s = c.prepare(&sql).map_err(|e| e.to_string())?;
    let result = s
        .query_map(params![q, project_id], note_from_row)
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string());
    result
}
#[tauri::command]
pub fn get_knowledge_note(app: tauri::AppHandle, id: String) -> Result<KnowledgeNote, String> {
    let c = connect(&app).map_err(|e| e.to_string())?;
    c.query_row(&format!("{NOTE_SELECT} WHERE n.id=?1"), [id], note_from_row)
        .optional()
        .map_err(|e| e.to_string())?
        .ok_or("笔记不存在".into())
}
#[tauri::command]
pub fn save_knowledge_note(
    app: tauri::AppHandle,
    input: KnowledgeNoteInput,
    id_opt: Option<String>,
) -> Result<String, String> {
    let title = required(&input.title, "笔记标题", 300)?;
    if input.body.chars().count() > 200_000 || input.tags.chars().count() > 1000 {
        return Err("笔记内容过长".into());
    }
    let c = connect(&app).map_err(|e| e.to_string())?;
    ensure_project(&c, &input.project_id)?;
    if let Some(task) = &input.task_id {
        let exists: bool = c
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM daily_tasks WHERE id=?1)",
                [task],
                |r| r.get(0),
            )
            .map_err(|e| e.to_string())?;
        if !exists {
            return Err("关联任务不存在".into());
        }
    }
    let note_id = id_opt.clone().unwrap_or_else(id);
    let timestamp = now();
    if id_opt.is_some() {
        if c.execute("UPDATE knowledge_notes SET title=?2,body=?3,tags=?4,is_pinned=?5,is_archived=?6,project_id=?7,task_id=?8,updated_at=?9 WHERE id=?1 AND deleted_at IS NULL",params![note_id,title,input.body,input.tags.trim(),input.is_pinned,input.is_archived,input.project_id,input.task_id,timestamp]).map_err(|e|e.to_string())?==0{return Err("笔记不存在或已在回收站".into())}
    } else {
        c.execute("INSERT INTO knowledge_notes(id,title,body,tags,is_pinned,is_archived,project_id,task_id,created_at,updated_at)VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?9)",params![note_id,title,input.body,input.tags.trim(),input.is_pinned,input.is_archived,input.project_id,input.task_id,timestamp]).map_err(|e|e.to_string())?;
    }
    Ok(note_id)
}
#[tauri::command]
pub fn set_knowledge_note_state(
    app: tauri::AppHandle,
    id: String,
    action: String,
) -> Result<(), String> {
    let c = connect(&app).map_err(|e| e.to_string())?;
    let timestamp = now();
    let sql=match action.as_str(){"ARCHIVE"=>"UPDATE knowledge_notes SET is_archived=1,updated_at=?2 WHERE id=?1 AND deleted_at IS NULL","UNARCHIVE"=>"UPDATE knowledge_notes SET is_archived=0,updated_at=?2 WHERE id=?1 AND deleted_at IS NULL","TRASH"=>"UPDATE knowledge_notes SET deleted_at=?2,updated_at=?2 WHERE id=?1","RESTORE"=>"UPDATE knowledge_notes SET deleted_at=NULL,is_archived=0,updated_at=?2 WHERE id=?1",_=>return Err("笔记操作无效".into())};
    if c.execute(sql, params![id, timestamp])
        .map_err(|e| e.to_string())?
        == 0
    {
        return Err("笔记不存在".into());
    }
    Ok(())
}
#[tauri::command]
pub fn delete_knowledge_note_permanently(app: tauri::AppHandle, id: String) -> Result<(), String> {
    let c = connect(&app).map_err(|e| e.to_string())?;
    if c.execute(
        "DELETE FROM knowledge_notes WHERE id=?1 AND deleted_at IS NOT NULL",
        [id],
    )
    .map_err(|e| e.to_string())?
        == 0
    {
        return Err("只能永久删除回收站中的笔记".into());
    }
    Ok(())
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TodayProject {
    id: String,
    title: String,
    progress: i64,
    accent: String,
    is_pinned: bool,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TodaySummary {
    tasks: Vec<DailyTask>,
    events: Vec<DailyEvent>,
    overdue_count: i64,
    planned_expenses: Vec<TodayPlanned>,
    projects: Vec<TodayProject>,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TodayPlanned {
    id: String,
    title: String,
    amount: i64,
    planned_date: i64,
}
#[tauri::command]
pub fn set_today_project_pinned(
    app: tauri::AppHandle,
    project_id: String,
    pinned: bool,
) -> Result<(), String> {
    let c = connect(&app).map_err(|e| e.to_string())?;
    if pinned {
        c.execute("INSERT OR REPLACE INTO today_pinned_projects(project_id,pinned_at) SELECT id,?2 FROM journey_projects WHERE id=?1",params![project_id,now()]).map_err(|e|e.to_string())?;
    } else {
        c.execute(
            "DELETE FROM today_pinned_projects WHERE project_id=?1",
            [project_id],
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}
#[tauri::command]
pub fn get_today_summary(
    app: tauri::AppHandle,
    day_key: String,
    start_at: i64,
    end_at: i64,
) -> Result<TodaySummary, String> {
    if !valid_day(&day_key) || end_at <= start_at {
        return Err("今日日期范围无效".into());
    }
    let c = connect(&app).map_err(|e| e.to_string())?;
    let task_sql="SELECT t.id,t.title,t.note,t.status,t.priority,t.planned_day,t.due_at,t.project_id,p.title,t.parent_id,t.source_item_id,t.completed_at,(SELECT COUNT(*) FROM daily_tasks c WHERE c.parent_id=t.id),t.created_at,t.updated_at FROM daily_tasks t LEFT JOIN journey_projects p ON p.id=t.project_id WHERE t.status IN ('TODO','ACTIVE') AND (t.planned_day=?1 OR (t.due_at IS NOT NULL AND t.due_at<?3)) ORDER BY CASE WHEN t.due_at<?2 THEN 0 ELSE 1 END,CASE t.priority WHEN 'URGENT' THEN 0 WHEN 'IMPORTANT' THEN 1 ELSE 2 END,COALESCE(t.due_at,9223372036854775807)";
    let mut ts = c.prepare(task_sql).map_err(|e| e.to_string())?;
    let tasks = ts
        .query_map(params![day_key, start_at, end_at], task_from_row)
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    let overdue_count = c
        .query_row(
            "SELECT COUNT(*) FROM daily_tasks WHERE status IN ('TODO','ACTIVE') AND due_at<?1",
            [now().min(end_at)],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    let mut es=c.prepare("SELECT id,title,all_day,day_key,starts_at,ends_at,location,note,created_at,updated_at FROM daily_events WHERE (all_day=1 AND day_key=?1) OR (all_day=0 AND starts_at<?3 AND ends_at>?2) ORDER BY COALESCE(day_key,date(starts_at/1000,'unixepoch','localtime')),all_day DESC,COALESCE(starts_at,0)").map_err(|e|e.to_string())?;
    let events = es
        .query_map(params![day_key, start_at, end_at], event_from_row)
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    let mut ps=c.prepare("SELECT id,title,amount,planned_date FROM planned_expenses WHERE status='PLANNED' AND planned_date<?1 ORDER BY planned_date LIMIT 8").map_err(|e|e.to_string())?;
    let planned_expenses = ps
        .query_map([start_at + 7 * 86_400_000], |r| {
            Ok(TodayPlanned {
                id: r.get(0)?,
                title: r.get(1)?,
                amount: r.get(2)?,
                planned_date: r.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    let mut js=c.prepare("SELECT p.id,p.title,p.progress,p.accent,CASE WHEN tp.project_id IS NULL THEN 0 ELSE 1 END FROM journey_projects p LEFT JOIN today_pinned_projects tp ON tp.project_id=p.id WHERE p.status IN ('ACTIVE','PLANNING') ORDER BY (tp.project_id IS NOT NULL) DESC,p.updated_at DESC LIMIT 4").map_err(|e|e.to_string())?;
    let projects = js
        .query_map([], |r| {
            Ok(TodayProject {
                id: r.get(0)?,
                title: r.get(1)?,
                progress: r.get(2)?,
                accent: r.get(3)?,
                is_pinned: r.get::<_, i64>(4)? != 0,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(TodaySummary {
        tasks,
        events,
        overdue_count,
        planned_expenses,
        projects,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_parent_cycles() {
        let c = rusqlite::Connection::open_in_memory().unwrap();
        c.execute_batch("CREATE TABLE daily_tasks(id TEXT PRIMARY KEY,parent_id TEXT);INSERT INTO daily_tasks VALUES('root',NULL),('child','root'),('grandchild','child'),('other',NULL);").unwrap();
        assert!(would_create_task_cycle(&c, "root", "grandchild").unwrap());
        assert!(would_create_task_cycle(&c, "root", "root").unwrap());
        assert!(!would_create_task_cycle(&c, "child", "other").unwrap());
    }
    #[test]
    fn validates_real_days() {
        assert!(valid_day("2024-02-29"));
        assert!(!valid_day("2023-02-29"));
        assert!(!valid_day("2024-13-01"));
    }
    #[test]
    fn task_enums_are_bounded() {
        assert!(TASK_STATUSES.contains(&"DONE"));
        assert!(!TASK_STATUSES.contains(&"DELETED"));
    }
    #[test]
    fn migration_preserves_links_and_detaches_deleted_projects() {
        let c = rusqlite::Connection::open_in_memory().unwrap();
        c.execute_batch("PRAGMA foreign_keys=ON;CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY,applied_at INTEGER NOT NULL);CREATE TABLE journey_projects(id TEXT PRIMARY KEY);CREATE TABLE journey_project_items(id TEXT PRIMARY KEY);INSERT INTO journey_projects VALUES('project');INSERT INTO journey_project_items VALUES('item');").unwrap();
        c.execute_batch(include_str!("../migrations/005_daily_knowledge.sql"))
            .unwrap();
        c.execute("INSERT INTO daily_tasks(id,title,status,priority,project_id,source_item_id,created_at,updated_at)VALUES('task','Do it','TODO','NORMAL','project','item',1,1)",[]).unwrap();
        c.execute("INSERT INTO knowledge_notes(id,title,project_id,task_id,created_at,updated_at)VALUES('note','Context','project','task',1,1)",[]).unwrap();
        assert!(c.execute("INSERT INTO daily_tasks(id,title,status,priority,source_item_id,created_at,updated_at)VALUES('duplicate','Again','TODO','NORMAL','item',1,1)",[]).is_err());
        c.execute("DELETE FROM journey_projects WHERE id='project'", [])
            .unwrap();
        let links: (Option<String>, Option<String>) = c
            .query_row(
                "SELECT project_id,task_id FROM knowledge_notes WHERE id='note'",
                [],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .unwrap();
        assert_eq!(links, (None, Some("task".into())));
    }
}
