use aes_gcm::{
    aead::{Aead, KeyInit, Payload},
    Aes256Gcm, Nonce,
};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use rand::{rngs::OsRng, RngCore};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use zeroize::Zeroizing;

use crate::{database::{connect, id, now}, security::SecurityState};

const KEY_CONTEXT: &[u8] = b"myfinance/vault/key/v1";

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultInput {
    platform: String,
    website: String,
    username: String,
    password: String,
    note: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultSummary {
    id: String,
    platform: String,
    username: String,
    updated_at: i64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultItem {
    id: String,
    #[serde(flatten)]
    input: VaultInput,
    updated_at: i64,
}

fn seal(key: &[u8], context: &[u8], value: &[u8]) -> Result<String, String> {
    let cipher = Aes256Gcm::new_from_slice(key).map_err(|_| "密码库密钥无效".to_string())?;
    let mut nonce = [0_u8; 12];
    OsRng.fill_bytes(&mut nonce);
    let ciphertext = cipher.encrypt(Nonce::from_slice(&nonce), Payload { msg: value, aad: context })
        .map_err(|_| "密码库加密失败".to_string())?;
    let mut output = nonce.to_vec();
    output.extend(ciphertext);
    Ok(BASE64.encode(output))
}

fn open(key: &[u8], context: &[u8], value: &str) -> Result<Zeroizing<Vec<u8>>, String> {
    let bytes = BASE64.decode(value).map_err(|_| "密码库数据格式无效".to_string())?;
    if bytes.len() <= 28 { return Err("密码库数据格式无效".into()); }
    let cipher = Aes256Gcm::new_from_slice(key).map_err(|_| "密码库密钥无效".to_string())?;
    cipher.decrypt(Nonce::from_slice(&bytes[..12]), Payload { msg: &bytes[12..], aad: context })
        .map(Zeroizing::new).map_err(|_| "密码库数据无法解密".to_string())
}

fn item_context(item_id: &str) -> Vec<u8> {
    format!("myfinance/vault/item/v1/{item_id}").into_bytes()
}

fn vault_key(connection: &Connection, master: &[u8], create: bool) -> Result<Option<Zeroizing<Vec<u8>>>, String> {
    let stored: Option<(i64, String)> = connection.query_row(
        "SELECT version,wrapped_key FROM vault_keys WHERE id=1", [], |row| Ok((row.get(0)?, row.get(1)?)),
    ).optional().map_err(|error| error.to_string())?;
    if let Some((version, wrapped)) = stored {
        if version != 1 { return Err("不支持的密码库密钥版本".into()); }
        return open(master, KEY_CONTEXT, &wrapped).map(Some);
    }
    let existing: i64 = connection.query_row("SELECT COUNT(*) FROM vault_items", [], |row| row.get(0))
        .map_err(|error| error.to_string())?;
    if existing > 0 { return Err("密码库记录缺少密钥，无法创建新密钥".into()); }
    if !create { return Ok(None); }
    let mut generated = Zeroizing::new(vec![0_u8; 32]);
    OsRng.fill_bytes(&mut generated);
    let wrapped = seal(master, KEY_CONTEXT, &generated)?;
    connection.execute("INSERT OR IGNORE INTO vault_keys(id,version,wrapped_key,created_at) VALUES(1,1,?1,?2)", params![wrapped, now()])
        .map_err(|error| error.to_string())?;
    let saved: String = connection.query_row("SELECT wrapped_key FROM vault_keys WHERE id=1", [], |row| row.get(0))
        .map_err(|error| error.to_string())?;
    open(master, KEY_CONTEXT, &saved).map(Some)
}

fn decode_item(key: &[u8], item_id: String, payload: String, updated_at: i64) -> Result<VaultItem, String> {
    let plaintext = open(key, &item_context(&item_id), &payload)?;
    let input = serde_json::from_slice(&plaintext).map_err(|_| "密码库记录无效".to_string())?;
    Ok(VaultItem { id: item_id, input, updated_at })
}

#[tauri::command]
pub fn list_vault_items(app: tauri::AppHandle, state: tauri::State<SecurityState>) -> Result<Vec<VaultSummary>, String> {
    let master = state.vault_key_access()?;
    let connection = connect(&app).map_err(|error| error.to_string())?;
    let Some(key) = vault_key(&connection, &master, false)? else { return Ok(Vec::new()); };
    let mut statement = connection.prepare("SELECT id,version,key_version,payload,updated_at FROM vault_items ORDER BY updated_at DESC")
        .map_err(|error| error.to_string())?;
    let rows = statement.query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?, row.get::<_, i64>(2)?, row.get::<_, String>(3)?, row.get::<_, i64>(4)?)))
        .map_err(|error| error.to_string())?;
    rows.map(|row| {
        let (id, version, key_version, payload, updated_at) = row.map_err(|error| error.to_string())?;
        if version != 1 || key_version != 1 { return Err("不支持的密码库记录版本".into()); }
        let item = decode_item(&key, id, payload, updated_at)?;
        Ok(VaultSummary { id: item.id, platform: item.input.platform, username: item.input.username, updated_at })
    }).collect()
}

#[tauri::command]
pub fn get_vault_item(app: tauri::AppHandle, state: tauri::State<SecurityState>, id: String) -> Result<VaultItem, String> {
    let master = state.vault_key_access()?;
    let connection = connect(&app).map_err(|error| error.to_string())?;
    let key = vault_key(&connection, &master, false)?.ok_or("记录不存在")?;
    let row = connection.query_row("SELECT version,key_version,payload,updated_at FROM vault_items WHERE id=?1", [&id], |row| Ok((row.get::<_, i64>(0)?, row.get::<_, i64>(1)?, row.get::<_, String>(2)?, row.get::<_, i64>(3)?)))
        .optional().map_err(|error| error.to_string())?.ok_or("记录不存在")?;
    if row.0 != 1 || row.1 != 1 { return Err("不支持的密码库记录版本".into()); }
    decode_item(&key, id, row.2, row.3)
}

#[tauri::command]
pub fn save_vault_item(app: tauri::AppHandle, state: tauri::State<SecurityState>, input: VaultInput, id_opt: Option<String>) -> Result<VaultSummary, String> {
    let master = state.vault_key_access()?;
    if input.platform.trim().is_empty() || input.username.trim().is_empty() || input.password.is_empty() {
        return Err("平台、账号和密码不能为空".into());
    }
    if input.platform.len() > 512 || input.website.len() > 2048 || input.username.len() > 512 || input.password.len() > 4096 || input.note.len() > 8192 {
        return Err("记录内容过长".into());
    }
    let connection = connect(&app).map_err(|error| error.to_string())?;
    let key = vault_key(&connection, &master, true)?.ok_or("密码库密钥无效")?;
    let timestamp = now();
    let item_id = id_opt.clone().unwrap_or_else(id);
    let payload = seal(&key, &item_context(&item_id), &serde_json::to_vec(&input).map_err(|_| "记录格式无效")?)?;
    let platform = input.platform.clone();
    let username = input.username.clone();
    if id_opt.is_some() {
        let changed = connection.execute("UPDATE vault_items SET payload=?2,updated_at=?3 WHERE id=?1 AND version=1 AND key_version=1", params![item_id, payload, timestamp])
            .map_err(|error| error.to_string())?;
        if changed == 0 { return Err("记录不存在或版本不受支持".into()); }
    } else {
        connection.execute("INSERT INTO vault_items(id,version,key_version,payload,created_at,updated_at) VALUES(?1,1,1,?2,?3,?3)", params![item_id, payload, timestamp])
            .map_err(|error| error.to_string())?;
    }
    Ok(VaultSummary { id: item_id, platform, username, updated_at: timestamp })
}

#[tauri::command]
pub fn delete_vault_item(app: tauri::AppHandle, state: tauri::State<SecurityState>, id: String) -> Result<(), String> {
    let master = state.vault_key_access()?;
    let connection = connect(&app).map_err(|error| error.to_string())?;
    vault_key(&connection, &master, false)?.ok_or("密码库密钥不存在")?;
    if connection.execute("DELETE FROM vault_items WHERE id=?1", [id]).map_err(|error| error.to_string())? == 0 {
        return Err("记录不存在".into());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn vault_key_and_record_are_bound_to_context() {
        let db = Connection::open_in_memory().unwrap();
        db.execute_batch("CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY, applied_at INTEGER NOT NULL);").unwrap();
        db.execute_batch(include_str!("../migrations/004_password_vault.sql")).unwrap();
        let master = [4_u8; 32];
        assert!(vault_key(&db, &master, false).unwrap().is_none());
        let key = vault_key(&db, &master, true).unwrap().unwrap();
        assert_eq!(key, vault_key(&db, &master, false).unwrap().unwrap());
        assert!(vault_key(&db, &[3_u8; 32], false).is_err());
        let encrypted = seal(&key, &item_context("a"), b"secret").unwrap();
        assert_eq!(open(&key, &item_context("a"), &encrypted).unwrap().as_slice(), b"secret");
        assert!(open(&key, &item_context("b"), &encrypted).is_err());
        let (old_salt, old_wrapped, old_nonce) = crate::security::wrap_data_key("old-password", &master).unwrap();
        let recovered = crate::security::unwrap_data_key("old-password", &old_salt, &old_wrapped, &old_nonce).unwrap();
        let (new_salt, new_wrapped, new_nonce) = crate::security::wrap_data_key("a-new-long-password", &recovered).unwrap();
        let recovered_after_change = crate::security::unwrap_data_key("a-new-long-password", &new_salt, &new_wrapped, &new_nonce).unwrap();
        let reopened = vault_key(&db, &recovered_after_change, false).unwrap().unwrap();
        assert_eq!(open(&reopened, &item_context("a"), &encrypted).unwrap().as_slice(), b"secret");
    }
}
