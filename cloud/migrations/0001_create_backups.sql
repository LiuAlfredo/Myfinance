CREATE TABLE IF NOT EXISTS backups (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  uploaded_at INTEGER NOT NULL,
  encrypted_size INTEGER NOT NULL,
  source_size INTEGER NOT NULL,
  schema_version INTEGER NOT NULL,
  checksum TEXT NOT NULL,
  chunk_count INTEGER NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('UPLOADING', 'COMPLETE'))
);

CREATE TABLE IF NOT EXISTS backup_chunks (
  backup_id TEXT NOT NULL REFERENCES backups(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  payload BLOB NOT NULL,
  PRIMARY KEY (backup_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_backups_created_at
  ON backups(created_at DESC);
