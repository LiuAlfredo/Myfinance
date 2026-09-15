-- Private calendar data is stored as encrypted payloads. Month/day indexes are keyed hashes.
CREATE TABLE IF NOT EXISTS app_security (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    password_hash TEXT NOT NULL,
    wrap_salt TEXT NOT NULL,
    wrapped_data_key TEXT NOT NULL,
    wrap_nonce TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS private_partners (
    id TEXT PRIMARY KEY,
    payload TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS private_calendar_events (
    id TEXT PRIMARY KEY,
    month_index TEXT NOT NULL,
    day_index TEXT NOT NULL,
    payload TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_private_events_month ON private_calendar_events(month_index);
CREATE INDEX IF NOT EXISTS idx_private_events_day ON private_calendar_events(day_index);

INSERT OR IGNORE INTO schema_migrations(version, applied_at)
VALUES (2, CAST(strftime('%s', 'now') AS INTEGER) * 1000);
