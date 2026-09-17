use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use hmac::{Hmac, Mac};
use rand::{rngs::OsRng, RngCore};
use rusqlite::params;
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use sha2::Sha256;
use std::collections::{BTreeMap, HashMap, HashSet};

use crate::{
    database::{connect, id, now},
    security::SecurityState,
};

type HmacSha256 = Hmac<Sha256>;

#[derive(Debug, Serialize, Deserialize)]
struct LegacyPartnerPayload {
    display_name: String,
    note: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PrivateCalendarEvent {
    pub id: String,
    pub occurred_at: i64,
    pub day_key: String,
    pub person_name: String,
    pub location: String,
    pub note: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PrivateCalendarEventInput {
    pub occurred_at: i64,
    pub day_key: String,
    pub person_name: String,
    #[serde(default)]
    pub location: String,
    #[serde(default)]
    pub note: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct EventPayload {
    occurred_at: i64,
    day_key: String,
    #[serde(default)]
    person_name: String,
    #[serde(default, skip_serializing_if = "String::is_empty")]
    partner_id: String,
    location: String,
    note: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PrivateCalendarDayMark {
    pub day_key: String,
    pub count: usize,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PrivateCalendarYearStats {
    year: i32,
    total: usize,
    active_days: usize,
    months: [usize; 12],
    first_day: String,
    last_day: String,
}

fn calendar_statistics(connection: &rusqlite::Connection, key: &[u8]) -> Result<Vec<PrivateCalendarYearStats>, String> {
    let mut statement = connection.prepare("SELECT payload FROM private_calendar_events")
        .map_err(|error| error.to_string())?;
    let rows = statement.query_map([], |row| row.get::<_, String>(0))
        .map_err(|error| error.to_string())?;
    let mut years: BTreeMap<i32, (PrivateCalendarYearStats, HashSet<String>)> = BTreeMap::new();
    for row in rows {
        let payload: EventPayload = decrypt_json(key, &row.map_err(|error| error.to_string())?)?;
        if !valid_day_key(&payload.day_key) { return Err("记录日期无效，无法统计".into()); }
        let year: i32 = payload.day_key[..4].parse().map_err(|_| "记录年份无效")?;
        let month: usize = payload.day_key[5..7].parse().map_err(|_| "记录月份无效")?;
        let (stats, days) = years.entry(year).or_insert_with(|| (PrivateCalendarYearStats {
            year, total: 0, active_days: 0, months: [0; 12],
            first_day: payload.day_key.clone(), last_day: payload.day_key.clone(),
        }, HashSet::new()));
        stats.total += 1;
        stats.months[month - 1] += 1;
        if payload.day_key < stats.first_day { stats.first_day = payload.day_key.clone(); }
        if payload.day_key > stats.last_day { stats.last_day = payload.day_key.clone(); }
        days.insert(payload.day_key);
        stats.active_days = days.len();
    }
    Ok(years.into_values().rev().map(|(stats, _)| stats).collect())
}

#[tauri::command]
pub fn get_private_calendar_statistics(app: tauri::AppHandle, state: tauri::State<SecurityState>) -> Result<Vec<PrivateCalendarYearStats>, String> {
    let key = state.key()?;
    let connection = connect(&app).map_err(|error| error.to_string())?;
    calendar_statistics(&connection, &key)
}

fn encrypt_json<T: Serialize>(key: &[u8], value: &T) -> Result<String, String> {
    let plaintext = serde_json::to_vec(value).map_err(|_| "私密记录序列化失败".to_string())?;
    let cipher = Aes256Gcm::new_from_slice(key).map_err(|_| "私密数据密钥无效".to_string())?;
    let mut nonce = [0_u8; 12];
    OsRng.fill_bytes(&mut nonce);
    let ciphertext = cipher
        .encrypt(Nonce::from_slice(&nonce), plaintext.as_ref())
        .map_err(|_| "私密记录加密失败".to_string())?;
    let mut encoded = nonce.to_vec();
    encoded.extend(ciphertext);
    Ok(BASE64.encode(encoded))
}

fn decrypt_json<T: DeserializeOwned>(key: &[u8], value: &str) -> Result<T, String> {
    let encoded = BASE64
        .decode(value)
        .map_err(|_| "私密记录格式无效".to_string())?;
    if encoded.len() <= 12 {
        return Err("私密记录格式无效".to_string());
    }
    let (nonce, ciphertext) = encoded.split_at(12);
    let cipher = Aes256Gcm::new_from_slice(key).map_err(|_| "私密数据密钥无效".to_string())?;
    let plaintext = cipher
        .decrypt(Nonce::from_slice(nonce), ciphertext)
        .map_err(|_| "私密记录无法解密".to_string())?;
    serde_json::from_slice(&plaintext).map_err(|_| "私密记录内容无效".to_string())
}

fn blind_index(key: &[u8], value: &str) -> Result<String, String> {
    let mut mac =
        <HmacSha256 as Mac>::new_from_slice(key).map_err(|_| "私密索引初始化失败".to_string())?;
    mac.update(b"my-personal-affairs/private-calendar/");
    mac.update(value.as_bytes());
    Ok(BASE64.encode(mac.finalize().into_bytes()))
}

fn valid_day_key(value: &str) -> bool {
    let parts = value.split('-').collect::<Vec<_>>();
    if parts.len() != 3 || parts[0].len() != 4 || parts[1].len() != 2 || parts[2].len() != 2 {
        return false;
    }
    if !parts
        .iter()
        .all(|part| part.bytes().all(|byte| byte.is_ascii_digit()))
    {
        return false;
    }
    let Some(year) = parts[0].parse::<i32>().ok() else {
        return false;
    };
    let Some(month) = parts[1].parse::<u32>().ok() else {
        return false;
    };
    let Some(day) = parts[2].parse::<u32>().ok() else {
        return false;
    };
    if !(1900..=9999).contains(&year) || !(1..=12).contains(&month) {
        return false;
    }
    let leap = year % 4 == 0 && (year % 100 != 0 || year % 400 == 0);
    let maximum = match month {
        2 if leap => 29,
        2 => 28,
        4 | 6 | 9 | 11 => 30,
        _ => 31,
    };
    (1..=maximum).contains(&day)
}

fn valid_record_time(day_key: &str, occurred_at: i64) -> bool {
    if !valid_day_key(day_key) { return false; }
    let year: i64 = day_key[..4].parse().unwrap_or(0);
    let month: usize = day_key[5..7].parse().unwrap_or(0);
    let day: i64 = day_key[8..10].parse().unwrap_or(0);
    let leap = year % 4 == 0 && (year % 100 != 0 || year % 400 == 0);
    let prior_month_days = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    let before = |y: i64| 365 * y + y / 4 - y / 100 + y / 400;
    let days = before(year - 1) - before(1969) + prior_month_days[month - 1] + day - 1
        + if leap && month > 2 { 1 } else { 0 };
    let midnight = days * 86_400_000;
    // Accept civil dates in all time zones, including historical dates before 1970.
    (midnight - 14 * 3_600_000..midnight + 38 * 3_600_000).contains(&occurred_at)
}

fn legacy_partner_map(
    connection: &rusqlite::Connection,
    key: &[u8],
) -> Result<HashMap<String, String>, String> {
    let mut statement = connection
        .prepare("SELECT id,payload FROM private_partners")
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(|error| error.to_string())?;
    let mut partners = HashMap::new();
    for row in rows {
        let (id, encrypted) = row.map_err(|error| error.to_string())?;
        let payload: LegacyPartnerPayload = decrypt_json(key, &encrypted)?;
        partners.insert(id, payload.display_name);
    }
    Ok(partners)
}

#[tauri::command]
pub fn get_private_calendar_month(
    app: tauri::AppHandle,
    state: tauri::State<SecurityState>,
    year: i32,
    month: u32,
) -> Result<Vec<PrivateCalendarDayMark>, String> {
    if !(1900..=9999).contains(&year) || !(1..=12).contains(&month) {
        return Err("月份无效".to_string());
    }
    let key = state.key()?;
    let month_key = format!("{year:04}-{month:02}");
    let month_index = blind_index(&key, &month_key)?;
    let connection = connect(&app).map_err(|error| error.to_string())?;
    let mut statement = connection
        .prepare("SELECT payload FROM private_calendar_events WHERE month_index=?1")
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([month_index], |row| row.get::<_, String>(0))
        .map_err(|error| error.to_string())?;
    let mut counts: HashMap<String, usize> = HashMap::new();
    for row in rows {
        let payload: EventPayload = decrypt_json(&key, &row.map_err(|error| error.to_string())?)?;
        *counts.entry(payload.day_key).or_default() += 1;
    }
    let mut marks = counts
        .into_iter()
        .map(|(day_key, count)| PrivateCalendarDayMark { day_key, count })
        .collect::<Vec<_>>();
    marks.sort_by(|left, right| left.day_key.cmp(&right.day_key));
    Ok(marks)
}

#[tauri::command]
pub fn get_private_calendar_day(
    app: tauri::AppHandle,
    state: tauri::State<SecurityState>,
    day_key: String,
) -> Result<Vec<PrivateCalendarEvent>, String> {
    if !valid_day_key(&day_key) {
        return Err("日期无效".to_string());
    }
    let key = state.key()?;
    let day_index = blind_index(&key, &day_key)?;
    let connection = connect(&app).map_err(|error| error.to_string())?;
    let legacy_partners = legacy_partner_map(&connection, &key)?;
    let mut statement = connection
        .prepare("SELECT id,payload FROM private_calendar_events WHERE day_index=?1")
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([day_index], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(|error| error.to_string())?;
    let mut events = Vec::new();
    for row in rows {
        let (id, encrypted) = row.map_err(|error| error.to_string())?;
        let payload: EventPayload = decrypt_json(&key, &encrypted)?;
        let person_name = if payload.person_name.is_empty() {
            legacy_partners
                .get(&payload.partner_id)
                .cloned()
                .unwrap_or_else(|| "未知姓名".to_string())
        } else {
            payload.person_name
        };
        events.push(PrivateCalendarEvent {
            id,
            occurred_at: payload.occurred_at,
            day_key: payload.day_key,
            person_name,
            location: payload.location,
            note: payload.note,
        });
    }
    events.sort_by_key(|event| event.occurred_at);
    Ok(events)
}

#[tauri::command]
pub fn save_private_calendar_event(
    app: tauri::AppHandle,
    state: tauri::State<SecurityState>,
    input: PrivateCalendarEventInput,
    id_opt: Option<String>,
) -> Result<PrivateCalendarEvent, String> {
    let key = state.key()?;
    let connection = connect(&app).map_err(|error| error.to_string())?;
    save_event(&connection, &key, input, id_opt)
}

fn save_event(connection: &rusqlite::Connection, key: &[u8], input: PrivateCalendarEventInput, id_opt: Option<String>) -> Result<PrivateCalendarEvent, String> {
    if !valid_record_time(&input.day_key, input.occurred_at) {
        return Err("日期或时间无效".to_string());
    }
    let person_name = input.person_name.trim();
    if person_name.is_empty() {
        return Err("请输入姓名".to_string());
    }
    if person_name.chars().count() > 80 {
        return Err("姓名不能超过 80 个字符".to_string());
    }
    if input.location.chars().count() > 500 || input.note.chars().count() > 5000 {
        return Err("地点或备注过长".into());
    }
    let payload = EventPayload {
        occurred_at: input.occurred_at,
        day_key: input.day_key.clone(),
        person_name: person_name.to_string(),
        partner_id: String::new(),
        location: input.location.trim().to_string(),
        note: input.note.trim().to_string(),
    };
    let encrypted = encrypt_json(key, &payload)?;
    let month_key = input
        .day_key
        .get(0..7)
        .ok_or_else(|| "日期无效".to_string())?;
    let month_index = blind_index(key, month_key)?;
    let day_index = blind_index(key, &input.day_key)?;
    let editing = id_opt.is_some();
    let event_id = id_opt.unwrap_or_else(id);
    let timestamp = now();
    let changed = connection.execute(
        if editing {
            "UPDATE private_calendar_events SET month_index=?2,day_index=?3,payload=?4,updated_at=?5 WHERE id=?1"
        } else {
            "INSERT INTO private_calendar_events(id,month_index,day_index,payload,created_at,updated_at) VALUES(?1,?2,?3,?4,?5,?5)"
        }, params![event_id, month_index, day_index, encrypted, timestamp],
    ).map_err(|error| error.to_string())?;
    if changed == 0 { return Err("记录已不存在，请刷新后重试".into()); }
    Ok(PrivateCalendarEvent {
        id: event_id,
        occurred_at: payload.occurred_at,
        day_key: payload.day_key,
        person_name: payload.person_name,
        location: payload.location,
        note: payload.note,
    })
}

#[tauri::command]
pub fn delete_private_calendar_event(
    app: tauri::AppHandle,
    state: tauri::State<SecurityState>,
    id: String,
) -> Result<(), String> {
    state.key()?;
    let connection = connect(&app).map_err(|error| error.to_string())?;
    let changed = connection
        .execute("DELETE FROM private_calendar_events WHERE id=?1", [id])
        .map_err(|error| error.to_string())?;
    if changed == 0 {
        return Err("记录不存在".to_string());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_database() -> rusqlite::Connection {
        let connection = rusqlite::Connection::open_in_memory().unwrap();
        connection.execute_batch("CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY,applied_at INTEGER NOT NULL);").unwrap();
        connection.execute_batch(include_str!("../migrations/002_private_calendar.sql")).unwrap();
        connection
    }

    fn input(day: &str, timestamp: i64) -> PrivateCalendarEventInput {
        PrivateCalendarEventInput { occurred_at: timestamp, day_key: day.into(), person_name: "private-person".into(), location: "private-place".into(), note: String::new() }
    }

    #[test]
    fn statistics_follow_multiple_records_moves_and_deletion() {
        let connection = test_database();
        let key = [9_u8; 32];
        assert!(calendar_statistics(&connection, &key).unwrap().is_empty());
        let first = save_event(&connection, &key, input("2024-02-29", 1_709_164_800_000), None).unwrap();
        save_event(&connection, &key, input("2024-02-29", 1_709_168_400_000), None).unwrap();
        let stats = calendar_statistics(&connection, &key).unwrap();
        assert_eq!(stats[0].total, 2);
        assert_eq!(stats[0].active_days, 1);
        assert_eq!(stats[0].months[1], 2);
        save_event(&connection, &key, input("2025-01-01", 1_735_689_600_000), Some(first.id.clone())).unwrap();
        let stats = calendar_statistics(&connection, &key).unwrap();
        assert_eq!(stats.iter().map(|row| (row.year, row.total)).collect::<Vec<_>>(), vec![(2025, 1), (2024, 1)]);
        let index: String = connection.query_row("SELECT day_index FROM private_calendar_events WHERE id=?1", [&first.id], |row| row.get(0)).unwrap();
        assert_eq!(index, blind_index(&key, "2025-01-01").unwrap());
        let encrypted: String = connection.query_row("SELECT payload FROM private_calendar_events WHERE id=?1", [&first.id], |row| row.get(0)).unwrap();
        assert!(!encrypted.contains("private-person"));
        assert!(calendar_statistics(&connection, &[0_u8; 32]).is_err());
        connection.execute("DELETE FROM private_calendar_events WHERE id=?1", [&first.id]).unwrap();
        let stats = calendar_statistics(&connection, &key).unwrap();
        assert_eq!(stats.len(), 1);
        assert_eq!(stats[0].year, 2024);
        assert!(save_event(&connection, &key, input("2025-01-01", 1_735_689_600_000), Some(first.id)).is_err());
    }

    #[test]
    fn rejects_mismatched_timestamps_and_accepts_pre_epoch_history() {
        assert!(valid_record_time("1960-01-01", -315_619_200_000));
        assert!(!valid_record_time("2024-02-29", 1_735_689_600_000));
        assert!(!valid_record_time("2023-02-29", 1_735_689_600_000));
        assert!(!valid_record_time("2024-02-29", i64::MAX));
    }

    #[test]
    fn validates_real_calendar_days() {
        assert!(valid_day_key("2028-02-29"));
        assert!(!valid_day_key("2027-02-29"));
        assert!(!valid_day_key("2026-13-01"));
        assert!(!valid_day_key("日期不正确"));
    }

    #[test]
    fn encrypted_payload_round_trips_without_plaintext() {
        let key = [7_u8; 32];
        let payload = EventPayload {
            occurred_at: 1_800_000_000_000,
            day_key: "2027-01-15".to_string(),
            person_name: "person-secret".to_string(),
            partner_id: String::new(),
            location: "private-place".to_string(),
            note: "private-note".to_string(),
        };
        let encrypted = encrypt_json(&key, &payload).expect("payload should encrypt");
        assert!(!encrypted.contains("private-place"));
        assert!(!encrypted.contains("person-secret"));
        let decrypted: EventPayload =
            decrypt_json(&key, &encrypted).expect("payload should decrypt");
        assert_eq!(decrypted.day_key, payload.day_key);
        assert_eq!(decrypted.location, payload.location);
    }

    #[test]
    fn legacy_partner_event_payload_still_deserializes() {
        let legacy = serde_json::json!({
            "occurred_at": 1_800_000_000_000_i64,
            "day_key": "2027-01-15",
            "partner_id": "legacy-partner",
            "location": "",
            "note": ""
        });
        let payload: EventPayload =
            serde_json::from_value(legacy).expect("legacy payload should remain readable");
        assert!(payload.person_name.is_empty());
        assert_eq!(payload.partner_id, "legacy-partner");
    }

    #[test]
    fn blind_indexes_are_keyed_and_deterministic() {
        let first = blind_index(&[1_u8; 32], "2027-01-15").expect("index should build");
        let repeated = blind_index(&[1_u8; 32], "2027-01-15").expect("index should build");
        let other_key = blind_index(&[2_u8; 32], "2027-01-15").expect("index should build");
        assert_eq!(first, repeated);
        assert_ne!(first, other_key);
        assert!(!first.contains("2027-01-15"));
    }
}
