use super::shared::*;
use crate::database::{connect, id, now};
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeNote {
    id: String,
    title: String,
    body: String,
    tags: String,
    is_pinned: bool,
    is_archived: bool,
    deleted_at: Option<i64>,
    project_id: Option<String>,
    project_title: Option<String>,
    task_id: Option<String>,
    task_title: Option<String>,
    created_at: i64,
    updated_at: i64,
    revision: i64,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeNoteInput {
    title: String,
    #[serde(default)]
    body: String,
    #[serde(default)]
    tags: String,
    #[serde(default)]
    is_pinned: bool,
    #[serde(default)]
    is_archived: bool,
    project_id: Option<String>,
    task_id: Option<String>,
    expected_revision: Option<i64>,
}
fn note_from_row(r: &rusqlite::Row<'_>) -> rusqlite::Result<KnowledgeNote> {
    Ok(KnowledgeNote {
        id: r.get(0)?,
        title: r.get(1)?,
        body: r.get(2)?,
        tags: r.get(3)?,
        is_pinned: r.get::<_, i64>(4)? != 0,
        is_archived: r.get::<_, i64>(5)? != 0,
        deleted_at: r.get(6)?,
        project_id: r.get(7)?,
        project_title: r.get(8)?,
        task_id: r.get(9)?,
        task_title: r.get(10)?,
        created_at: r.get(11)?,
        updated_at: r.get(12)?,
        revision: r.get(13)?,
    })
}
const NOTE_SELECT:&str="SELECT n.id,n.title,n.body,n.tags,n.is_pinned,n.is_archived,n.deleted_at,n.project_id,p.title,n.task_id,t.title,n.created_at,n.updated_at,n.revision FROM knowledge_notes n LEFT JOIN journey_projects p ON p.id=n.project_id LEFT JOIN daily_tasks t ON t.id=n.task_id";
#[tauri::command]
pub fn list_knowledge_notes(
    app: tauri::AppHandle,
    view: Option<String>,
    query: Option<String>,
    project_id: Option<String>,
) -> Result<Vec<KnowledgeNote>, String> {
    let c = connect(&app).map_err(|e| e.to_string())?;
    let state = match view.as_deref().unwrap_or("ACTIVE") {
        "TRASH" => "n.deleted_at IS NOT NULL",
        "ARCHIVED" => "n.deleted_at IS NULL AND n.is_archived=1",
        _ => "n.deleted_at IS NULL AND n.is_archived=0",
    };
    let q = format!("%{}%", query.unwrap_or_default().trim());
    let sql=format!("{NOTE_SELECT} WHERE {state} AND (?1='%%' OR n.title LIKE ?1 OR n.body LIKE ?1 OR n.tags LIKE ?1) AND (?2 IS NULL OR n.project_id=?2) ORDER BY n.is_pinned DESC,n.updated_at DESC");
    let mut s = c.prepare(&sql).map_err(|e| e.to_string())?;
    let result = s
        .query_map(params![q, project_id], note_from_row)
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string());
    result
}
#[tauri::command]
pub fn get_knowledge_note(app: tauri::AppHandle, id: String) -> Result<KnowledgeNote, String> {
    let c = connect(&app).map_err(|e| e.to_string())?;
    c.query_row(&format!("{NOTE_SELECT} WHERE n.id=?1"), [id], note_from_row)
        .optional()
        .map_err(|e| e.to_string())?
        .ok_or("笔记不存在".into())
}
#[tauri::command]
pub fn save_knowledge_note(
    app: tauri::AppHandle,
    input: KnowledgeNoteInput,
    id_opt: Option<String>,
) -> Result<String, String> {
    let c = connect(&app).map_err(|e| e.to_string())?;
    write_note(&c, input, id_opt)
}

pub(super) fn write_note(
    c: &rusqlite::Connection,
    input: KnowledgeNoteInput,
    id_opt: Option<String>,
) -> Result<String, String> {
    let title = required(&input.title, "笔记标题", 300)?;
    if input.body.chars().count() > 200_000 || input.tags.chars().count() > 1000 {
        return Err("笔记内容过长".into());
    }
    ensure_project(&c, &input.project_id)?;
    if let Some(task) = &input.task_id {
        let exists: bool = c
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM daily_tasks WHERE id=?1)",
                [task],
                |r| r.get(0),
            )
            .map_err(|e| e.to_string())?;
        if !exists {
            return Err("关联任务不存在".into());
        }
    }
    let note_id = id_opt.clone().unwrap_or_else(id);
    let timestamp = now();
    let tx = c.unchecked_transaction().map_err(|e| e.to_string())?;
    if id_opt.is_some() {
        let current = tx
            .query_row(
                &format!("{NOTE_SELECT} WHERE n.id=?1 AND n.deleted_at IS NULL"),
                [&note_id],
                note_from_row,
            )
            .map_err(|_| "笔记不存在或已在回收站")?;
        if input.expected_revision != Some(current.revision) {
            return Err("笔记已被修改，请保留草稿并查看最新版本后重试".into());
        }
        let old = serde_json::json!({"title":current.title,"body":current.body,"tags":current.tags,"isPinned":current.is_pinned,"isArchived":current.is_archived,"projectId":current.project_id,"taskId":current.task_id});
        tx.execute("INSERT OR IGNORE INTO note_versions(id,note_id,revision,payload,created_at) VALUES(?1,?2,?3,?4,?5)",params![id(),note_id,current.revision,old.to_string(),timestamp]).map_err(|e|e.to_string())?;
        if tx.execute("UPDATE knowledge_notes SET title=?2,body=?3,tags=?4,is_pinned=?5,is_archived=?6,project_id=?7,task_id=?8,updated_at=?9,revision=revision+1 WHERE id=?1 AND deleted_at IS NULL AND revision=?10",params![note_id,title,input.body,input.tags.trim(),input.is_pinned,input.is_archived,input.project_id,input.task_id,timestamp,input.expected_revision]).map_err(|e|e.to_string())?==0{return Err("笔记版本冲突，草稿已保留".into())}
        tx.execute("DELETE FROM note_versions WHERE note_id=?1 AND id NOT IN (SELECT id FROM note_versions WHERE note_id=?1 ORDER BY revision DESC LIMIT 50)",[&note_id]).map_err(|e|e.to_string())?;
    } else {
        tx.execute("INSERT INTO knowledge_notes(id,title,body,tags,is_pinned,is_archived,project_id,task_id,created_at,updated_at)VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?9)",params![note_id,title,input.body,input.tags.trim(),input.is_pinned,input.is_archived,input.project_id,input.task_id,timestamp]).map_err(|e|e.to_string())?;
    }
    tx.execute(
        "DELETE FROM note_drafts WHERE note_id=?1 AND payload=?2",
        params![
            note_id,
            serde_json::to_string(&input).map_err(|e| e.to_string())?
        ],
    )
    .map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;
    Ok(note_id)
}
#[tauri::command]
pub fn set_knowledge_note_state(
    app: tauri::AppHandle,
    id: String,
    action: String,
) -> Result<(), String> {
    let c = connect(&app).map_err(|e| e.to_string())?;
    let timestamp = now();
    let sql=match action.as_str(){"ARCHIVE"=>"UPDATE knowledge_notes SET is_archived=1,updated_at=?2,revision=revision+1 WHERE id=?1 AND deleted_at IS NULL","UNARCHIVE"=>"UPDATE knowledge_notes SET is_archived=0,updated_at=?2,revision=revision+1 WHERE id=?1 AND deleted_at IS NULL","TRASH"=>"UPDATE knowledge_notes SET deleted_at=?2,updated_at=?2,revision=revision+1 WHERE id=?1","RESTORE"=>"UPDATE knowledge_notes SET deleted_at=NULL,updated_at=?2,revision=revision+1 WHERE id=?1",_=>return Err("笔记操作无效".into())};
    if c.execute(sql, params![id, timestamp])
        .map_err(|e| e.to_string())?
        == 0
    {
        return Err("笔记不存在".into());
    }
    Ok(())
}
#[tauri::command]
pub fn delete_knowledge_note_permanently(app: tauri::AppHandle, id: String) -> Result<(), String> {
    let c = connect(&app).map_err(|e| e.to_string())?;
    if c.execute(
        "DELETE FROM knowledge_notes WHERE id=?1 AND deleted_at IS NOT NULL",
        [id],
    )
    .map_err(|e| e.to_string())?
        == 0
    {
        return Err("只能永久删除回收站中的笔记".into());
    }
    Ok(())
}

#[cfg(test)]
mod reliability_tests {
    use super::*;
    fn input(body: &str, revision: Option<i64>) -> KnowledgeNoteInput {
        serde_json::from_value(serde_json::json!({"title":"资料","body":body,"tags":"","isPinned":false,"isArchived":false,"projectId":null,"taskId":null,"expectedRevision":revision})).unwrap()
    }
    #[test]
    fn stale_save_keeps_draft_and_history_is_bounded() {
        let c = rusqlite::Connection::open_in_memory().unwrap();
        c.execute_batch("PRAGMA foreign_keys=ON").unwrap();
        crate::database::migrate(&c).unwrap();
        let note = write_note(&c, input("original", None), None).unwrap();
        let stale = input("stale", Some(1));
        c.execute(
            "INSERT INTO note_drafts VALUES(?1,1,?2,0)",
            params![note, serde_json::to_string(&stale).unwrap()],
        )
        .unwrap();
        write_note(&c, input("new", Some(1)), Some(note.clone())).unwrap();
        assert!(write_note(&c, stale, Some(note.clone())).is_err());
        assert_eq!(
            c.query_row(
                "SELECT body FROM knowledge_notes WHERE id=?1",
                [&note],
                |r| r.get::<_, String>(0)
            )
            .unwrap(),
            "new"
        );
        assert_eq!(
            c.query_row("SELECT COUNT(*) FROM note_drafts", [], |r| r
                .get::<_, i64>(0))
                .unwrap(),
            1
        );
        assert_eq!(
            c.query_row(
                "SELECT json_extract(payload,'$.body') FROM note_versions WHERE revision=1",
                [],
                |r| r.get::<_, String>(0)
            )
            .unwrap(),
            "original"
        );
        for revision in 2..60 {
            write_note(&c, input("saved", Some(revision)), Some(note.clone())).unwrap();
        }
        assert_eq!(
            c.query_row("SELECT COUNT(*) FROM note_versions", [], |r| r
                .get::<_, i64>(0))
                .unwrap(),
            50
        );
    }
    #[test]
    fn successful_save_removes_only_matching_draft() {
        let c = rusqlite::Connection::open_in_memory().unwrap();
        crate::database::migrate(&c).unwrap();
        let note = write_note(&c, input("original", None), None).unwrap();
        let data = input("draft", Some(1));
        c.execute(
            "INSERT INTO note_drafts VALUES(?1,1,?2,0)",
            params![note, serde_json::to_string(&data).unwrap()],
        )
        .unwrap();
        write_note(&c, data, Some(note)).unwrap();
        assert_eq!(
            c.query_row("SELECT COUNT(*) FROM note_drafts", [], |r| r
                .get::<_, i64>(0))
                .unwrap(),
            0
        );
    }
}
