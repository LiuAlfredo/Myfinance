use super::shared::required;
use crate::database::{connect, id, now};
use chrono::{Datelike, Local, NaiveDate, TimeDelta};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};

pub(super) fn date(value: &str) -> Result<NaiveDate, String> {
    {
        let day = NaiveDate::parse_from_str(value, "%Y-%m-%d").map_err(|_| "日期无效")?;
        if day.year() < 1900 || day.year() > 9999 {
            return Err("日期须在 1900–9999 年之间".into());
        }
        Ok(day)
    }
}
pub(super) fn next_cycle(
    current: NaiveDate,
    anchor: NaiveDate,
    frequency: &str,
) -> Result<NaiveDate, String> {
    match frequency {
        "DAILY" => current
            .checked_add_signed(TimeDelta::days(1))
            .ok_or("日期超出范围".into()),
        "WEEKLY" => current
            .checked_add_signed(TimeDelta::days(7))
            .ok_or("日期超出范围".into()),
        "MONTHLY" | "YEARLY" => {
            let index = current.year() * 12
                + current.month0() as i32
                + if frequency == "YEARLY" { 12 } else { 1 };
            let year = index.div_euclid(12);
            let month = index.rem_euclid(12) as u32 + 1;
            for day in (1..=anchor.day()).rev() {
                if let Some(value) = NaiveDate::from_ymd_opt(year, month, day) {
                    return Ok(value);
                }
            }
            Err("日期超出范围".into())
        }
        _ => Err("周期无效".into()),
    }
}
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RoutineInput {
    title: String,
    note: String,
    project_id: Option<String>,
    frequency: String,
    weekdays: String,
    anchor_day: String,
    next_day: String,
    missed_policy: String,
    active: bool,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Routine {
    id: String,
    #[serde(flatten)]
    input: RoutineInput,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Occurrence {
    routine_id: String,
    day: String,
    task_id: Option<String>,
    skipped: bool,
    status: Option<String>,
    title: String,
}
#[tauri::command]
pub fn list_task_routines(app: tauri::AppHandle) -> Result<Vec<Routine>, String> {
    let c = connect(&app).map_err(|e| e.to_string())?;
    let mut s=c.prepare("SELECT id,title,note,project_id,frequency,weekdays,anchor_day,next_day,missed_policy,active FROM task_routines ORDER BY updated_at DESC").map_err(|e|e.to_string())?;
    let values = s
        .query_map([], |r| {
            Ok(Routine {
                id: r.get(0)?,
                input: RoutineInput {
                    title: r.get(1)?,
                    note: r.get(2)?,
                    project_id: r.get(3)?,
                    frequency: r.get(4)?,
                    weekdays: r.get(5)?,
                    anchor_day: r.get(6)?,
                    next_day: r.get(7)?,
                    missed_policy: r.get(8)?,
                    active: r.get(9)?,
                },
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(values)
}
#[tauri::command]
pub fn save_task_routine(
    app: tauri::AppHandle,
    input: RoutineInput,
    id_opt: Option<String>,
) -> Result<(), String> {
    required(&input.title, "规则标题", 200)?;
    if date(&input.next_day)? < date(&input.anchor_day)? {
        return Err("下次日期不能早于起始日期".into());
    }
    if !["DAILY", "WEEKLY", "MONTHLY"].contains(&input.frequency.as_str())
        || !["CATCH_UP", "SKIP"].contains(&input.missed_policy.as_str())
        || input.note.chars().count() > 8000
    {
        return Err("重复规则无效".into());
    }
    if !input.weekdays.is_empty()
        && input.weekdays.split(',').any(|d| {
            d.parse::<u32>()
                .map(|n| !(1..=7).contains(&n))
                .unwrap_or(true)
        })
    {
        return Err("星期须为 1–7，以逗号分隔".into());
    }
    let c = connect(&app).map_err(|e| e.to_string())?;
    super::shared::ensure_project(&c, &input.project_id)?;
    let record = id_opt.clone().unwrap_or_else(id);
    let stamp = now();
    if id_opt.is_some() {
        if c.execute("UPDATE task_routines SET title=?2,note=?3,project_id=?4,frequency=?5,weekdays=?6,anchor_day=?7,next_day=?8,missed_policy=?9,active=?10,updated_at=?11 WHERE id=?1",params![record,input.title.trim(),input.note,input.project_id,input.frequency,input.weekdays,input.anchor_day,input.next_day,input.missed_policy,input.active,stamp]).map_err(|e|e.to_string())?==0{return Err("规则不存在".into())}
    } else {
        c.execute(
            "INSERT INTO task_routines VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?11)",
            params![
                record,
                input.title.trim(),
                input.note,
                input.project_id,
                input.frequency,
                input.weekdays,
                input.anchor_day,
                input.next_day,
                input.missed_policy,
                input.active,
                stamp
            ],
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}
pub(super) fn generate(c: &Connection, today: NaiveDate) -> Result<usize, String> {
    let tx = c.unchecked_transaction().map_err(|e| e.to_string())?;
    let rules = {
        let mut s=tx.prepare("SELECT id,title,note,project_id,frequency,weekdays,anchor_day,next_day,missed_policy FROM task_routines WHERE active=1").map_err(|e|e.to_string())?;
        let rows = s
            .query_map([], |r| {
                Ok((
                    r.get::<_, String>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, String>(2)?,
                    r.get::<_, Option<String>>(3)?,
                    r.get::<_, String>(4)?,
                    r.get::<_, String>(5)?,
                    r.get::<_, String>(6)?,
                    r.get::<_, String>(7)?,
                    r.get::<_, String>(8)?,
                ))
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        rows
    };
    let mut count = 0;
    for (rule, title, note, project, frequency, weekdays, anchor, next, policy) in rules {
        let anchor = date(&anchor)?;
        let mut day = date(&next)?;
        for _ in 0..3660 {
            if day > today {
                break;
            }
            let eligible = frequency != "WEEKLY"
                || weekdays.is_empty()
                || weekdays
                    .split(',')
                    .any(|d| d.parse::<u32>().ok() == Some(day.weekday().number_from_monday()));
            if eligible {
                let skipped = policy == "SKIP" && day < today;
                let task = id();
                let changed=tx.execute("INSERT OR IGNORE INTO routine_occurrences(routine_id,day,task_id,skipped) VALUES(?1,?2,NULL,?3)",params![rule,day.to_string(),skipped]).map_err(|e|e.to_string())?;
                if changed > 0 && !skipped {
                    let stamp = now();
                    tx.execute("INSERT INTO daily_tasks(id,title,note,status,priority,planned_day,project_id,created_at,updated_at) VALUES(?1,?2,?3,'TODO','NORMAL',?4,?5,?6,?6)",params![task,title,note,day.to_string(),project,stamp]).map_err(|e|e.to_string())?;
                    tx.execute(
                        "UPDATE routine_occurrences SET task_id=?3 WHERE routine_id=?1 AND day=?2",
                        params![rule, day.to_string(), task],
                    )
                    .map_err(|e| e.to_string())?;
                    count += 1;
                }
            }
            day = if frequency == "WEEKLY" && !weekdays.is_empty() {
                next_cycle(day, anchor, "DAILY")?
            } else {
                next_cycle(day, anchor, &frequency)?
            };
        }
        tx.execute(
            "UPDATE task_routines SET next_day=?2 WHERE id=?1",
            params![rule, day.to_string()],
        )
        .map_err(|e| e.to_string())?;
    }
    tx.commit().map_err(|e| e.to_string())?;
    Ok(count)
}
#[tauri::command]
pub fn generate_routine_tasks(app: tauri::AppHandle) -> Result<usize, String> {
    let c = connect(&app).map_err(|e| e.to_string())?;
    generate(&c, Local::now().date_naive())
}
#[tauri::command]
pub fn list_routine_history(app: tauri::AppHandle) -> Result<Vec<Occurrence>, String> {
    let c = connect(&app).map_err(|e| e.to_string())?;
    let mut s=c.prepare("SELECT o.routine_id,o.day,o.task_id,o.skipped,t.status,r.title FROM routine_occurrences o JOIN task_routines r ON r.id=o.routine_id LEFT JOIN daily_tasks t ON t.id=o.task_id ORDER BY o.day DESC LIMIT 500").map_err(|e|e.to_string())?;
    let values = s
        .query_map([], |r| {
            Ok(Occurrence {
                routine_id: r.get(0)?,
                day: r.get(1)?,
                task_id: r.get(2)?,
                skipped: r.get(3)?,
                status: r.get(4)?,
                title: r.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(values)
}
#[tauri::command]
pub fn skip_routine_occurrence(
    app: tauri::AppHandle,
    routine_id: String,
    day: String,
) -> Result<(), String> {
    let c = connect(&app).map_err(|e| e.to_string())?;
    let tx = c.unchecked_transaction().map_err(|e| e.to_string())?;
    let task: Option<String> = tx
        .query_row(
            "SELECT task_id FROM routine_occurrences WHERE routine_id=?1 AND day=?2",
            params![routine_id, day],
            |r| r.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?
        .flatten();
    if let Some(task) = task {
        tx.execute(
            "UPDATE daily_tasks SET status='CANCELLED',completed_at=NULL,updated_at=?2 WHERE id=?1",
            params![task, now()],
        )
        .map_err(|e| e.to_string())?;
    }
    tx.execute(
        "UPDATE routine_occurrences SET skipped=1 WHERE routine_id=?1 AND day=?2",
        params![routine_id, day],
    )
    .map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn month_anchor_survives_february() {
        let jan = date("2024-01-31").unwrap();
        let feb = next_cycle(jan, jan, "MONTHLY").unwrap();
        assert_eq!(feb.to_string(), "2024-02-29");
        assert_eq!(
            next_cycle(feb, jan, "MONTHLY").unwrap().to_string(),
            "2024-03-31"
        );
    }
    #[test]
    fn generation_is_idempotent_and_deleted_tasks_do_not_regenerate() {
        let c = Connection::open_in_memory().unwrap();
        crate::database::migrate(&c).unwrap();
        c.execute("INSERT INTO task_routines VALUES('r','Read','',NULL,'DAILY','','2026-09-01','2026-09-01','CATCH_UP',1,0,0)",[]).unwrap();
        let day = date("2026-09-03").unwrap();
        assert_eq!(generate(&c, day).unwrap(), 3);
        assert_eq!(generate(&c, day).unwrap(), 0);
        c.execute("DELETE FROM daily_tasks", []).unwrap();
        assert_eq!(generate(&c, day).unwrap(), 0);
    }
}
