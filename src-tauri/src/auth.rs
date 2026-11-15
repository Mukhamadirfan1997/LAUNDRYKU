use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use argon2::password_hash::{
    PasswordHash, PasswordHasher, PasswordVerifier, SaltString,
};
use argon2::Argon2;
use rand_core::OsRng;
use serde::Serialize;
use sqlx::sqlite::SqliteRow;
use sqlx::{Row, SqlitePool};
use tauri::{AppHandle, Manager, State};
use tauri_plugin_sql::{DbInstances, DbPool};
use uuid::Uuid;

const DB_URL: &str = "sqlite:laundryku.db";
const SESSION_TTL_SECONDS: i64 = 8 * 60 * 60;
const DEFAULT_ADMIN_USERNAME: &str = "admin";
const DEFAULT_ADMIN_PASSWORD: &str = "Admin123!";

const ALLOWED_ACTIONS: [&str; 10] = [
    "login",
    "logout",
    "create",
    "update",
    "delete",
    "status_change",
    "payment",
    "export",
    "backup",
    "restore",
];

#[derive(Default)]
pub struct AuthState {
    sessions: Mutex<HashMap<String, Session>>,
}

#[derive(Clone)]
struct Session {
    user_id: i64,
    username: String,
    role: String,
    employee_id: Option<i64>,
    employee_name: Option<String>,
    position: Option<String>,
    expires_at: i64,
}

impl Session {
    fn to_user(&self) -> SessionUser {
        SessionUser {
            id: self.user_id,
            username: self.username.clone(),
            role: self.role.clone(),
            employee_id: self.employee_id,
            employee_name: self.employee_name.clone(),
            position: self.position.clone(),
        }
    }
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SessionUser {
    pub id: i64,
    pub username: String,
    pub role: String,
    pub employee_id: Option<i64>,
    pub employee_name: Option<String>,
    pub position: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoginResponse {
    pub token: String,
    pub user: SessionUser,
    pub expires_at: i64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionValidation {
    pub user: SessionUser,
    pub expires_at: i64,
}

fn now_seconds() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs() as i64)
        .unwrap_or(0)
}

fn new_token() -> String {
    format!(
        "{}{}",
        Uuid::new_v4().simple(),
        Uuid::new_v4().simple()
    )
}

pub(crate) fn hash_password(password: &str) -> Result<String, String> {
    let salt = SaltString::generate(&mut OsRng);
    Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map(|hash| hash.to_string())
        .map_err(|error| {
            log::error!("Gagal membuat hash password Argon2: {error}");
            "Gagal mengamankan password. Silakan coba lagi.".to_string()
        })
}

pub(crate) fn password_matches(password: &str, password_hash: &str) -> bool {
    let Ok(parsed) = PasswordHash::new(password_hash) else {
        log::error!("Hash password pada database tidak valid.");
        return false;
    };

    Argon2::default()
        .verify_password(password.as_bytes(), &parsed)
        .is_ok()
}

/// Kebijakan password yang dipakai saat membuat akun dan mengganti password.
pub(crate) fn validate_password_policy(password: &str) -> Result<(), String> {
    let length = password.chars().count();

    if length < 8 {
        return Err("Password minimal 8 karakter.".to_string());
    }
    if length > 72 {
        return Err("Password maksimal 72 karakter.".to_string());
    }
    if !password.chars().any(|character| character.is_uppercase()) {
        return Err("Password harus memuat huruf besar.".to_string());
    }
    if !password.chars().any(|character| character.is_lowercase()) {
        return Err("Password harus memuat huruf kecil.".to_string());
    }
    if !password.chars().any(|character| character.is_ascii_digit()) {
        return Err("Password harus memuat angka.".to_string());
    }

    Ok(())
}

/// Menghapus semua sesi aktif, dipakai setelah restore database.
pub(crate) fn clear_all_sessions(state: &AuthState) -> Result<(), String> {
    let mut sessions = state
        .sessions
        .lock()
        .map_err(|_| "Sesi tidak tersedia. Jalankan ulang aplikasi.".to_string())?;
    sessions.clear();
    Ok(())
}

/// Menghapus sesi milik pengguna tertentu setelah role/status akun berubah.
pub(crate) fn clear_user_sessions(state: &AuthState, user_id: i64) -> Result<(), String> {
    let mut sessions = state
        .sessions
        .lock()
        .map_err(|_| "Sesi tidak tersedia. Jalankan ulang aplikasi.".to_string())?;
    sessions.retain(|_, session| session.user_id != user_id);
    Ok(())
}

pub(crate) fn db_error(context: &str, error: sqlx::Error) -> String {
    log::error!("{context}: {error}");
    format!("{context}. Silakan coba lagi.")
}

fn read_row<T>(row: &SqliteRow, column: &str) -> Result<T, String>
where
    T: for<'c> sqlx::Decode<'c, sqlx::Sqlite> + sqlx::Type<sqlx::Sqlite>,
{
    row.try_get::<T, _>(column).map_err(|error| {
        log::error!("Kolom akun '{column}' tidak dapat dibaca: {error}");
        "Data akun tidak lengkap. Hubungi Admin.".to_string()
    })
}

pub(crate) async fn get_pool(app: &AppHandle) -> Result<SqlitePool, String> {
    let instances = app.state::<DbInstances>();
    let guard = instances.0.read().await;

    match guard.get(DB_URL) {
        Some(DbPool::Sqlite(pool)) => Ok(pool.clone()),
        _ => Err(
            "Database belum siap. Tutup lalu jalankan ulang aplikasi LaundryKu.".to_string(),
        ),
    }
}

fn valid_session(state: &AuthState, token: &str) -> Result<Session, String> {
    let now = now_seconds();
    let mut sessions = state
        .sessions
        .lock()
        .map_err(|_| "Sesi tidak tersedia. Jalankan ulang aplikasi.".to_string())?;

    sessions.retain(|_, session| session.expires_at > now);
    sessions
        .get(token)
        .cloned()
        .ok_or_else(|| "Sesi Anda tidak valid. Silakan login kembali.".to_string())
}

/// Membuat akun admin awal hanya bila tabel users masih kosong.
///
/// Dipanggil saat aplikasi mulai dan dicek kembali sebelum login, sehingga
/// pengguna pertama selalu bisa masuk dengan akun admin bawaan.
pub async fn ensure_default_admin(app: &AppHandle) -> Result<(), String> {
    let pool = get_pool(app).await?;

    let user_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM users")
        .fetch_one(&pool)
        .await
        .map_err(|error| db_error("Gagal memeriksa data akun", error))?;

    if user_count > 0 {
        return Ok(());
    }

    let password_hash = hash_password(DEFAULT_ADMIN_PASSWORD)?;
    let mut tx = pool
        .begin()
        .await
        .map_err(|error| db_error("Gagal memulai penyiapan akun admin", error))?;

    let employee_result = sqlx::query(
        "INSERT INTO employees (name, position, is_active) VALUES (?, 'Admin', 1)",
    )
    .bind("Administrator")
    .execute(&mut *tx)
    .await
    .map_err(|error| db_error("Gagal membuat data pegawai admin", error))?;

    sqlx::query(
        "INSERT INTO users (employee_id, username, password_hash, role, is_active)
         VALUES (?, ?, ?, 'admin', 1)",
    )
    .bind(employee_result.last_insert_rowid())
    .bind(DEFAULT_ADMIN_USERNAME)
    .bind(&password_hash)
    .execute(&mut *tx)
    .await
    .map_err(|error| db_error("Gagal membuat akun admin", error))?;

    sqlx::query(
        "INSERT INTO activity_logs (user_name, action, entity, description)
         VALUES ('Sistem', 'create', 'users', 'Akun admin awal dibuat otomatis')",
    )
    .execute(&mut *tx)
    .await
    .map_err(|error| db_error("Gagal mencatat aktivitas awal", error))?;

    tx.commit()
        .await
        .map_err(|error| db_error("Gagal menyimpan akun admin", error))?;

    log::info!("Akun admin awal berhasil dibuat.");
    Ok(())
}

#[tauri::command]
pub async fn login(
    app: AppHandle,
    state: State<'_, AuthState>,
    username: String,
    password: String,
) -> Result<LoginResponse, String> {
    let username = username.trim().to_string();

    if username.is_empty() || password.is_empty() {
        return Err("Username dan password wajib diisi.".to_string());
    }

    if username.len() > 50 || password.len() > 200 {
        return Err("Username atau password tidak valid.".to_string());
    }

    if let Err(error) = ensure_default_admin(&app).await {
        log::warn!("Pemeriksaan akun admin awal gagal: {error}");
    }

    let pool = get_pool(&app).await?;
    let row = sqlx::query(
        "SELECT u.id, u.employee_id, u.username, u.password_hash, u.role, u.is_active,
                e.name AS employee_name, e.position AS employee_position
         FROM users u
         LEFT JOIN employees e ON e.id = u.employee_id
         WHERE u.username = ?
         LIMIT 1",
    )
    .bind(&username)
    .fetch_optional(&pool)
    .await
    .map_err(|error| db_error("Gagal membaca data akun", error))?;

    let Some(row) = row else {
        return Err("Username atau password salah.".to_string());
    };

    let is_active: i64 = read_row(&row, "is_active")?;
    if is_active != 1 {
        return Err("Akun Anda dinonaktifkan. Hubungi Admin.".to_string());
    }

    let password_hash: String = read_row(&row, "password_hash")?;
    if !password_matches(&password, &password_hash) {
        return Err("Username atau password salah.".to_string());
    }

    let user = SessionUser {
        id: read_row(&row, "id")?,
        username: read_row(&row, "username")?,
        role: read_row(&row, "role")?,
        employee_id: read_row(&row, "employee_id")?,
        employee_name: read_row(&row, "employee_name")?,
        position: read_row(&row, "employee_position")?,
    };

    sqlx::query(
        "UPDATE users
         SET last_login_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
             updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE id = ?",
    )
    .bind(user.id)
    .execute(&pool)
    .await
    .map_err(|error| db_error("Gagal memperbarui waktu login", error))?;

    if let Err(error) = sqlx::query(
        "INSERT INTO activity_logs (user_id, user_name, action, entity, entity_id, description)
         VALUES (?, ?, 'login', 'users', ?, 'Login berhasil melalui aplikasi')",
    )
    .bind(user.id)
    .bind(&user.username)
    .bind(user.id)
    .execute(&pool)
    .await
    {
        log::warn!("Gagal mencatat log login: {error}");
    }

    let token = new_token();
    let expires_at = now_seconds() + SESSION_TTL_SECONDS;
    let session = Session {
        user_id: user.id,
        username: user.username.clone(),
        role: user.role.clone(),
        employee_id: user.employee_id,
        employee_name: user.employee_name.clone(),
        position: user.position.clone(),
        expires_at,
    };

    {
        let now = now_seconds();
        let mut sessions = state
            .sessions
            .lock()
            .map_err(|_| "Sesi tidak tersedia. Jalankan ulang aplikasi.".to_string())?;
        sessions.retain(|_, active| active.expires_at > now);
        sessions.insert(token.clone(), session);
    }

    Ok(LoginResponse {
        token,
        user,
        expires_at,
    })
}

#[tauri::command]
pub fn validate_session(
    state: State<'_, AuthState>,
    token: String,
) -> Result<SessionValidation, String> {
    let session = valid_session(&state, &token)?;

    Ok(SessionValidation {
        user: session.to_user(),
        expires_at: session.expires_at,
    })
}

#[tauri::command]
pub async fn logout(
    app: AppHandle,
    state: State<'_, AuthState>,
    token: String,
) -> Result<(), String> {
    let session = {
        let mut sessions = state
            .sessions
            .lock()
            .map_err(|_| "Sesi tidak tersedia. Jalankan ulang aplikasi.".to_string())?;
        sessions.remove(&token)
    };

    if let Some(session) = session {
        if let Ok(pool) = get_pool(&app).await {
            if let Err(error) = sqlx::query(
                "INSERT INTO activity_logs
                    (user_id, user_name, action, entity, entity_id, description)
                 VALUES (?, ?, 'logout', 'users', ?, 'Logout dari aplikasi')",
            )
            .bind(session.user_id)
            .bind(&session.username)
            .bind(session.user_id)
            .execute(&pool)
            .await
            {
                log::warn!("Gagal mencatat log logout: {error}");
            }
        }
    }

    Ok(())
}

/// Mencatat aktivitas atas nama pengguna yang sedang login.
///
/// Aksi sensitif pada fase berikutnya tetap memeriksa role di Rust sebelum
/// memanggil fungsi ini, sehingga frontend tidak bisa memalsukan identitas.
#[tauri::command]
pub async fn log_activity(
    app: AppHandle,
    state: State<'_, AuthState>,
    token: String,
    action: String,
    entity: Option<String>,
    entity_id: Option<i64>,
    description: String,
) -> Result<(), String> {
    let session = valid_session(&state, &token)?;
    let action = action.trim().to_lowercase();

    if !ALLOWED_ACTIONS.contains(&action.as_str()) {
        return Err("Jenis aktivitas tidak dikenal.".to_string());
    }

    let description = description.trim();
    if description.is_empty() {
        return Err("Keterangan aktivitas wajib diisi.".to_string());
    }
    if description.chars().count() > 500 {
        return Err("Keterangan aktivitas terlalu panjang.".to_string());
    }

    let entity = entity
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());

    let pool = get_pool(&app).await?;
    sqlx::query(
        "INSERT INTO activity_logs
            (user_id, user_name, action, entity, entity_id, description)
         VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(session.user_id)
    .bind(&session.username)
    .bind(&action)
    .bind(entity.as_deref())
    .bind(entity_id)
    .bind(description)
    .execute(&pool)
    .await
    .map_err(|error| db_error("Gagal mencatat aktivitas", error))?;

    Ok(())
}

/// Helper untuk command sensitif pada fase berikutnya.
pub fn require_role(
    state: &AuthState,
    token: &str,
    allowed_roles: &[&str],
) -> Result<SessionUser, String> {
    let session = valid_session(state, token)?;
    if !allowed_roles.contains(&session.role.as_str()) {
        return Err("Anda tidak memiliki izin untuk melakukan aksi ini.".to_string());
    }
    Ok(session.to_user())
}
