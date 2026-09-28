ALTER TABLE knowledge_notes ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
CREATE TABLE note_drafts (
    note_id TEXT PRIMARY KEY REFERENCES knowledge_notes(id) ON DELETE CASCADE,
    base_revision INTEGER NOT NULL,
    payload TEXT NOT NULL,
    updated_at INTEGER NOT NULL
);
CREATE TABLE note_versions (
    id TEXT PRIMARY KEY,
    note_id TEXT NOT NULL REFERENCES knowledge_notes(id) ON DELETE CASCADE,
    revision INTEGER NOT NULL,
    payload TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    UNIQUE(note_id,revision)
);
CREATE TABLE note_attachments (
    id TEXT PRIMARY KEY,
    note_id TEXT NOT NULL REFERENCES knowledge_notes(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    size INTEGER NOT NULL,
    sha256 TEXT NOT NULL,
    data BLOB NOT NULL,
    created_at INTEGER NOT NULL
);
CREATE INDEX idx_note_versions ON note_versions(note_id,created_at DESC);
CREATE TABLE automatic_backups (
    id TEXT PRIMARY KEY,
    path TEXT NOT NULL UNIQUE,
    created_at INTEGER NOT NULL,
    size INTEGER NOT NULL,
    schema_version INTEGER NOT NULL,
    checksum TEXT NOT NULL
);
INSERT INTO schema_migrations VALUES(6,CAST(strftime('%s','now') AS INTEGER)*1000);
