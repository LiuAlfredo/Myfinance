CREATE TABLE task_routines (
    id TEXT PRIMARY KEY, title TEXT NOT NULL, note TEXT NOT NULL DEFAULT '',
    project_id TEXT REFERENCES journey_projects(id) ON DELETE SET NULL,
    frequency TEXT NOT NULL CHECK(frequency IN ('DAILY','WEEKLY','MONTHLY')),
    weekdays TEXT NOT NULL DEFAULT '', anchor_day TEXT NOT NULL,
    next_day TEXT NOT NULL, missed_policy TEXT NOT NULL CHECK(missed_policy IN ('CATCH_UP','SKIP')),
    active INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE TABLE routine_occurrences (
    routine_id TEXT NOT NULL REFERENCES task_routines(id) ON DELETE CASCADE,
    day TEXT NOT NULL, task_id TEXT REFERENCES daily_tasks(id) ON DELETE SET NULL,
    skipped INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(routine_id,day)
);
CREATE TABLE subscriptions (
    id TEXT PRIMARY KEY, title TEXT NOT NULL, amount INTEGER NOT NULL CHECK(amount>0),
    currency TEXT NOT NULL DEFAULT 'CNY', account_id TEXT NOT NULL REFERENCES accounts(id),
    frequency TEXT NOT NULL CHECK(frequency IN ('MONTHLY','YEARLY')),
    anchor_day TEXT NOT NULL, next_day TEXT NOT NULL, reminder_days INTEGER NOT NULL DEFAULT 3,
    status TEXT NOT NULL CHECK(status IN ('ACTIVE','PAUSED','CANCELLED')),
    created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE TABLE subscription_payments (
    id TEXT PRIMARY KEY, subscription_id TEXT NOT NULL REFERENCES subscriptions(id),
    period_day TEXT NOT NULL, transaction_id TEXT NOT NULL UNIQUE REFERENCES transactions(id),
    amount INTEGER NOT NULL, paid_at INTEGER NOT NULL,
    UNIQUE(subscription_id,period_day)
);
CREATE TRIGGER protect_subscription_payment_transaction
BEFORE UPDATE OF type,account_id,amount,currency ON transactions
WHEN EXISTS(SELECT 1 FROM subscription_payments WHERE transaction_id=OLD.id)
AND (NEW.type IS NOT OLD.type OR NEW.account_id IS NOT OLD.account_id OR NEW.amount IS NOT OLD.amount OR NEW.currency IS NOT OLD.currency)
BEGIN
    SELECT RAISE(ABORT,'已关联订阅付款的交易不能修改金额、币种、账户或类型');
END;
INSERT INTO schema_migrations VALUES(7,CAST(strftime('%s','now') AS INTEGER)*1000);
