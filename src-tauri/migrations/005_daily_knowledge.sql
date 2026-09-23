CREATE TABLE IF NOT EXISTS daily_tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'TODO' CHECK(status IN ('TODO','ACTIVE','DONE','CANCELLED')),
    priority TEXT NOT NULL DEFAULT 'NORMAL' CHECK(priority IN ('NORMAL','IMPORTANT','URGENT')),
    planned_day TEXT,
    due_at INTEGER,
    project_id TEXT REFERENCES journey_projects(id) ON DELETE SET NULL,
    parent_id TEXT REFERENCES daily_tasks(id) ON DELETE CASCADE,
    source_item_id TEXT UNIQUE REFERENCES journey_project_items(id) ON DELETE SET NULL,
    completed_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS daily_events (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    all_day INTEGER NOT NULL DEFAULT 0,
    day_key TEXT,
    starts_at INTEGER,
    ends_at INTEGER,
    location TEXT NOT NULL DEFAULT '',
    note TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    CHECK((all_day=1 AND day_key IS NOT NULL) OR (all_day=0 AND starts_at IS NOT NULL AND ends_at IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS knowledge_notes (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    tags TEXT NOT NULL DEFAULT '',
    is_pinned INTEGER NOT NULL DEFAULT 0,
    is_archived INTEGER NOT NULL DEFAULT 0,
    deleted_at INTEGER,
    project_id TEXT REFERENCES journey_projects(id) ON DELETE SET NULL,
    task_id TEXT REFERENCES daily_tasks(id) ON DELETE SET NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS today_pinned_projects (
    project_id TEXT PRIMARY KEY REFERENCES journey_projects(id) ON DELETE CASCADE,
    pinned_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_daily_tasks_planned ON daily_tasks(status,planned_day);
CREATE INDEX IF NOT EXISTS idx_daily_tasks_due ON daily_tasks(status,due_at);
CREATE INDEX IF NOT EXISTS idx_daily_tasks_project ON daily_tasks(project_id,updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_daily_events_day ON daily_events(day_key,starts_at);
CREATE INDEX IF NOT EXISTS idx_knowledge_notes_state ON knowledge_notes(deleted_at,is_archived,is_pinned,updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_notes_project ON knowledge_notes(project_id,updated_at DESC);

INSERT OR IGNORE INTO schema_migrations(version, applied_at)
VALUES (5, CAST(strftime('%s', 'now') AS INTEGER) * 1000);
