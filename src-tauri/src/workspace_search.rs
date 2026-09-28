use crate::database::connect;
use rusqlite::params;
use serde::Serialize;
#[derive(Serialize)]
pub struct SearchHit {
    id: String,
    kind: String,
    title: String,
    detail: String,
    url: String,
}
#[tauri::command]
pub fn search_workspace(
    app: tauri::AppHandle,
    query: String,
    kind: String,
) -> Result<Vec<SearchHit>, String> {
    let c = connect(&app).map_err(|e| e.to_string())?;
    search(&c, &query, &kind)
}
fn search(c: &rusqlite::Connection, query: &str, kind: &str) -> Result<Vec<SearchHit>, String> {
    let q = query.trim();
    if q.is_empty() {
        return Ok(Vec::new());
    }
    if q.chars().count() > 200 {
        return Err("搜索内容过长".into());
    }
    let pattern = format!(
        "%{}%",
        q.replace('!', "!!").replace('%', "!%").replace('_', "!_")
    );
    let mut result = Vec::new();
    for (typ,sql) in [
        ("TASK","SELECT id,title,note FROM daily_tasks WHERE title LIKE ?1 ESCAPE '!' OR note LIKE ?1 ESCAPE '!' ORDER BY updated_at DESC LIMIT 50"),
        ("PROJECT","SELECT id,title,description FROM journey_projects WHERE title LIKE ?1 ESCAPE '!' OR summary LIKE ?1 ESCAPE '!' OR description LIKE ?1 ESCAPE '!' ORDER BY updated_at DESC LIMIT 50"),
        ("EVENT","SELECT id,title,note FROM daily_events WHERE title LIKE ?1 ESCAPE '!' OR note LIKE ?1 ESCAPE '!' OR location LIKE ?1 ESCAPE '!' ORDER BY updated_at DESC LIMIT 50"),
        ("TRANSACTION","SELECT id,COALESCE(NULLIF(merchant,''),'交易记录'),note FROM transactions WHERE merchant LIKE ?1 ESCAPE '!' OR note LIKE ?1 ESCAPE '!' ORDER BY transaction_date DESC LIMIT 50"),
        ("PLANNED","SELECT id,title,note FROM planned_expenses WHERE status='PLANNED' AND (title LIKE ?1 ESCAPE '!' OR note LIKE ?1 ESCAPE '!') ORDER BY planned_date LIMIT 50"),
        ("NOTE","SELECT id,title,substr(body,1,160) FROM knowledge_notes WHERE deleted_at IS NULL AND (title LIKE ?1 ESCAPE '!' OR body LIKE ?1 ESCAPE '!' OR tags LIKE ?1 ESCAPE '!') ORDER BY updated_at DESC LIMIT 50")]{
        if kind!="ALL"&&kind!=typ{continue}let mut s=c.prepare(sql).map_err(|e|e.to_string())?;
        let values=s.query_map(params![pattern],|r|{let id:String=r.get(0)?;let url=match typ{"TASK"=>format!("/daily?task={id}"),"PROJECT"=>format!("/journey?project={id}"),"EVENT"=>format!("/daily?view=EVENTS&event={id}"),"TRANSACTION"=>format!("/finance/transactions?transaction={id}"),"PLANNED"=>format!("/finance/planning?planned={id}"),_=>format!("/knowledge?note={id}")};Ok(SearchHit{id,kind:typ.into(),title:r.get(1)?,detail:r.get(2)?,url})}).map_err(|e|e.to_string())?.collect::<Result<Vec<_>,_>>().map_err(|e|e.to_string())?;result.extend(values);
    }
    Ok(result)
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn wildcard_is_literal_and_trash_and_secrets_are_excluded() {
        let c = rusqlite::Connection::open_in_memory().unwrap();
        crate::database::migrate(&c).unwrap();
        c.execute("INSERT INTO knowledge_notes(id,title,body,created_at,updated_at)VALUES('n','100%','match',0,0)",[]).unwrap();
        c.execute("INSERT INTO knowledge_notes(id,title,body,deleted_at,created_at,updated_at)VALUES('trash','100% secret','',1,0,0)",[]).unwrap();
        c.execute("INSERT INTO vault_items(id,version,key_version,payload,created_at,updated_at)VALUES('secret',1,1,'100%',0,0)",[]).unwrap();
        let hits = search(&c, "100%", "ALL").unwrap();
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].id, "n");
        assert_eq!(hits[0].url, "/knowledge?note=n");
        assert!(search(&c, "100%", "PROJECT").unwrap().is_empty());
    }
}
