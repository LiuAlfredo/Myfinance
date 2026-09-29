use crate::database::{connect, id, now};
use crate::security::SecurityState;
use chrono::{Datelike, Local, Months, TimeZone};
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
pub struct Transfer {
    pub id: String,
    pub from_account_id: String,
    pub from_account_name: String,
    pub to_account_id: String,
    pub to_account_name: String,
    pub amount: i64,
    pub currency: String,
    pub transfer_date: i64,
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
    pub balances_by_currency: Vec<CurrencyTotal>,
    pub balance_trend: Vec<BalancePoint>,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CurrencyTotal {
    pub currency: String,
    pub amount: i64,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BalancePoint {
    pub label: String,
    pub balance: i64,
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
    pub last_transaction_id: Option<String>,
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
    pub transaction_id: Option<String>,
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
    pub last_transaction_id: Option<String>,
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
fn account_balance_at(
    conn: &rusqlite::Connection,
    id: &str,
    at: Option<i64>,
) -> rusqlite::Result<i64> {
    let initial: i64 = conn.query_row(
        "SELECT initial_balance FROM accounts WHERE id=?1",
        [id],
        |r| r.get(0),
    )?;
    let in_sum: i64 = conn.query_row(
        "SELECT COALESCE(SUM(amount),0) FROM transactions WHERE account_id=?1 AND type='INCOME' AND (?2 IS NULL OR transaction_date<=?2)",
        params![id, at],
        |r| r.get(0),
    )?;
    let out_sum: i64 = conn.query_row(
        "SELECT COALESCE(SUM(amount),0) FROM transactions WHERE account_id=?1 AND type='EXPENSE' AND (?2 IS NULL OR transaction_date<=?2)",
        params![id, at],
        |r| r.get(0),
    )?;
    let adj:i64=conn.query_row("SELECT COALESCE(SUM(CASE WHEN type='ADJUSTMENT' THEN amount ELSE 0 END),0) FROM transactions WHERE account_id=?1 AND (?2 IS NULL OR transaction_date<=?2)",params![id,at],|r|r.get(0))?;
    let ti: i64 = conn.query_row(
        "SELECT COALESCE(SUM(amount),0) FROM transfers WHERE to_account_id=?1 AND (?2 IS NULL OR transfer_date<=?2)",
        params![id, at],
        |r| r.get(0),
    )?;
    let to: i64 = conn.query_row(
        "SELECT COALESCE(SUM(amount),0) FROM transfers WHERE from_account_id=?1 AND (?2 IS NULL OR transfer_date<=?2)",
        params![id, at],
        |r| r.get(0),
    )?;
    Ok(initial + in_sum - out_sum + adj + ti - to)
}
fn account_balance(conn: &rusqlite::Connection, id: &str) -> rusqlite::Result<i64> {
    account_balance_at(conn, id, Some(now()))
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
    if input.name.trim().is_empty() || input.name.chars().count() > 100 {
        return Err("账户名称不能为空".into());
    }
    if !["CNY", "USD", "JPY"].contains(&input.currency.as_str()) {
        return Err("不支持的账户币种".into());
    }
    let c = connect(&app).map_err(|e| e.to_string())?;
    if let Some(existing) = &id_opt {
        let changed_currency: bool = c.query_row(
            "SELECT currency<>?2 AND (EXISTS(SELECT 1 FROM transactions WHERE account_id=?1) OR EXISTS(SELECT 1 FROM transfers WHERE from_account_id=?1 OR to_account_id=?1) OR EXISTS(SELECT 1 FROM installments WHERE account_id=?1) OR EXISTS(SELECT 1 FROM subscriptions WHERE account_id=?1)) FROM accounts WHERE id=?1",
            params![existing, input.currency], |r| r.get(0)).map_err(|e| e.to_string())?;
        if changed_currency {
            return Err("已有流水或计划的账户不能修改币种".into());
        }
    }
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
    let used:i64=c.query_row("SELECT (SELECT COUNT(*) FROM transactions WHERE account_id=?1)+(SELECT COUNT(*) FROM transfers WHERE from_account_id=?1 OR to_account_id=?1)+(SELECT COUNT(*) FROM planned_expenses WHERE account_id=?1)+(SELECT COUNT(*) FROM installments WHERE account_id=?1)+(SELECT COUNT(*) FROM subscriptions WHERE account_id=?1)+(SELECT COUNT(*) FROM recurring_transactions WHERE account_id=?1)",[&id],|r|r.get(0)).map_err(|e|e.to_string())?;
    if used > 0 {
        return Err("已有交易或计划记录的账户不能删除，请停用账户以保留历史".into());
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
    if let Some(existing) = &id_opt {
        let sourced:bool=c.query_row("SELECT EXISTS(SELECT 1 FROM planned_expenses WHERE transaction_id=?1) OR EXISTS(SELECT 1 FROM installment_payments WHERE transaction_id=?1) OR EXISTS(SELECT 1 FROM recurring_payments WHERE transaction_id=?1) OR EXISTS(SELECT 1 FROM subscription_payments WHERE transaction_id=?1)",[existing],|r|r.get(0)).map_err(|e|e.to_string())?;
        if sourced {
            return Err("来源交易不能直接修改，请先在对应计划中撤销入账".into());
        }
    }
    let account_currency: Option<String> = c
        .query_row(
            "SELECT currency FROM accounts WHERE id=?1 AND is_active=1",
            [&input.account_id],
            |r| r.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?;
    let Some(account_currency) = account_currency else {
        return Err("请选择有效的启用账户".into());
    };
    if account_currency != input.currency {
        return Err("交易币种必须与账户币种一致".into());
    }
    if let Some(category) = &input.category_id {
        let valid: bool = c
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM categories WHERE id=?1 AND type=?2 AND is_active=1)",
                params![category, input.r#type],
                |r| r.get(0),
            )
            .map_err(|e| e.to_string())?;
        if !valid {
            return Err("分类不存在、已停用或与交易类型不一致".into());
        }
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
pub fn get_transactions_page(
    app: tauri::AppHandle,
    offset: i64,
    limit: i64,
) -> Result<Vec<Transaction>, String> {
    if offset < 0 || !(1..=200).contains(&limit) {
        return Err("分页参数无效".into());
    }
    let c = connect(&app).map_err(|e| e.to_string())?;
    let mut s=c.prepare("SELECT t.id,t.type,t.account_id,a.name,t.category_id,c.name,t.amount,t.currency,t.merchant,t.transaction_date,t.note FROM transactions t JOIN accounts a ON a.id=t.account_id LEFT JOIN categories c ON c.id=t.category_id ORDER BY t.transaction_date DESC,t.created_at DESC LIMIT ?1 OFFSET ?2").map_err(|e|e.to_string())?;
    let rows = s
        .query_map(params![limit, offset], |r| {
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
    let source: bool = c.query_row("SELECT EXISTS(SELECT 1 FROM planned_expenses WHERE transaction_id=?1) OR EXISTS(SELECT 1 FROM installment_payments WHERE transaction_id=?1) OR EXISTS(SELECT 1 FROM recurring_payments WHERE transaction_id=?1) OR EXISTS(SELECT 1 FROM subscription_payments WHERE transaction_id=?1)",[&id],|r|r.get(0)).map_err(|e|e.to_string())?;
    if source {
        return Err("此交易由计划、分期、固定收支或订阅生成，请在来源记录中撤销".into());
    }
    let changed = c
        .execute("DELETE FROM transactions WHERE id=?1", [id])
        .map_err(|e| e.to_string())?;
    if changed == 0 {
        return Err("交易不存在".into());
    }
    Ok(())
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
    let currencies: Vec<String> = {
        let mut statement = tx
            .prepare(
                "SELECT currency FROM accounts WHERE id IN (?1,?2) AND is_active=1 ORDER BY id",
            )
            .map_err(|e| e.to_string())?;
        let rows = statement
            .query_map(params![from_account_id, to_account_id], |r| r.get(0))
            .map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?
    };
    if currencies.len() != 2 {
        return Err("请选择两个有效账户".into());
    }
    if currencies[0] != currencies[1] || currencies[0] != currency {
        return Err("暂不支持无汇率的跨币种转账".into());
    }
    tx.execute("INSERT INTO transfers(id,from_account_id,to_account_id,amount,currency,transfer_date,note,created_at,updated_at) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?8)",params![id(),from_account_id,to_account_id,amount,currency,transfer_date,note,now()]).map_err(|e|e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}
#[tauri::command]
pub fn get_transfers(app: tauri::AppHandle) -> Result<Vec<Transfer>, String> {
    let c = connect(&app).map_err(|e| e.to_string())?;
    let mut statement=c.prepare("SELECT t.id,t.from_account_id,f.name,t.to_account_id,d.name,t.amount,t.currency,t.transfer_date,t.note FROM transfers t JOIN accounts f ON f.id=t.from_account_id JOIN accounts d ON d.id=t.to_account_id ORDER BY t.transfer_date DESC,t.created_at DESC").map_err(|e|e.to_string())?;
    let rows = statement
        .query_map([], |r| {
            Ok(Transfer {
                id: r.get(0)?,
                from_account_id: r.get(1)?,
                from_account_name: r.get(2)?,
                to_account_id: r.get(3)?,
                to_account_name: r.get(4)?,
                amount: r.get(5)?,
                currency: r.get(6)?,
                transfer_date: r.get(7)?,
                note: r.get(8)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}
#[tauri::command]
pub fn delete_transfer(app: tauri::AppHandle, id: String) -> Result<(), String> {
    let c = connect(&app).map_err(|e| e.to_string())?;
    if c.execute("DELETE FROM transfers WHERE id=?1", [id])
        .map_err(|e| e.to_string())?
        == 0
    {
        return Err("转账记录不存在".into());
    }
    Ok(())
}
fn month_bounds() -> (i64, i64) {
    let local = Local::now();
    let start = Local
        .with_ymd_and_hms(local.year(), local.month(), 1, 0, 0, 0)
        .single()
        .unwrap();
    let next = start.checked_add_months(Months::new(1)).unwrap();
    (start.timestamp_millis(), next.timestamp_millis() - 1)
}
#[tauri::command]
pub fn get_dashboard(app: tauri::AppHandle) -> Result<Dashboard, String> {
    let c = connect(&app).map_err(|e| e.to_string())?;
    let accounts = get_accounts(app.clone())?;
    let (from, to) = month_bounds();
    let through = to.min(now());
    let income:i64=c.query_row("SELECT COALESCE(SUM(amount),0) FROM transactions WHERE type='INCOME' AND currency='CNY' AND transaction_date BETWEEN ?1 AND ?2",params![from,through],|r|r.get(0)).map_err(|e|e.to_string())?;
    let expense:i64=c.query_row("SELECT COALESCE(SUM(amount),0) FROM transactions WHERE type='EXPENSE' AND currency='CNY' AND transaction_date BETWEEN ?1 AND ?2",params![from,through],|r|r.get(0)).map_err(|e|e.to_string())?;
    let txs = get_transactions(app, None, Some(now()))?
        .into_iter()
        .take(8)
        .collect();
    let mut values = std::collections::BTreeMap::<String, i64>::new();
    for account in accounts.iter().filter(|a| a.is_active) {
        *values.entry(account.currency.clone()).or_default() += account.balance;
    }
    let balances_by_currency = values
        .into_iter()
        .map(|(currency, amount)| CurrencyTotal { currency, amount })
        .collect();
    let today = Local::now().date_naive();
    let mut balance_trend = Vec::new();
    for offset in (0..7).rev() {
        let day = today - chrono::Duration::days(offset);
        let end = Local
            .with_ymd_and_hms(day.year(), day.month(), day.day(), 23, 59, 59)
            .single()
            .unwrap()
            .timestamp_millis();
        let mut balance = 0;
        for account in accounts
            .iter()
            .filter(|a| a.is_active && a.currency == "CNY")
        {
            balance += account_balance_at(&c, &account.id, Some(end)).map_err(|e| e.to_string())?;
        }
        balance_trend.push(BalancePoint {
            label: format!("{}/{}", day.month(), day.day()),
            balance,
        });
    }
    Ok(Dashboard {
        total_balance: accounts
            .iter()
            .filter(|a| a.is_active && a.currency == "CNY")
            .map(|a| a.balance)
            .sum(),
        monthly_income: income,
        monthly_expenses: expense,
        monthly_savings: income - expense,
        account_count: accounts.iter().filter(|a| a.is_active).count() as i64,
        transactions: txs,
        balances_by_currency,
        balance_trend,
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

fn advance_period(timestamp: i64, frequency: &str) -> i64 {
    let Some(value) = Local.timestamp_millis_opt(timestamp).single() else {
        return timestamp;
    };
    match frequency {
        "DAILY" => timestamp + 86_400_000,
        "WEEKLY" => timestamp + 7 * 86_400_000,
        "MONTHLY" => value
            .checked_add_months(Months::new(1))
            .map(|v| v.timestamp_millis())
            .unwrap_or(timestamp),
        "YEARLY" => value
            .checked_add_months(Months::new(12))
            .map(|v| v.timestamp_millis())
            .unwrap_or(timestamp),
        _ => timestamp,
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
    if !["INCOME", "EXPENSE"].contains(&input.r#type.as_str())
        || !["DAILY", "WEEKLY", "MONTHLY", "YEARLY"].contains(&input.frequency.as_str())
    {
        return Err("固定收支类型或周期无效".into());
    }
    if input.end_date.is_some_and(|end| end < input.start_date) {
        return Err("结束日期不能早于开始日期".into());
    }
    let c = connect(&app).map_err(|e| e.to_string())?;
    let valid: bool = c
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM accounts WHERE id=?1 AND currency=?2 AND is_active=1)",
            params![input.account_id, input.currency],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    if !valid {
        return Err("账户不存在、已停用或币种不一致".into());
    }
    let idv = id_opt.unwrap_or_else(id);
    let t = now();
    c.execute("INSERT INTO recurring_transactions(id,type,account_id,category_id,amount,currency,title,frequency,start_date,end_date,next_run_date,is_active,note,created_at,updated_at) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?9,1,?11,?12,?12) ON CONFLICT(id) DO UPDATE SET type=excluded.type,account_id=excluded.account_id,category_id=excluded.category_id,amount=excluded.amount,currency=excluded.currency,title=excluded.title,frequency=excluded.frequency,start_date=excluded.start_date,end_date=excluded.end_date,next_run_date=excluded.start_date,note=excluded.note,updated_at=excluded.updated_at",params![idv,input.r#type,input.account_id,input.category_id,input.amount,input.currency,input.title.trim(),input.frequency,input.start_date,input.end_date,input.note.trim(),t]).map_err(|e|e.to_string())?;
    Ok(())
}
#[tauri::command]
pub fn get_recurring(app: tauri::AppHandle) -> Result<Vec<Recurring>, String> {
    let c = connect(&app).map_err(|e| e.to_string())?;
    let mut s=c.prepare("SELECT r.id,r.type,r.account_id,r.category_id,r.amount,r.currency,r.title,r.frequency,r.start_date,r.end_date,r.next_run_date,r.is_active,r.note,(SELECT transaction_id FROM recurring_payments p WHERE p.recurring_id=r.id ORDER BY p.paid_at DESC LIMIT 1) FROM recurring_transactions r ORDER BY r.next_run_date").map_err(|e|e.to_string())?;
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
                last_transaction_id: r.get(13)?,
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
    let paid: bool = c
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM recurring_payments WHERE recurring_id=?1)",
            [&id],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    if paid {
        return Err("已有入账记录的固定收支不能删除，请停用以保留历史".into());
    }
    let changed = c
        .execute("DELETE FROM recurring_transactions WHERE id=?1", [id])
        .map_err(|e| e.to_string())?;
    if changed == 0 {
        return Err("固定收支不存在".into());
    }
    Ok(())
}
#[tauri::command]
pub fn post_recurring(app: tauri::AppHandle, recurring_id: String) -> Result<String, String> {
    let c = connect(&app).map_err(|e| e.to_string())?;
    let tx = c.unchecked_transaction().map_err(|e| e.to_string())?;
    let row:Option<(String,String,i64,String,String,Option<String>,i64,String,Option<i64>)>=tx.query_row("SELECT r.type,r.account_id,r.amount,r.currency,r.title,r.category_id,r.next_run_date,r.frequency,r.end_date FROM recurring_transactions r JOIN accounts a ON a.id=r.account_id AND a.is_active=1 AND a.currency=r.currency WHERE r.id=?1 AND r.is_active=1",[&recurring_id],|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?,r.get(3)?,r.get(4)?,r.get(5)?,r.get(6)?,r.get(7)?,r.get(8)?))).optional().map_err(|e|e.to_string())?;
    let Some((kind, account, amount, currency, title, category, scheduled, frequency, end)) = row
    else {
        return Err("固定收支不存在、已停用或账户不可用".into());
    };
    if end.is_some_and(|value| scheduled > value) {
        return Err("固定收支已超过结束日期".into());
    }
    if let Some(existing)=tx.query_row("SELECT transaction_id FROM recurring_payments WHERE recurring_id=?1 AND scheduled_at=?2",params![recurring_id,scheduled],|r|r.get::<_,String>(0)).optional().map_err(|e|e.to_string())?{return Ok(existing)}
    let transaction = id();
    let stamp = now();
    tx.execute("INSERT INTO transactions(id,type,account_id,category_id,amount,currency,merchant,transaction_date,note,created_at,updated_at)VALUES(?1,?2,?3,?4,?5,?6,?7,?8,'固定收支',?9,?9)",params![transaction,kind,account,category,amount,currency,title,scheduled,stamp]).map_err(|e|e.to_string())?;
    tx.execute(
        "INSERT INTO recurring_payments VALUES(?1,?2,?3,?4,?5,?6)",
        params![id(), recurring_id, scheduled, transaction, amount, stamp],
    )
    .map_err(|e| e.to_string())?;
    tx.execute(
        "UPDATE recurring_transactions SET next_run_date=?2,updated_at=?3 WHERE id=?1",
        params![recurring_id, advance_period(scheduled, &frequency), stamp],
    )
    .map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;
    Ok(transaction)
}
#[tauri::command]
pub fn undo_recurring_payment(app: tauri::AppHandle, recurring_id: String) -> Result<(), String> {
    let c = connect(&app).map_err(|e| e.to_string())?;
    let tx = c.unchecked_transaction().map_err(|e| e.to_string())?;
    let row:Option<(String,i64)>=tx.query_row("SELECT transaction_id,scheduled_at FROM recurring_payments WHERE recurring_id=?1 ORDER BY scheduled_at DESC LIMIT 1",[&recurring_id],|r|Ok((r.get(0)?,r.get(1)?))).optional().map_err(|e|e.to_string())?;
    let Some((transaction, scheduled)) = row else {
        return Err("没有可撤销的固定收支入账".into());
    };
    tx.execute(
        "DELETE FROM recurring_payments WHERE recurring_id=?1 AND scheduled_at=?2",
        params![recurring_id, scheduled],
    )
    .map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM transactions WHERE id=?1", [transaction])
        .map_err(|e| e.to_string())?;
    tx.execute(
        "UPDATE recurring_transactions SET next_run_date=?2,updated_at=?3 WHERE id=?1",
        params![recurring_id, scheduled, now()],
    )
    .map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_planned(
    app: tauri::AppHandle,
    input: PlannedInput,
    id_opt: Option<String>,
) -> Result<(), String> {
    validate_amount(input.amount)?;
    if input.title.trim().is_empty() || input.title.chars().count() > 200 {
        return Err("计划标题不能为空或过长".into());
    }
    let c = connect(&app).map_err(|e| e.to_string())?;
    let valid: bool = c
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM accounts WHERE id=?1 AND currency=?2 AND is_active=1)",
            params![input.account_id, input.currency],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    if !valid {
        return Err("账户不存在、已停用或币种不一致".into());
    }
    if let Some(category) = &input.category_id {
        let valid:bool=c.query_row("SELECT EXISTS(SELECT 1 FROM categories WHERE id=?1 AND type='EXPENSE' AND is_active=1)",[category],|r|r.get(0)).map_err(|e|e.to_string())?;
        if !valid {
            return Err("支出分类无效".into());
        }
    }
    let idv = id_opt.unwrap_or_else(id);
    c.execute("INSERT INTO planned_expenses(id,title,amount,currency,planned_date,category_id,account_id,status,note,created_at,updated_at) VALUES(?1,?2,?3,?4,?5,?6,?7,'PLANNED',?8,?9,?9) ON CONFLICT(id) DO UPDATE SET title=excluded.title,amount=excluded.amount,currency=excluded.currency,planned_date=excluded.planned_date,category_id=excluded.category_id,account_id=excluded.account_id,note=excluded.note,updated_at=excluded.updated_at",params![idv,input.title,input.amount,input.currency,input.planned_date,input.category_id,input.account_id,input.note,now()]).map_err(|e|e.to_string())?;
    Ok(())
}
#[tauri::command]
pub fn get_planned(app: tauri::AppHandle) -> Result<Vec<Planned>, String> {
    let c = connect(&app).map_err(|e| e.to_string())?;
    let mut s=c.prepare("SELECT id,title,amount,currency,planned_date,category_id,account_id,status,note,transaction_id FROM planned_expenses ORDER BY planned_date").map_err(|e|e.to_string())?;
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
                transaction_id: r.get(9)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}
#[tauri::command]
pub fn complete_planned(app: tauri::AppHandle, planned_id: String) -> Result<String, String> {
    let c = connect(&app).map_err(|e| e.to_string())?;
    let tx = c.unchecked_transaction().map_err(|e| e.to_string())?;
    if let Some(existing) = tx
        .query_row(
            "SELECT transaction_id FROM planned_expenses WHERE id=?1 AND status='COMPLETED'",
            [&planned_id],
            |r| r.get::<_, Option<String>>(0),
        )
        .optional()
        .map_err(|e| e.to_string())?
        .flatten()
    {
        return Ok(existing);
    }
    let p:Option<(i64,String,String,Option<String>,String)>=tx.query_row("SELECT p.amount,p.account_id,p.currency,p.category_id,p.title FROM planned_expenses p JOIN accounts a ON a.id=p.account_id AND a.is_active=1 AND a.currency=p.currency WHERE p.id=?1 AND p.status='PLANNED'",[&planned_id],|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?,r.get(3)?,r.get(4)?))).optional().map_err(|e|e.to_string())?;
    let Some((amount, account, currency, category, title)) = p else {
        return Err("计划不存在、已处理或账户不可用".into());
    };
    let transaction_id = id();
    let stamp = now();
    tx.execute("INSERT INTO transactions(id,type,account_id,category_id,amount,currency,merchant,transaction_date,note,created_at,updated_at) VALUES(?1,'EXPENSE',?2,?3,?4,?5,?6,?7,'计划支出',?7,?7)",params![transaction_id,account,category,amount,currency,title,stamp]).map_err(|e|e.to_string())?;
    tx.execute("UPDATE planned_expenses SET status='COMPLETED',transaction_id=?2,updated_at=?3 WHERE id=?1",params![planned_id,transaction_id,stamp]).map_err(|e|e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;
    Ok(transaction_id)
}
#[tauri::command]
pub fn undo_planned(app: tauri::AppHandle, id: String) -> Result<(), String> {
    let c = connect(&app).map_err(|e| e.to_string())?;
    let tx = c.unchecked_transaction().map_err(|e| e.to_string())?;
    let transaction: Option<String> = tx
        .query_row(
            "SELECT transaction_id FROM planned_expenses WHERE id=?1 AND status='COMPLETED'",
            [&id],
            |r| r.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?;
    let Some(transaction) = transaction else {
        return Err("计划尚未入账".into());
    };
    tx.execute("UPDATE planned_expenses SET status='PLANNED',transaction_id=NULL,updated_at=?2 WHERE id=?1",params![id,now()]).map_err(|e|e.to_string())?;
    tx.execute("DELETE FROM transactions WHERE id=?1", [transaction])
        .map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())
}
#[tauri::command]
pub fn delete_planned(app: tauri::AppHandle, id: String) -> Result<(), String> {
    let c = connect(&app).map_err(|e| e.to_string())?;
    let changed = c
        .execute(
            "DELETE FROM planned_expenses WHERE id=?1 AND status!='COMPLETED'",
            [id],
        )
        .map_err(|e| e.to_string())?;
    if changed == 0 {
        return Err("已入账的计划不能删除，请先撤销入账".into());
    }
    Ok(())
}
#[tauri::command]
pub fn cancel_planned(app: tauri::AppHandle, id: String) -> Result<(), String> {
    let c = connect(&app).map_err(|e| e.to_string())?;
    let changed=c.execute("UPDATE planned_expenses SET status='CANCELLED',updated_at=?2 WHERE id=?1 AND status='PLANNED'",params![id,now()]).map_err(|e|e.to_string())?;
    if changed == 0 {
        return Err("计划不存在或已经处理".into());
    }
    Ok(())
}

#[tauri::command]
pub fn save_installment(
    app: tauri::AppHandle,
    input: InstallmentInput,
    id_opt: Option<String>,
) -> Result<(), String> {
    let c = connect(&app).map_err(|e| e.to_string())?;
    save_installment_row(&c, input, id_opt)
}
fn save_installment_row(
    c: &rusqlite::Connection,
    input: InstallmentInput,
    id_opt: Option<String>,
) -> Result<(), String> {
    validate_amount(input.total_amount)?;
    if input.title.trim().is_empty() || input.title.chars().count() > 200 {
        return Err("分期名称不能为空或过长".into());
    }
    if input.installment_count <= 0 {
        return Err("分期期数必须大于 0".into());
    }
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
    let account_currency: Option<String> = c
        .query_row(
            "SELECT currency FROM accounts WHERE id=?1 AND is_active=1",
            [&input.account_id],
            |r| r.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?;
    if account_currency.is_none() {
        return Err("请选择有效的启用账户".into());
    }
    c.execute("INSERT INTO installments(id,title,total_amount,installment_count,installment_amount,first_payment_date,paid_count,remaining_count,remaining_amount,account_id,status,note,created_at,updated_at) VALUES(?1,?2,?3,?4,?5,?6,0,?4,?3,?7,'ACTIVE',?8,?9,?9) ON CONFLICT(id) DO UPDATE SET title=excluded.title,total_amount=excluded.total_amount,installment_count=excluded.installment_count,installment_amount=excluded.installment_amount,first_payment_date=excluded.first_payment_date,remaining_count=excluded.installment_count,remaining_amount=excluded.total_amount,account_id=excluded.account_id,note=excluded.note,updated_at=excluded.updated_at",params![idv,input.title.trim(),input.total_amount,input.installment_count,each,input.first_payment_date,input.account_id,input.note.trim(),t]).map_err(|e|e.to_string())?;
    Ok(())
}
#[tauri::command]
pub fn get_installments(app: tauri::AppHandle) -> Result<Vec<Installment>, String> {
    let c = connect(&app).map_err(|e| e.to_string())?;
    let mut s=c.prepare("SELECT i.id,i.title,i.total_amount,i.installment_count,i.installment_amount,i.first_payment_date,i.paid_count,i.remaining_count,i.remaining_amount,i.account_id,i.status,i.note,(SELECT transaction_id FROM installment_payments p WHERE p.installment_id=i.id ORDER BY period_no DESC LIMIT 1) FROM installments i ORDER BY i.first_payment_date").map_err(|e|e.to_string())?;
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
                last_transaction_id: r.get(12)?,
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
    let row:Option<(i64,i64,i64,i64,String,String)>=tx.query_row("SELECT i.paid_count,i.installment_count,i.remaining_amount,i.first_payment_date,i.account_id,a.currency FROM installments i JOIN accounts a ON a.id=i.account_id WHERE i.id=?1 AND i.status='ACTIVE' AND a.is_active=1",[&installment_id],|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?,r.get(3)?,r.get(4)?,r.get(5)?))).optional().map_err(|e|e.to_string())?;
    let Some((paid, count, remaining, date, account, currency)) = row else {
        return Err("分期不存在或已完成".into());
    };
    let amount = if paid + 1 == count {
        remaining
    } else {
        remaining / (count - paid)
    };
    let t = now();
    let transaction_id = id();
    tx.execute("INSERT INTO transactions(id,type,account_id,amount,currency,merchant,transaction_date,note,created_at,updated_at) VALUES(?1,'EXPENSE',?2,?3,?4,?5,?6,'分期付款',?7,?7)",params![transaction_id,account,amount,currency,"分期",date.max(t),t]).map_err(|e|e.to_string())?;
    tx.execute(
        "INSERT INTO installment_payments VALUES(?1,?2,?3,?4,?5,?6)",
        params![id(), installment_id, paid + 1, transaction_id, amount, t],
    )
    .map_err(|_| "本期已经入账")?;
    tx.execute("UPDATE installments SET paid_count=paid_count+1,remaining_count=remaining_count-1,remaining_amount=remaining_amount-?2,status=CASE WHEN remaining_count<=1 THEN 'COMPLETED' ELSE status END,updated_at=?3 WHERE id=?1",params![installment_id,amount,t]).map_err(|e|e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;
    Ok(amount)
}
#[tauri::command]
pub fn undo_installment_payment(
    app: tauri::AppHandle,
    installment_id: String,
) -> Result<(), String> {
    let c = connect(&app).map_err(|e| e.to_string())?;
    let tx = c.unchecked_transaction().map_err(|e| e.to_string())?;
    let payment:Option<(String,i64,i64)>=tx.query_row("SELECT transaction_id,period_no,amount FROM installment_payments WHERE installment_id=?1 ORDER BY period_no DESC LIMIT 1",[&installment_id],|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?))).optional().map_err(|e|e.to_string())?;
    let Some((transaction, period, amount)) = payment else {
        return Err("没有可撤销的分期付款".into());
    };
    let paid: i64 = tx
        .query_row(
            "SELECT paid_count FROM installments WHERE id=?1",
            [&installment_id],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    if period != paid {
        return Err("只能撤销最后一期付款".into());
    }
    tx.execute(
        "DELETE FROM installment_payments WHERE installment_id=?1 AND period_no=?2",
        params![installment_id, period],
    )
    .map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM transactions WHERE id=?1", [transaction])
        .map_err(|e| e.to_string())?;
    tx.execute("UPDATE installments SET paid_count=paid_count-1,remaining_count=remaining_count+1,remaining_amount=remaining_amount+?2,status='ACTIVE',updated_at=?3 WHERE id=?1",params![installment_id,amount,now()]).map_err(|e|e.to_string())?;
    tx.commit().map_err(|e| e.to_string())
}
#[tauri::command]
pub fn delete_installment(app: tauri::AppHandle, id: String) -> Result<(), String> {
    let c = connect(&app).map_err(|e| e.to_string())?;
    let changed = c
        .execute(
            "DELETE FROM installments WHERE id=?1 AND paid_count=0",
            [id],
        )
        .map_err(|e| e.to_string())?;
    if changed == 0 {
        return Err("已有付款记录的分期不能删除，可改为取消".into());
    }
    Ok(())
}
#[tauri::command]
pub fn cancel_installment(app: tauri::AppHandle, id: String) -> Result<(), String> {
    let c = connect(&app).map_err(|e| e.to_string())?;
    let changed=c.execute(
        "UPDATE installments SET status='CANCELLED',updated_at=?2 WHERE id=?1 AND status='ACTIVE'",
        params![id, now()],
    )
    .map_err(|e| e.to_string())?;
    if changed == 0 {
        return Err("分期不存在或已结束".into());
    }
    Ok(())
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
    if input.currency != "CNY" {
        return Err("当前预算仅支持人民币；外币预算需先配置汇率".into());
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
    let mut ac = c.prepare("SELECT id FROM accounts WHERE is_active=1 AND currency='CNY'")?;
    for r in ac.query_map([], |r| r.get::<_, String>(0))? {
        total += account_balance_at(c, &r?, Some(start))?;
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
    let mut rs=c.prepare("SELECT type,amount,next_run_date,frequency,end_date FROM recurring_transactions WHERE is_active=1 AND currency='CNY'")?;
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
        while d <= start {
            d = advance_period(d, &f);
        }
        while d <= end {
            if e.map(|x| d > x).unwrap_or(false) {
                break;
            }
            events.push((
                d,
                if t == "INCOME" { a } else { 0 },
                if t == "EXPENSE" { a } else { 0 },
            ));
            let next = advance_period(d, &f);
            if next <= d {
                break;
            }
            d = next;
        }
    }
    let mut subscriptions=c.prepare("SELECT amount,next_day,frequency FROM subscriptions WHERE status='ACTIVE' AND currency='CNY'")?;
    for row in subscriptions.query_map([], |r| {
        Ok((
            r.get::<_, i64>(0)?,
            r.get::<_, String>(1)?,
            r.get::<_, String>(2)?,
        ))
    })? {
        let (amount, day, frequency) = row?;
        let Ok(date) = chrono::NaiveDate::parse_from_str(&day, "%Y-%m-%d") else {
            continue;
        };
        let Some(local) = Local
            .with_ymd_and_hms(date.year(), date.month(), date.day(), 12, 0, 0)
            .single()
        else {
            continue;
        };
        let mut d = local.timestamp_millis();
        while d <= start {
            d = advance_period(d, &frequency);
        }
        while d <= end {
            events.push((d, 0, amount));
            let next = advance_period(d, &frequency);
            if next <= d {
                break;
            }
            d = next;
        }
    }
    let mut ps=c.prepare("SELECT planned_date,amount FROM planned_expenses WHERE status='PLANNED' AND currency='CNY' AND planned_date>?1 AND planned_date<=?2")?;
    for r in ps.query_map(params![start, end], |r| {
        Ok((r.get::<_, i64>(0)?, r.get::<_, i64>(1)?))
    })? {
        let (d, a) = r?;
        events.push((d, 0, a));
    }
    let mut is=c.prepare("SELECT i.first_payment_date,i.installment_amount,i.remaining_amount,i.remaining_count,i.paid_count FROM installments i JOIN accounts a ON a.id=i.account_id WHERE i.status='ACTIVE' AND a.currency='CNY'")?;
    for r in is.query_map([], |r| {
        Ok((
            r.get::<_, i64>(0)?,
            r.get::<_, i64>(1)?,
            r.get::<_, i64>(2)?,
            r.get::<_, i64>(3)?,
            r.get::<_, i64>(4)?,
        ))
    })? {
        let (mut d, each, remaining, count, paid) = r?;
        for _ in 0..paid {
            d = advance_period(d, "MONTHLY");
        }
        let mut left = remaining;
        for _ in 0..count {
            while d <= start {
                d = advance_period(d, "MONTHLY");
            }
            if d > end {
                break;
            }
            let a = left.min(each);
            events.push((d, 0, a));
            left -= a;
            d = advance_period(d, "MONTHLY");
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
        .filter(|a| a.is_active && a.currency == "CNY")
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

#[cfg(test)]
mod finance_regression_tests {
    use super::*;
    use rusqlite::Connection;

    fn connection() -> Connection {
        let value = Connection::open_in_memory().unwrap();
        value.pragma_update(None, "foreign_keys", "ON").unwrap();
        crate::database::migrate(&value).unwrap();
        value.execute("INSERT INTO accounts(id,name,type,currency,initial_balance,created_at,updated_at)VALUES('a','账户','BANK','CNY',100000,0,0)",[]).unwrap();
        value
    }

    #[test]
    fn future_transaction_is_applied_once_in_forecast() {
        let c = connection();
        let start = now();
        c.execute("INSERT INTO transactions(id,type,account_id,amount,currency,transaction_date,created_at,updated_at)VALUES('future','EXPENSE','a',10000,'CNY',?1,0,0)",[start+2*86_400_000]).unwrap();
        assert_eq!(account_balance_at(&c, "a", Some(start)).unwrap(), 100000);
        let rows = forecast_rows(&c, 3).unwrap();
        assert_eq!(rows.first().unwrap().balance, 100000);
        assert_eq!(rows.last().unwrap().balance, 90000);
    }

    #[test]
    fn editing_unpaid_installment_recalculates_remaining_values() {
        let c = connection();
        let input = |total, count| InstallmentInput {
            title: "分期".into(),
            total_amount: total,
            installment_count: count,
            first_payment_date: now(),
            account_id: "a".into(),
            note: String::new(),
        };
        save_installment_row(&c, input(120000, 12), Some("i".into())).unwrap();
        save_installment_row(&c, input(60000, 6), Some("i".into())).unwrap();
        let row:(i64,i64,i64,i64)=c.query_row("SELECT total_amount,installment_count,remaining_amount,remaining_count FROM installments WHERE id='i'",[],|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?,r.get(3)?))).unwrap();
        assert_eq!(row, (60000, 6, 60000, 6));
    }

    #[test]
    fn monthly_period_uses_calendar_months() {
        let value = Local
            .with_ymd_and_hms(2024, 1, 31, 12, 0, 0)
            .single()
            .unwrap()
            .timestamp_millis();
        let next = Local
            .timestamp_millis_opt(advance_period(value, "MONTHLY"))
            .single()
            .unwrap();
        assert_eq!((next.year(), next.month(), next.day()), (2024, 2, 29));
    }
}
