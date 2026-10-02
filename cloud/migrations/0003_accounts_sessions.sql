CREATE TABLE accounts (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_iterations INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  device_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_used_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  revoked INTEGER NOT NULL DEFAULT 0 CHECK(revoked IN (0, 1))
);

CREATE INDEX idx_sessions_account ON sessions(account_id, revoked, expires_at);

CREATE TABLE login_attempts (
  attempt_key TEXT PRIMARY KEY,
  window_started_at INTEGER NOT NULL,
  attempt_count INTEGER NOT NULL,
  locked_until INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE backups ADD COLUMN account_id TEXT REFERENCES accounts(id) ON DELETE CASCADE;
CREATE INDEX idx_backups_account_created ON backups(account_id, created_at DESC);
