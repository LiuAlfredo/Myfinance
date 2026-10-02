use rusqlite::{Connection, Result};
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

pub fn path(app: &tauri::AppHandle) -> Result<PathBuf> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
    fs::create_dir_all(&dir).map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
    Ok(dir.join("myfinance.sqlite3"))
}

pub fn connect(app: &tauri::AppHandle) -> Result<Connection> {
    let conn = Connection::open(path(app)?)?;
    conn.pragma_update(None, "foreign_keys", "ON")?;
    conn.busy_timeout(std::time::Duration::from_secs(5))?;
    Ok(conn)
}

pub fn initialize(app: &tauri::AppHandle) -> Result<()> {
    let conn = connect(app)?;
    let version: i64 = conn
        .query_row(
            "SELECT COALESCE(MAX(version),0) FROM schema_migrations",
            [],
            |r| r.get(0),
        )
        .unwrap_or(0);
    let populated: bool = conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='accounts')",
        [],
        |r| r.get(0),
    )?;
    if populated && version < 9 {
        let source = path(app)?;
        let destination = source.with_extension(format!("pre-upgrade-{}-{}.sqlite3", now(), id()));
        crate::database_backup::backup(&source, &destination).map_err(|e| {
            rusqlite::Error::ToSqlConversionFailure(Box::new(std::io::Error::other(e)))
        })?;
    }
    migrate(&conn)
}

pub fn migrate(conn: &Connection) -> Result<()> {
    conn.execute_batch("PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY,applied_at INTEGER NOT NULL);")?;
    let latest: i64 = conn.query_row(
        "SELECT COALESCE(MAX(version),0) FROM schema_migrations",
        [],
        |r| r.get(0),
    )?;
    if latest > 9 {
        return Err(rusqlite::Error::InvalidQuery);
    }
    let tx = conn.unchecked_transaction()?;
    let initial: bool = tx.query_row(
        "SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version=1)",
        [],
        |r| r.get(0),
    )?;
    if !initial {
        legacy_baseline(&tx)?;
        tx.execute("INSERT INTO schema_migrations VALUES(1,?1)", [now()])?;
    }
    for (version, sql) in [
        (2, include_str!("../migrations/002_private_calendar.sql")),
        (3, include_str!("../migrations/003_journey.sql")),
        (4, include_str!("../migrations/004_password_vault.sql")),
        (5, include_str!("../migrations/005_daily_knowledge.sql")),
        (
            6,
            include_str!("../migrations/006_workspace_reliability.sql"),
        ),
        (
            7,
            include_str!("../migrations/007_routines_subscriptions.sql"),
        ),
        (
            8,
            include_str!("../migrations/008_finance_ledger_links.sql"),
        ),
        (
            9,
            include_str!("../migrations/009_cloud_backup_revision.sql"),
        ),
    ] {
        let applied: bool = tx.query_row(
            "SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version=?1)",
            [version],
            |r| r.get(0),
        )?;
        if !applied {
            tx.execute_batch(sql)?;
        }
    }
    tx.commit()
}

fn legacy_baseline(conn: &Connection) -> Result<()> {
    conn.execute_batch("PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, name TEXT NOT NULL, institution TEXT NOT NULL DEFAULT '', type TEXT NOT NULL, currency TEXT NOT NULL DEFAULT 'CNY', initial_balance INTEGER NOT NULL DEFAULT 0, is_active INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS categories (id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL, icon TEXT NOT NULL DEFAULT 'tag', color TEXT NOT NULL DEFAULT '#5b6ee1', sort_order INTEGER NOT NULL DEFAULT 0, is_system INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS transactions (id TEXT PRIMARY KEY, type TEXT NOT NULL, account_id TEXT NOT NULL REFERENCES accounts(id), category_id TEXT REFERENCES categories(id), amount INTEGER NOT NULL, currency TEXT NOT NULL DEFAULT 'CNY', merchant TEXT NOT NULL DEFAULT '', transaction_date INTEGER NOT NULL, note TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS transfers (id TEXT PRIMARY KEY, from_account_id TEXT NOT NULL REFERENCES accounts(id), to_account_id TEXT NOT NULL REFERENCES accounts(id), amount INTEGER NOT NULL CHECK(amount > 0), currency TEXT NOT NULL DEFAULT 'CNY', transfer_date INTEGER NOT NULL, note TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS recurring_transactions (id TEXT PRIMARY KEY, type TEXT NOT NULL, account_id TEXT NOT NULL REFERENCES accounts(id), category_id TEXT REFERENCES categories(id), amount INTEGER NOT NULL CHECK(amount > 0), currency TEXT NOT NULL DEFAULT 'CNY', title TEXT NOT NULL, frequency TEXT NOT NULL, start_date INTEGER NOT NULL, end_date INTEGER, next_run_date INTEGER NOT NULL, is_active INTEGER NOT NULL DEFAULT 1, note TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS planned_expenses (id TEXT PRIMARY KEY, title TEXT NOT NULL, amount INTEGER NOT NULL CHECK(amount > 0), currency TEXT NOT NULL DEFAULT 'CNY', planned_date INTEGER NOT NULL, category_id TEXT REFERENCES categories(id), account_id TEXT NOT NULL REFERENCES accounts(id), status TEXT NOT NULL DEFAULT 'PLANNED', note TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS installments (id TEXT PRIMARY KEY, title TEXT NOT NULL, total_amount INTEGER NOT NULL CHECK(total_amount > 0), installment_count INTEGER NOT NULL CHECK(installment_count > 0), installment_amount INTEGER NOT NULL, first_payment_date INTEGER NOT NULL, paid_count INTEGER NOT NULL DEFAULT 0, remaining_count INTEGER NOT NULL, remaining_amount INTEGER NOT NULL, account_id TEXT NOT NULL REFERENCES accounts(id), status TEXT NOT NULL DEFAULT 'ACTIVE', note TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS budgets (id TEXT PRIMARY KEY, category_id TEXT NOT NULL REFERENCES categories(id), amount INTEGER NOT NULL CHECK(amount >= 0), currency TEXT NOT NULL DEFAULT 'CNY', year INTEGER NOT NULL, month INTEGER NOT NULL CHECK(month BETWEEN 1 AND 12), created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, UNIQUE(category_id, year, month));
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER NOT NULL);")?;
    let has_active: i64 = conn.query_row(
        "SELECT COUNT(*) FROM pragma_table_info('categories') WHERE name='is_active'",
        [],
        |r| r.get(0),
    )?;
    if has_active == 0 {
        conn.execute(
            "ALTER TABLE categories ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1",
            [],
        )?;
    }
    let has_recurring_note: i64 = conn.query_row(
        "SELECT COUNT(*) FROM pragma_table_info('recurring_transactions') WHERE name='note'",
        [],
        |r| r.get(0),
    )?;
    if has_recurring_note == 0 {
        conn.execute(
            "ALTER TABLE recurring_transactions ADD COLUMN note TEXT NOT NULL DEFAULT ''",
            [],
        )?;
    }
    let has_installment_note: i64 = conn.query_row(
        "SELECT COUNT(*) FROM pragma_table_info('installments') WHERE name='note'",
        [],
        |r| r.get(0),
    )?;
    if has_installment_note == 0 {
        conn.execute(
            "ALTER TABLE installments ADD COLUMN note TEXT NOT NULL DEFAULT ''",
            [],
        )?;
    }
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM categories", [], |r| r.get(0))?;
    if count == 0 {
        let now = now();
        let defaults = [
            ("餐饮", "EXPENSE", "utensils"),
            ("交通", "EXPENSE", "train"),
            ("购物", "EXPENSE", "shopping-bag"),
            ("住房", "EXPENSE", "house"),
            ("娱乐", "EXPENSE", "sparkles"),
            ("医疗", "EXPENSE", "heart-pulse"),
            ("学习", "EXPENSE", "book-open"),
            ("通讯", "EXPENSE", "smartphone"),
            ("旅行", "EXPENSE", "plane"),
            ("生活", "EXPENSE", "coffee"),
            ("其他", "EXPENSE", "tag"),
            ("工资", "INCOME", "briefcase"),
            ("其他收入", "INCOME", "plus"),
        ];
        for (i, (name, typ, icon)) in defaults.iter().enumerate() {
            conn.execute("INSERT INTO categories (id,name,type,icon,color,sort_order,is_system,created_at,updated_at) VALUES (?1,?2,?3,?4,'#5b6ee1',?5,1,?6,?6)", rusqlite::params![uuid::Uuid::new_v4().to_string(), name, typ, icon, i as i64, now])?;
        }
    }
    Ok(())
}

pub fn now() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}
pub fn id() -> String {
    uuid::Uuid::new_v4().to_string()
}

#[cfg(test)]
mod migration_tests {
    use super::*;
    #[test]
    fn versioned_upgrade_is_repeatable_and_preserves_records() {
        let c = Connection::open_in_memory().unwrap();
        legacy_baseline(&c).unwrap();
        c.execute_batch(include_str!("../migrations/002_private_calendar.sql"))
            .unwrap();
        c.execute_batch(include_str!("../migrations/003_journey.sql"))
            .unwrap();
        c.execute_batch(include_str!("../migrations/004_password_vault.sql"))
            .unwrap();
        c.execute_batch(include_str!("../migrations/005_daily_knowledge.sql"))
            .unwrap();
        c.execute("INSERT INTO knowledge_notes(id,title,body,created_at,updated_at)VALUES('n','old','retained',1,1)",[]).unwrap();
        migrate(&c).unwrap();
        migrate(&c).unwrap();
        assert_eq!(
            c.query_row("SELECT body FROM knowledge_notes WHERE id='n'", [], |r| {
                r.get::<_, String>(0)
            })
            .unwrap(),
            "retained"
        );
        assert_eq!(
            c.query_row("SELECT COUNT(*) FROM schema_migrations", [], |r| r
                .get::<_, i64>(0))
                .unwrap(),
            9
        );
    }
    #[test]
    fn failed_upgrade_rolls_back_all_new_schema_changes() {
        let c = Connection::open_in_memory().unwrap();
        migrate(&c).unwrap();
        c.execute_batch("DELETE FROM schema_migrations WHERE version=8;DROP TABLE recurring_payments;DROP TABLE installment_payments;ALTER TABLE planned_expenses DROP COLUMN transaction_id;CREATE TABLE recurring_payments(unrelated TEXT);").unwrap();
        assert!(migrate(&c).is_err());
        assert_eq!(
            c.query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE name='installment_payments'",
                [],
                |r| r.get::<_, i64>(0)
            )
            .unwrap(),
            0
        );
        assert_eq!(
            c.query_row(
                "SELECT COUNT(*) FROM schema_migrations WHERE version=8",
                [],
                |r| r.get::<_, i64>(0)
            )
            .unwrap(),
            0
        );
    }
    #[test]
    fn refuses_newer_database_version() {
        let c = Connection::open_in_memory().unwrap();
        migrate(&c).unwrap();
        c.execute("INSERT INTO schema_migrations VALUES(10,0)", [])
            .unwrap();
        assert!(migrate(&c).is_err());
    }

    #[test]
    fn cloud_revision_tracks_business_create_update_and_delete() {
        let c = Connection::open_in_memory().unwrap();
        migrate(&c).unwrap();
        let initial: i64 = c
            .query_row(
                "SELECT revision FROM cloud_change_state WHERE id=1",
                [],
                |r| r.get(0),
            )
            .unwrap();
        c.execute("INSERT INTO accounts(id,name,institution,type,currency,initial_balance,is_active,created_at,updated_at) VALUES('a','现金','','CASH','CNY',0,1,1,1)", []).unwrap();
        c.execute("UPDATE accounts SET name='钱包' WHERE id='a'", [])
            .unwrap();
        c.execute("DELETE FROM accounts WHERE id='a'", []).unwrap();
        let current: i64 = c
            .query_row(
                "SELECT revision FROM cloud_change_state WHERE id=1",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(current, initial + 3);
    }
}
