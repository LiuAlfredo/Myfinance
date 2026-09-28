use super::notes::{write_note, KnowledgeNoteInput};
use crate::database::{connect, id, now};
use rusqlite::params;
use serde::Serialize;
use sha2::{Digest, Sha256};

#[tauri::command]
pub fn stage_note_draft(
    app: tauri::AppHandle,
    note_id: String,
    input: KnowledgeNoteInput,
) -> Result<(), String> {
    let c = connect(&app).map_err(|e| e.to_string())?;
    let payload = serde_json::to_string(&input).map_err(|e| e.to_string())?;
    if payload.len() > 900_000 {
        return Err("草稿过长".into());
    }
    let value: serde_json::Value = serde_json::from_str(&payload).map_err(|e| e.to_string())?;
    c.execute("INSERT INTO note_drafts(note_id,base_revision,payload,updated_at) VALUES(?1,?2,?3,?4) ON CONFLICT(note_id) DO UPDATE SET payload=excluded.payload,base_revision=excluded.base_revision,updated_at=excluded.updated_at",params![note_id,value["expectedRevision"].as_i64().unwrap_or(1),payload,now()]).map_err(|e|e.to_string())?;
    Ok(())
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NoteResource {
    id: String,
    note_id: String,
    name: String,
    payload: Option<String>,
    created_at: i64,
    size: i64,
    revision: i64,
}

#[tauri::command]
pub fn list_note_resources(
    app: tauri::AppHandle,
    note_id: Option<String>,
    kind: String,
) -> Result<Vec<NoteResource>, String> {
    let c = connect(&app).map_err(|e| e.to_string())?;
    let sql=match kind.as_str(){
        "DRAFTS"=>"SELECT note_id,note_id,'未保存草稿',payload,updated_at,0,base_revision FROM note_drafts WHERE (?1 IS NULL OR note_id=?1)",
        "VERSIONS"=>"SELECT id,note_id,'历史版本',payload,created_at,0,revision FROM note_versions WHERE note_id=?1 ORDER BY revision DESC",
        "ATTACHMENTS"=>"SELECT id,note_id,name,NULL,created_at,size,0 FROM note_attachments WHERE note_id=?1 ORDER BY created_at DESC",
        _=>return Err("资料类型无效".into())};
    let mut s = c.prepare(sql).map_err(|e| e.to_string())?;
    let rows = s
        .query_map([note_id], |r| {
            Ok(NoteResource {
                id: r.get(0)?,
                note_id: r.get(1)?,
                name: r.get(2)?,
                payload: r.get(3)?,
                created_at: r.get(4)?,
                size: r.get(5)?,
                revision: r.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(rows)
}
#[tauri::command]
pub fn discard_note_draft(app: tauri::AppHandle, note_id: String) -> Result<(), String> {
    let c = connect(&app).map_err(|e| e.to_string())?;
    c.execute("DELETE FROM note_drafts WHERE note_id=?1", [note_id])
        .map_err(|e| e.to_string())?;
    Ok(())
}
#[tauri::command]
pub fn restore_note_version(
    app: tauri::AppHandle,
    note_id: String,
    version_id: String,
    expected_revision: i64,
) -> Result<(), String> {
    let c = connect(&app).map_err(|e| e.to_string())?;
    let payload: String = c
        .query_row(
            "SELECT payload FROM note_versions WHERE id=?1 AND note_id=?2",
            params![version_id, note_id],
            |r| r.get(0),
        )
        .map_err(|_| "历史版本不存在")?;
    let mut value: serde_json::Value = serde_json::from_str(&payload).map_err(|e| e.to_string())?;
    value["expectedRevision"] = expected_revision.into();
    detach_missing_links(&c, &mut value)?;
    write_note(
        &c,
        serde_json::from_value(value).map_err(|e| e.to_string())?,
        Some(note_id),
    )?;
    Ok(())
}
#[tauri::command]
pub fn import_note_attachment(
    app: tauri::AppHandle,
    note_id: String,
    path: String,
) -> Result<(), String> {
    let path = std::path::Path::new(&path);
    let meta = std::fs::metadata(path).map_err(|e| e.to_string())?;
    if !meta.is_file() || meta.len() > 20 * 1024 * 1024 {
        return Err("附件须为不超过 20 MB 的文件".into());
    }
    let data = std::fs::read(path).map_err(|e| e.to_string())?;
    if data.len() > 20 * 1024 * 1024 {
        return Err("附件过大".into());
    }
    let c = connect(&app).map_err(|e| e.to_string())?;
    c.execute(
        "INSERT INTO note_attachments VALUES(?1,?2,?3,?4,?5,?6,?7)",
        params![
            id(),
            note_id,
            path.file_name().and_then(|n| n.to_str()).unwrap_or("附件"),
            data.len() as i64,
            format!("{:x}", Sha256::digest(&data)),
            data,
            now()
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}
#[tauri::command]
pub fn export_note_attachment(
    app: tauri::AppHandle,
    id: String,
    destination: String,
) -> Result<(), String> {
    let c = connect(&app).map_err(|e| e.to_string())?;
    let (data, checksum): (Vec<u8>, String) = c
        .query_row(
            "SELECT data,sha256 FROM note_attachments WHERE id=?1",
            [id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .map_err(|e| e.to_string())?;
    if format!("{:x}", Sha256::digest(&data)) != checksum {
        return Err("附件完整性校验失败".into());
    }
    let path = std::path::Path::new(&destination);
    let database = crate::database::path(&app).map_err(|e| e.to_string())?;
    if path.canonicalize().ok() == database.canonicalize().ok() {
        return Err("不能覆盖当前数据库".into());
    }
    std::fs::write(path, data).map_err(|e| e.to_string())
}
#[tauri::command]
pub fn delete_note_attachment(app: tauri::AppHandle, id: String) -> Result<(), String> {
    let c = connect(&app).map_err(|e| e.to_string())?;
    c.execute("DELETE FROM note_attachments WHERE id=?1", [id])
        .map_err(|e| e.to_string())?;
    Ok(())
}
fn detach_missing_links(
    c: &rusqlite::Connection,
    value: &mut serde_json::Value,
) -> Result<(), String> {
    for (key, table) in [("projectId", "journey_projects"), ("taskId", "daily_tasks")] {
        if let Some(reference) = value[key].as_str() {
            let exists: bool = c
                .query_row(
                    &format!("SELECT EXISTS(SELECT 1 FROM {table} WHERE id=?1)"),
                    [reference],
                    |r| r.get(0),
                )
                .map_err(|e| e.to_string())?;
            if !exists {
                value[key] = serde_json::Value::Null;
            }
        }
    }
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn restoring_history_detaches_links_to_deleted_records() {
        let c = rusqlite::Connection::open_in_memory().unwrap();
        crate::database::migrate(&c).unwrap();
        let mut value = serde_json::json!({"body":"preserved","projectId":"deleted-project","taskId":"deleted-task"});
        detach_missing_links(&c, &mut value).unwrap();
        assert_eq!(value["body"], "preserved");
        assert!(value["projectId"].is_null());
        assert!(value["taskId"].is_null());
    }
}
