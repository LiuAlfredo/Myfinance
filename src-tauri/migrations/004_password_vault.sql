-- The vault key is wrapped with the existing unlocked master data key.
CREATE TABLE IF NOT EXISTS vault_keys (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    version INTEGER NOT NULL CHECK (version = 1),
    wrapped_key TEXT NOT NULL,
    created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS vault_items (
    id TEXT PRIMARY KEY,
    version INTEGER NOT NULL CHECK (version = 1),
    key_version INTEGER NOT NULL DEFAULT 1,
    payload TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

INSERT OR IGNORE INTO schema_migrations(version, applied_at)
VALUES (4, CAST(strftime('%s', 'now') AS INTEGER) * 1000);
