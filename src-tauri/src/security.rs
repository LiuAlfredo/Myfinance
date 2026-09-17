use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use argon2::{
    password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use rand::{rngs::OsRng, RngCore};
use rusqlite::{params, OptionalExtension};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use zeroize::Zeroizing;

use crate::database::{connect, now};

const MIN_PASSWORD_LENGTH: usize = 12;

pub struct SecurityState {
    data_key: Mutex<Option<Zeroizing<Vec<u8>>>>,
    vault_until: Mutex<Option<Instant>>,
}

impl SecurityState {
    pub fn new() -> Self {
        Self {
            data_key: Mutex::new(None),
            vault_until: Mutex::new(None),
        }
    }

    pub fn lock(&self) -> Result<(), String> {
        self.revoke_vault()?;
        let mut guard = self
            .data_key
            .lock()
            .map_err(|_| "安全状态不可用".to_string())?;
        *guard = None;
        Ok(())
    }

    fn revoke_vault(&self) -> Result<(), String> {
        *self.vault_until.lock().map_err(|_| "安全状态不可用".to_string())? = None;
        Ok(())
    }

    pub fn vault_key_access(&self) -> Result<Zeroizing<Vec<u8>>, String> {
        let key = self.key()?;
        let guard = self.vault_until.lock().map_err(|_| "安全状态不可用".to_string())?;
        if !guard.is_some_and(|until| Instant::now() < until) {
            return Err("密码库已锁定，请验证软件密码".into());
        }
        Ok(key)
    }

    fn grant_vault(&self) -> Result<(), String> {
        self.key()?;
        *self.vault_until.lock().map_err(|_| "安全状态不可用".to_string())? = Some(Instant::now() + Duration::from_secs(5 * 60));
        Ok(())
    }

    pub fn key(&self) -> Result<Zeroizing<Vec<u8>>, String> {
        let guard = self
            .data_key
            .lock()
            .map_err(|_| "安全状态不可用".to_string())?;
        guard
            .as_ref()
            .map(|key| Zeroizing::new(key.to_vec()))
            .ok_or_else(|| "私密数据已锁定，请重新登录".to_string())
    }

    fn unlock_with(&self, key: Vec<u8>) -> Result<(), String> {
        self.revoke_vault()?;
        let mut guard = self
            .data_key
            .lock()
            .map_err(|_| "安全状态不可用".to_string())?;
        *guard = Some(Zeroizing::new(key));
        Ok(())
    }
}

fn derive_wrapping_key(password: &str, salt: &[u8]) -> Result<Zeroizing<Vec<u8>>, String> {
    let mut output = Zeroizing::new(vec![0_u8; 32]);
    Argon2::default()
        .hash_password_into(password.as_bytes(), salt, &mut output)
        .map_err(|_| "密码派生失败".to_string())?;
    Ok(output)
}

fn password_hash(password: &str) -> Result<String, String> {
    let salt = SaltString::generate(&mut OsRng);
    Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map(|hash| hash.to_string())
        .map_err(|_| "密码保存失败".to_string())
}

fn password_is_valid(password: &str, encoded: &str) -> bool {
    PasswordHash::new(encoded)
        .ok()
        .and_then(|hash| {
            Argon2::default()
                .verify_password(password.as_bytes(), &hash)
                .ok()
        })
        .is_some()
}

pub(crate) fn wrap_data_key(password: &str, data_key: &[u8]) -> Result<(String, String, String), String> {
    let mut salt = [0_u8; 16];
    let mut nonce = [0_u8; 12];
    OsRng.fill_bytes(&mut salt);
    OsRng.fill_bytes(&mut nonce);
    let wrapping_key = derive_wrapping_key(password, &salt)?;
    let cipher =
        Aes256Gcm::new_from_slice(&wrapping_key).map_err(|_| "数据密钥初始化失败".to_string())?;
    let wrapped = cipher
        .encrypt(Nonce::from_slice(&nonce), data_key)
        .map_err(|_| "数据密钥加密失败".to_string())?;
    Ok((
        BASE64.encode(salt),
        BASE64.encode(wrapped),
        BASE64.encode(nonce),
    ))
}

pub(crate) fn unwrap_data_key(
    password: &str,
    salt: &str,
    wrapped: &str,
    nonce: &str,
) -> Result<Vec<u8>, String> {
    let salt = BASE64
        .decode(salt)
        .map_err(|_| "安全配置已损坏".to_string())?;
    let wrapped = BASE64
        .decode(wrapped)
        .map_err(|_| "安全配置已损坏".to_string())?;
    let nonce = BASE64
        .decode(nonce)
        .map_err(|_| "安全配置已损坏".to_string())?;
    if nonce.len() != 12 { return Err("安全配置已损坏".to_string()); }
    let wrapping_key = derive_wrapping_key(password, &salt)?;
    let cipher =
        Aes256Gcm::new_from_slice(&wrapping_key).map_err(|_| "数据密钥初始化失败".to_string())?;
    cipher
        .decrypt(Nonce::from_slice(&nonce), wrapped.as_ref())
        .map_err(|_| "密码不正确或安全配置已损坏".to_string())
}

fn initialize_security(app: &tauri::AppHandle, password: &str) -> Result<Vec<u8>, String> {
    if password.chars().count() < MIN_PASSWORD_LENGTH {
        return Err("软件密码至少需要 12 位".into());
    }
    let connection = connect(app).map_err(|error| error.to_string())?;
    let private_count: i64 = connection.query_row("SELECT COUNT(*) FROM private_calendar_events", [], |row| row.get(0))
        .map_err(|error| error.to_string())?;
    let vault_count: i64 = connection.query_row("SELECT COUNT(*) FROM vault_items", [], |row| row.get(0))
        .map_err(|error| error.to_string())?;
    let partner_count: i64 = connection.query_row("SELECT COUNT(*) FROM private_partners", [], |row| row.get(0))
        .map_err(|error| error.to_string())?;
    if private_count > 0 || partner_count > 0 || vault_count > 0 { return Err("存在私密记录，但安全配置缺失，不能初始化新密码".into()); }
    let mut data_key = vec![0_u8; 32];
    OsRng.fill_bytes(&mut data_key);
    let (wrap_salt, wrapped_data_key, wrap_nonce) = wrap_data_key(password, &data_key)?;
    let hash = password_hash(password)?;
    let timestamp = now();
    connection.execute(
        "INSERT INTO app_security(id,password_hash,wrap_salt,wrapped_data_key,wrap_nonce,created_at,updated_at) VALUES(1,?1,?2,?3,?4,?5,?5)",
        params![hash, wrap_salt, wrapped_data_key, wrap_nonce, timestamp],
    ).map_err(|error| error.to_string())?;
    Ok(data_key)
}

#[tauri::command]
pub fn app_password_setup_required(app: tauri::AppHandle) -> Result<bool, String> {
    let connection = connect(&app).map_err(|error| error.to_string())?;
    let exists: bool = connection.query_row("SELECT EXISTS(SELECT 1 FROM app_security WHERE id=1)", [], |row| row.get(0))
        .map_err(|error| error.to_string())?;
    Ok(!exists)
}

#[tauri::command]
pub fn setup_app_password(app: tauri::AppHandle, state: tauri::State<SecurityState>, password: String) -> Result<(), String> {
    let key = initialize_security(&app, &password)?;
    state.unlock_with(key)
}

#[tauri::command]
pub fn verify_app_password(
    app: tauri::AppHandle,
    state: tauri::State<SecurityState>,
    password: String,
) -> Result<bool, String> {
    let connection = connect(&app).map_err(|error| error.to_string())?;
    let security = connection.query_row(
        "SELECT password_hash,wrap_salt,wrapped_data_key,wrap_nonce FROM app_security WHERE id=1",
        [],
        |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?, row.get::<_, String>(2)?, row.get::<_, String>(3)?)),
    ).optional().map_err(|error| error.to_string())?;

    let data_key = match security {
        Some((hash, salt, wrapped, nonce)) => {
            if !password_is_valid(&password, &hash) {
                return Ok(false);
            }
            unwrap_data_key(&password, &salt, &wrapped, &nonce)?
        }
        None => return Ok(false),
    };
    state.unlock_with(data_key)?;
    Ok(true)
}

#[tauri::command]
pub fn change_app_password(
    app: tauri::AppHandle,
    state: tauri::State<SecurityState>,
    current_password: String,
    new_password: String,
) -> Result<bool, String> {
    if new_password.chars().count() < MIN_PASSWORD_LENGTH {
        return Err("新密码至少需要 12 位".to_string());
    }
    let connection = connect(&app).map_err(|error| error.to_string())?;
    let security = connection.query_row(
        "SELECT password_hash,wrap_salt,wrapped_data_key,wrap_nonce FROM app_security WHERE id=1",
        [],
        |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?, row.get::<_, String>(2)?, row.get::<_, String>(3)?)),
    ).optional().map_err(|error| error.to_string())?;
    let Some((hash, salt, wrapped, nonce)) = security else {
        return Err("安全配置尚未初始化".to_string());
    };
    if !password_is_valid(&current_password, &hash) {
        return Ok(false);
    }
    let data_key = unwrap_data_key(&current_password, &salt, &wrapped, &nonce)?;
    let (new_salt, new_wrapped, new_nonce) = wrap_data_key(&new_password, &data_key)?;
    let new_hash = password_hash(&new_password)?;
    connection.execute(
        "UPDATE app_security SET password_hash=?1,wrap_salt=?2,wrapped_data_key=?3,wrap_nonce=?4,updated_at=?5 WHERE id=1",
        params![new_hash, new_salt, new_wrapped, new_nonce, now()],
    ).map_err(|error| error.to_string())?;
    state.unlock_with(data_key)?;
    Ok(true)
}

#[tauri::command]
pub fn unlock_password_vault(
    app: tauri::AppHandle,
    state: tauri::State<SecurityState>,
    password: String,
) -> Result<bool, String> {
    state.key()?;
    if password.chars().count() < MIN_PASSWORD_LENGTH {
        return Err("请先在“软件密码”中将密码升级为至少 12 位，再启用密码库".into());
    }
    let connection = connect(&app).map_err(|error| error.to_string())?;
    let hash: String = connection.query_row(
        "SELECT password_hash FROM app_security WHERE id=1", [], |row| row.get(0),
    ).map_err(|error| error.to_string())?;
    if !password_is_valid(&password, &hash) { return Ok(false); }
    state.grant_vault()?;
    Ok(true)
}

#[tauri::command]
pub fn lock_password_vault(state: tauri::State<SecurityState>) -> Result<(), String> {
    state.revoke_vault()
}

#[tauri::command]
pub fn lock_private_data(state: tauri::State<SecurityState>) -> Result<(), String> {
    state.lock()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn locked_state_rejects_access_and_password_rewrapping_preserves_data_key() {
        let state = SecurityState::new();
        assert!(state.key().is_err());
        state.unlock_with(vec![42_u8; 32]).unwrap();
        let key = state.key().unwrap();
        let (salt, wrapped, nonce) = wrap_data_key("new-password", &key).unwrap();
        assert_eq!(unwrap_data_key("new-password", &salt, &wrapped, &nonce).unwrap(), key.to_vec());
        assert!(unwrap_data_key("old-password", &salt, &wrapped, &nonce).is_err());
        assert!(unwrap_data_key("new-password", &salt, &wrapped, &BASE64.encode([0_u8; 3])).is_err());
        state.lock().unwrap();
        assert!(state.key().is_err());
    }

    #[test]
    fn wrapping_key_requires_the_same_password() {
        let data_key = [42_u8; 32];
        let (salt, wrapped, nonce) =
            wrap_data_key("correct-password", &data_key).expect("key should wrap");
        let unwrapped = unwrap_data_key("correct-password", &salt, &wrapped, &nonce)
            .expect("key should unwrap");
        assert_eq!(unwrapped, data_key);
        assert!(unwrap_data_key("wrong-password", &salt, &wrapped, &nonce).is_err());
    }

    #[test]
    fn vault_requires_an_unlocked_session_and_expires_independently() {
        let state = SecurityState::new();
        assert!(state.grant_vault().is_err());
        state.unlock_with(vec![7_u8; 32]).unwrap();
        assert!(state.vault_key_access().is_err());
        state.grant_vault().unwrap();
        assert_eq!(state.vault_key_access().unwrap().as_slice(), &[7_u8; 32]);
        *state.vault_until.lock().unwrap() = Some(Instant::now() - Duration::from_secs(1));
        assert!(state.vault_key_access().is_err());
        state.grant_vault().unwrap();
        state.lock().unwrap();
        assert!(state.vault_key_access().is_err());
    }

    #[test]
    fn password_hash_does_not_store_plaintext() {
        let encoded = password_hash("123456").expect("password should hash");
        assert!(!encoded.contains("123456"));
        assert!(password_is_valid("123456", &encoded));
        assert!(!password_is_valid("123455", &encoded));
    }
}
