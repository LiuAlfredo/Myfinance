ALTER TABLE planned_expenses ADD COLUMN transaction_id TEXT REFERENCES transactions(id);

CREATE TABLE installment_payments (
    id TEXT PRIMARY KEY,
    installment_id TEXT NOT NULL REFERENCES installments(id) ON DELETE CASCADE,
    period_no INTEGER NOT NULL,
    transaction_id TEXT NOT NULL UNIQUE REFERENCES transactions(id),
    amount INTEGER NOT NULL,
    paid_at INTEGER NOT NULL,
    UNIQUE(installment_id, period_no)
);

CREATE TABLE recurring_payments (
    id TEXT PRIMARY KEY,
    recurring_id TEXT NOT NULL REFERENCES recurring_transactions(id) ON DELETE CASCADE,
    scheduled_at INTEGER NOT NULL,
    transaction_id TEXT NOT NULL UNIQUE REFERENCES transactions(id),
    amount INTEGER NOT NULL,
    paid_at INTEGER NOT NULL,
    UNIQUE(recurring_id, scheduled_at)
);

INSERT INTO schema_migrations VALUES(8,CAST(strftime('%s','now') AS INTEGER)*1000);
