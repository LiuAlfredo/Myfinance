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
    migrate(&conn)?;
    Ok(conn)
}

fn migrate(conn: &Connection) -> Result<()> {
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
    conn.execute_batch(include_str!("../migrations/002_private_calendar.sql"))?;
    conn.execute_batch(include_str!("../migrations/003_journey.sql"))?;
    conn.execute_batch(include_str!("../migrations/004_password_vault.sql"))?;
    conn.execute_batch(include_str!("../migrations/005_daily_knowledge.sql"))?;
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
