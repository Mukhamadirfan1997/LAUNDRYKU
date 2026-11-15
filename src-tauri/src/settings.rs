use std::path::{Path, PathBuf};

use serde::Serialize;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use sqlx::{Sqlite, SqlitePool, Transaction};
use tauri::{AppHandle, Manager, State};
use tauri_plugin_sql::{DbInstances, DbPool};
use uuid::Uuid;

use crate::audit;
use crate::auth::{self, AuthState};
use crate::validation::{
    validate_optional_text, validate_phone, validate_text,
};

const DB_URL: &str = "sqlite:laundryku.db";
const DB_FILE_NAME: &str = "laundryku.db";
const REQUIRED_TABLES: [&str; 13] = [
    "_sqlx_migrations",
    "activity_logs",
    "business_profile",
    "customers",
    "employees",
    "expense_categories",
    "expenses",
    "items",
    "order_items",
    "orders",
    "payments",
    "services",
    "users",
];

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupSnapshot {
    pub path: String,
    pub size_bytes: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupInfo {
    pub path: String,
    pub file_name: String,
    pub size_bytes: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RestoreInfo {
    pub path: String,
    pub file_name: String,
    pub users: i64,
    pub orders: i64,
    pub expenses: i64,
}

fn active_value(is_active: bool) -> i64 {
    if is_active { 1 } else { 0 }
}

fn validate_position(value: &str) -> Result<String, String> {
    match value.trim() {
        "Admin" => Ok("Admin".to_string()),
        "Operator" => Ok("Operator".to_string()),
        "Kasir" => Ok("Kasir".to_string()),
        _ => Err("Jabatan pegawai tidak valid.".to_string()),
    }
}

fn role_for_position(position: &str) -> &'static str {
    match position {
        "Admin" => "admin",
        "Kasir" => "kasir",
        _ => "operator",
    }
}

fn validate_username(value: &str) -> Result<String, String> {
    let username = value.trim();
    let length = username.chars().count();

    if length < 3 {
        return Err("Username minimal 3 karakter.".to_string());
    }
    if length > 50 {
        return Err("Username maksimal 50 karakter.".to_string());
    }
    if !username.chars().all(|character| {
        character.is_ascii_alphanumeric() || matches!(character, '.' | '_' | '-')
    }) {
        return Err(
            "Username hanya boleh berisi huruf, angka, titik, garis bawah, atau tanda hubung."
                .to_string(),
        );
    }

    Ok(username.to_string())
}

fn validate_optional_phone(value: Option<String>, label: &str) -> Result<Option<String>, String> {
    let value = validate_optional_text(value, label, 30)?;
    match value {
        Some(phone) => Ok(Some(validate_phone(&phone)?)),
        None => Ok(None),
    }
}

async fn ensure_username_unique(
    tx: &mut Transaction<'_, Sqlite>,
    username: &str,
    exclude_id: Option<i64>,
) -> Result<(), String> {
    let count: i64 = match exclude_id {
        Some(id) => {
            sqlx::query_scalar(
                "SELECT COUNT(*) FROM users WHERE username = ? COLLATE NOCASE AND id <> ?",
            )
            .bind(username)
            .bind(id)
            .fetch_one(&mut **tx)
            .await
        }
        None => {
            sqlx::query_scalar(
                "SELECT COUNT(*) FROM users WHERE username = ? COLLATE NOCASE",
            )
            .bind(username)
            .fetch_one(&mut **tx)
            .await
        }
    }
    .map_err(|error| auth::db_error("Gagal memeriksa username", error))?;

    if count > 0 {
        return Err("Username sudah digunakan. Pilih username lain.".to_string());
    }

    Ok(())
}

async fn employee_info(
    tx: &mut Transaction<'_, Sqlite>,
    employee_id: i64,
) -> Result<(String, String, i64), String> {
    let row: Option<(String, String, i64)> = sqlx::query_as(
        "SELECT name, position, is_active FROM employees WHERE id = ?",
    )
    .bind(employee_id)
    .fetch_optional(&mut **tx)
    .await
    .map_err(|error| auth::db_error("Gagal membaca data pegawai", error))?;

    row.ok_or_else(|| "Pegawai tidak ditemukan. Muat ulang daftar pegawai.".to_string())
}

async fn active_admin_count_excluding(
    tx: &mut Transaction<'_, Sqlite>,
    user_id: Option<i64>,
) -> Result<i64, String> {
    match user_id {
        Some(id) => sqlx::query_scalar(
            "SELECT COUNT(*) FROM users WHERE role = 'admin' AND is_active = 1 AND id <> ?",
        )
        .bind(id)
        .fetch_one(&mut **tx)
        .await,
        None => sqlx::query_scalar(
            "SELECT COUNT(*) FROM users WHERE role = 'admin' AND is_active = 1",
        )
        .fetch_one(&mut **tx)
        .await,
    }
    .map_err(|error| auth::db_error("Gagal memeriksa akun admin aktif", error))
}

async fn linked_active_admin_count(
    tx: &mut Transaction<'_, Sqlite>,
    employee_id: i64,
) -> Result<i64, String> {
    sqlx::query_scalar(
        "SELECT COUNT(*) FROM users
         WHERE employee_id = ? AND role = 'admin' AND is_active = 1",
    )
    .bind(employee_id)
    .fetch_one(&mut **tx)
    .await
    .map_err(|error| auth::db_error("Gagal memeriksa akun admin pegawai", error))
}

#[tauri::command]
pub async fn update_business_profile(
    app: AppHandle,
    state: State<'_, AuthState>,
    token: String,
    business_name: String,
    owner_name: String,
    address: Option<String>,
    phone: Option<String>,
) -> Result<(), String> {
    let user = auth::require_role(&state, &token, &["admin"])?;

    let business_name = validate_text(&business_name, "Nama usaha", 2, 100)?;
    let owner_name = validate_text(&owner_name, "Nama pemilik", 2, 100)?;
    let address = validate_optional_text(address, "Alamat usaha", 250)?.unwrap_or_default();
    let phone = validate_optional_phone(phone, "No. telepon usaha")?.unwrap_or_default();

    let pool = auth::get_pool(&app).await?;
    let mut tx = pool
        .begin()
        .await
        .map_err(|error| auth::db_error("Gagal memulai pembaruan profil usaha", error))?;

    sqlx::query(
        "INSERT INTO business_profile
            (id, business_name, owner_name, address, phone, updated_at)
         VALUES (1, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
         ON CONFLICT(id) DO UPDATE SET
            business_name = excluded.business_name,
            owner_name = excluded.owner_name,
            address = excluded.address,
            phone = excluded.phone,
            updated_at = excluded.updated_at",
    )
    .bind(&business_name)
    .bind(&owner_name)
    .bind(&address)
    .bind(&phone)
    .execute(&mut *tx)
    .await
    .map_err(|error| auth::db_error("Gagal memperbarui profil usaha", error))?;

    audit::log_action(
        &mut tx,
        &user,
        "update",
        "business_profile",
        1,
        &format!("Memperbarui profil usaha: {business_name}"),
    )
    .await?;

    tx.commit()
        .await
        .map_err(|error| auth::db_error("Gagal menyimpan profil usaha", error))?;

    Ok(())
}

#[tauri::command]
pub async fn create_employee(
    app: AppHandle,
    state: State<'_, AuthState>,
    token: String,
    name: String,
    position: String,
    phone: Option<String>,
    address: Option<String>,
) -> Result<i64, String> {
    let user = auth::require_role(&state, &token, &["admin"])?;
    let name = validate_text(&name, "Nama pegawai", 2, 100)?;
    let position = validate_position(&position)?;
    let phone = validate_optional_phone(phone, "No. telepon pegawai")?;
    let address = validate_optional_text(address, "Alamat pegawai", 250)?;

    let pool = auth::get_pool(&app).await?;
    let mut tx = pool
        .begin()
        .await
        .map_err(|error| auth::db_error("Gagal memulai penambahan pegawai", error))?;

    let result = sqlx::query(
        "INSERT INTO employees (name, position, phone, address, is_active)
         VALUES (?, ?, ?, ?, 1)",
    )
    .bind(&name)
    .bind(&position)
    .bind(phone.as_deref())
    .bind(address.as_deref())
    .execute(&mut *tx)
    .await
    .map_err(|error| auth::db_error("Gagal menambah pegawai", error))?;

    let employee_id = result.last_insert_rowid();
    audit::log_action(
        &mut tx,
        &user,
        "create",
        "employees",
        employee_id,
        &format!("Menambah pegawai: {name} ({position})"),
    )
    .await?;

    tx.commit()
        .await
        .map_err(|error| auth::db_error("Gagal menyimpan pegawai", error))?;

    Ok(employee_id)
}

#[tauri::command]
pub async fn update_employee(
    app: AppHandle,
    state: State<'_, AuthState>,
    token: String,
    employee_id: i64,
    name: String,
    position: String,
    phone: Option<String>,
    address: Option<String>,
) -> Result<(), String> {
    let user = auth::require_role(&state, &token, &["admin"])?;
    if employee_id <= 0 {
        return Err("Pegawai tidak valid.".to_string());
    }

    let name = validate_text(&name, "Nama pegawai", 2, 100)?;
    let position = validate_position(&position)?;
    let phone = validate_optional_phone(phone, "No. telepon pegawai")?;
    let address = validate_optional_text(address, "Alamat pegawai", 250)?;

    let pool = auth::get_pool(&app).await?;
    let mut tx = pool
        .begin()
        .await
        .map_err(|error| auth::db_error("Gagal memulai pembaruan pegawai", error))?;

    let (old_name, old_position, _) = employee_info(&mut tx, employee_id).await?;

    if user.employee_id == Some(employee_id) && old_position != position {
        return Err(
            "Jabatan pegawai yang terhubung dengan akun Anda tidak dapat diubah.".to_string(),
        );
    }

    if old_position != position && old_position == "Admin" {
        let linked_admins = linked_active_admin_count(&mut tx, employee_id).await?;
        if linked_admins > 0 {
            let other_admins = active_admin_count_excluding(&mut tx, None).await?;
            if other_admins - linked_admins <= 0 {
                return Err(
                    "Perubahan ini akan menghilangkan satu-satunya akun admin aktif. Tambahkan admin lain terlebih dahulu."
                        .to_string(),
                );
            }
        }
    }

    let linked_user_ids: Vec<i64> = if old_position != position {
        sqlx::query_scalar("SELECT id FROM users WHERE employee_id = ?")
            .bind(employee_id)
            .fetch_all(&mut *tx)
            .await
            .map_err(|error| auth::db_error("Gagal membaca akun pegawai", error))?
    } else {
        Vec::new()
    };

    sqlx::query(
        "UPDATE employees
         SET name = ?, position = ?, phone = ?, address = ?,
             updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE id = ?",
    )
    .bind(&name)
    .bind(&position)
    .bind(phone.as_deref())
    .bind(address.as_deref())
    .bind(employee_id)
    .execute(&mut *tx)
    .await
    .map_err(|error| auth::db_error("Gagal memperbarui pegawai", error))?;

    if old_position != position {
        sqlx::query(
            "UPDATE users
             SET role = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
             WHERE employee_id = ?",
        )
        .bind(role_for_position(&position))
        .bind(employee_id)
        .execute(&mut *tx)
        .await
        .map_err(|error| auth::db_error("Gagal menyesuaikan role akun pegawai", error))?;
    }

    let description = if old_name == name {
        format!("Memperbarui pegawai: {name} ({position})")
    } else {
        format!("Memperbarui pegawai: {old_name} menjadi {name} ({position})")
    };
    audit::log_action(
        &mut tx,
        &user,
        "update",
        "employees",
        employee_id,
        &description,
    )
    .await?;

    tx.commit()
        .await
        .map_err(|error| auth::db_error("Gagal menyimpan perubahan pegawai", error))?;

    for linked_user_id in linked_user_ids {
        auth::clear_user_sessions(&state, linked_user_id)?;
    }

    Ok(())
}

#[tauri::command]
pub async fn set_employee_active(
    app: AppHandle,
    state: State<'_, AuthState>,
    token: String,
    employee_id: i64,
    is_active: bool,
) -> Result<(), String> {
    let user = auth::require_role(&state, &token, &["admin"])?;
    if employee_id <= 0 {
        return Err("Pegawai tidak valid.".to_string());
    }
    if !is_active && user.employee_id == Some(employee_id) {
        return Err("Anda tidak dapat menonaktifkan pegawai yang terhubung dengan akun Anda.".to_string());
    }

    let pool = auth::get_pool(&app).await?;
    let mut tx = pool
        .begin()
        .await
        .map_err(|error| auth::db_error("Gagal memulai perubahan status pegawai", error))?;

    let (name, _, _) = employee_info(&mut tx, employee_id).await?;

    if !is_active {
        let linked_admins = linked_active_admin_count(&mut tx, employee_id).await?;
        if linked_admins > 0 {
            let other_admins = active_admin_count_excluding(&mut tx, None).await?;
            if other_admins - linked_admins <= 0 {
                return Err(
                    "Pegawai ini terhubung dengan satu-satunya akun admin aktif. Tambahkan admin lain terlebih dahulu."
                        .to_string(),
                );
            }
        }
    }

    let linked_user_ids: Vec<i64> = if !is_active {
        sqlx::query_scalar("SELECT id FROM users WHERE employee_id = ?")
            .bind(employee_id)
            .fetch_all(&mut *tx)
            .await
            .map_err(|error| auth::db_error("Gagal membaca akun pegawai", error))?
    } else {
        Vec::new()
    };

    sqlx::query(
        "UPDATE employees
         SET is_active = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE id = ?",
    )
    .bind(active_value(is_active))
    .bind(employee_id)
    .execute(&mut *tx)
    .await
    .map_err(|error| auth::db_error("Gagal mengubah status pegawai", error))?;

    if !is_active {
        sqlx::query(
            "UPDATE users
             SET is_active = 0, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
             WHERE employee_id = ?",
        )
        .bind(employee_id)
        .execute(&mut *tx)
        .await
        .map_err(|error| auth::db_error("Gagal menonaktifkan akun pegawai", error))?;
    }

    let description = if is_active {
        format!("Mengaktifkan pegawai: {name}")
    } else {
        format!("Menonaktifkan pegawai: {name} beserta akun loginnya")
    };
    audit::log_action(
        &mut tx,
        &user,
        "update",
        "employees",
        employee_id,
        &description,
    )
    .await?;

    tx.commit()
        .await
        .map_err(|error| auth::db_error("Gagal menyimpan status pegawai", error))?;

    for linked_user_id in linked_user_ids {
        auth::clear_user_sessions(&state, linked_user_id)?;
    }

    Ok(())
}

#[tauri::command]
pub async fn delete_employee(
    app: AppHandle,
    state: State<'_, AuthState>,
    token: String,
    employee_id: i64,
) -> Result<(), String> {
    let user = auth::require_role(&state, &token, &["admin"])?;
    if employee_id <= 0 {
        return Err("Pegawai tidak valid.".to_string());
    }
    if user.employee_id == Some(employee_id) {
        return Err("Anda tidak dapat menghapus pegawai yang terhubung dengan akun Anda.".to_string());
    }

    let pool = auth::get_pool(&app).await?;
    let mut tx = pool
        .begin()
        .await
        .map_err(|error| auth::db_error("Gagal memulai penghapusan pegawai", error))?;

    let (name, _, _) = employee_info(&mut tx, employee_id).await?;

    let account_count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM users WHERE employee_id = ?")
            .bind(employee_id)
            .fetch_one(&mut *tx)
            .await
            .map_err(|error| auth::db_error("Gagal memeriksa akun pegawai", error))?;

    if account_count > 0 {
        return Err(
            "Pegawai masih memiliki akun login. Hapus akunnya terlebih dahulu agar riwayat tetap aman."
                .to_string(),
        );
    }

    sqlx::query("DELETE FROM employees WHERE id = ?")
        .bind(employee_id)
        .execute(&mut *tx)
        .await
        .map_err(|error| auth::db_error("Gagal menghapus pegawai", error))?;

    audit::log_action(
        &mut tx,
        &user,
        "delete",
        "employees",
        employee_id,
        &format!("Menghapus pegawai: {name}"),
    )
    .await?;

    tx.commit()
        .await
        .map_err(|error| auth::db_error("Gagal menyimpan penghapusan pegawai", error))?;

    Ok(())
}

#[tauri::command]
pub async fn create_user_account(
    app: AppHandle,
    state: State<'_, AuthState>,
    token: String,
    employee_id: i64,
    username: String,
    password: String,
    is_active: bool,
) -> Result<i64, String> {
    let user = auth::require_role(&state, &token, &["admin"])?;
    if employee_id <= 0 {
        return Err("Pegawai tidak valid.".to_string());
    }

    let username = validate_username(&username)?;
    auth::validate_password_policy(&password)?;

    let pool = auth::get_pool(&app).await?;
    let mut tx = pool
        .begin()
        .await
        .map_err(|error| auth::db_error("Gagal memulai pembuatan akun", error))?;

    let (employee_name, position, employee_active) = employee_info(&mut tx, employee_id).await?;
    if employee_active != 1 {
        return Err("Pegawai nonaktif. Aktifkan pegawai terlebih dahulu.".to_string());
    }

    let linked_count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM users WHERE employee_id = ?")
            .bind(employee_id)
            .fetch_one(&mut *tx)
            .await
            .map_err(|error| auth::db_error("Gagal memeriksa akun pegawai", error))?;

    if linked_count > 0 {
        return Err("Pegawai ini sudah memiliki akun login.".to_string());
    }

    ensure_username_unique(&mut tx, &username, None).await?;

    let password_hash = auth::hash_password(&password)?;
    let role = role_for_position(&position);

    let result = sqlx::query(
        "INSERT INTO users (employee_id, username, password_hash, role, is_active)
         VALUES (?, ?, ?, ?, ?)",
    )
    .bind(employee_id)
    .bind(&username)
    .bind(&password_hash)
    .bind(role)
    .bind(active_value(is_active))
    .execute(&mut *tx)
    .await
    .map_err(|error| auth::db_error("Gagal membuat akun login", error))?;

    let account_id = result.last_insert_rowid();
    audit::log_action(
        &mut tx,
        &user,
        "create",
        "users",
        account_id,
        &format!("Membuat akun login: {username} untuk {employee_name} ({role})"),
    )
    .await?;

    tx.commit()
        .await
        .map_err(|error| auth::db_error("Gagal menyimpan akun login", error))?;

    Ok(account_id)
}

#[tauri::command]
pub async fn update_user_account(
    app: AppHandle,
    state: State<'_, AuthState>,
    token: String,
    account_id: i64,
    employee_id: i64,
    username: String,
    is_active: bool,
) -> Result<(), String> {
    let user = auth::require_role(&state, &token, &["admin"])?;
    if account_id <= 0 || employee_id <= 0 {
        return Err("Akun atau pegawai tidak valid.".to_string());
    }

    let username = validate_username(&username)?;

    let pool = auth::get_pool(&app).await?;
    let mut tx = pool
        .begin()
        .await
        .map_err(|error| auth::db_error("Gagal memulai pembaruan akun", error))?;

    let existing: Option<(i64, String, i64)> = sqlx::query_as(
        "SELECT employee_id, role, is_active FROM users WHERE id = ?",
    )
    .bind(account_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|error| auth::db_error("Gagal membaca akun login", error))?;

    let Some((old_employee_id, old_role, old_is_active)) = existing else {
        return Err("Akun login tidak ditemukan. Muat ulang daftar akun.".to_string());
    };

    if account_id == user.id && old_employee_id != employee_id {
        return Err("Pegawai pada akun Anda sendiri tidak dapat diubah.".to_string());
    }

    let (employee_name, position, employee_active) = employee_info(&mut tx, employee_id).await?;
    if employee_active != 1 && is_active {
        return Err("Pegawai nonaktif. Nonaktifkan akun atau aktifkan pegawai terlebih dahulu.".to_string());
    }

    let linked_other: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM users WHERE employee_id = ? AND id <> ?",
    )
    .bind(employee_id)
    .bind(account_id)
    .fetch_one(&mut *tx)
    .await
    .map_err(|error| auth::db_error("Gagal memeriksa akun pegawai", error))?;

    if linked_other > 0 && old_employee_id != employee_id {
        return Err("Pegawai ini sudah memiliki akun login lain.".to_string());
    }

    let new_role = role_for_position(&position);
    if old_role == "admin"
        && old_is_active == 1
        && (new_role != "admin" || !is_active)
        && active_admin_count_excluding(&mut tx, Some(account_id)).await? == 0
    {
        return Err(
            "Akun ini adalah satu-satunya admin aktif. Tambahkan admin lain sebelum mengubahnya."
                .to_string(),
        );
    }
    if account_id == user.id && !is_active {
        return Err("Anda tidak dapat menonaktifkan akun sendiri.".to_string());
    }

    ensure_username_unique(&mut tx, &username, Some(account_id)).await?;

    sqlx::query(
        "UPDATE users
         SET employee_id = ?, username = ?, role = ?, is_active = ?,
             updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE id = ?",
    )
    .bind(employee_id)
    .bind(&username)
    .bind(new_role)
    .bind(active_value(is_active))
    .bind(account_id)
    .execute(&mut *tx)
    .await
    .map_err(|error| auth::db_error("Gagal memperbarui akun login", error))?;

    audit::log_action(
        &mut tx,
        &user,
        "update",
        "users",
        account_id,
        &format!("Memperbarui akun login: {username} untuk {employee_name} ({new_role})"),
    )
    .await?;

    tx.commit()
        .await
        .map_err(|error| auth::db_error("Gagal menyimpan akun login", error))?;

    if account_id != user.id {
        auth::clear_user_sessions(&state, account_id)?;
    }

    Ok(())
}

#[tauri::command]
pub async fn set_user_account_active(
    app: AppHandle,
    state: State<'_, AuthState>,
    token: String,
    account_id: i64,
    is_active: bool,
) -> Result<(), String> {
    let user = auth::require_role(&state, &token, &["admin"])?;
    if account_id <= 0 {
        return Err("Akun tidak valid.".to_string());
    }
    if account_id == user.id && !is_active {
        return Err("Anda tidak dapat menonaktifkan akun sendiri.".to_string());
    }

    let pool = auth::get_pool(&app).await?;
    let mut tx = pool
        .begin()
        .await
        .map_err(|error| auth::db_error("Gagal memulai perubahan status akun", error))?;

    let existing: Option<(String, String, i64, i64)> = sqlx::query_as(
        "SELECT u.username, u.role, u.is_active, COALESCE(e.is_active, 0)
         FROM users u
         LEFT JOIN employees e ON e.id = u.employee_id
         WHERE u.id = ?",
    )
    .bind(account_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|error| auth::db_error("Gagal membaca akun login", error))?;

    let Some((username, role, old_active, employee_active)) = existing else {
        return Err("Akun login tidak ditemukan. Muat ulang daftar akun.".to_string());
    };

    if is_active && employee_active != 1 {
        return Err(
            "Pegawai untuk akun ini sedang nonaktif. Aktifkan pegawai terlebih dahulu."
                .to_string(),
        );
    }

    if !is_active
        && old_active == 1
        && role == "admin"
        && active_admin_count_excluding(&mut tx, Some(account_id)).await? == 0
    {
        return Err(
            "Akun ini adalah satu-satunya admin aktif dan tidak dapat dinonaktifkan."
                .to_string(),
        );
    }

    sqlx::query(
        "UPDATE users
         SET is_active = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE id = ?",
    )
    .bind(active_value(is_active))
    .bind(account_id)
    .execute(&mut *tx)
    .await
    .map_err(|error| auth::db_error("Gagal mengubah status akun", error))?;

    let description = if is_active {
        format!("Mengaktifkan akun login: {username}")
    } else {
        format!("Menonaktifkan akun login: {username}")
    };
    audit::log_action(
        &mut tx,
        &user,
        "update",
        "users",
        account_id,
        &description,
    )
    .await?;

    tx.commit()
        .await
        .map_err(|error| auth::db_error("Gagal menyimpan status akun", error))?;

    if account_id != user.id {
        auth::clear_user_sessions(&state, account_id)?;
    }

    Ok(())
}

#[tauri::command]
pub async fn delete_user_account(
    app: AppHandle,
    state: State<'_, AuthState>,
    token: String,
    account_id: i64,
) -> Result<(), String> {
    let user = auth::require_role(&state, &token, &["admin"])?;
    if account_id <= 0 {
        return Err("Akun tidak valid.".to_string());
    }
    if account_id == user.id {
        return Err("Anda tidak dapat menghapus akun sendiri.".to_string());
    }

    let pool = auth::get_pool(&app).await?;
    let mut tx = pool
        .begin()
        .await
        .map_err(|error| auth::db_error("Gagal memulai penghapusan akun", error))?;

    let existing: Option<(String, String, i64)> = sqlx::query_as(
        "SELECT username, role, is_active FROM users WHERE id = ?",
    )
    .bind(account_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|error| auth::db_error("Gagal membaca akun login", error))?;

    let Some((username, role, is_active)) = existing else {
        return Err("Akun login tidak ditemukan. Muat ulang daftar akun.".to_string());
    };

    if role == "admin"
        && is_active == 1
        && active_admin_count_excluding(&mut tx, Some(account_id)).await? == 0
    {
        return Err(
            "Akun ini adalah satu-satunya admin aktif dan tidak dapat dihapus.".to_string(),
        );
    }

    sqlx::query("DELETE FROM users WHERE id = ?")
        .bind(account_id)
        .execute(&mut *tx)
        .await
        .map_err(|error| auth::db_error("Gagal menghapus akun login", error))?;

    audit::log_action(
        &mut tx,
        &user,
        "delete",
        "users",
        account_id,
        &format!("Menghapus akun login: {username}"),
    )
    .await?;

    tx.commit()
        .await
        .map_err(|error| auth::db_error("Gagal menyimpan penghapusan akun", error))?;

    if account_id != user.id {
        auth::clear_user_sessions(&state, account_id)?;
    }

    Ok(())
}

#[tauri::command]
pub async fn change_password(
    app: AppHandle,
    state: State<'_, AuthState>,
    token: String,
    current_password: String,
    new_password: String,
) -> Result<(), String> {
    let user = auth::require_role(&state, &token, &["admin", "kasir", "operator"])?;

    if current_password.is_empty() {
        return Err("Password saat ini wajib diisi.".to_string());
    }
    auth::validate_password_policy(&new_password)?;

    let pool = auth::get_pool(&app).await?;
    let mut tx = pool
        .begin()
        .await
        .map_err(|error| auth::db_error("Gagal memulai penggantian password", error))?;

    let password_hash: Option<String> =
        sqlx::query_scalar("SELECT password_hash FROM users WHERE id = ?")
            .bind(user.id)
            .fetch_optional(&mut *tx)
            .await
            .map_err(|error| auth::db_error("Gagal membaca akun login", error))?;

    let Some(password_hash) = password_hash else {
        return Err("Akun Anda tidak ditemukan. Silakan login kembali.".to_string());
    };

    if !auth::password_matches(&current_password, &password_hash) {
        return Err("Password saat ini salah.".to_string());
    }
    if auth::password_matches(&new_password, &password_hash) {
        return Err("Password baru harus berbeda dari password saat ini.".to_string());
    }

    let new_hash = auth::hash_password(&new_password)?;
    sqlx::query(
        "UPDATE users
         SET password_hash = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE id = ?",
    )
    .bind(&new_hash)
    .bind(user.id)
    .execute(&mut *tx)
    .await
    .map_err(|error| auth::db_error("Gagal mengganti password", error))?;

    audit::log_action(
        &mut tx,
        &user,
        "update",
        "users",
        user.id,
        "Mengganti password akun sendiri",
    )
    .await?;

    tx.commit()
        .await
        .map_err(|error| auth::db_error("Gagal menyimpan password baru", error))?;

    Ok(())
}

fn live_database_path(app: &AppHandle) -> Result<PathBuf, String> {
    let folder = app
        .path()
        .app_config_dir()
        .map_err(|error| format!("Gagal menentukan folder data aplikasi: {error}"))?;
    Ok(folder.join(DB_FILE_NAME))
}

fn validate_database_file_path(path: &str, live_path: &Path) -> Result<PathBuf, String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("Lokasi file database wajib dipilih.".to_string());
    }

    let selected = PathBuf::from(trimmed);
    let extension = selected
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_lowercase();
    if extension != "db" {
        return Err("Pilih file database dengan ekstensi .db.".to_string());
    }

    if paths_equal(&selected, live_path) {
        return Err(
            "File database yang sedang dipakai tidak dapat dipilih. Gunakan nama file lain."
                .to_string(),
        );
    }

    Ok(selected)
}

fn paths_equal(first: &Path, second: &Path) -> bool {
    if first == second {
        return true;
    }

    match (first.canonicalize(), second.canonicalize()) {
        (Ok(a), Ok(b)) => a == b,
        _ => {
            first
                .to_string_lossy()
                .eq_ignore_ascii_case(&second.to_string_lossy())
        }
    }
}

fn random_backup_path(app: &AppHandle, prefix: &str) -> Result<PathBuf, String> {
    let folder = app
        .path()
        .app_config_dir()
        .map_err(|error| format!("Gagal menentukan folder data aplikasi: {error}"))?;
    std::fs::create_dir_all(&folder)
        .map_err(|error| format!("Gagal menyiapkan folder data aplikasi: {error}"))?;
    Ok(folder.join(format!(
        "{prefix}-{}.db",
        Uuid::new_v4().simple()
    )))
}

fn remove_sqlite_sidecars(path: &Path) {
    let base = path.to_string_lossy();
    for suffix in ["-wal", "-shm"] {
        let sidecar = PathBuf::from(format!("{base}{suffix}"));
        if sidecar.exists() {
            let _ = std::fs::remove_file(sidecar);
        }
    }
}

async fn create_snapshot(pool: &SqlitePool, target: &Path) -> Result<(), String> {
    if target.exists() {
        std::fs::remove_file(target)
            .map_err(|error| format!("Gagal menyiapkan file cadangan: {error}"))?;
    }

    sqlx::query("VACUUM INTO ?")
        .bind(target.to_string_lossy().as_ref())
        .execute(pool)
        .await
        .map_err(|error| auth::db_error("Gagal membuat cadangan database", error))?;

    let size = std::fs::metadata(target)
        .map_err(|error| format!("Gagal memeriksa file cadangan: {error}"))?
        .len();
    if size == 0 {
        return Err("Cadangan database kosong. Silakan coba lagi.".to_string());
    }

    Ok(())
}

async fn validate_backup_file(path: &Path) -> Result<(), String> {
    if !path.exists() {
        return Err("File cadangan tidak ditemukan.".to_string());
    }

    let options = SqliteConnectOptions::new()
        .filename(path)
        .read_only(true)
        .create_if_missing(false);
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(options)
        .await
        .map_err(|_| {
            "File yang dipilih bukan database LaundryKu yang valid. Pilih file cadangan lain."
                .to_string()
        })?;

    let validation = async {
        let integrity: String = sqlx::query_scalar("PRAGMA integrity_check")
            .fetch_one(&pool)
            .await
            .map_err(|_| {
                "File yang dipilih bukan database LaundryKu yang valid atau rusak. Pilih file cadangan lain."
                    .to_string()
            })?;
        if integrity.to_lowercase() != "ok" {
            return Err(
                "Cadangan database rusak. Pilih file cadangan lain.".to_string(),
            );
        }

        let foreign_key_issues = sqlx::query("PRAGMA foreign_key_check")
            .fetch_all(&pool)
            .await
            .map_err(|_| {
                "File cadangan tidak dapat dibaca sebagai database LaundryKu. Pilih file cadangan lain."
                    .to_string()
            })?;
        if !foreign_key_issues.is_empty() {
            return Err(
                "Cadangan memiliki relasi data yang tidak valid dan tidak dapat dipulihkan."
                    .to_string(),
            );
        }

        let table_names = REQUIRED_TABLES
            .iter()
            .map(|name| format!("'{name}'"))
            .collect::<Vec<_>>()
            .join(", ");
        let table_count: i64 = sqlx::query_scalar(&format!(
            "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name IN ({table_names})"
        ))
        .fetch_one(&pool)
        .await
        .map_err(|_| {
            "Struktur file cadangan tidak dapat diperiksa. Pilih file cadangan LaundryKu yang lain."
                .to_string()
        })?;

        if table_count != REQUIRED_TABLES.len() as i64 {
            return Err(
                "File bukan cadangan LaundryKu yang lengkap. Pilih file cadangan lain."
                    .to_string(),
            );
        }

        let migration_count: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM _sqlx_migrations WHERE success = 1")
                .fetch_one(&pool)
                .await
                .map_err(|_| {
                    "Versi file cadangan tidak dapat dibaca. Pilih file cadangan LaundryKu yang lain."
                        .to_string()
                })?;
        if migration_count < 3 {
            return Err(
                "Cadangan berasal dari versi LaundryKu yang lebih lama. Jalankan aplikasi versi tersebut untuk memulihkan."
                    .to_string(),
            );
        }

        let active_admin_count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM users WHERE role = 'admin' AND is_active = 1",
        )
        .fetch_one(&pool)
        .await
        .map_err(|_| {
            "Akun admin pada file cadangan tidak dapat diperiksa. Pilih file cadangan LaundryKu yang lain."
                .to_string()
        })?;
        if active_admin_count < 1 {
            return Err(
                "Cadangan tidak memiliki akun admin aktif sehingga tidak dapat dipulihkan."
                    .to_string(),
            );
        }

        Ok(())
    }
    .await;

    pool.close().await;
    validation
}

async fn open_live_pool(path: &Path) -> Result<SqlitePool, String> {
    let options = SqliteConnectOptions::new()
        .filename(path)
        .create_if_missing(false)
        .foreign_keys(true);
    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect_with(options)
        .await
        .map_err(|error| format!("Gagal membuka kembali database: {error}"))?;

    sqlx::query("PRAGMA journal_mode = WAL")
        .execute(&pool)
        .await
        .map_err(|error| format!("Gagal menyiapkan mode database: {error}"))?;

    Ok(pool)
}

async fn replace_database_file(live_path: &Path, source: &Path) -> Result<(), String> {
    if live_path.exists() {
        std::fs::remove_file(live_path)
            .map_err(|error| format!("Gagal mengganti file database: {error}"))?;
    }
    remove_sqlite_sidecars(live_path);
    std::fs::copy(source, live_path)
        .map_err(|error| format!("Gagal menyalin file database: {error}"))?;
    Ok(())
}

fn validate_snapshot_path(app: &AppHandle, path: &str) -> Result<PathBuf, String> {
    let snapshot = PathBuf::from(path.trim());
    let folder = app
        .path()
        .app_config_dir()
        .map_err(|error| format!("Gagal menentukan folder data aplikasi: {error}"))?;

    let canonical_snapshot = snapshot
        .canonicalize()
        .map_err(|_| "File cadangan sementara tidak ditemukan.".to_string())?;
    let canonical_folder = folder
        .canonicalize()
        .map_err(|error| format!("Gagal memeriksa folder data aplikasi: {error}"))?;

    if canonical_snapshot.parent() != Some(canonical_folder.as_path()) {
        return Err("Lokasi file cadangan sementara tidak valid.".to_string());
    }

    let file_name = canonical_snapshot
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("");
    if !file_name.starts_with("laundryku-cadangan-")
        || !file_name.to_lowercase().ends_with(".db")
    {
        return Err("File cadangan sementara tidak valid.".to_string());
    }

    Ok(canonical_snapshot)
}

/// Membuat snapshot SQLite konsisten yang akan dibaca frontend lalu disimpan
/// melalui dialog Save As + plugin fs.
#[tauri::command]
pub async fn prepare_database_backup(
    app: AppHandle,
    state: State<'_, AuthState>,
    token: String,
) -> Result<BackupSnapshot, String> {
    auth::require_role(&state, &token, &["admin"])?;

    let pool = auth::get_pool(&app).await?;
    let temp_path = random_backup_path(&app, "laundryku-cadangan")?;
    create_snapshot(&pool, &temp_path).await?;

    let size_bytes = std::fs::metadata(&temp_path)
        .map_err(|error| format!("Gagal memeriksa file cadangan: {error}"))?
        .len();

    Ok(BackupSnapshot {
        path: temp_path.display().to_string(),
        size_bytes,
    })
}

/// Mencatat aktivitas backup setelah frontend berhasil menulis file tujuan.
#[tauri::command]
pub async fn finalize_database_backup(
    app: AppHandle,
    state: State<'_, AuthState>,
    token: String,
    snapshot_path: String,
    target_path: String,
) -> Result<BackupInfo, String> {
    let user = auth::require_role(&state, &token, &["admin"])?;
    let snapshot = validate_snapshot_path(&app, &snapshot_path)?;
    let live_path = live_database_path(&app)?;
    let target = validate_database_file_path(&target_path, &live_path)?;

    if !target.exists() {
        let _ = std::fs::remove_file(&snapshot);
        return Err("File cadangan tujuan tidak ditemukan. Silakan coba lagi.".to_string());
    }

    let size_bytes = std::fs::metadata(&target)
        .map_err(|error| format!("Gagal memeriksa file cadangan: {error}"))?
        .len();
    if size_bytes == 0 {
        let _ = std::fs::remove_file(&snapshot);
        return Err("File cadangan kosong. Silakan coba lagi.".to_string());
    }

    let file_name = target
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or(DB_FILE_NAME)
        .to_string();

    let pool = auth::get_pool(&app).await?;
    let mut tx = pool
        .begin()
        .await
        .map_err(|error| auth::db_error("Gagal mencatat aktivitas cadangan", error))?;
    audit::log_action(
        &mut tx,
        &user,
        "backup",
        "database",
        0,
        &format!("Membuat cadangan database: {file_name}"),
    )
    .await?;
    tx.commit()
        .await
        .map_err(|error| auth::db_error("Gagal menyimpan aktivitas cadangan", error))?;

    let _ = std::fs::remove_file(snapshot);

    Ok(BackupInfo {
        path: target.display().to_string(),
        file_name,
        size_bytes,
    })
}

#[tauri::command]
pub async fn discard_database_backup(
    app: AppHandle,
    state: State<'_, AuthState>,
    token: String,
    snapshot_path: String,
) -> Result<(), String> {
    auth::require_role(&state, &token, &["admin"])?;
    let snapshot = validate_snapshot_path(&app, &snapshot_path)?;
    std::fs::remove_file(snapshot)
        .map_err(|error| format!("Gagal membersihkan file cadangan sementara: {error}"))?;
    Ok(())
}

#[tauri::command]
pub async fn restore_database(
    app: AppHandle,
    state: State<'_, AuthState>,
    token: String,
    path: String,
) -> Result<RestoreInfo, String> {
    let user = auth::require_role(&state, &token, &["admin"])?;
    let live_path = live_database_path(&app)?;
    let source = validate_database_file_path(&path, &live_path)?;

    validate_backup_file(&source).await?;

    let pool = auth::get_pool(&app).await?;
    let safety_path = random_backup_path(&app, "laundryku-sebelum-restore")?;
    create_snapshot(&pool, &safety_path).await?;
    drop(pool);

    let file_name = source
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("laundryku.db")
        .to_string();

    let instances = app.state::<DbInstances>();
    let mut guard = instances.0.write().await;

    if let Some(db_pool) = guard.remove(DB_URL) {
        let DbPool::Sqlite(active_pool) = db_pool;
        active_pool.close().await;
    }

    if let Err(error) = replace_database_file(&live_path, &source).await {
        // Kembalikan snapshot keamanan bila penggantian file gagal.
        let _ = replace_database_file(&live_path, &safety_path).await;
        if let Ok(reopened) = open_live_pool(&live_path).await {
            guard.insert(DB_URL.to_string(), DbPool::Sqlite(reopened));
        }
        let _ = std::fs::remove_file(&safety_path);
        return Err(error);
    }

    let reopened = match open_live_pool(&live_path).await {
        Ok(value) => value,
        Err(error) => {
            let _ = replace_database_file(&live_path, &safety_path).await;
            let rollback = open_live_pool(&live_path).await;
            if let Ok(rollback_pool) = rollback {
                guard.insert(DB_URL.to_string(), DbPool::Sqlite(rollback_pool));
            }
            let _ = std::fs::remove_file(&safety_path);
            return Err(format!(
                "Database gagal dibuka kembali. Data lama telah dikembalikan. {error}"
            ));
        }
    };

    guard.insert(DB_URL.to_string(), DbPool::Sqlite(reopened.clone()));
    drop(guard);

    let counts: Result<(i64, i64, i64), sqlx::Error> = sqlx::query_as(
        "SELECT
            (SELECT COUNT(*) FROM users),
            (SELECT COUNT(*) FROM orders),
            (SELECT COUNT(*) FROM expenses)",
    )
    .fetch_one(&reopened)
    .await;

    let (users, orders, expenses) = counts
        .map_err(|error| auth::db_error("Gagal memeriksa database hasil restore", error))?;

    let actor_exists: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM users WHERE id = ?")
        .bind(user.id)
        .fetch_one(&reopened)
        .await
        .unwrap_or(0);
    let actor_id = if actor_exists > 0 { Some(user.id) } else { None };

    if let Err(error) = sqlx::query(
        "INSERT INTO activity_logs
            (user_id, user_name, action, entity, entity_id, description)
         VALUES (?, ?, 'restore', 'database', 0, ?)",
    )
    .bind(actor_id)
    .bind(&user.username)
    .bind(format!("Memulihkan database dari cadangan: {file_name}"))
    .execute(&reopened)
    .await
    {
        log::warn!("Gagal mencatat aktivitas restore: {error}");
    }

    auth::clear_all_sessions(&state)?;
    let _ = std::fs::remove_file(&safety_path);

    Ok(RestoreInfo {
        path: source.display().to_string(),
        file_name,
        users,
        orders,
        expenses,
    })
}
