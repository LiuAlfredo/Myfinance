use crate::database::{connect, id, now};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    path::{Path, PathBuf},
    sync::Mutex,
};
static BACKUP_LOCK: Mutex<()> = Mutex::new(());

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BackupConfig {
    enabled: bool,
    directory: String,
    interval_hours: i64,
    retain: usize,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupRecord {
    id: String,
    path: String,
    created_at: i64,
    size: i64,
    schema_version: i64,
    checksum: String,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupStatus {
    config: BackupConfig,
    records: Vec<BackupRecord>,
    last_error: Option<String>,
    next_at: Option<i64>,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupPreview {
    pub(crate) schema_version: i64,
    pub(crate) upgraded_version: i64,
    pub(crate) has_security: bool,
    pub(crate) counts: Vec<(String, i64)>,
}

fn setting(c: &Connection, key: &str) -> Result<Option<String>, String> {
    c.query_row("SELECT value FROM settings WHERE key=?1", [key], |r| {
        r.get(0)
    })
    .optional()
    .map_err(|e| e.to_string())
}
fn put(c: &Connection, key: &str, value: &str) -> Result<(), String> {
    c.execute("INSERT INTO settings(key,value,updated_at) VALUES(?1,?2,?3) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at",params![key,value,now()]).map_err(|e|e.to_string())?;
    Ok(())
}
fn config(app: &tauri::AppHandle, c: &Connection) -> Result<BackupConfig, String> {
    if let Some(value) = setting(c, "auto_backup_config")? {
        return serde_json::from_str(&value).map_err(|e| e.to_string());
    }
    let dir = crate::database::path(app)
        .map_err(|e| e.to_string())?
        .parent()
        .ok_or("数据目录不可用")?
        .join("backups");
    Ok(BackupConfig {
        enabled: true,
        directory: dir.to_string_lossy().into(),
        interval_hours: 24,
        retain: 7,
    })
}
fn checksum(path: &Path) -> Result<String, String> {
    use std::io::Read;
    let mut file = std::fs::File::open(path).map_err(|e| e.to_string())?;
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 65536];
    loop {
        let n = file.read(&mut buffer).map_err(|e| e.to_string())?;
        if n == 0 {
            break;
        }
        hasher.update(&buffer[..n]);
    }
    Ok(format!("{:x}", hasher.finalize()))
}
#[tauri::command]
pub fn get_backup_status(app: tauri::AppHandle) -> Result<BackupStatus, String> {
    let c = connect(&app).map_err(|e| e.to_string())?;
    let config = config(&app, &c)?;
    let mut s=c.prepare("SELECT id,path,created_at,size,schema_version,checksum FROM automatic_backups ORDER BY created_at DESC").map_err(|e|e.to_string())?;
    let records = s
        .query_map([], |r| {
            Ok(BackupRecord {
                id: r.get(0)?,
                path: r.get(1)?,
                created_at: r.get(2)?,
                size: r.get(3)?,
                schema_version: r.get(4)?,
                checksum: r.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    let next_at = if config.enabled {
        Some(records.first().map(|r| r.created_at).unwrap_or(0) + config.interval_hours * 3_600_000)
    } else {
        None
    };
    Ok(BackupStatus {
        config,
        records,
        last_error: setting(&c, "auto_backup_error")?.filter(|s| !s.is_empty()),
        next_at,
    })
}
#[tauri::command]
pub fn save_backup_config(app: tauri::AppHandle, input: BackupConfig) -> Result<(), String> {
    if !(1..=168).contains(&input.interval_hours)
        || !(1..=100).contains(&input.retain)
        || input.directory.trim().is_empty()
        || !Path::new(&input.directory).is_absolute()
    {
        return Err("备份目录须为绝对路径；间隔 1–168 小时，保留 1–100 份".into());
    }
    let c = connect(&app).map_err(|e| e.to_string())?;
    put(
        &c,
        "auto_backup_config",
        &serde_json::to_string(&input).map_err(|e| e.to_string())?,
    )
}
#[tauri::command]
pub fn run_automatic_backup(app: tauri::AppHandle, force: bool) -> Result<Option<String>, String> {
    let _guard = BACKUP_LOCK.try_lock().map_err(|_| "备份正在执行")?;
    let c = connect(&app).map_err(|e| e.to_string())?;
    let cfg = config(&app, &c)?;
    let last: i64 = c
        .query_row(
            "SELECT COALESCE(MAX(created_at),0) FROM automatic_backups",
            [],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    if !force && (!cfg.enabled || now() - last < cfg.interval_hours * 3_600_000) {
        return Ok(None);
    }
    let result = (|| {
        let directory = PathBuf::from(&cfg.directory);
        std::fs::create_dir_all(&directory).map_err(|e| e.to_string())?;
        let record_id = id();
        let stamp = now();
        let destination = directory.join(format!("myfinance-auto-{record_id}.sqlite3"));
        let source = crate::database::path(&app).map_err(|e| e.to_string())?;
        crate::database_backup::backup(&source, &destination)?;
        let snap =
            Connection::open_with_flags(&destination, rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY)
                .map_err(|e| e.to_string())?;
        crate::database_backup::validate_snapshot(&snap)?;
        drop(snap);
        let hash = checksum(&destination)?;
        let size = std::fs::metadata(&destination)
            .map_err(|e| e.to_string())?
            .len() as i64;
        c.execute(
            "INSERT INTO automatic_backups VALUES(?1,?2,?3,?4,8,?5)",
            params![record_id, destination.to_string_lossy(), stamp, size, hash],
        )
        .map_err(|e| e.to_string())?;
        let mut s=c.prepare("SELECT id,path,checksum FROM automatic_backups ORDER BY created_at DESC LIMIT -1 OFFSET ?1").map_err(|e|e.to_string())?;
        let old = s
            .query_map([cfg.retain as i64], |r| {
                Ok((
                    r.get::<_, String>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, String>(2)?,
                ))
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        for (record, path, hash) in old {
            let target = Path::new(&path);
            if target.parent().and_then(|p| p.canonicalize().ok()) != directory.canonicalize().ok()
            {
                continue;
            }
            if target.file_name().and_then(|n| n.to_str())
                != Some(&format!("myfinance-auto-{record}.sqlite3"))
            {
                continue;
            }
            if !target.exists() {
                c.execute("DELETE FROM automatic_backups WHERE id=?1", [record])
                    .map_err(|e| e.to_string())?;
                continue;
            }
            if !can_remove_automatic(&directory, &record, target, &hash)? {
                continue;
            }
            std::fs::remove_file(target).map_err(|e| e.to_string())?;
            c.execute("DELETE FROM automatic_backups WHERE id=?1", [record])
                .map_err(|e| e.to_string())?;
        }
        Ok::<_, String>(Some(destination.to_string_lossy().into_owned()))
    })();
    put(
        &c,
        "auto_backup_error",
        result.as_ref().err().map(|e| e.as_str()).unwrap_or(""),
    )?;
    result
}
#[tauri::command]
pub fn preview_database_backup(source: String) -> Result<BackupPreview, String> {
    preview_path(Path::new(&source))
}

pub(crate) fn preview_path(source: &Path) -> Result<BackupPreview, String> {
    let source = Connection::open_with_flags(source, rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY)
        .map_err(|e| e.to_string())?;
    let mut snapshot = Connection::open_in_memory().map_err(|e| e.to_string())?;
    let backup =
        rusqlite::backup::Backup::new(&source, &mut snapshot).map_err(|e| e.to_string())?;
    backup
        .run_to_completion(128, std::time::Duration::from_millis(10), None)
        .map_err(|e| e.to_string())?;
    drop(backup);
    crate::database_backup::validate_snapshot(&snapshot)?;
    let schema_version = snapshot
        .query_row(
            "SELECT COALESCE(MAX(version),0) FROM schema_migrations",
            [],
            |r| r.get(0),
        )
        .unwrap_or(0);
    crate::database::migrate(&snapshot).map_err(|e| format!("备份升级校验失败：{e}"))?;
    crate::database_backup::validate_snapshot(&snapshot)?;
    let mut counts = Vec::new();
    for (name, table) in [
        ("账户", "accounts"),
        ("交易", "transactions"),
        ("项目", "journey_projects"),
        ("任务", "daily_tasks"),
        ("日程", "daily_events"),
        ("笔记", "knowledge_notes"),
        ("附件", "note_attachments"),
        ("私密记录", "private_calendar_events"),
        ("密码记录", "vault_items"),
        ("重复规则", "task_routines"),
        ("订阅", "subscriptions"),
    ] {
        let count = snapshot
            .query_row(&format!("SELECT COUNT(*) FROM {table}"), [], |r| r.get(0))
            .map_err(|e| e.to_string())?;
        counts.push((name.into(), count));
    }
    let has_security = snapshot
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM app_security WHERE id=1)",
            [],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    Ok(BackupPreview {
        schema_version,
        upgraded_version: 8,
        has_security,
        counts,
    })
}
#[tauri::command]
pub fn open_backup_directory(app: tauri::AppHandle) -> Result<(), String> {
    let c = connect(&app).map_err(|e| e.to_string())?;
    let directory = PathBuf::from(config(&app, &c)?.directory);
    std::fs::create_dir_all(&directory).map_err(|e| e.to_string())?;
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        std::process::Command::new("explorer.exe")
            .arg(directory)
            .creation_flags(0x08000000)
            .spawn()
            .map_err(|e| e.to_string())?;
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("此入口仅支持 Windows".into())
    }
}
fn can_remove_automatic(
    directory: &Path,
    record: &str,
    target: &Path,
    hash: &str,
) -> Result<bool, String> {
    if target.parent().and_then(|p| p.canonicalize().ok())
        != Some(directory.canonicalize().map_err(|e| e.to_string())?)
        || target.file_name().and_then(|n| n.to_str())
            != Some(&format!("myfinance-auto-{record}.sqlite3"))
    {
        return Ok(false);
    }
    Ok(checksum(target)? == hash)
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn cleanup_requires_origin_directory_name_and_original_hash() {
        let directory = std::env::temp_dir().join(format!("myfinance-retention-{}", id()));
        std::fs::create_dir_all(&directory).unwrap();
        let target = directory.join("myfinance-auto-record.sqlite3");
        std::fs::write(&target, b"snapshot").unwrap();
        let hash = checksum(&target).unwrap();
        assert!(can_remove_automatic(&directory, "record", &target, &hash).unwrap());
        assert!(!can_remove_automatic(&directory, "different", &target, &hash).unwrap());
        assert!(
            !can_remove_automatic(directory.parent().unwrap(), "record", &target, &hash).unwrap()
        );
        std::fs::write(&target, b"replaced").unwrap();
        assert!(!can_remove_automatic(&directory, "record", &target, &hash).unwrap());
        std::fs::remove_dir_all(directory).unwrap();
    }
}
