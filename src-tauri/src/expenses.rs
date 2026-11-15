use sqlx::{Sqlite, Transaction};
use tauri::{AppHandle, State};

use crate::audit;
use crate::auth::{self, AuthState};
use crate::validation::{format_rupiah, validate_date, validate_text};

const MAX_AMOUNT: i64 = 1_000_000_000;

fn validate_category_name(value: &str) -> Result<String, String> {
    validate_text(value, "Nama kategori", 2, 60)
}

fn validate_description(value: &str) -> Result<String, String> {
    validate_text(value, "Keterangan pengeluaran", 2, 200)
}

fn validate_amount(value: i64) -> Result<i64, String> {
    if value <= 0 {
        return Err("Nominal pengeluaran harus lebih dari 0.".to_string());
    }
    if value > MAX_AMOUNT {
        return Err("Nominal pengeluaran terlalu besar. Maksimal Rp 1.000.000.000.".to_string());
    }
    Ok(value)
}

fn active_value(is_active: bool) -> i64 {
    if is_active { 1 } else { 0 }
}

async fn category_info(
    tx: &mut Transaction<'_, Sqlite>,
    category_id: i64,
) -> Result<(String, i64), String> {
    let row: Option<(String, i64)> = sqlx::query_as(
        "SELECT name, is_active FROM expense_categories WHERE id = ?",
    )
    .bind(category_id)
    .fetch_optional(&mut **tx)
    .await
    .map_err(|error| auth::db_error("Gagal membaca kategori pengeluaran", error))?;

    row.ok_or_else(|| {
        "Kategori pengeluaran tidak ditemukan. Muat ulang daftar kategori.".to_string()
    })
}

async fn ensure_unique_category_name(
    tx: &mut Transaction<'_, Sqlite>,
    name: &str,
    exclude_id: Option<i64>,
) -> Result<(), String> {
    let count: i64 = match exclude_id {
        Some(id) => {
            sqlx::query_scalar(
                "SELECT COUNT(*) FROM expense_categories
                 WHERE name = ? COLLATE NOCASE AND id <> ?",
            )
            .bind(name)
            .bind(id)
            .fetch_one(&mut **tx)
            .await
        }
        None => {
            sqlx::query_scalar(
                "SELECT COUNT(*) FROM expense_categories WHERE name = ? COLLATE NOCASE",
            )
            .bind(name)
            .fetch_one(&mut **tx)
            .await
        }
    }
    .map_err(|error| auth::db_error("Gagal memeriksa nama kategori pengeluaran", error))?;

    if count > 0 {
        return Err("Nama kategori sudah digunakan. Gunakan nama lain.".to_string());
    }

    Ok(())
}

#[tauri::command]
pub async fn create_expense_category(
    app: AppHandle,
    state: State<'_, AuthState>,
    token: String,
    name: String,
    is_active: bool,
) -> Result<i64, String> {
    let user = auth::require_role(&state, &token, &["admin"])?;
    let name = validate_category_name(&name)?;

    let pool = auth::get_pool(&app).await?;
    let mut tx = pool.begin().await.map_err(|error| {
        auth::db_error("Gagal memulai penambahan kategori pengeluaran", error)
    })?;

    ensure_unique_category_name(&mut tx, &name, None).await?;

    let result = sqlx::query(
        "INSERT INTO expense_categories (name, is_active) VALUES (?, ?)",
    )
    .bind(&name)
    .bind(active_value(is_active))
    .execute(&mut *tx)
    .await
    .map_err(|error| auth::db_error("Gagal menambah kategori pengeluaran", error))?;

    let category_id = result.last_insert_rowid();
    audit::log_action(
        &mut tx,
        &user,
        "create",
        "expense_categories",
        category_id,
        &format!("Menambah kategori pengeluaran: {name}"),
    )
    .await?;

    tx.commit().await.map_err(|error| {
        auth::db_error("Gagal menyimpan kategori pengeluaran", error)
    })?;

    Ok(category_id)
}

#[tauri::command]
pub async fn update_expense_category(
    app: AppHandle,
    state: State<'_, AuthState>,
    token: String,
    category_id: i64,
    name: String,
    is_active: bool,
) -> Result<(), String> {
    let user = auth::require_role(&state, &token, &["admin"])?;
    if category_id <= 0 {
        return Err("Kategori pengeluaran tidak valid.".to_string());
    }

    let name = validate_category_name(&name)?;

    let pool = auth::get_pool(&app).await?;
    let mut tx = pool.begin().await.map_err(|error| {
        auth::db_error("Gagal memulai pembaruan kategori pengeluaran", error)
    })?;

    category_info(&mut tx, category_id).await?;
    ensure_unique_category_name(&mut tx, &name, Some(category_id)).await?;

    let result = sqlx::query(
        "UPDATE expense_categories
         SET name = ?, is_active = ?,
             updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE id = ?",
    )
    .bind(&name)
    .bind(active_value(is_active))
    .bind(category_id)
    .execute(&mut *tx)
    .await
    .map_err(|error| auth::db_error("Gagal memperbarui kategori pengeluaran", error))?;

    if result.rows_affected() == 0 {
        return Err(
            "Kategori pengeluaran tidak ditemukan. Muat ulang daftar kategori.".to_string(),
        );
    }

    audit::log_action(
        &mut tx,
        &user,
        "update",
        "expense_categories",
        category_id,
        &format!("Memperbarui kategori pengeluaran: {name}"),
    )
    .await?;

    tx.commit().await.map_err(|error| {
        auth::db_error("Gagal menyimpan kategori pengeluaran", error)
    })?;

    Ok(())
}

#[tauri::command]
pub async fn set_expense_category_active(
    app: AppHandle,
    state: State<'_, AuthState>,
    token: String,
    category_id: i64,
    is_active: bool,
) -> Result<(), String> {
    let user = auth::require_role(&state, &token, &["admin"])?;
    if category_id <= 0 {
        return Err("Kategori pengeluaran tidak valid.".to_string());
    }

    let pool = auth::get_pool(&app).await?;
    let mut tx = pool.begin().await.map_err(|error| {
        auth::db_error("Gagal memulai perubahan status kategori pengeluaran", error)
    })?;
    let (name, _) = category_info(&mut tx, category_id).await?;

    let result = sqlx::query(
        "UPDATE expense_categories
         SET is_active = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE id = ?",
    )
    .bind(active_value(is_active))
    .bind(category_id)
    .execute(&mut *tx)
    .await
    .map_err(|error| auth::db_error("Gagal mengubah status kategori pengeluaran", error))?;

    if result.rows_affected() == 0 {
        return Err(
            "Kategori pengeluaran tidak ditemukan. Muat ulang daftar kategori.".to_string(),
        );
    }

    let description = if is_active {
        format!("Mengaktifkan kategori pengeluaran: {name}")
    } else {
        format!("Menonaktifkan kategori pengeluaran: {name}")
    };
    audit::log_action(
        &mut tx,
        &user,
        "update",
        "expense_categories",
        category_id,
        &description,
    )
    .await?;

    tx.commit().await.map_err(|error| {
        auth::db_error("Gagal menyimpan status kategori pengeluaran", error)
    })?;

    Ok(())
}

#[tauri::command]
pub async fn delete_expense_category(
    app: AppHandle,
    state: State<'_, AuthState>,
    token: String,
    category_id: i64,
) -> Result<(), String> {
    let user = auth::require_role(&state, &token, &["admin"])?;
    if category_id <= 0 {
        return Err("Kategori pengeluaran tidak valid.".to_string());
    }

    let pool = auth::get_pool(&app).await?;
    let mut tx = pool.begin().await.map_err(|error| {
        auth::db_error("Gagal memulai penghapusan kategori pengeluaran", error)
    })?;
    let (name, _) = category_info(&mut tx, category_id).await?;

    let usage_count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM expenses WHERE category_id = ?")
            .bind(category_id)
            .fetch_one(&mut *tx)
            .await
            .map_err(|error| {
                auth::db_error("Gagal memeriksa pemakaian kategori pengeluaran", error)
            })?;

    if usage_count > 0 {
        return Err(format!(
            "Kategori \"{name}\" sudah dipakai pada catatan pengeluaran. Nonaktifkan saja agar riwayat tetap utuh."
        ));
    }

    let result = sqlx::query("DELETE FROM expense_categories WHERE id = ?")
        .bind(category_id)
        .execute(&mut *tx)
        .await
        .map_err(|error| auth::db_error("Gagal menghapus kategori pengeluaran", error))?;

    if result.rows_affected() == 0 {
        return Err(
            "Kategori pengeluaran tidak ditemukan. Muat ulang daftar kategori.".to_string(),
        );
    }

    audit::log_action(
        &mut tx,
        &user,
        "delete",
        "expense_categories",
        category_id,
        &format!("Menghapus kategori pengeluaran: {name}"),
    )
    .await?;

    tx.commit().await.map_err(|error| {
        auth::db_error("Gagal menyimpan penghapusan kategori pengeluaran", error)
    })?;

    Ok(())
}

#[tauri::command]
pub async fn create_expense(
    app: AppHandle,
    state: State<'_, AuthState>,
    token: String,
    expense_date: String,
    category_id: i64,
    description: String,
    amount: i64,
) -> Result<i64, String> {
    let user = auth::require_role(&state, &token, &["admin"])?;
    if category_id <= 0 {
        return Err("Kategori pengeluaran tidak valid.".to_string());
    }

    let expense_date = validate_date(&expense_date)?;
    let description = validate_description(&description)?;
    let amount = validate_amount(amount)?;

    let pool = auth::get_pool(&app).await?;
    let mut tx = pool
        .begin()
        .await
        .map_err(|error| auth::db_error("Gagal memulai pencatatan pengeluaran", error))?;

    let (_, category_active) = category_info(&mut tx, category_id).await?;
    if category_active != 1 {
        return Err("Kategori pengeluaran nonaktif. Pilih kategori yang aktif.".to_string());
    }

    let result = sqlx::query(
        "INSERT INTO expenses (expense_date, category_id, description, amount, created_by)
         VALUES (?, ?, ?, ?, ?)",
    )
    .bind(&expense_date)
    .bind(category_id)
    .bind(&description)
    .bind(amount)
    .bind(user.id)
    .execute(&mut *tx)
    .await
    .map_err(|error| auth::db_error("Gagal mencatat pengeluaran", error))?;

    let expense_id = result.last_insert_rowid();
    audit::log_action(
        &mut tx,
        &user,
        "create",
        "expenses",
        expense_id,
        &format!(
            "Mencatat pengeluaran {description} ({})",
            format_rupiah(amount)
        ),
    )
    .await?;

    tx.commit()
        .await
        .map_err(|error| auth::db_error("Gagal menyimpan pengeluaran", error))?;

    Ok(expense_id)
}

#[tauri::command]
pub async fn update_expense(
    app: AppHandle,
    state: State<'_, AuthState>,
    token: String,
    expense_id: i64,
    expense_date: String,
    category_id: i64,
    description: String,
    amount: i64,
) -> Result<(), String> {
    let user = auth::require_role(&state, &token, &["admin"])?;
    if expense_id <= 0 {
        return Err("Pengeluaran tidak valid.".to_string());
    }
    if category_id <= 0 {
        return Err("Kategori pengeluaran tidak valid.".to_string());
    }

    let expense_date = validate_date(&expense_date)?;
    let description = validate_description(&description)?;
    let amount = validate_amount(amount)?;

    let pool = auth::get_pool(&app).await?;
    let mut tx = pool
        .begin()
        .await
        .map_err(|error| auth::db_error("Gagal memulai pembaruan pengeluaran", error))?;

    let existing: Option<(i64, String, i64)> = sqlx::query_as(
        "SELECT category_id, description, amount FROM expenses WHERE id = ?",
    )
    .bind(expense_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|error| auth::db_error("Gagal membaca pengeluaran", error))?;

    let Some((previous_category_id, _, _)) = existing else {
        return Err("Pengeluaran tidak ditemukan. Muat ulang daftar pengeluaran.".to_string());
    };

    let (_, category_active) = category_info(&mut tx, category_id).await?;
    if category_id != previous_category_id && category_active != 1 {
        return Err("Kategori pengeluaran nonaktif. Pilih kategori yang aktif.".to_string());
    }

    let result = sqlx::query(
        "UPDATE expenses
         SET expense_date = ?, category_id = ?, description = ?, amount = ?,
             updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE id = ?",
    )
    .bind(&expense_date)
    .bind(category_id)
    .bind(&description)
    .bind(amount)
    .bind(expense_id)
    .execute(&mut *tx)
    .await
    .map_err(|error| auth::db_error("Gagal memperbarui pengeluaran", error))?;

    if result.rows_affected() == 0 {
        return Err("Pengeluaran tidak ditemukan. Muat ulang daftar pengeluaran.".to_string());
    }

    audit::log_action(
        &mut tx,
        &user,
        "update",
        "expenses",
        expense_id,
        &format!(
            "Memperbarui pengeluaran {description} ({})",
            format_rupiah(amount)
        ),
    )
    .await?;

    tx.commit()
        .await
        .map_err(|error| auth::db_error("Gagal menyimpan perubahan pengeluaran", error))?;

    Ok(())
}

#[tauri::command]
pub async fn delete_expense(
    app: AppHandle,
    state: State<'_, AuthState>,
    token: String,
    expense_id: i64,
) -> Result<(), String> {
    let user = auth::require_role(&state, &token, &["admin"])?;
    if expense_id <= 0 {
        return Err("Pengeluaran tidak valid.".to_string());
    }

    let pool = auth::get_pool(&app).await?;
    let mut tx = pool
        .begin()
        .await
        .map_err(|error| auth::db_error("Gagal memulai penghapusan pengeluaran", error))?;

    let existing: Option<(String, i64)> =
        sqlx::query_as("SELECT description, amount FROM expenses WHERE id = ?")
            .bind(expense_id)
            .fetch_optional(&mut *tx)
            .await
            .map_err(|error| auth::db_error("Gagal membaca pengeluaran", error))?;

    let Some((description, amount)) = existing else {
        return Err("Pengeluaran tidak ditemukan. Muat ulang daftar pengeluaran.".to_string());
    };

    let result = sqlx::query("DELETE FROM expenses WHERE id = ?")
        .bind(expense_id)
        .execute(&mut *tx)
        .await
        .map_err(|error| auth::db_error("Gagal menghapus pengeluaran", error))?;

    if result.rows_affected() == 0 {
        return Err("Pengeluaran tidak ditemukan. Muat ulang daftar pengeluaran.".to_string());
    }

    audit::log_action(
        &mut tx,
        &user,
        "delete",
        "expenses",
        expense_id,
        &format!(
            "Menghapus pengeluaran {description} ({})",
            format_rupiah(amount)
        ),
    )
    .await?;

    tx.commit()
        .await
        .map_err(|error| auth::db_error("Gagal menyimpan penghapusan pengeluaran", error))?;

    Ok(())
}
