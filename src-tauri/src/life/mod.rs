pub mod events;
pub mod note_resources;
pub mod notes;
pub mod routines;
mod shared;
pub mod subscriptions;
pub mod tasks;
pub mod today;
#[cfg(test)]
mod tests {
    use super::shared::*;
    use super::tasks::would_create_task_cycle;
    #[test]
    fn rejects_parent_cycles() {
        let c = rusqlite::Connection::open_in_memory().unwrap();
        c.execute_batch("CREATE TABLE daily_tasks(id TEXT PRIMARY KEY,parent_id TEXT);INSERT INTO daily_tasks VALUES('root',NULL),('child','root'),('grandchild','child'),('other',NULL);").unwrap();
        assert!(would_create_task_cycle(&c, "root", "grandchild").unwrap());
        assert!(would_create_task_cycle(&c, "root", "root").unwrap());
        assert!(!would_create_task_cycle(&c, "child", "other").unwrap());
    }
    #[test]
    fn validates_real_days() {
        assert!(valid_day("2024-02-29"));
        assert!(!valid_day("2023-02-29"));
        assert!(!valid_day("2024-13-01"));
    }
    #[test]
    fn task_enums_are_bounded() {
        assert!(TASK_STATUSES.contains(&"DONE"));
        assert!(!TASK_STATUSES.contains(&"DELETED"));
    }
    #[test]
    fn migration_preserves_links_and_detaches_deleted_projects() {
        let c = rusqlite::Connection::open_in_memory().unwrap();
        c.execute_batch("PRAGMA foreign_keys=ON;CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY,applied_at INTEGER NOT NULL);CREATE TABLE journey_projects(id TEXT PRIMARY KEY);CREATE TABLE journey_project_items(id TEXT PRIMARY KEY);INSERT INTO journey_projects VALUES('project');INSERT INTO journey_project_items VALUES('item');").unwrap();
        c.execute_batch(include_str!("../../migrations/005_daily_knowledge.sql"))
            .unwrap();
        c.execute("INSERT INTO daily_tasks(id,title,status,priority,project_id,source_item_id,created_at,updated_at)VALUES('task','Do it','TODO','NORMAL','project','item',1,1)",[]).unwrap();
        c.execute("INSERT INTO knowledge_notes(id,title,project_id,task_id,created_at,updated_at)VALUES('note','Context','project','task',1,1)",[]).unwrap();
        assert!(c.execute("INSERT INTO daily_tasks(id,title,status,priority,source_item_id,created_at,updated_at)VALUES('duplicate','Again','TODO','NORMAL','item',1,1)",[]).is_err());
        c.execute("DELETE FROM journey_projects WHERE id='project'", [])
            .unwrap();
        let links: (Option<String>, Option<String>) = c
            .query_row(
                "SELECT project_id,task_id FROM knowledge_notes WHERE id='note'",
                [],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .unwrap();
        assert_eq!(links, (None, Some("task".into())));
    }
}
