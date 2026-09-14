-- Initial local-first Finance schema. Runtime applies the same idempotent migration in database.rs.
CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at INTEGER NOT NULL);
