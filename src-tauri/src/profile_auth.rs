use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::Manager;

use crate::{cloud_backup, database, database_backup, security::SecurityState};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileAuthInput {
    username: String,
    password: String,
    #[serde(default)]
    legacy_password: String,
    #[serde(default)]
    recovery_key: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileAuthResult {
    account_id: String,
    username: String,
    cloud_connected: bool,
    cloud_error: Option<String>,
    recovery_key: Option<String>,
    migrated_legacy: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileAuthStatus {
    known_usernames: Vec<String>,
    legacy_data_available: bool,
}

struct LocalProfile {
    account_id: String,
    username: String,
    device_id: String,
}

fn identity_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let directory = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    std::fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    Ok(directory.join("identity.sqlite3"))
}

fn identity(app: &tauri::AppHandle) -> Result<Connection, String> {
    let connection = Connection::open(identity_path(app)?).map_err(|error| error.to_string())?;
    connection
        .execute_batch(
            "PRAGMA journal_mode=WAL;
             PRAGMA foreign_keys=ON;
             CREATE TABLE IF NOT EXISTS local_profiles(
               account_id TEXT PRIMARY KEY,
               username TEXT NOT NULL UNIQUE COLLATE NOCASE,
               device_id TEXT NOT NULL,
               created_at INTEGER NOT NULL,
               last_login_at INTEGER NOT NULL
             );
             CREATE TABLE IF NOT EXISTS identity_settings(
               key TEXT PRIMARY KEY,
               value TEXT NOT NULL,
               updated_at INTEGER NOT NULL
             );",
        )
        .map_err(|error| error.to_string())?;
    Ok(connection)
}

pub fn initialize(app: &tauri::AppHandle) -> Result<(), String> {
    identity(app).map(|_| ())?;
    database::deactivate_profile()
}

fn profile_by_username(
    connection: &Connection,
    username: &str,
) -> Result<Option<LocalProfile>, String> {
    connection
        .query_row(
            "SELECT account_id,username,device_id FROM local_profiles WHERE username=?1 COLLATE NOCASE",
            [username],
            |row| {
                Ok(LocalProfile {
                    account_id: row.get(0)?,
                    username: row.get(1)?,
                    device_id: row.get(2)?,
                })
            },
        )
        .optional()
        .map_err(|error| error.to_string())
}

fn legacy_available(app: &tauri::AppHandle, connection: &Connection) -> Result<bool, String> {
    let claimed: bool = connection
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM identity_settings WHERE key='legacy_claimed_account_id')",
            [],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())?;
    let path = database::legacy_path(app).map_err(|error| error.to_string())?;
    Ok(!claimed
        && path.is_file()
        && path
            .metadata()
            .map(|value| value.len() > 0)
            .unwrap_or(false))
}

fn remember_profile(
    connection: &Connection,
    account_id: &str,
    username: &str,
    device_id: &str,
) -> Result<(), String> {
    let timestamp = database::now();
    connection
        .execute(
            "INSERT INTO local_profiles(account_id,username,device_id,created_at,last_login_at)
             VALUES(?1,?2,?3,?4,?4)
             ON CONFLICT(account_id) DO UPDATE SET username=excluded.username,
               device_id=excluded.device_id,last_login_at=excluded.last_login_at",
            params![account_id, username, device_id, timestamp],
        )
        .map(|_| ())
        .map_err(|error| error.to_string())
}

fn mark_legacy_claimed(connection: &Connection, account_id: &str) -> Result<(), String> {
    connection
        .execute(
            "INSERT INTO identity_settings(key,value,updated_at)
             VALUES('legacy_claimed_account_id',?1,?2)
             ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at",
            params![account_id, database::now()],
        )
        .map(|_| ())
        .map_err(|error| error.to_string())
}

fn clear_failed_session(state: &SecurityState) {
    let _ = state.lock();
    let _ = database::deactivate_profile();
}

fn open_existing_profile(
    app: &tauri::AppHandle,
    state: &SecurityState,
    profile: &LocalProfile,
    password: &str,
) -> Result<bool, String> {
    state.lock()?;
    database::activate_profile(&profile.account_id)?;
    if let Err(error) = database::initialize(app) {
        clear_failed_session(state);
        return Err(format!("账号数据库升级失败，原数据保留：{error}"));
    }
    match crate::security::unlock_profile(app, state, password) {
        Ok(true) => Ok(true),
        Ok(false) => {
            clear_failed_session(state);
            Ok(false)
        }
        Err(error) => {
            clear_failed_session(state);
            Err(error)
        }
    }
}

fn create_profile(
    app: &tauri::AppHandle,
    state: &SecurityState,
    account_id: &str,
    password: &str,
    legacy_password: &str,
    migrate_legacy: bool,
) -> Result<bool, String> {
    state.lock()?;
    database::activate_profile(account_id)?;
    let target = database::path(app).map_err(|error| error.to_string())?;
    if target.exists() {
        database::initialize(app).map_err(|error| error.to_string())?;
        if crate::security::unlock_profile(app, state, password)? {
            return Ok(false);
        }
        clear_failed_session(state);
        return Err("该账号的本地数据库已经存在，但密码不匹配".into());
    }

    if migrate_legacy {
        let source = database::legacy_path(app).map_err(|error| error.to_string())?;
        if legacy_password.is_empty() {
            clear_failed_session(state);
            return Err("请输入原软件密码以迁移现有数据".into());
        }
        if !crate::security::database_password_valid(&source, legacy_password)? {
            clear_failed_session(state);
            return Err("原软件密码不正确".into());
        }
        if let Err(error) = database_backup::backup(&source, &target) {
            clear_failed_session(state);
            return Err(format!("旧数据迁移失败，原数据库未修改：{error}"));
        }
        if let Err(error) = database::initialize(app) {
            clear_failed_session(state);
            return Err(format!("迁移数据库升级失败，原数据库未修改：{error}"));
        }
        if !crate::security::rewrap_profile_password(app, state, legacy_password, password)? {
            clear_failed_session(state);
            return Err("原软件密码不正确".into());
        }
        Ok(true)
    } else {
        database::initialize(app).map_err(|error| error.to_string())?;
        crate::security::setup_profile_security(app, state, password)?;
        Ok(false)
    }
}

#[tauri::command]
pub fn get_profile_auth_status(app: tauri::AppHandle) -> Result<ProfileAuthStatus, String> {
    let connection = identity(&app)?;
    let mut statement = connection
        .prepare("SELECT username FROM local_profiles ORDER BY last_login_at DESC")
        .map_err(|error| error.to_string())?;
    let known_usernames = statement
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;
    Ok(ProfileAuthStatus {
        known_usernames,
        legacy_data_available: legacy_available(&app, &connection)?,
    })
}

async fn authenticate_new_or_remote_profile(
    app: &tauri::AppHandle,
    state: &SecurityState,
    input: &ProfileAuthInput,
    action: &str,
) -> Result<ProfileAuthResult, String> {
    let connection = identity(app)?;
    let username = input.username.trim().to_lowercase();
    if action == "register" && profile_by_username(&connection, &username)?.is_some() {
        return Err("该账号已在本机使用，请直接登录".into());
    }
    let local = profile_by_username(&connection, &username)?;
    let device_id = local
        .as_ref()
        .map(|value| value.device_id.clone())
        .unwrap_or_else(database::id);
    let session = cloud_backup::request_account_session(
        cloud_backup::DEFAULT_ENDPOINT,
        &username,
        &input.password,
        &device_id,
        action,
    )
    .await?;
    let migrate_legacy = local.is_none() && legacy_available(app, &connection)?;
    if local.is_none()
        && !migrate_legacy
        && action == "login"
        && cloud_backup::account_has_backups(cloud_backup::DEFAULT_ENDPOINT, &session).await?
        && input.recovery_key.chars().count() < 24
    {
        return Err("该账号已有云备份，请输入恢复密钥以便在新设备上恢复数据".into());
    }
    let migrated_legacy = if let Some(profile) = local.as_ref() {
        if profile.account_id != session.account_id {
            return Err("本机账号与云端账号标识不一致".into());
        }
        if !open_existing_profile(app, state, profile, &input.password)? {
            return Err("账号或密码不正确".into());
        }
        false
    } else {
        create_profile(
            app,
            state,
            &session.account_id,
            &input.password,
            &input.legacy_password,
            migrate_legacy,
        )?
    };
    remember_profile(
        &connection,
        &session.account_id,
        &session.username,
        &device_id,
    )?;
    if migrated_legacy {
        mark_legacy_claimed(&connection, &session.account_id)?;
    }
    let recovery_key = cloud_backup::install_account_session(
        app,
        state,
        cloud_backup::DEFAULT_ENDPOINT,
        device_id,
        &session,
        (!input.recovery_key.trim().is_empty()).then_some(input.recovery_key.trim()),
    )
    .await?;
    Ok(ProfileAuthResult {
        account_id: session.account_id,
        username: session.username,
        cloud_connected: true,
        cloud_error: None,
        recovery_key,
        migrated_legacy,
    })
}

#[tauri::command]
pub async fn register_profile(
    app: tauri::AppHandle,
    state: tauri::State<'_, SecurityState>,
    input: ProfileAuthInput,
) -> Result<ProfileAuthResult, String> {
    let result = authenticate_new_or_remote_profile(&app, &state, &input, "register").await;
    if result.is_err() {
        clear_failed_session(&state);
    }
    result
}

#[tauri::command]
pub async fn login_profile(
    app: tauri::AppHandle,
    state: tauri::State<'_, SecurityState>,
    input: ProfileAuthInput,
) -> Result<ProfileAuthResult, String> {
    let result = async {
        let connection = identity(&app)?;
        let username = input.username.trim().to_lowercase();
        let Some(profile) = profile_by_username(&connection, &username)? else {
            return authenticate_new_or_remote_profile(&app, &state, &input, "login").await;
        };
        if !open_existing_profile(&app, &state, &profile, &input.password)? {
            return Err("账号或密码不正确".into());
        }
        let session = cloud_backup::request_account_session(
            cloud_backup::DEFAULT_ENDPOINT,
            &username,
            &input.password,
            &profile.device_id,
            "login",
        )
        .await;
        let (cloud_connected, cloud_error, recovery_key) = match session {
            Ok(session) => {
                let recovery_key = cloud_backup::install_account_session(
                    &app,
                    &state,
                    cloud_backup::DEFAULT_ENDPOINT,
                    profile.device_id.clone(),
                    &session,
                    None,
                )
                .await?;
                (true, None, recovery_key)
            }
            Err(error) => (false, Some(error), None),
        };
        remember_profile(
            &connection,
            &profile.account_id,
            &profile.username,
            &profile.device_id,
        )?;
        Ok(ProfileAuthResult {
            account_id: profile.account_id,
            username: profile.username,
            cloud_connected,
            cloud_error,
            recovery_key,
            migrated_legacy: false,
        })
    }
    .await;
    if result.is_err() {
        clear_failed_session(&state);
    }
    result
}

#[tauri::command]
pub fn logout_profile(state: tauri::State<'_, SecurityState>) -> Result<(), String> {
    database::deactivate_profile()?;
    state.lock()
}

#[tauri::command]
pub async fn change_profile_password(
    app: tauri::AppHandle,
    state: tauri::State<'_, SecurityState>,
    current_password: String,
    new_password: String,
) -> Result<bool, String> {
    let _profile_guard = database::ProfileOperationGuard::acquire()?;
    let database_path = database::path(&app).map_err(|error| error.to_string())?;
    if !crate::security::database_password_valid(&database_path, &current_password)? {
        return Ok(false);
    }
    cloud_backup::change_account_password(&app, &state, &current_password, &new_password).await?;
    match crate::security::rewrap_profile_password(&app, &state, &current_password, &new_password) {
        Ok(value) => Ok(value),
        Err(error) => {
            let rollback = cloud_backup::change_account_password(
                &app,
                &state,
                &new_password,
                &current_password,
            )
            .await;
            if rollback.is_err() {
                Err(format!(
                    "本地密码更新失败，云端密码已改变；请使用新密码重试：{error}"
                ))
            } else {
                Err(format!("密码更新失败，云端修改已回滚：{error}"))
            }
        }
    }
}
