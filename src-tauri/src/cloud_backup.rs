use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use argon2::Argon2;
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use rand::{rngs::OsRng, RngCore};
use reqwest::{Client, StatusCode, Url};
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    path::PathBuf,
    sync::atomic::{AtomicBool, Ordering},
    time::Duration,
};
use zeroize::Zeroizing;

use crate::{
    backup_management::BackupPreview,
    database::{connect, id, now},
    security::SecurityState,
};

const CONFIG_KEY: &str = "cloud_backup_config";
const LAST_ERROR_KEY: &str = "cloud_backup_last_error";
const LAST_SUCCESS_KEY: &str = "cloud_backup_last_success";
const LAST_REVISION_KEY: &str = "cloud_backup_last_revision";
const POLICY_KEY: &str = "cloud_backup_policy";
const MAGIC: &[u8; 8] = b"MFCLD1\0\0";
const MAX_DOWNLOAD_BYTES: usize = 20 * 1024 * 1024;
const MIN_RECOVERY_KEY_LENGTH: usize = 24;
static CLOUD_BACKUP_RUNNING: AtomicBool = AtomicBool::new(false);

struct BackupRunGuard;

impl BackupRunGuard {
    fn acquire() -> Result<Self, String> {
        CLOUD_BACKUP_RUNNING
            .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
            .map(|_| Self)
            .map_err(|_| "云备份正在执行".to_string())
    }
}

impl Drop for BackupRunGuard {
    fn drop(&mut self) {
        CLOUD_BACKUP_RUNNING.store(false, Ordering::Release);
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CloudConfigInput {
    endpoint: String,
    recovery_key: String,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StoredCloudConfig {
    endpoint: String,
    device_id: String,
    encrypted_recovery_key: String,
    nonce: String,
}

struct CloudConfig {
    endpoint: String,
    device_id: String,
    recovery_key: Zeroizing<String>,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CloudBackupPolicy {
    enabled: bool,
    interval_hours: i64,
    retain: usize,
    protect_hours: i64,
}

impl Default for CloudBackupPolicy {
    fn default() -> Self {
        Self {
            enabled: true,
            interval_hours: 24,
            retain: 10,
            protect_hours: 24,
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CloudBackupStatus {
    configured: bool,
    endpoint: Option<String>,
    device_id: Option<String>,
    last_success: Option<i64>,
    last_error: Option<String>,
    policy: CloudBackupPolicy,
    next_at: Option<i64>,
    current_revision: i64,
    last_backup_revision: i64,
    running: bool,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CloudBackupRecord {
    id: String,
    device_id: String,
    created_at: i64,
    uploaded_at: i64,
    encrypted_size: i64,
    source_size: i64,
    schema_version: i64,
    checksum: String,
    backup_kind: String,
    pinned: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CleanupResult {
    deleted_ids: Vec<String>,
    candidate_ids: Vec<String>,
}

#[derive(Deserialize)]
struct BackupList {
    backups: Vec<CloudBackupRecord>,
}

fn setting(app: &tauri::AppHandle, key: &str) -> Result<Option<String>, String> {
    connect(app)
        .map_err(|error| error.to_string())?
        .query_row("SELECT value FROM settings WHERE key=?1", [key], |row| {
            row.get(0)
        })
        .optional()
        .map_err(|error| error.to_string())
}

fn put_setting(app: &tauri::AppHandle, key: &str, value: &str) -> Result<(), String> {
    connect(app)
        .map_err(|error| error.to_string())?
        .execute(
            "INSERT INTO settings(key,value,updated_at) VALUES(?1,?2,?3) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at",
            params![key, value, now()],
        )
        .map(|_| ())
        .map_err(|error| error.to_string())
}

fn policy(app: &tauri::AppHandle) -> Result<CloudBackupPolicy, String> {
    setting(app, POLICY_KEY)?
        .map(|value| serde_json::from_str(&value).map_err(|error| error.to_string()))
        .transpose()
        .map(|value| value.unwrap_or_default())
}

fn validate_policy(value: &CloudBackupPolicy) -> Result<(), String> {
    if !(1..=168).contains(&value.interval_hours)
        || !(1..=100).contains(&value.retain)
        || !(1..=720).contains(&value.protect_hours)
    {
        return Err("自动备份间隔须为 1–168 小时，保留 1–100 份，保护期 1–720 小时".into());
    }
    Ok(())
}

fn current_revision(app: &tauri::AppHandle) -> Result<i64, String> {
    connect(app)
        .map_err(|error| error.to_string())?
        .query_row(
            "SELECT revision FROM cloud_change_state WHERE id=1",
            [],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())
}

fn normalize_endpoint(raw: &str) -> Result<String, String> {
    let mut url = Url::parse(raw.trim()).map_err(|_| "云端地址格式无效".to_string())?;
    if url.scheme() != "https" && !(url.scheme() == "http" && url.host_str() == Some("127.0.0.1")) {
        return Err("云端地址必须使用 HTTPS".into());
    }
    if url.query().is_some() || url.fragment().is_some() {
        return Err("云端地址不能包含查询参数或片段".into());
    }
    let path = url.path().trim_end_matches('/').to_string();
    url.set_path(&path);
    Ok(url.to_string().trim_end_matches('/').to_string())
}

fn encrypt_secret(secret: &[u8], key: &[u8]) -> Result<(String, String), String> {
    let mut nonce = [0_u8; 12];
    OsRng.fill_bytes(&mut nonce);
    let cipher = Aes256Gcm::new_from_slice(key).map_err(|_| "云备份密钥初始化失败")?;
    let ciphertext = cipher
        .encrypt(Nonce::from_slice(&nonce), secret)
        .map_err(|_| "云备份配置加密失败")?;
    Ok((
        URL_SAFE_NO_PAD.encode(ciphertext),
        URL_SAFE_NO_PAD.encode(nonce),
    ))
}

fn decrypt_secret(ciphertext: &str, nonce: &str, key: &[u8]) -> Result<Zeroizing<String>, String> {
    let ciphertext = URL_SAFE_NO_PAD
        .decode(ciphertext)
        .map_err(|_| "云备份配置已损坏")?;
    let nonce = URL_SAFE_NO_PAD
        .decode(nonce)
        .map_err(|_| "云备份配置已损坏")?;
    if nonce.len() != 12 {
        return Err("云备份配置已损坏".into());
    }
    let cipher = Aes256Gcm::new_from_slice(key).map_err(|_| "云备份密钥初始化失败")?;
    let plaintext = cipher
        .decrypt(Nonce::from_slice(&nonce), ciphertext.as_ref())
        .map_err(|_| "无法解密云备份配置，请重新登录")?;
    String::from_utf8(plaintext)
        .map(Zeroizing::new)
        .map_err(|_| "云备份配置已损坏".into())
}

fn load_config(app: &tauri::AppHandle, state: &SecurityState) -> Result<CloudConfig, String> {
    let raw = setting(app, CONFIG_KEY)?.ok_or("请先配置云备份")?;
    let stored: StoredCloudConfig = serde_json::from_str(&raw).map_err(|_| "云备份配置已损坏")?;
    let recovery_key =
        decrypt_secret(&stored.encrypted_recovery_key, &stored.nonce, &state.key()?)?;
    Ok(CloudConfig {
        endpoint: normalize_endpoint(&stored.endpoint)?,
        device_id: stored.device_id,
        recovery_key,
    })
}

fn derive_backup_key(recovery_key: &str, salt: &[u8]) -> Result<Zeroizing<Vec<u8>>, String> {
    let mut key = Zeroizing::new(vec![0_u8; 32]);
    Argon2::default()
        .hash_password_into(recovery_key.as_bytes(), salt, &mut key)
        .map_err(|_| "云备份密钥派生失败".to_string())?;
    Ok(key)
}

fn encrypt_backup(plaintext: &[u8], recovery_key: &str) -> Result<Vec<u8>, String> {
    let mut salt = [0_u8; 16];
    let mut nonce = [0_u8; 12];
    OsRng.fill_bytes(&mut salt);
    OsRng.fill_bytes(&mut nonce);
    let key = derive_backup_key(recovery_key, &salt)?;
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|_| "云备份加密初始化失败")?;
    let ciphertext = cipher
        .encrypt(Nonce::from_slice(&nonce), plaintext)
        .map_err(|_| "云备份加密失败")?;
    let mut result = Vec::with_capacity(MAGIC.len() + salt.len() + nonce.len() + ciphertext.len());
    result.extend_from_slice(MAGIC);
    result.extend_from_slice(&salt);
    result.extend_from_slice(&nonce);
    result.extend_from_slice(&ciphertext);
    Ok(result)
}

fn decrypt_backup(payload: &[u8], recovery_key: &str) -> Result<Vec<u8>, String> {
    let header = MAGIC.len() + 16 + 12;
    if payload.len() <= header || &payload[..MAGIC.len()] != MAGIC {
        return Err("云备份文件格式无效".into());
    }
    let salt = &payload[MAGIC.len()..MAGIC.len() + 16];
    let nonce = &payload[MAGIC.len() + 16..header];
    let key = derive_backup_key(recovery_key, salt)?;
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|_| "云备份解密初始化失败")?;
    cipher
        .decrypt(Nonce::from_slice(nonce), &payload[header..])
        .map_err(|_| "恢复密钥不正确或云备份已损坏".into())
}

fn client() -> Result<Client, String> {
    Client::builder()
        .timeout(Duration::from_secs(60))
        .build()
        .map_err(|error| error.to_string())
}

async fn response_error(response: reqwest::Response) -> String {
    let status = response.status();
    let body = response.text().await.unwrap_or_default();
    if status == StatusCode::UNAUTHORIZED {
        "恢复密钥与云端配置不匹配".into()
    } else if body.is_empty() {
        format!("云端请求失败：{status}")
    } else {
        format!("云端请求失败：{status} {body}")
    }
}

async fn download(
    app: &tauri::AppHandle,
    state: &SecurityState,
    backup_id: &str,
) -> Result<Vec<u8>, String> {
    let config = load_config(app, state)?;
    if !backup_id
        .chars()
        .all(|value| value.is_ascii_hexdigit() || value == '-')
        || backup_id.len() != 36
    {
        return Err("云备份编号无效".into());
    }
    let response = client()?
        .get(format!("{}/v1/backups/{backup_id}", config.endpoint))
        .bearer_auth(config.recovery_key.as_str())
        .send()
        .await
        .map_err(|error| format!("无法连接云端：{error}"))?;
    if !response.status().is_success() {
        return Err(response_error(response).await);
    }
    if response
        .content_length()
        .is_some_and(|size| size as usize > MAX_DOWNLOAD_BYTES)
    {
        return Err("云备份超过 20 MiB 安全限制".into());
    }
    let encrypted = response.bytes().await.map_err(|error| error.to_string())?;
    if encrypted.len() > MAX_DOWNLOAD_BYTES {
        return Err("云备份超过 20 MiB 安全限制".into());
    }
    decrypt_backup(&encrypted, config.recovery_key.as_str())
}

fn temporary_path(app: &tauri::AppHandle, name: &str) -> Result<PathBuf, String> {
    let directory = crate::database::path(app)
        .map_err(|error| error.to_string())?
        .parent()
        .ok_or("数据目录不可用")?
        .join("cloud-staging");
    std::fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    Ok(directory.join(name))
}

#[tauri::command]
pub fn generate_cloud_recovery_key() -> String {
    let mut bytes = [0_u8; 32];
    OsRng.fill_bytes(&mut bytes);
    URL_SAFE_NO_PAD.encode(bytes)
}

#[tauri::command]
pub fn save_cloud_backup_config(
    app: tauri::AppHandle,
    state: tauri::State<SecurityState>,
    input: CloudConfigInput,
) -> Result<(), String> {
    let endpoint = normalize_endpoint(&input.endpoint)?;
    let recovery_key = Zeroizing::new(input.recovery_key.trim().to_string());
    if recovery_key.chars().count() < MIN_RECOVERY_KEY_LENGTH {
        return Err("恢复密钥至少需要 24 位".into());
    }
    let existing = setting(&app, CONFIG_KEY)?
        .and_then(|raw| serde_json::from_str::<StoredCloudConfig>(&raw).ok());
    let device_id = existing.map(|value| value.device_id).unwrap_or_else(id);
    let (encrypted_recovery_key, nonce) = encrypt_secret(recovery_key.as_bytes(), &state.key()?)?;
    let stored = StoredCloudConfig {
        endpoint,
        device_id,
        encrypted_recovery_key,
        nonce,
    };
    put_setting(
        &app,
        CONFIG_KEY,
        &serde_json::to_string(&stored).map_err(|error| error.to_string())?,
    )
}

#[tauri::command]
pub fn get_cloud_backup_status(app: tauri::AppHandle) -> Result<CloudBackupStatus, String> {
    let stored = setting(&app, CONFIG_KEY)?
        .and_then(|raw| serde_json::from_str::<StoredCloudConfig>(&raw).ok());
    let policy = policy(&app)?;
    let last_success = setting(&app, LAST_SUCCESS_KEY)?.and_then(|value| value.parse().ok());
    let last_backup_revision = setting(&app, LAST_REVISION_KEY)?
        .and_then(|value| value.parse().ok())
        .unwrap_or(-1);
    Ok(CloudBackupStatus {
        configured: stored.is_some(),
        endpoint: stored.as_ref().map(|value| value.endpoint.clone()),
        device_id: stored.as_ref().map(|value| value.device_id.clone()),
        last_success,
        last_error: setting(&app, LAST_ERROR_KEY)?.filter(|value| !value.is_empty()),
        next_at: if policy.enabled {
            last_success.map(|value| value + policy.interval_hours * 3_600_000)
        } else {
            None
        },
        policy,
        current_revision: current_revision(&app)?,
        last_backup_revision,
        running: CLOUD_BACKUP_RUNNING.load(Ordering::Acquire),
    })
}

#[tauri::command]
pub fn save_cloud_backup_policy(
    app: tauri::AppHandle,
    input: CloudBackupPolicy,
) -> Result<(), String> {
    validate_policy(&input)?;
    put_setting(
        &app,
        POLICY_KEY,
        &serde_json::to_string(&input).map_err(|error| error.to_string())?,
    )
}

#[tauri::command]
pub async fn test_cloud_backup(
    app: tauri::AppHandle,
    state: tauri::State<'_, SecurityState>,
) -> Result<(), String> {
    let config = load_config(&app, &state)?;
    let response = client()?
        .get(format!("{}/v1/backups", config.endpoint))
        .bearer_auth(config.recovery_key.as_str())
        .send()
        .await
        .map_err(|error| format!("无法连接云端：{error}"))?;
    if response.status().is_success() {
        Ok(())
    } else {
        Err(response_error(response).await)
    }
}

#[tauri::command]
pub async fn list_cloud_backups(
    app: tauri::AppHandle,
    state: tauri::State<'_, SecurityState>,
) -> Result<Vec<CloudBackupRecord>, String> {
    let config = load_config(&app, &state)?;
    let response = client()?
        .get(format!("{}/v1/backups", config.endpoint))
        .bearer_auth(config.recovery_key.as_str())
        .send()
        .await
        .map_err(|error| format!("无法连接云端：{error}"))?;
    if !response.status().is_success() {
        return Err(response_error(response).await);
    }
    response
        .json::<BackupList>()
        .await
        .map(|value| value.backups)
        .map_err(|_| "云端返回了无效的备份列表".into())
}

async fn run_cleanup(
    app: &tauri::AppHandle,
    state: &SecurityState,
    dry_run: bool,
) -> Result<CleanupResult, String> {
    let config = load_config(app, state)?;
    let policy = policy(app)?;
    let path = if dry_run {
        "cleanup-preview"
    } else {
        "cleanup"
    };
    let response = client()?
        .post(format!("{}/v1/backups/{path}", config.endpoint))
        .bearer_auth(config.recovery_key.as_str())
        .json(&serde_json::json!({
            "deviceId": config.device_id,
            "retain": policy.retain,
            "protectHours": policy.protect_hours,
        }))
        .send()
        .await
        .map_err(|error| format!("无法连接云端：{error}"))?;
    if !response.status().is_success() {
        return Err(response_error(response).await);
    }
    response
        .json()
        .await
        .map_err(|_| "云端返回了无效的清理结果".into())
}

async fn upload_cloud_backup_kind(
    app: &tauri::AppHandle,
    state: &SecurityState,
    backup_kind: &str,
) -> Result<CloudBackupRecord, String> {
    let _guard = BackupRunGuard::acquire()?;
    let result = async {
        let config = load_config(app, state)?;
        let backup_id = id();
        let created_at = now();
        let revision = current_revision(app)?;
        let snapshot = temporary_path(app, &format!("upload-{backup_id}.sqlite3"))?;
        let source = crate::database::path(app).map_err(|error| error.to_string())?;
        crate::database_backup::backup(&source, &snapshot)?;
        let plaintext = std::fs::read(&snapshot).map_err(|error| error.to_string())?;
        let _ = std::fs::remove_file(&snapshot);
        let encrypted = encrypt_backup(&plaintext, config.recovery_key.as_str())?;
        if encrypted.len() > MAX_DOWNLOAD_BYTES {
            return Err("当前数据库加密后超过 20 MiB 云备份限制".into());
        }
        let checksum = format!("{:x}", Sha256::digest(&encrypted));
        let mut response = None;
        for attempt in 0..3 {
            match client()?
                .post(format!("{}/v1/backups", config.endpoint))
                .bearer_auth(config.recovery_key.as_str())
                .header("x-backup-id", &backup_id)
                .header("x-device-id", &config.device_id)
                .header("x-created-at", created_at)
                .header("x-source-size", plaintext.len())
                .header("x-schema-version", 9)
                .header("x-checksum", &checksum)
                .header("x-backup-kind", backup_kind)
                .body(encrypted.clone())
                .send()
                .await
            {
                Ok(value) if value.status().is_success() => {
                    response = Some(value);
                    break;
                }
                Ok(value) if value.status().is_server_error() && attempt < 2 => {}
                Ok(value) => return Err(response_error(value).await),
                Err(_) if attempt < 2 => {}
                Err(error) => return Err(format!("无法连接云端：{error}")),
            }
            tokio::time::sleep(Duration::from_millis(500 * (attempt + 1))).await;
        }
        response.ok_or("云备份上传失败")?;
        let record = CloudBackupRecord {
            id: backup_id,
            device_id: config.device_id,
            created_at,
            uploaded_at: now(),
            encrypted_size: encrypted.len() as i64,
            source_size: plaintext.len() as i64,
            schema_version: 9,
            checksum,
            backup_kind: backup_kind.to_string(),
            pinned: false,
        };
        put_setting(app, LAST_REVISION_KEY, &revision.to_string())?;
        Ok(record)
    }
    .await;
    match &result {
        Ok(_) => {
            put_setting(app, LAST_SUCCESS_KEY, &now().to_string())?;
            match run_cleanup(app, state, false).await {
                Ok(_) => put_setting(app, LAST_ERROR_KEY, "")?,
                Err(error) => put_setting(
                    app,
                    LAST_ERROR_KEY,
                    &format!("备份成功，旧备份清理失败：{error}"),
                )?,
            }
        }
        Err(error) => put_setting(app, LAST_ERROR_KEY, error)?,
    }
    result
}

#[tauri::command]
pub async fn upload_cloud_backup(
    app: tauri::AppHandle,
    state: tauri::State<'_, SecurityState>,
) -> Result<CloudBackupRecord, String> {
    upload_cloud_backup_kind(&app, &state, "MANUAL").await
}

#[tauri::command]
pub async fn run_automatic_cloud_backup(
    app: tauri::AppHandle,
    state: tauri::State<'_, SecurityState>,
    force: bool,
) -> Result<Option<CloudBackupRecord>, String> {
    let policy = policy(&app)?;
    if !policy.enabled || setting(&app, CONFIG_KEY)?.is_none() || state.key().is_err() {
        return Ok(None);
    }
    let revision = current_revision(&app)?;
    let last_revision = setting(&app, LAST_REVISION_KEY)?
        .and_then(|value| value.parse().ok())
        .unwrap_or(-1);
    let last_success = setting(&app, LAST_SUCCESS_KEY)?
        .and_then(|value| value.parse().ok())
        .unwrap_or(0);
    if !force
        && (revision <= last_revision || now() - last_success < policy.interval_hours * 3_600_000)
    {
        return Ok(None);
    }
    upload_cloud_backup_kind(&app, &state, "AUTO")
        .await
        .map(Some)
}

#[tauri::command]
pub async fn cleanup_cloud_backups(
    app: tauri::AppHandle,
    state: tauri::State<'_, SecurityState>,
    dry_run: bool,
) -> Result<Vec<String>, String> {
    run_cleanup(&app, &state, dry_run).await.map(|result| {
        if dry_run {
            result.candidate_ids
        } else {
            result.deleted_ids
        }
    })
}

#[tauri::command]
pub async fn set_cloud_backup_pinned(
    app: tauri::AppHandle,
    state: tauri::State<'_, SecurityState>,
    backup_id: String,
    pinned: bool,
) -> Result<(), String> {
    let config = load_config(&app, &state)?;
    let response = client()?
        .patch(format!("{}/v1/backups/{backup_id}", config.endpoint))
        .bearer_auth(config.recovery_key.as_str())
        .json(&serde_json::json!({ "pinned": pinned }))
        .send()
        .await
        .map_err(|error| format!("无法连接云端：{error}"))?;
    if response.status().is_success() {
        Ok(())
    } else {
        Err(response_error(response).await)
    }
}

#[tauri::command]
pub async fn delete_cloud_backup(
    app: tauri::AppHandle,
    state: tauri::State<'_, SecurityState>,
    backup_id: String,
) -> Result<(), String> {
    let config = load_config(&app, &state)?;
    let response = client()?
        .delete(format!("{}/v1/backups/{backup_id}", config.endpoint))
        .bearer_auth(config.recovery_key.as_str())
        .send()
        .await
        .map_err(|error| format!("无法连接云端：{error}"))?;
    if response.status().is_success() {
        Ok(())
    } else {
        Err(response_error(response).await)
    }
}

async fn materialize_backup(
    app: &tauri::AppHandle,
    state: &SecurityState,
    backup_id: &str,
) -> Result<PathBuf, String> {
    let plaintext = download(app, state, backup_id).await?;
    let path = temporary_path(app, &format!("restore-{backup_id}.sqlite3"))?;
    std::fs::write(&path, plaintext).map_err(|error| error.to_string())?;
    let connection =
        rusqlite::Connection::open_with_flags(&path, rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY)
            .map_err(|_| "云备份不是有效的 SQLite 数据库")?;
    crate::database_backup::validate_snapshot(&connection)?;
    Ok(path)
}

#[tauri::command]
pub async fn preview_cloud_backup(
    app: tauri::AppHandle,
    state: tauri::State<'_, SecurityState>,
    backup_id: String,
) -> Result<BackupPreview, String> {
    let path = materialize_backup(&app, &state, &backup_id).await?;
    let result = crate::backup_management::preview_path(&path);
    let _ = std::fs::remove_file(path);
    result
}

#[tauri::command]
pub async fn restore_cloud_backup(
    app: tauri::AppHandle,
    state: tauri::State<'_, SecurityState>,
    backup_id: String,
) -> Result<(), String> {
    let path = materialize_backup(&app, &state, &backup_id).await?;
    let current = crate::database::path(&app).map_err(|error| error.to_string())?;
    let result = crate::database_backup::restore(&current, &path);
    let _ = std::fs::remove_file(path);
    result?;
    state.lock()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encrypted_backup_round_trip_and_wrong_key_rejected() {
        let original = b"SQLite format 3 encrypted snapshot";
        let encrypted = encrypt_backup(original, "a-long-recovery-key-used-for-testing").unwrap();
        assert!(!encrypted
            .windows(original.len())
            .any(|part| part == original));
        assert_eq!(
            decrypt_backup(&encrypted, "a-long-recovery-key-used-for-testing").unwrap(),
            original
        );
        assert!(decrypt_backup(&encrypted, "a-different-recovery-key-for-test").is_err());
    }

    #[test]
    fn rejects_plaintext_and_insecure_remote_endpoint() {
        assert!(
            decrypt_backup(b"SQLite format 3", "a-long-recovery-key-used-for-testing").is_err()
        );
        assert!(normalize_endpoint("http://example.com").is_err());
        assert_eq!(
            normalize_endpoint("https://example.workers.dev/").unwrap(),
            "https://example.workers.dev"
        );
    }
}
