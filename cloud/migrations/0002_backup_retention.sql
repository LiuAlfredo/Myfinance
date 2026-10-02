ALTER TABLE backups ADD COLUMN backup_kind TEXT NOT NULL DEFAULT 'MANUAL'
  CHECK(backup_kind IN ('AUTO', 'MANUAL', 'PRE_RESTORE'));
ALTER TABLE backups ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0
  CHECK(pinned IN (0, 1));

CREATE INDEX IF NOT EXISTS idx_backups_retention
  ON backups(device_id, backup_kind, pinned, uploaded_at DESC);
