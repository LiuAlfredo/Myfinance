use super::events::event_from_row;
use super::shared::*;
use super::tasks::task_from_row;
use crate::database::{connect, now};
use rusqlite::params;
use serde::Serialize;
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
pub struct TodayPlanned {
    id: String,
    title: String,
    amount: i64,
    planned_date: i64,
    currency: String,
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
) -> Result<serde_json::Value, String> {
    if !valid_day(&day_key) || end_at <= start_at {
        return Err("日期无效".into());
    }
    let c = connect(&app).map_err(|e| e.to_string())?;
    let tasks = read_section(&c, "TASKS", &day_key, start_at, end_at)?;
    Ok(
        serde_json::json!({"tasks":tasks["tasks"],"overdueCount":tasks["overdueCount"],"events":read_section(&c,"EVENTS",&day_key,start_at,end_at)?,"plannedExpenses":read_section(&c,"PLANNED",&day_key,start_at,end_at)?,"projects":read_section(&c,"PROJECTS",&day_key,start_at,end_at)?}),
    )
}

#[tauri::command]
pub fn get_today_section(
    app: tauri::AppHandle,
    section: String,
    day_key: String,
    start_at: i64,
    end_at: i64,
) -> Result<serde_json::Value, String> {
    if !valid_day(&day_key) || end_at <= start_at {
        return Err("日期无效".into());
    }
    let c = connect(&app).map_err(|e| e.to_string())?;
    read_section(&c, &section, &day_key, start_at, end_at)
}
fn read_section(
    c: &rusqlite::Connection,
    section: &str,
    day_key: &str,
    start_at: i64,
    end_at: i64,
) -> Result<serde_json::Value, String> {
    match section {
        "TASKS" => {
            let task_sql="SELECT t.id,t.title,t.note,t.status,t.priority,t.planned_day,t.due_at,t.project_id,p.title,t.parent_id,t.source_item_id,t.completed_at,(SELECT COUNT(*) FROM daily_tasks c WHERE c.parent_id=t.id),t.created_at,t.updated_at FROM daily_tasks t LEFT JOIN journey_projects p ON p.id=t.project_id WHERE t.status IN ('TODO','ACTIVE') AND (t.planned_day=?1 OR (t.due_at IS NOT NULL AND t.due_at<?3)) ORDER BY CASE WHEN t.due_at<?2 THEN 0 ELSE 1 END,CASE t.priority WHEN 'URGENT' THEN 0 WHEN 'IMPORTANT' THEN 1 ELSE 2 END,COALESCE(t.due_at,9223372036854775807)";
            let mut ts = c.prepare(task_sql).map_err(|e| e.to_string())?;
            let tasks = ts
                .query_map(params![day_key, start_at, end_at], task_from_row)
                .map_err(|e| e.to_string())?
                .collect::<Result<Vec<_>, _>>()
                .map_err(|e| e.to_string())?;
            let overdue_count:i64 = c
        .query_row(
            "SELECT COUNT(*) FROM daily_tasks WHERE status IN ('TODO','ACTIVE') AND due_at<?1",
            [now().min(end_at)],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
            Ok(serde_json::json!({"tasks":tasks,"overdueCount":overdue_count}))
        }
        "EVENTS" => {
            let mut es=c.prepare("SELECT id,title,all_day,day_key,starts_at,ends_at,location,note,created_at,updated_at FROM daily_events WHERE (all_day=1 AND day_key=?1) OR (all_day=0 AND starts_at<?3 AND ends_at>?2) ORDER BY COALESCE(day_key,date(starts_at/1000,'unixepoch','localtime')),all_day DESC,COALESCE(starts_at,0)").map_err(|e|e.to_string())?;
            let events = es
                .query_map(params![day_key, start_at, end_at], event_from_row)
                .map_err(|e| e.to_string())?
                .collect::<Result<Vec<_>, _>>()
                .map_err(|e| e.to_string())?;
            Ok(serde_json::json!(events))
        }
        "PLANNED" => {
            let mut ps=c.prepare("SELECT id,title,amount,planned_date,currency FROM planned_expenses WHERE status='PLANNED' AND planned_date<?1 ORDER BY planned_date LIMIT 8").map_err(|e|e.to_string())?;
            let planned_expenses = ps
                .query_map([start_at + 7 * 86_400_000], |r| {
                    Ok(TodayPlanned {
                        id: r.get(0)?,
                        title: r.get(1)?,
                        amount: r.get(2)?,
                        planned_date: r.get(3)?,
                        currency: r.get(4)?,
                    })
                })
                .map_err(|e| e.to_string())?
                .collect::<Result<Vec<_>, _>>()
                .map_err(|e| e.to_string())?;
            Ok(serde_json::json!(planned_expenses))
        }
        "PROJECTS" => {
            let mut js=c.prepare("SELECT p.id,p.title,p.progress,p.accent,CASE WHEN tp.project_id IS NULL THEN 0 ELSE 1 END FROM journey_projects p LEFT JOIN today_pinned_projects tp ON tp.project_id=p.id WHERE p.status IN ('ACTIVE','PLANNING') ORDER BY (tp.project_id IS NOT NULL) DESC,tp.pinned_at ASC,p.updated_at DESC LIMIT 4").map_err(|e|e.to_string())?;
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
            Ok(serde_json::json!(projects))
        }
        "ALL_PROJECTS" => {
            let mut js=c.prepare("SELECT p.id,p.title,p.progress,p.accent,CASE WHEN tp.project_id IS NULL THEN 0 ELSE 1 END FROM journey_projects p LEFT JOIN today_pinned_projects tp ON tp.project_id=p.id WHERE p.status IN ('ACTIVE','PLANNING') ORDER BY (tp.project_id IS NOT NULL) DESC,tp.pinned_at ASC,p.updated_at DESC").map_err(|e|e.to_string())?;
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
            Ok(serde_json::json!(projects))
        }
        _ => Err("首页区域无效".into()),
    }
}
#[tauri::command]
pub fn reorder_today_projects(app: tauri::AppHandle, ids: Vec<String>) -> Result<(), String> {
    let c = connect(&app).map_err(|e| e.to_string())?;
    let tx = c.unchecked_transaction().map_err(|e| e.to_string())?;
    for (i, key) in ids.iter().enumerate() {
        tx.execute(
            "UPDATE today_pinned_projects SET pinned_at=?2 WHERE project_id=?1",
            params![key, i as i64],
        )
        .map_err(|e| e.to_string())?;
    }
    tx.commit().map_err(|e| e.to_string())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn sections_return_valid_rows_and_isolate_a_damaged_source() {
        let c = rusqlite::Connection::open_in_memory().unwrap();
        crate::database::migrate(&c).unwrap();
        c.execute("INSERT INTO accounts(id,name,type,currency,created_at,updated_at) VALUES('a','美元','BANK','USD',0,0)",[]).unwrap();
        c.execute("INSERT INTO planned_expenses(id,title,amount,currency,planned_date,account_id,created_at,updated_at) VALUES('p','续费',100,'USD',0,'a',0,0)",[]).unwrap();
        for section in ["TASKS", "EVENTS", "PLANNED", "PROJECTS", "ALL_PROJECTS"] {
            assert!(read_section(&c, section, "2026-09-28", 0, 86400000).is_ok());
        }
        assert_eq!(
            read_section(&c, "PLANNED", "2026-09-28", 0, 86400000).unwrap()[0]["currency"],
            "USD"
        );
        c.execute("DROP TABLE daily_events", []).unwrap();
        assert!(read_section(&c, "EVENTS", "2026-09-28", 0, 86400000).is_err());
        assert!(read_section(&c, "TASKS", "2026-09-28", 0, 86400000).is_ok());
    }
}
