use rusqlite::{backup::Backup, Connection, OpenFlags};
use std::{path::Path, time::Duration};

fn same_file(left: &Path, right: &Path) -> bool {
    match (left.canonicalize(), right.canonicalize()) {
        (Ok(left), Ok(right)) => left.to_string_lossy().eq_ignore_ascii_case(&right.to_string_lossy()),
        _ => false,
    }
}

fn copy_snapshot(source: &Connection, destination: &mut Connection) -> Result<(), String> {
    // SQLite includes committed WAL pages and rolls back an unfinished backup.
    let backup = Backup::new(source, destination).map_err(|error| error.to_string())?;
    let start = std::time::Instant::now();
    loop {
        match backup.step(128).map_err(|error| error.to_string())? {
            rusqlite::backup::StepResult::Done => return Ok(()),
            _ if start.elapsed() >= Duration::from_secs(15) => return Err("数据库正忙，请稍后重试".into()),
            rusqlite::backup::StepResult::More => {},
            _ => std::thread::sleep(Duration::from_millis(25)),
        }
    }
}

fn validate_snapshot(connection: &Connection) -> Result<(), String> {
    let check: String = connection.query_row("PRAGMA integrity_check", [], |row| row.get(0))
        .map_err(|_| "备份文件不是有效的 SQLite 数据库")?;
    if check != "ok" { return Err("备份完整性校验失败".into()); }
    for sql in [
        "SELECT id,name,initial_balance FROM accounts LIMIT 0",
        "SELECT id,account_id,amount FROM transactions LIMIT 0",
        "SELECT key,value FROM settings LIMIT 0",
    ] {
        connection.prepare(sql).map_err(|_| "请选择 My Personal Affairs / MyFinance 的完整数据库备份")?;
    }
    let has_private_events: bool = connection.query_row(
        "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='private_calendar_events')", [], |row| row.get(0),
    ).map_err(|error| error.to_string())?;
    if has_private_events {
        connection.prepare("SELECT id,month_index,day_index,payload,created_at,updated_at FROM private_calendar_events LIMIT 0")
            .map_err(|_| "私密日历备份结构无效")?;
        let count: i64 = connection.query_row("SELECT COUNT(*) FROM private_calendar_events", [], |row| row.get(0))
            .map_err(|_| "私密日历备份结构无效")?;
        if count > 0 {
            let count: i64 = connection.query_row(
                "SELECT COUNT(*) FROM app_security WHERE id=1 AND length(password_hash)>0 AND length(wrapped_data_key)>0 AND length(wrap_salt)>0 AND length(wrap_nonce)>0", [], |row| row.get(0),
            ).map_err(|_| "备份缺少私密记录的密钥配置")?;
            if count != 1 { return Err("备份缺少私密记录的密钥配置".into()); }
        }
    }
    let has_vault: bool = connection.query_row(
        "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='vault_items')", [], |row| row.get(0),
    ).map_err(|error| error.to_string())?;
    if has_vault {
        connection.prepare("SELECT id,version,key_version,payload,created_at,updated_at FROM vault_items LIMIT 0")
            .map_err(|_| "密码库备份结构无效")?;
        connection.prepare("SELECT id,version,wrapped_key,created_at FROM vault_keys LIMIT 0")
            .map_err(|_| "密码库备份缺少密钥表")?;
        let item_count: i64 = connection.query_row("SELECT COUNT(*) FROM vault_items", [], |row| row.get(0))
            .map_err(|_| "密码库备份结构无效")?;
        let key_count: i64 = connection.query_row("SELECT COUNT(*) FROM vault_keys WHERE id=1 AND version=1 AND length(wrapped_key)>0", [], |row| row.get(0))
            .map_err(|_| "密码库备份缺少密钥")?;
        if item_count > 0 && key_count != 1 { return Err("密码库备份缺少密钥".into()); }
        if item_count > 0 {
            let security_count: i64 = connection.query_row("SELECT COUNT(*) FROM app_security WHERE id=1 AND length(wrapped_data_key)>0", [], |row| row.get(0))
                .map_err(|_| "密码库备份缺少主密钥配置")?;
            if security_count != 1 { return Err("密码库备份缺少主密钥配置".into()); }
        }
    }
    Ok(())
}

pub fn backup(source: &Path, destination: &Path) -> Result<(), String> {
    if same_file(source, destination) { return Err("备份目标不能是当前数据库".into()); }
    let connection = Connection::open_with_flags(source, OpenFlags::SQLITE_OPEN_READ_ONLY)
        .map_err(|error| error.to_string())?;
    let mut target = Connection::open(destination).map_err(|error| error.to_string())?;
    copy_snapshot(&connection, &mut target)
}

pub fn restore(current: &Path, source: &Path) -> Result<(), String> {
    if same_file(current, source) { return Err("不能将当前数据库恢复到自身".into()); }
    let source_connection = Connection::open_with_flags(source, OpenFlags::SQLITE_OPEN_READ_ONLY)
        .map_err(|_| "无法打开备份文件")?;
    // Validate a consistent snapshot before touching the live database.
    let mut snapshot = Connection::open_in_memory().map_err(|error| error.to_string())?;
    copy_snapshot(&source_connection, &mut snapshot)?;
    validate_snapshot(&snapshot)?;
    if current.exists() {
        let previous = current.with_extension(format!("previous-{}-{}.sqlite3", crate::database::now(), crate::database::id()));
        backup(current, &previous)?;
    }
    let mut target = Connection::open(current).map_err(|error| error.to_string())?;
    // Restore through SQLite, preserving its locking and WAL coordination.
    copy_snapshot(&snapshot, &mut target)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn backup_and_restore_include_live_wal_and_reject_unrelated_databases() {
        let directory = std::env::temp_dir().join(format!("myfinance-backup-test-{}", crate::database::id()));
        std::fs::create_dir_all(&directory).unwrap();
        let current = directory.join("current.sqlite3");
        let saved = directory.join("saved.sqlite3");
        let invalid = directory.join("invalid.sqlite3");
        {
            let live = Connection::open(&current).unwrap();
            live.execute_batch("PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0;
                CREATE TABLE accounts(id TEXT,name TEXT,initial_balance INTEGER);
                CREATE TABLE transactions(id TEXT,account_id TEXT,amount INTEGER);
                CREATE TABLE settings(key TEXT,value TEXT);
                CREATE TABLE app_security(id INTEGER PRIMARY KEY,password_hash TEXT,wrapped_data_key TEXT);
                CREATE TABLE vault_keys(id INTEGER PRIMARY KEY,version INTEGER,wrapped_key TEXT,created_at INTEGER);
                CREATE TABLE vault_items(id TEXT PRIMARY KEY,version INTEGER,key_version INTEGER,payload TEXT,created_at INTEGER,updated_at INTEGER);
                INSERT INTO app_security VALUES(1,'hash','wrapped-master');
                INSERT INTO vault_keys VALUES(1,1,'wrapped-vault',1);
                INSERT INTO vault_items VALUES('record',1,1,'ciphertext',1,1);
                INSERT INTO settings VALUES('test','original');").unwrap();
            backup(&current, &saved).unwrap();
            let exported = Connection::open(&saved).unwrap();
            let value: String = exported.query_row("SELECT value FROM settings", [], |row| row.get(0)).unwrap();
            assert_eq!(value, "original");
            let encrypted: String = exported.query_row("SELECT payload FROM vault_items WHERE id='record'", [], |row| row.get(0)).unwrap();
            assert_eq!(encrypted, "ciphertext");
            drop(exported);
            live.execute("UPDATE settings SET value='changed'", []).unwrap();
            Connection::open(&invalid).unwrap().execute_batch("CREATE TABLE unrelated(id INTEGER)").unwrap();
            assert!(restore(&current, &invalid).is_err());
            let unchanged: String = live.query_row("SELECT value FROM settings", [], |row| row.get(0)).unwrap();
            assert_eq!(unchanged, "changed");
            restore(&current, &saved).unwrap();
            let restored: String = live.query_row("SELECT value FROM settings", [], |row| row.get(0)).unwrap();
            assert_eq!(restored, "original");
            let encrypted: String = live.query_row("SELECT payload FROM vault_items WHERE id='record'", [], |row| row.get(0)).unwrap();
            assert_eq!(encrypted, "ciphertext");
            assert!(backup(&current, &current).is_err());
        }
        std::fs::remove_dir_all(directory).unwrap();
    }
}
