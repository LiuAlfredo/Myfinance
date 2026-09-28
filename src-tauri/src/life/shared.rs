pub(super) const TASK_STATUSES: &[&str] = &["TODO", "ACTIVE", "DONE", "CANCELLED"];
pub(super) const PRIORITIES: &[&str] = &["NORMAL", "IMPORTANT", "URGENT"];

pub(super) fn required(value: &str, label: &str, max: usize) -> Result<String, String> {
    let value = value.trim();
    if value.is_empty() {
        return Err(format!("{label}不能为空"));
    }
    if value.chars().count() > max {
        return Err(format!("{label}不能超过 {max} 个字符"));
    }
    Ok(value.to_string())
}

pub(super) fn valid_day(value: &str) -> bool {
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

pub(super) fn ensure_project(
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
