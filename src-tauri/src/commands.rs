use crate::database::{connect, id, now};
use crate::security::SecurityState;
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Account {
    pub id: String,
    pub name: String,
    pub institution: String,
    pub r#type: String,
    pub currency: String,
    pub initial_balance: i64,
    pub balance: i64,
    pub is_active: bool,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Category {
    pub id: String,
    pub name: String,
    pub r#type: String,
    pub icon: String,
    pub color: String,
    pub is_active: bool,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Transaction {
    pub id: String,
    pub r#type: String,
    pub account_id: String,
    pub account_name: String,
    pub category_id: Option<String>,
    pub category_name: Option<String>,
    pub amount: i64,
    pub currency: String,
    pub merchant: String,
    pub transaction_date: i64,
    pub note: String,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Dashboard {
    pub total_balance: i64,
    pub monthly_income: i64,
    pub monthly_expenses: i64,
    pub monthly_savings: i64,
    pub account_count: i64,
    pub transactions: Vec<Transaction>,
    pub accounts: Vec<Account>,
}
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountInput {
    pub name: String,
    pub institution: String,
    pub r#type: String,
    pub currency: String,
    pub initial_balance: i64,
}
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransactionInput {
    pub r#type: String,
    pub account_id: String,
    pub category_id: Option<String>,
    pub amount: i64,
    pub currency: String,
    pub merchant: String,
    pub transaction_date: i64,
    pub note: String,
}
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CategoryInput {
    pub name: String,
    pub r#type: String,
    pub icon: String,
    pub color: String,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SimpleRecord {
    pub id: String,
    pub title: String,
    pub amount: i64,
    pub date: i64,
    pub status: String,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Recurring {
    pub id: String,
    pub r#type: String,
    pub account_id: String,
    pub category_id: Option<String>,
    pub amount: i64,
    pub currency: String,
    pub title: String,
    pub frequency: String,
    pub start_date: i64,
    pub end_date: Option<i64>,
    pub next_run_date: i64,
    pub is_active: bool,
    pub note: String,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Planned {
    pub id: String,
    pub title: String,
    pub amount: i64,
    pub currency: String,
    pub planned_date: i64,
    pub category_id: Option<String>,
    pub account_id: String,
    pub status: String,
    pub note: String,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Installment {
    pub id: String,
    pub title: String,
    pub total_amount: i64,
    pub installment_count: i64,
    pub installment_amount: i64,
    pub first_payment_date: i64,
    pub paid_count: i64,
    pub remaining_count: i64,
    pub remaining_amount: i64,
    pub account_id: String,
    pub status: String,
    pub note: String,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Budget {
    pub id: String,
    pub category_id: String,
    pub category_name: String,
    pub amount: i64,
    pub spent: i64,
    pub currency: String,
    pub year: i64,
    pub month: i64,
}
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecurringInput {
    pub r#type: String,
    pub account_id: String,
    pub category_id: Option<String>,
    pub amount: i64,
    pub currency: String,
    pub title: String,
    pub frequency: String,
    pub start_date: i64,
    pub end_date: Option<i64>,
    #[serde(default)]
    pub note: String,
}
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlannedInput {
    pub title: String,
    pub amount: i64,
    pub currency: String,
    pub planned_date: i64,
    pub category_id: Option<String>,
    pub account_id: String,
    pub note: String,
}
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallmentInput {
    pub title: String,
    pub total_amount: i64,
    pub installment_count: i64,
    pub first_payment_date: i64,
    pub account_id: String,
    #[serde(default)]
    pub note: String,
}
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BudgetInput {
    pub category_id: String,
    pub amount: i64,
    pub currency: String,
    pub year: i64,
    pub month: i64,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ForecastPoint {
    pub date: i64,
    pub balance: i64,
    pub income: i64,
    pub expense: i64,
    pub label: String,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PurchaseAnalysis {
    pub verdict: String,
    pub current_balance: i64,
    pub balance_after_purchase: i64,
    pub minimum_future_balance: i64,
    pub safety_balance: i64,
    pub reason: String,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileInfo {
    pub name: String,
    pub size: u64,
    pub modified: i64,
}

fn validate_amount(amount: i64) -> Result<(), String> {
    if amount <= 0 {
        Err("金额必须大于 0（以分为单位）".into())
    } else {
        Ok(())
    }
}
fn account_balance(conn: &rusqlite::Connection, id: &str) -> rusqlite::Result<i64> {
    let initial: i64 = conn.query_row(
        "SELECT initial_balance FROM accounts WHERE id=?1",
        [id],
        |r| r.get(0),
    )?;
    let in_sum: i64 = conn.query_row(
        "SELECT COALESCE(SUM(amount),0) FROM transactions WHERE account_id=?1 AND type='INCOME'",
        [id],
        |r| r.get(0),
    )?;
    let out_sum: i64 = conn.query_row(
        "SELECT COALESCE(SUM(amount),0) FROM transactions WHERE account_id=?1 AND type='EXPENSE'",
        [id],
        |r| r.get(0),
    )?;
    let adj:i64=conn.query_row("SELECT COALESCE(SUM(CASE WHEN type='ADJUSTMENT' THEN amount ELSE 0 END),0) FROM transactions WHERE account_id=?1",[id],|r|r.get(0))?;
    let ti: i64 = conn.query_row(
        "SELECT COALESCE(SUM(amount),0) FROM transfers WHERE to_account_id=?1",
        [id],
        |r| r.get(0),
    )?;
    let to: i64 = conn.query_row(
        "SELECT COALESCE(SUM(amount),0) FROM transfers WHERE from_account_id=?1",
        [id],
        |r| r.get(0),
    )?;
    Ok(initial + in_sum - out_sum + adj + ti - to)
}
fn map_account(conn: &rusqlite::Connection, row: &rusqlite::Row) -> rusqlite::Result<Account> {
    let id: String = row.get(0)?;
    Ok(Account {
        id: id.clone(),
        name: row.get(1)?,
        institution: row.get(2)?,
        r#type: row.get(3)?,
        currency: row.get(4)?,
        initial_balance: row.get(5)?,
        balance: account_balance(conn, &id)?,
        is_active: row.get::<_, i64>(6)? != 0,
    })
}

#[tauri::command]
pub fn get_accounts(app: tauri::AppHandle) -> Result<Vec<Account>, String> {
    let c = connect(&app).map_err(|e| e.to_string())?;
    let mut s=c.prepare("SELECT id,name,institution,type,currency,initial_balance,is_active FROM accounts ORDER BY is_active DESC,created_at DESC").map_err(|e|e.to_string())?;
    let rows = s
        .query_map([], |r| map_account(&c, r))
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}
#[tauri::command]
pub fn save_account(
    app: tauri::AppHandle,
    input: AccountInput,
    id_opt: Option<String>,
) -> Result<Account, String> {
    if input.name.trim().is_empty() {
        return Err("账户名称不能为空".into());
    }
    let c = connect(&app).map_err(|e| e.to_string())?;
    let tx = c.unchecked_transaction().map_err(|e| e.to_string())?;
    let idv = id_opt.unwrap_or_else(id);
    let t = now();
    tx.execute("INSERT INTO accounts (id,name,institution,type,currency,initial_balance,is_active,created_at,updated_at) VALUES (?1,?2,?3,?4,?5,?6,1,?7,?7) ON CONFLICT(id) DO UPDATE SET name=excluded.name,institution=excluded.institution,type=excluded.type,currency=excluded.currency,initial_balance=excluded.initial_balance,updated_at=excluded.updated_at",params![idv,input.name.trim(),input.institution.trim(),input.r#type,input.currency,input.initial_balance,t]).map_err(|e|e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;
    get_accounts(app)?
        .into_iter()
        .find(|a| a.id == idv)
        .ok_or("账户保存失败".into())
}
#[tauri::command]
pub fn set_account_active(app: tauri::AppHandle, id: String, active: bool) -> Result<(), String> {
    let c = connect(&app).map_err(|e| e.to_string())?;
    c.execute(
        "UPDATE accounts SET is_active=?2,updated_at=?3 WHERE id=?1",
        params![id, active as i64, now()],
    )
    .map_err(|e| e.to_string())
    .map(|_| ())
}
#[tauri::command]
pub fn delete_account(app: tauri::AppHandle, id: String) -> Result<(), String> {
    let c = connect(&app).map_err(|e| e.to_string())?;
    let used:i64=c.query_row("SELECT (SELECT COUNT(*) FROM transactions WHERE account_id=?1)+(SELECT COUNT(*) FROM transfers WHERE from_account_id=?1 OR to_account_id=?1)",[&id],|r|r.get(0)).map_err(|e|e.to_string())?;
    if used > 0 {
        return Err("已有交易记录的账户不能删除，请先停用账户".into());
    }
    c.execute("DELETE FROM accounts WHERE id=?1", [id])
        .map_err(|e| e.to_string())
        .map(|_| ())
}
#[tauri::command]
pub fn get_categories(
    app: tauri::AppHandle,
    kind: Option<String>,
) -> Result<Vec<Category>, String> {
    let c = connect(&app).map_err(|e| e.to_string())?;
    let mut s=c.prepare("SELECT id,name,type,icon,color,is_active FROM categories WHERE (?1 IS NULL OR type=?1) ORDER BY is_active DESC,sort_order,name").map_err(|e|e.to_string())?;
    let rows = s
        .query_map([kind], |r| {
            Ok(Category {
                id: r.get(0)?,
                name: r.get(1)?,
                r#type: r.get(2)?,
                icon: r.get(3)?,
                color: r.get(4)?,
                is_active: r.get::<_, i64>(5)? != 0,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}
#[tauri::command]
pub fn save_category(
    app: tauri::AppHandle,
    input: CategoryInput,
    id_opt: Option<String>,
) -> Result<Category, String> {
    if input.name.trim().is_empty() {
        return Err("分类名称不能为空".into());
    }
    let c = connect(&app).map_err(|e| e.to_string())?;
    let idv = id_opt.unwrap_or_else(id);
    c.execute("INSERT INTO categories(id,name,type,icon,color,created_at,updated_at) VALUES(?1,?2,?3,?4,?5,?6,?6) ON CONFLICT(id) DO UPDATE SET name=excluded.name,type=excluded.type,icon=excluded.icon,color=excluded.color,updated_at=excluded.updated_at",params![idv,input.name.trim(),input.r#type,input.icon,input.color,now()]).map_err(|e|e.to_string())?;
    get_categories(app, None)?
        .into_iter()
        .find(|x| x.id == idv)
        .ok_or("分类保存失败".into())
}
#[tauri::command]
pub fn set_category_active(app: tauri::AppHandle, id: String, active: bool) -> Result<(), String> {
    let c = connect(&app).map_err(|e| e.to_string())?;
    let system: i64 = c
        .query_row("SELECT is_system FROM categories WHERE id=?1", [&id], |r| {
            r.get(0)
        })
        .map_err(|e| e.to_string())?;
    if system != 0 && !active {
        return Err("系统分类不能停用".into());
    }
    c.execute(
        "UPDATE categories SET is_active=?2,updated_at=?3 WHERE id=?1",
        params![id, active as i64, now()],
    )
    .map_err(|e| e.to_string())
    .map(|_| ())
}
#[tauri::command]
pub fn save_transaction(
    app: tauri::AppHandle,
    input: TransactionInput,
    id_opt: Option<String>,
) -> Result<Transaction, String> {
    if input.r#type == "ADJUSTMENT" {
        if input.amount == 0 {
            return Err("余额调整不能为 0".into());
        }
    } else {
        validate_amount(input.amount)?;
    }
    if input.r#type != "INCOME" && input.r#type != "EXPENSE" && input.r#type != "ADJUSTMENT" {
        return Err("不支持的交易类型".into());
    }
    let c = connect(&app).map_err(|e| e.to_string())?;
    let exists: i64 = c
        .query_row(
            "SELECT COUNT(*) FROM accounts WHERE id=?1 AND is_active=1",
            [&input.account_id],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    if exists == 0 {
        return Err("请选择有效的启用账户".into());
    }
    let idv = id_opt.unwrap_or_else(id);
    let t = now();
    c.execute("INSERT INTO transactions(id,type,account_id,category_id,amount,currency,merchant,transaction_date,note,created_at,updated_at) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?10) ON CONFLICT(id) DO UPDATE SET type=excluded.type,account_id=excluded.account_id,category_id=excluded.category_id,amount=excluded.amount,currency=excluded.currency,merchant=excluded.merchant,transaction_date=excluded.transaction_date,note=excluded.note,updated_at=excluded.updated_at",params![idv,input.r#type,input.account_id,input.category_id,input.amount,input.currency,input.merchant,input.transaction_date,input.note,t]).map_err(|e|e.to_string())?;
    get_transactions(app, None, None)?
        .into_iter()
        .find(|x| x.id == idv)
        .ok_or("交易保存失败".into())
}
#[tauri::command]
pub fn get_transactions(
    app: tauri::AppHandle,
    from: Option<i64>,
    to: Option<i64>,
) -> Result<Vec<Transaction>, String> {
    let c = connect(&app).map_err(|e| e.to_string())?;
    let mut s=c.prepare("SELECT t.id,t.type,t.account_id,a.name,t.category_id,c.name,t.amount,t.currency,t.merchant,t.transaction_date,t.note FROM transactions t JOIN accounts a ON a.id=t.account_id LEFT JOIN categories c ON c.id=t.category_id WHERE (?1 IS NULL OR t.transaction_date>=?1) AND (?2 IS NULL OR t.transaction_date<=?2) ORDER BY t.transaction_date DESC,t.created_at DESC").map_err(|e|e.to_string())?;
    let rows = s
        .query_map(params![from, to], |r| {
            Ok(Transaction {
                id: r.get(0)?,
                r#type: r.get(1)?,
                account_id: r.get(2)?,
                account_name: r.get(3)?,
                category_id: r.get(4)?,
                category_name: r.get(5)?,
                amount: r.get(6)?,
                currency: r.get(7)?,
                merchant: r.get(8)?,
                transaction_date: r.get(9)?,
                note: r.get(10)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}
#[tauri::command]
pub fn delete_transaction(app: tauri::AppHandle, id: String) -> Result<(), String> {
    let c = connect(&app).map_err(|e| e.to_string())?;
    c.execute("DELETE FROM transactions WHERE id=?1", [id])
        .map_err(|e| e.to_string())
        .map(|_| ())
}
#[tauri::command]
pub fn create_transfer(
    app: tauri::AppHandle,
    from_account_id: String,
    to_account_id: String,
    amount: i64,
    currency: String,
    transfer_date: i64,
    note: String,
) -> Result<(), String> {
    validate_amount(amount)?;
    if from_account_id == to_account_id {
        return Err("转出和转入账户不能相同".into());
    }
    let c = connect(&app).map_err(|e| e.to_string())?;
    let tx = c.unchecked_transaction().map_err(|e| e.to_string())?;
    let count: i64 = tx
        .query_row(
            "SELECT COUNT(*) FROM accounts WHERE id IN (?1,?2) AND is_active=1",
            params![from_account_id, to_account_id],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    if count != 2 {
        return Err("请选择两个有效账户".into());
    }
    tx.execute("INSERT INTO transfers(id,from_account_id,to_account_id,amount,currency,transfer_date,note,created_at,updated_at) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?8)",params![id(),from_account_id,to_account_id,amount,currency,transfer_date,note,now()]).map_err(|e|e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}
fn month_bounds() -> (i64, i64) {
    let d = chrono_like_now();
    (d - 31 * 86_400_000, d + 86_400_000)
}
fn chrono_like_now() -> i64 {
    now()
}
#[tauri::command]
pub fn get_dashboard(app: tauri::AppHandle) -> Result<Dashboard, String> {
    let c = connect(&app).map_err(|e| e.to_string())?;
    let accounts = get_accounts(app.clone())?;
    let (from, to) = month_bounds();
    let income:i64=c.query_row("SELECT COALESCE(SUM(amount),0) FROM transactions WHERE type='INCOME' AND transaction_date BETWEEN ?1 AND ?2",params![from,to],|r|r.get(0)).map_err(|e|e.to_string())?;
    let expense:i64=c.query_row("SELECT COALESCE(SUM(amount),0) FROM transactions WHERE type='EXPENSE' AND transaction_date BETWEEN ?1 AND ?2",params![from,to],|r|r.get(0)).map_err(|e|e.to_string())?;
    let txs = get_transactions(app, None, Some(to))?
        .into_iter()
        .take(8)
        .collect();
    Ok(Dashboard {
        total_balance: accounts.iter().map(|a| a.balance).sum(),
        monthly_income: income,
        monthly_expenses: expense,
        monthly_savings: income - expense,
        account_count: accounts.iter().filter(|a| a.is_active).count() as i64,
        transactions: txs,
        accounts,
    })
}
#[tauri::command]
pub fn get_simple_records(
    app: tauri::AppHandle,
    kind: String,
) -> Result<Vec<SimpleRecord>, String> {
    let c = connect(&app).map_err(|e| e.to_string())?;
    let table = match kind.as_str() {
        "planned" => "planned_expenses",
        "installments" => "installments",
        "budgets" => "budgets",
        _ => return Err("未知记录类型".into()),
    };
    let sql = if table == "budgets" {
        "SELECT b.id, c.name, b.amount, (b.year*100+b.month), 'ACTIVE' FROM budgets b JOIN categories c ON c.id=b.category_id ORDER BY b.year DESC,b.month DESC"
    } else if table == "planned_expenses" {
        "SELECT id,title,amount,planned_date,status FROM planned_expenses ORDER BY planned_date"
    } else {
        "SELECT id,title,installment_amount,first_payment_date,status FROM installments ORDER BY first_payment_date"
    };
    let mut s = c.prepare(sql).map_err(|e| e.to_string())?;
    let rows = s
        .query_map([], |r| {
            Ok(SimpleRecord {
                id: r.get(0)?,
                title: r.get(1)?,
                amount: r.get(2)?,
                date: r.get(3)?,
                status: r.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}
#[tauri::command]
pub fn get_setting(app: tauri::AppHandle, key: String) -> Result<Option<String>, String> {
    let c = connect(&app).map_err(|e| e.to_string())?;
    c.query_row("SELECT value FROM settings WHERE key=?1", [key], |r| {
        r.get(0)
    })
    .optional()
    .map_err(|e| e.to_string())
}
#[tauri::command]
pub fn set_setting(app: tauri::AppHandle, key: String, value: String) -> Result<(), String> {
    let c = connect(&app).map_err(|e| e.to_string())?;
    c.execute("INSERT INTO settings(key,value,updated_at) VALUES(?1,?2,?3) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at",params![key,value,now()]).map_err(|e|e.to_string()).map(|_|())
}
#[tauri::command]
pub fn search_all(app: tauri::AppHandle, query: String) -> Result<Vec<String>, String> {
    let c = connect(&app).map_err(|e| e.to_string())?;
    let q = format!("%{}%", query);
    let mut out = Vec::new();
    let mut s = c.prepare(
        "SELECT '账户 · '||name FROM accounts WHERE name LIKE ?1 \
         UNION ALL SELECT '交易 · '||merchant FROM transactions WHERE merchant LIKE ?1 OR note LIKE ?1 \
         UNION ALL SELECT '分类 · '||name FROM categories WHERE name LIKE ?1 \
         UNION ALL SELECT '项目 · '||title FROM journey_projects WHERE title LIKE ?1 OR summary LIKE ?1 \
         UNION ALL SELECT '灵感 · '||title FROM journey_ideas WHERE title LIKE ?1 OR tags LIKE ?1 \
         UNION ALL SELECT '目标 · '||title FROM journey_goals WHERE title LIKE ?1 \
         LIMIT 30"
    ).map_err(|e| e.to_string())?;
    let rows = s.query_map([q], |r| r.get(0)).map_err(|e| e.to_string())?;
    for r in rows {
        out.push(r.map_err(|e| e.to_string())?)
    }
    Ok(out)
}

fn frequency_days(frequency: &str) -> i64 {
    match frequency {
        "DAILY" => 1,
        "WEEKLY" => 7,
        "YEARLY" => 365,
        _ => 30,
    }
}
#[tauri::command]
pub fn save_recurring(
    app: tauri::AppHandle,
    input: RecurringInput,
    id_opt: Option<String>,
) -> Result<(), String> {
    validate_amount(input.amount)?;
    if input.title.trim().is_empty() {
        return Err("固定收支名称不能为空".into());
    }
    let c = connect(&app).map_err(|e| e.to_string())?;
    let idv = id_opt.unwrap_or_else(id);
    let t = now();
    c.execute("INSERT INTO recurring_transactions(id,type,account_id,category_id,amount,currency,title,frequency,start_date,end_date,next_run_date,is_active,note,created_at,updated_at) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?9,1,?11,?12,?12) ON CONFLICT(id) DO UPDATE SET type=excluded.type,account_id=excluded.account_id,category_id=excluded.category_id,amount=excluded.amount,currency=excluded.currency,title=excluded.title,frequency=excluded.frequency,start_date=excluded.start_date,end_date=excluded.end_date,note=excluded.note,updated_at=excluded.updated_at",params![idv,input.r#type,input.account_id,input.category_id,input.amount,input.currency,input.title.trim(),input.frequency,input.start_date,input.end_date,input.note.trim(),t]).map_err(|e|e.to_string())?;
    Ok(())
}
#[tauri::command]
pub fn get_recurring(app: tauri::AppHandle) -> Result<Vec<Recurring>, String> {
    let c = connect(&app).map_err(|e| e.to_string())?;
    let mut s=c.prepare("SELECT id,type,account_id,category_id,amount,currency,title,frequency,start_date,end_date,next_run_date,is_active,note FROM recurring_transactions ORDER BY next_run_date").map_err(|e|e.to_string())?;
    let rows = s
        .query_map([], |r| {
            Ok(Recurring {
                id: r.get(0)?,
                r#type: r.get(1)?,
                account_id: r.get(2)?,
                category_id: r.get(3)?,
                amount: r.get(4)?,
                currency: r.get(5)?,
                title: r.get(6)?,
                frequency: r.get(7)?,
                start_date: r.get(8)?,
                end_date: r.get(9)?,
                next_run_date: r.get(10)?,
                is_active: r.get::<_, i64>(11)? != 0,
                note: r.get(12)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}
#[tauri::command]
pub fn set_recurring_active(app: tauri::AppHandle, id: String, active: bool) -> Result<(), String> {
    let c = connect(&app).map_err(|e| e.to_string())?;
    c.execute(
        "UPDATE recurring_transactions SET is_active=?2,updated_at=?3 WHERE id=?1",
        params![id, active as i64, now()],
    )
    .map_err(|e| e.to_string())
    .map(|_| ())
}
#[tauri::command]
pub fn delete_recurring(app: tauri::AppHandle, id: String) -> Result<(), String> {
    let c = connect(&app).map_err(|e| e.to_string())?;
    c.execute("DELETE FROM recurring_transactions WHERE id=?1", [id])
        .map_err(|e| e.to_string())
        .map(|_| ())
}

#[tauri::command]
pub fn save_planned(
    app: tauri::AppHandle,
    input: PlannedInput,
    id_opt: Option<String>,
) -> Result<(), String> {
    validate_amount(input.amount)?;
    let c = connect(&app).map_err(|e| e.to_string())?;
    let idv = id_opt.unwrap_or_else(id);
    c.execute("INSERT INTO planned_expenses(id,title,amount,currency,planned_date,category_id,account_id,status,note,created_at,updated_at) VALUES(?1,?2,?3,?4,?5,?6,?7,'PLANNED',?8,?9,?9) ON CONFLICT(id) DO UPDATE SET title=excluded.title,amount=excluded.amount,currency=excluded.currency,planned_date=excluded.planned_date,category_id=excluded.category_id,account_id=excluded.account_id,note=excluded.note,updated_at=excluded.updated_at",params![idv,input.title,input.amount,input.currency,input.planned_date,input.category_id,input.account_id,input.note,now()]).map_err(|e|e.to_string())?;
    Ok(())
}
#[tauri::command]
pub fn get_planned(app: tauri::AppHandle) -> Result<Vec<Planned>, String> {
    let c = connect(&app).map_err(|e| e.to_string())?;
    let mut s=c.prepare("SELECT id,title,amount,currency,planned_date,category_id,account_id,status,note FROM planned_expenses ORDER BY planned_date").map_err(|e|e.to_string())?;
    let rows = s
        .query_map([], |r| {
            Ok(Planned {
                id: r.get(0)?,
                title: r.get(1)?,
                amount: r.get(2)?,
                currency: r.get(3)?,
                planned_date: r.get(4)?,
                category_id: r.get(5)?,
                account_id: r.get(6)?,
                status: r.get(7)?,
                note: r.get(8)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}
#[tauri::command]
pub fn complete_planned(app: tauri::AppHandle, planned_id: String) -> Result<(), String> {
    let c = connect(&app).map_err(|e| e.to_string())?;
    let tx = c.unchecked_transaction().map_err(|e| e.to_string())?;
    let p:Option<(i64,String,String,Option<String>,String)>=tx.query_row("SELECT amount,account_id,currency,category_id,title FROM planned_expenses WHERE id=?1 AND status='PLANNED'",[&planned_id],|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?,r.get(3)?,r.get(4)?))).optional().map_err(|e|e.to_string())?;
    if let Some((amount, account, currency, category, title)) = p {
        tx.execute("INSERT INTO transactions(id,type,account_id,category_id,amount,currency,merchant,transaction_date,note,created_at,updated_at) VALUES(?1,'EXPENSE',?2,?3,?4,?5,?6,?7,'计划支出',?7,?7)",params![id(),account,category,amount,currency,title,now()]).map_err(|e|e.to_string())?;
        tx.execute(
            "UPDATE planned_expenses SET status='COMPLETED',updated_at=?2 WHERE id=?1",
            params![planned_id, now()],
        )
        .map_err(|e| e.to_string())?;
    }
    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}
#[tauri::command]
pub fn delete_planned(app: tauri::AppHandle, id: String) -> Result<(), String> {
    let c = connect(&app).map_err(|e| e.to_string())?;
    c.execute(
        "DELETE FROM planned_expenses WHERE id=?1 AND status!='COMPLETED'",
        [id],
    )
    .map_err(|e| e.to_string())
    .map(|_| ())
}
#[tauri::command]
pub fn cancel_planned(app: tauri::AppHandle, id: String) -> Result<(), String> {
    let c = connect(&app).map_err(|e| e.to_string())?;
    c.execute("UPDATE planned_expenses SET status='CANCELLED',updated_at=?2 WHERE id=?1 AND status='PLANNED'",params![id,now()]).map_err(|e|e.to_string()).map(|_|())
}

#[tauri::command]
pub fn save_installment(
    app: tauri::AppHandle,
    input: InstallmentInput,
    id_opt: Option<String>,
) -> Result<(), String> {
    validate_amount(input.total_amount)?;
    if input.installment_count <= 0 {
        return Err("分期期数必须大于 0".into());
    }
    let c = connect(&app).map_err(|e| e.to_string())?;
    let idv = id_opt.clone().unwrap_or_else(id);
    if let Some(existing) = id_opt.as_ref() {
        let paid: i64 = c
            .query_row(
                "SELECT paid_count FROM installments WHERE id=?1",
                [existing],
                |r| r.get(0),
            )
            .unwrap_or(0);
        if paid > 0 {
            return Err("已有付款记录的分期不能修改总额或期数".into());
        }
    }
    let each = input.total_amount / input.installment_count;
    let t = now();
    c.execute("INSERT INTO installments(id,title,total_amount,installment_count,installment_amount,first_payment_date,paid_count,remaining_count,remaining_amount,account_id,status,note,created_at,updated_at) VALUES(?1,?2,?3,?4,?5,?6,0,?4,?3,?7,'ACTIVE',?8,?9,?9) ON CONFLICT(id) DO UPDATE SET title=excluded.title,total_amount=excluded.total_amount,installment_count=excluded.installment_count,installment_amount=excluded.installment_amount,first_payment_date=excluded.first_payment_date,account_id=excluded.account_id,note=excluded.note,updated_at=excluded.updated_at",params![idv,input.title,input.total_amount,input.installment_count,each,input.first_payment_date,input.account_id,input.note.trim(),t]).map_err(|e|e.to_string())?;
    Ok(())
}
#[tauri::command]
pub fn get_installments(app: tauri::AppHandle) -> Result<Vec<Installment>, String> {
    let c = connect(&app).map_err(|e| e.to_string())?;
    let mut s=c.prepare("SELECT id,title,total_amount,installment_count,installment_amount,first_payment_date,paid_count,remaining_count,remaining_amount,account_id,status,note FROM installments ORDER BY first_payment_date").map_err(|e|e.to_string())?;
    let rows = s
        .query_map([], |r| {
            Ok(Installment {
                id: r.get(0)?,
                title: r.get(1)?,
                total_amount: r.get(2)?,
                installment_count: r.get(3)?,
                installment_amount: r.get(4)?,
                first_payment_date: r.get(5)?,
                paid_count: r.get(6)?,
                remaining_count: r.get(7)?,
                remaining_amount: r.get(8)?,
                account_id: r.get(9)?,
                status: r.get(10)?,
                note: r.get(11)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}
#[tauri::command]
pub fn pay_installment(app: tauri::AppHandle, installment_id: String) -> Result<i64, String> {
    let c = connect(&app).map_err(|e| e.to_string())?;
    let tx = c.unchecked_transaction().map_err(|e| e.to_string())?;
    let row:Option<(i64,i64,i64,i64,String)>=tx.query_row("SELECT paid_count,installment_count,remaining_amount,first_payment_date,account_id FROM installments WHERE id=?1 AND status='ACTIVE'",[&installment_id],|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?,r.get(3)?,r.get(4)?))).optional().map_err(|e|e.to_string())?;
    let Some((paid, count, remaining, date, account)) = row else {
        return Err("分期不存在或已完成".into());
    };
    let amount = if paid + 1 == count {
        remaining
    } else {
        remaining / (count - paid)
    };
    let t = now();
    tx.execute("INSERT INTO transactions(id,type,account_id,amount,currency,merchant,transaction_date,note,created_at,updated_at) VALUES(?1,'EXPENSE',?2,?3,'CNY',?4,?5,'分期付款',?5,?5)",params![id(),account,amount,"分期",date.max(t)]).map_err(|e|e.to_string())?;
    tx.execute("UPDATE installments SET paid_count=paid_count+1,remaining_count=remaining_count-1,remaining_amount=remaining_amount-?2,status=CASE WHEN remaining_count<=1 THEN 'COMPLETED' ELSE status END,updated_at=?3 WHERE id=?1",params![installment_id,amount,t]).map_err(|e|e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;
    Ok(amount)
}
#[tauri::command]
pub fn delete_installment(app: tauri::AppHandle, id: String) -> Result<(), String> {
    let c = connect(&app).map_err(|e| e.to_string())?;
    c.execute(
        "DELETE FROM installments WHERE id=?1 AND paid_count=0",
        [id],
    )
    .map_err(|e| e.to_string())
    .map(|_| ())
}
#[tauri::command]
pub fn cancel_installment(app: tauri::AppHandle, id: String) -> Result<(), String> {
    let c = connect(&app).map_err(|e| e.to_string())?;
    c.execute(
        "UPDATE installments SET status='CANCELLED',updated_at=?2 WHERE id=?1 AND paid_count=0",
        params![id, now()],
    )
    .map_err(|e| e.to_string())
    .map(|_| ())
}

#[tauri::command]
pub fn save_budget(
    app: tauri::AppHandle,
    input: BudgetInput,
    id_opt: Option<String>,
) -> Result<(), String> {
    if input.amount < 0 || input.month < 1 || input.month > 12 {
        return Err("预算参数无效".into());
    }
    let c = connect(&app).map_err(|e| e.to_string())?;
    let idv = id_opt.unwrap_or_else(id);
    c.execute("INSERT INTO budgets(id,category_id,amount,currency,year,month,created_at,updated_at) VALUES(?1,?2,?3,?4,?5,?6,?7,?7) ON CONFLICT(category_id,year,month) DO UPDATE SET amount=excluded.amount,currency=excluded.currency,updated_at=excluded.updated_at",params![idv,input.category_id,input.amount,input.currency,input.year,input.month,now()]).map_err(|e|e.to_string())?;
    Ok(())
}
#[tauri::command]
pub fn get_budgets(app: tauri::AppHandle, year: i64, month: i64) -> Result<Vec<Budget>, String> {
    let c = connect(&app).map_err(|e| e.to_string())?;
    let mut s=c.prepare("SELECT b.id,b.category_id,c.name,b.amount,COALESCE((SELECT SUM(t.amount) FROM transactions t WHERE t.category_id=b.category_id AND t.type='EXPENSE' AND CAST(strftime('%Y',t.transaction_date/1000,'unixepoch','localtime') AS INTEGER)=b.year AND CAST(strftime('%m',t.transaction_date/1000,'unixepoch','localtime') AS INTEGER)=b.month),0),b.currency,b.year,b.month FROM budgets b JOIN categories c ON c.id=b.category_id WHERE b.year=?1 AND b.month=?2").map_err(|e|e.to_string())?;
    let rows = s
        .query_map(params![year, month], |r| {
            Ok(Budget {
                id: r.get(0)?,
                category_id: r.get(1)?,
                category_name: r.get(2)?,
                amount: r.get(3)?,
                spent: r.get(4)?,
                currency: r.get(5)?,
                year: r.get(6)?,
                month: r.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}
#[tauri::command]
pub fn delete_budget(app: tauri::AppHandle, id: String) -> Result<(), String> {
    let c = connect(&app).map_err(|e| e.to_string())?;
    c.execute("DELETE FROM budgets WHERE id=?1", [id])
        .map_err(|e| e.to_string())
        .map(|_| ())
}
fn forecast_rows(c: &rusqlite::Connection, days: i64) -> rusqlite::Result<Vec<ForecastPoint>> {
    let start = now();
    let end = start + days * 86_400_000;
    let mut total = 0;
    let mut ac = c.prepare("SELECT id FROM accounts WHERE is_active=1")?;
    for r in ac.query_map([], |r| r.get::<_, String>(0))? {
        total += account_balance(c, &r?)?;
    }
    let mut events: Vec<(i64, i64, i64)> = Vec::new();
    let mut s=c.prepare("SELECT transaction_date,type,amount FROM transactions WHERE transaction_date>?1 AND transaction_date<=?2")?;
    for r in s.query_map(params![start, end], |r| {
        Ok((
            r.get::<_, i64>(0)?,
            r.get::<_, String>(1)?,
            r.get::<_, i64>(2)?,
        ))
    })? {
        let (d, t, a) = r?;
        events.push((
            d,
            if t == "INCOME" { a } else { 0 },
            if t == "EXPENSE" { a } else { 0 },
        ));
    }
    let mut rs=c.prepare("SELECT type,amount,next_run_date,frequency,end_date FROM recurring_transactions WHERE is_active=1")?;
    for r in rs.query_map([], |r| {
        Ok((
            r.get::<_, String>(0)?,
            r.get::<_, i64>(1)?,
            r.get::<_, i64>(2)?,
            r.get::<_, String>(3)?,
            r.get::<_, Option<i64>>(4)?,
        ))
    })? {
        let (t, a, mut d, f, e) = r?;
        while d <= end {
            if e.map(|x| d > x).unwrap_or(false) {
                break;
            }
            events.push((
                d,
                if t == "INCOME" { a } else { 0 },
                if t == "EXPENSE" { a } else { 0 },
            ));
            d += frequency_days(&f) * 86_400_000;
        }
    }
    let mut ps=c.prepare("SELECT planned_date,amount FROM planned_expenses WHERE status='PLANNED' AND planned_date>?1 AND planned_date<=?2")?;
    for r in ps.query_map(params![start, end], |r| {
        Ok((r.get::<_, i64>(0)?, r.get::<_, i64>(1)?))
    })? {
        let (d, a) = r?;
        events.push((d, 0, a));
    }
    let mut is=c.prepare("SELECT first_payment_date,installment_amount,remaining_amount,remaining_count FROM installments WHERE status='ACTIVE'")?;
    for r in is.query_map([], |r| {
        Ok((
            r.get::<_, i64>(0)?,
            r.get::<_, i64>(1)?,
            r.get::<_, i64>(2)?,
            r.get::<_, i64>(3)?,
        ))
    })? {
        let (mut d, each, remaining, count) = r?;
        let mut left = remaining;
        for _ in 0..count {
            if d > end {
                break;
            }
            let a = left.min(each);
            events.push((d, 0, a));
            left -= a;
            d += 30 * 86_400_000;
        }
    }
    events.sort_by_key(|e| e.0);
    let mut out = Vec::new();
    let mut balance = total;
    for day in 0..=days {
        let d = start + day * 86_400_000;
        let mut inc = 0;
        let mut exp = 0;
        for e in events.iter().filter(|e| e.0 >= d && e.0 < d + 86_400_000) {
            inc += e.1;
            exp += e.2;
        }
        balance += inc - exp;
        out.push(ForecastPoint {
            date: d,
            balance,
            income: inc,
            expense: exp,
            label: format!("+{}d", day),
        });
    }
    Ok(out)
}
#[tauri::command]
pub fn get_forecast(app: tauri::AppHandle, days: i64) -> Result<Vec<ForecastPoint>, String> {
    let c = connect(&app).map_err(|e| e.to_string())?;
    forecast_rows(&c, days.clamp(1, 730)).map_err(|e| e.to_string())
}
#[tauri::command]
pub fn can_buy(
    app: tauri::AppHandle,
    amount: i64,
    purchase_date: i64,
) -> Result<PurchaseAnalysis, String> {
    validate_amount(amount)?;
    let c = connect(&app).map_err(|e| e.to_string())?;
    let current = get_accounts(app.clone())?
        .iter()
        .map(|a| a.balance)
        .sum::<i64>();
    let safety: i64 = c
        .query_row(
            "SELECT value FROM settings WHERE key='safety_balance'",
            [],
            |r| r.get::<_, String>(0),
        )
        .ok()
        .and_then(|x| x.parse().ok())
        .unwrap_or(0);
    let days = ((purchase_date - now()).max(0) / 86_400_000 + 30).clamp(1, 730);
    let min = forecast_rows(&c, days)
        .map_err(|e| e.to_string())?
        .iter()
        .map(|p| p.balance)
        .min()
        .unwrap_or(current)
        - amount;
    let after = current - amount;
    let (verdict, reason) = if min < safety {
        (
            "NOT_RECOMMENDED".to_string(),
            "购买后预测余额会低于安全余额".to_string(),
        )
    } else if after < safety * 2 {
        (
            "CAUTION".to_string(),
            "购买后仍可维持安全余额，但安全裕度较小".to_string(),
        )
    } else {
        ("OK".to_string(), "预计现金流能够覆盖这笔购买".to_string())
    };
    Ok(PurchaseAnalysis {
        verdict,
        current_balance: current,
        balance_after_purchase: after,
        minimum_future_balance: min,
        safety_balance: safety,
        reason,
    })
}
#[tauri::command]
pub fn backup_database(app: tauri::AppHandle, destination: String) -> Result<(), String> {
    let src = crate::database::path(&app).map_err(|e| e.to_string())?;
    crate::database_backup::backup(&src, std::path::Path::new(&destination))
}
#[tauri::command]
pub fn restore_database(
    app: tauri::AppHandle,
    source: String,
    security: tauri::State<SecurityState>,
) -> Result<(), String> {
    let current = crate::database::path(&app).map_err(|e| e.to_string())?;
    crate::database_backup::restore(&current, std::path::Path::new(&source))?;
    security.lock()?;
    Ok(())
}
#[tauri::command]
pub fn get_file_info(path: String) -> Result<FileInfo, String> {
    let p = std::path::Path::new(&path);
    let m = std::fs::metadata(p).map_err(|e| e.to_string())?;
    let modified = m
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0);
    Ok(FileInfo {
        name: p
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or_default()
            .to_string(),
        size: m.len(),
        modified,
    })
}
