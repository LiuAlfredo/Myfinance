use super::shared::*;
use crate::database::{connect, id, now};
use rusqlite::params;
use serde::{Deserialize, Serialize};
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
pub(super) fn event_from_row(r: &rusqlite::Row<'_>) -> rusqlite::Result<DailyEvent> {
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
#[tauri::command]
pub fn get_daily_event(app: tauri::AppHandle, id: String) -> Result<DailyEvent, String> {
    let c = connect(&app).map_err(|e| e.to_string())?;
    c.query_row("SELECT id,title,all_day,day_key,starts_at,ends_at,location,note,created_at,updated_at FROM daily_events WHERE id=?1",[id],event_from_row).map_err(|_|"日程不存在".into())
}
