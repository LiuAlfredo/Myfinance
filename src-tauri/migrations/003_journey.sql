CREATE TABLE IF NOT EXISTS journey_projects (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    project_type TEXT NOT NULL CHECK(project_type IN ('WORK', 'PERSONAL')),
    summary TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'PLANNING' CHECK(status IN ('PLANNING', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED')),
    progress INTEGER NOT NULL DEFAULT 0 CHECK(progress BETWEEN 0 AND 100),
    current_goal TEXT NOT NULL DEFAULT '',
    target_date INTEGER,
    accent TEXT NOT NULL DEFAULT '#5b6ee1',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS journey_project_items (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES journey_projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'TODO' CHECK(status IN ('TODO', 'ACTIVE', 'DONE', 'BLOCKED')),
    progress INTEGER NOT NULL DEFAULT 0 CHECK(progress BETWEEN 0 AND 100),
    priority TEXT NOT NULL DEFAULT 'MEDIUM' CHECK(priority IN ('LOW', 'MEDIUM', 'HIGH')),
    target_date INTEGER,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS journey_milestones (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES journey_projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    target_date INTEGER,
    is_completed INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS journey_logs (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES journey_projects(id) ON DELETE CASCADE,
    kind TEXT NOT NULL DEFAULT 'NOTE' CHECK(kind IN ('NOTE', 'DECISION', 'PROBLEM', 'DISCOVERY', 'SUMMARY')),
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS journey_ideas (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'NEW' CHECK(status IN ('NEW', 'RESEARCH', 'WAITING', 'CONVERTED', 'DROPPED')),
    tags TEXT NOT NULL DEFAULT '',
    value_score INTEGER NOT NULL DEFAULT 3 CHECK(value_score BETWEEN 1 AND 5),
    converted_project_id TEXT REFERENCES journey_projects(id),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS journey_goals (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    reason TEXT NOT NULL DEFAULT '',
    horizon TEXT NOT NULL DEFAULT 'YEAR' CHECK(horizon IN ('YEAR', 'THREE_YEARS', 'FIVE_YEARS', 'LIFETIME')),
    progress INTEGER NOT NULL DEFAULT 0 CHECK(progress BETWEEN 0 AND 100),
    target_date INTEGER,
    next_action TEXT NOT NULL DEFAULT '',
    linked_project_ids TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'PAUSED', 'ACHIEVED')),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_journey_projects_status_updated ON journey_projects(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_journey_items_project_sort ON journey_project_items(project_id, sort_order, created_at);
CREATE INDEX IF NOT EXISTS idx_journey_milestones_project_sort ON journey_milestones(project_id, sort_order, created_at);
CREATE INDEX IF NOT EXISTS idx_journey_logs_project_created ON journey_logs(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_journey_ideas_status_updated ON journey_ideas(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_journey_goals_status_updated ON journey_goals(status, updated_at DESC);

INSERT OR IGNORE INTO schema_migrations(version, applied_at)
VALUES (3, CAST(strftime('%s', 'now') AS INTEGER) * 1000);
