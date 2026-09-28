use super::{
    routines::{date, next_cycle},
    shared::required,
};
use crate::database::{connect, id, now};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubscriptionInput {
    title: String,
    amount: i64,
    currency: String,
    account_id: String,
    frequency: String,
    anchor_day: String,
    next_day: String,
    reminder_days: i64,
    status: String,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Subscription {
    id: String,
    #[serde(flatten)]
    input: SubscriptionInput,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Payment {
    id: String,
    subscription_id: String,
    period_day: String,
    transaction_id: String,
    amount: i64,
    paid_at: i64,
    currency: String,
    title: String,
}
#[tauri::command]
pub fn list_subscriptions(app: tauri::AppHandle) -> Result<Vec<Subscription>, String> {
    let c = connect(&app).map_err(|e| e.to_string())?;
    let mut s=c.prepare("SELECT id,title,amount,currency,account_id,frequency,anchor_day,next_day,reminder_days,status FROM subscriptions ORDER BY next_day").map_err(|e|e.to_string())?;
    let values = s
        .query_map([], |r| {
            Ok(Subscription {
                id: r.get(0)?,
                input: SubscriptionInput {
                    title: r.get(1)?,
                    amount: r.get(2)?,
                    currency: r.get(3)?,
                    account_id: r.get(4)?,
                    frequency: r.get(5)?,
                    anchor_day: r.get(6)?,
                    next_day: r.get(7)?,
                    reminder_days: r.get(8)?,
                    status: r.get(9)?,
                },
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(values)
}
#[tauri::command]
pub fn save_subscription(
    app: tauri::AppHandle,
    input: SubscriptionInput,
    id_opt: Option<String>,
) -> Result<(), String> {
    required(&input.title, "订阅名称", 200)?;
    if date(&input.next_day)? < date(&input.anchor_day)? {
        return Err("下次续费不能早于起始日期".into());
    }
    if input.amount <= 0
        || input.amount > 1_000_000_000_000
        || !(0..=365).contains(&input.reminder_days)
        || !["MONTHLY", "YEARLY"].contains(&input.frequency.as_str())
        || !["ACTIVE", "PAUSED", "CANCELLED"].contains(&input.status.as_str())
    {
        return Err("订阅设置无效".into());
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
    let key = id_opt.clone().unwrap_or_else(id);
    let stamp = now();
    if id_opt.is_some() {
        if c.execute("UPDATE subscriptions SET title=?2,amount=?3,currency=?4,account_id=?5,frequency=?6,anchor_day=?7,next_day=?8,reminder_days=?9,status=?10,updated_at=?11 WHERE id=?1",params![key,input.title.trim(),input.amount,input.currency,input.account_id,input.frequency,input.anchor_day,input.next_day,input.reminder_days,input.status,stamp]).map_err(|e|e.to_string())?==0{return Err("订阅不存在".into())}
    } else {
        c.execute(
            "INSERT INTO subscriptions VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?11)",
            params![
                key,
                input.title.trim(),
                input.amount,
                input.currency,
                input.account_id,
                input.frequency,
                input.anchor_day,
                input.next_day,
                input.reminder_days,
                input.status,
                stamp
            ],
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}
pub(super) fn pay(
    c: &Connection,
    subscription_id: String,
    period_day: String,
    existing_transaction_id: Option<String>,
) -> Result<String, String> {
    let tx = c.unchecked_transaction().map_err(|e| e.to_string())?;
    if let Some(existing)=tx.query_row("SELECT transaction_id FROM subscription_payments WHERE subscription_id=?1 AND period_day=?2",params![subscription_id,period_day],|r|r.get::<_,String>(0)).optional().map_err(|e|e.to_string())?{return Ok(existing)}
    let (title,amount,currency,account,frequency,anchor,next):(String,i64,String,String,String,String,String)=tx.query_row("SELECT title,amount,currency,account_id,frequency,anchor_day,next_day FROM subscriptions WHERE id=?1 AND status='ACTIVE'",[&subscription_id],|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?,r.get(3)?,r.get(4)?,r.get(5)?,r.get(6)?))).map_err(|_|"订阅不存在或未启用")?;
    if period_day != next {
        return Err("订阅周期已变化，请刷新后重试".into());
    }
    let transaction = existing_transaction_id.clone().unwrap_or_else(id);
    let stamp = now();
    if existing_transaction_id.is_some() {
        let valid:bool=tx.query_row("SELECT EXISTS(SELECT 1 FROM transactions WHERE id=?1 AND type='EXPENSE' AND amount=?2 AND currency=?3 AND account_id=?4)",params![transaction,amount,currency,account],|r|r.get(0)).map_err(|e|e.to_string())?;
        if !valid {
            return Err("关联支出的金额、币种或账户与订阅不一致".into());
        }
    } else {
        let active: bool = tx
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM accounts WHERE id=?1 AND is_active=1 AND currency=?2)",
                params![account, currency],
                |r| r.get(0),
            )
            .map_err(|e| e.to_string())?;
        if !active {
            return Err("付款账户已停用或币种已变化".into());
        }
        tx.execute("INSERT INTO transactions(id,type,account_id,amount,currency,merchant,transaction_date,note,created_at,updated_at) VALUES(?1,'EXPENSE',?2,?3,?4,?5,?6,'订阅续费',?6,?6)",params![transaction,account,amount,currency,title,stamp]).map_err(|e|e.to_string())?;
    }
    tx.execute(
        "INSERT INTO subscription_payments VALUES(?1,?2,?3,?4,?5,?6)",
        params![
            id(),
            subscription_id,
            period_day,
            transaction,
            amount,
            stamp
        ],
    )
    .map_err(|_| "此交易已用于其他续费周期")?;
    let next = next_cycle(date(&next)?, date(&anchor)?, &frequency)?.to_string();
    tx.execute(
        "UPDATE subscriptions SET next_day=?2,updated_at=?3 WHERE id=?1",
        params![subscription_id, next, stamp],
    )
    .map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;
    Ok(transaction)
}
#[tauri::command]
pub fn pay_subscription(
    app: tauri::AppHandle,
    subscription_id: String,
    period_day: String,
    existing_transaction_id: Option<String>,
) -> Result<String, String> {
    let c = connect(&app).map_err(|e| e.to_string())?;
    pay(&c, subscription_id, period_day, existing_transaction_id)
}
#[tauri::command]
pub fn list_subscription_payments(app: tauri::AppHandle) -> Result<Vec<Payment>, String> {
    let c = connect(&app).map_err(|e| e.to_string())?;
    let mut s=c.prepare("SELECT p.id,p.subscription_id,p.period_day,p.transaction_id,p.amount,p.paid_at,t.currency,s.title FROM subscription_payments p JOIN subscriptions s ON s.id=p.subscription_id JOIN transactions t ON t.id=p.transaction_id ORDER BY paid_at DESC").map_err(|e|e.to_string())?;
    let values = s
        .query_map([], |r| {
            Ok(Payment {
                id: r.get(0)?,
                subscription_id: r.get(1)?,
                period_day: r.get(2)?,
                transaction_id: r.get(3)?,
                amount: r.get(4)?,
                paid_at: r.get(5)?,
                currency: r.get(6)?,
                title: r.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(values)
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn payment_retries_create_one_expense() {
        let c = Connection::open_in_memory().unwrap();
        crate::database::migrate(&c).unwrap();
        c.execute("INSERT INTO accounts(id,name,type,currency,created_at,updated_at) VALUES('a','账户','BANK','CNY',0,0)",[]).unwrap();
        c.execute("INSERT INTO subscriptions VALUES('s','服务',1200,'CNY','a','MONTHLY','2024-01-31','2024-01-31',3,'ACTIVE',0,0)",[]).unwrap();
        let first = pay(&c, "s".into(), "2024-01-31".into(), None).unwrap();
        assert_eq!(
            pay(&c, "s".into(), "2024-01-31".into(), None).unwrap(),
            first
        );
        assert_eq!(
            c.query_row("SELECT COUNT(*) FROM transactions", [], |r| r
                .get::<_, i64>(0))
                .unwrap(),
            1
        );
        assert_eq!(
            c.query_row("SELECT next_day FROM subscriptions", [], |r| r
                .get::<_, String>(0))
                .unwrap(),
            "2024-02-29"
        );
    }
}
#[cfg(test)]
mod ledger_tests {
    use super::*;
    #[test]
    fn existing_expense_is_linked_once_and_amount_is_protected() {
        let c = Connection::open_in_memory().unwrap();
        c.execute_batch("PRAGMA foreign_keys=ON").unwrap();
        crate::database::migrate(&c).unwrap();
        c.execute(
            "INSERT INTO accounts(id,name,type,created_at,updated_at)VALUES('a','账户','BANK',0,0)",
            [],
        )
        .unwrap();
        c.execute("INSERT INTO subscriptions VALUES('s','服务',100,'CNY','a','MONTHLY','2026-09-01','2026-09-01',3,'ACTIVE',0,0)",[]).unwrap();
        c.execute("INSERT INTO transactions(id,type,account_id,amount,transaction_date,created_at,updated_at)VALUES('t','EXPENSE','a',100,0,0,0)",[]).unwrap();
        assert_eq!(
            pay(&c, "s".into(), "2026-09-01".into(), Some("t".into())).unwrap(),
            "t"
        );
        assert_eq!(
            c.query_row("SELECT COUNT(*) FROM transactions", [], |r| r
                .get::<_, i64>(0))
                .unwrap(),
            1
        );
        assert!(c
            .execute("UPDATE transactions SET amount=200 WHERE id='t'", [])
            .is_err());
        assert!(c
            .execute("DELETE FROM transactions WHERE id='t'", [])
            .is_err());
        assert!(pay(&c, "s".into(), "2026-10-01".into(), Some("t".into())).is_err());
        assert_eq!(
            c.query_row("SELECT next_day FROM subscriptions", [], |r| r
                .get::<_, String>(0))
                .unwrap(),
            "2026-10-01"
        );
    }
}
