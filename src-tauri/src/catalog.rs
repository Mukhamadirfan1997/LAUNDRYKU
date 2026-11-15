use sqlx::{Sqlite, Transaction};
use tauri::{AppHandle, State};

use crate::audit;
use crate::auth::{self, AuthState};

const MAX_PRICE: i64 = 1_000_000_000;
const MAX_STOCK: i64 = 1_000_000;

fn validate_name(value: &str) -> Result<String, String> {
    validate_text(value, "Nama barang", 2, 80)
}

fn validate_unit(value: &str) -> Result<String, String> {
    validate_text(value, "Satuan", 1, 20)
}

fn validate_service_part(value: &str, label: &str) -> Result<String, String> {
    validate_text(value, label, 1, 60)
}

fn service_display_name(category: &str, speed: &str) -> String {
    format!("{category} - {speed}")
}

fn validate_text(
    value: &str,
    label: &str,
    min_length: usize,
    max_length: usize,
) -> Result<String, String> {
    let trimmed = value.trim();
    let length = trimmed.chars().count();

    if length < min_length {
        return Err(format!("{label} minimal {min_length} karakter."));
    }
    if length > max_length {
        return Err(format!("{label} maksimal {max_length} karakter."));
    }

    Ok(trimmed.to_string())
}

fn validate_amount(value: i64, label: &str, max: i64) -> Result<i64, String> {
    if value < 0 {
        return Err(format!("{label} tidak boleh negatif."));
    }
    if value > max {
        return Err(format!("{label} terlalu besar."));
    }
    Ok(value)
}

fn active_value(is_active: bool) -> i64 {
    if is_active { 1 } else { 0 }
}

async fn ensure_unique_item_name(
    tx: &mut Transaction<'_, Sqlite>,
    name: &str,
    exclude_id: Option<i64>,
) -> Result<(), String> {
    let count: i64 = match exclude_id {
        Some(id) => {
            sqlx::query_scalar(
                "SELECT COUNT(*) FROM items WHERE name = ? COLLATE NOCASE AND id <> ?",
            )
            .bind(name)
            .bind(id)
            .fetch_one(&mut **tx)
            .await
        }
        None => {
            sqlx::query_scalar("SELECT COUNT(*) FROM items WHERE name = ? COLLATE NOCASE")
                .bind(name)
                .fetch_one(&mut **tx)
                .await
        }
    }
    .map_err(|error| auth::db_error("Gagal memeriksa nama barang", error))?;

    if count > 0 {
        return Err("Nama barang sudah digunakan. Gunakan nama lain.".to_string());
    }

    Ok(())
}

async fn ensure_unique_service(
    tx: &mut Transaction<'_, Sqlite>,
    category: &str,
    speed: &str,
    exclude_id: Option<i64>,
) -> Result<(), String> {
    let count: i64 = match exclude_id {
        Some(id) => {
            sqlx::query_scalar(
                "SELECT COUNT(*) FROM services
                 WHERE category = ? COLLATE NOCASE
                   AND speed = ? COLLATE NOCASE
                   AND id <> ?",
            )
            .bind(category)
            .bind(speed)
            .bind(id)
            .fetch_one(&mut **tx)
            .await
        }
        None => {
            sqlx::query_scalar(
                "SELECT COUNT(*) FROM services
                 WHERE category = ? COLLATE NOCASE
                   AND speed = ? COLLATE NOCASE",
            )
            .bind(category)
            .bind(speed)
            .fetch_one(&mut **tx)
            .await
        }
    }
    .map_err(|error| auth::db_error("Gagal memeriksa nama layanan", error))?;

    if count > 0 {
        return Err(
            "Kombinasi kategori dan kecepatan sudah digunakan. Gunakan nama lain."
                .to_string(),
        );
    }

    Ok(())
}

async fn item_name(
    tx: &mut Transaction<'_, Sqlite>,
    item_id: i64,
) -> Result<String, String> {
    let name: Option<String> = sqlx::query_scalar("SELECT name FROM items WHERE id = ?")
        .bind(item_id)
        .fetch_optional(&mut **tx)
        .await
        .map_err(|error| auth::db_error("Gagal membaca barang", error))?;

    name.ok_or_else(|| "Barang tidak ditemukan. Muat ulang daftar barang.".to_string())
}

async fn service_label(
    tx: &mut Transaction<'_, Sqlite>,
    service_id: i64,
) -> Result<String, String> {
    let label: Option<String> = sqlx::query_scalar(
        "SELECT category || ' - ' || speed FROM services WHERE id = ?",
    )
    .bind(service_id)
    .fetch_optional(&mut **tx)
    .await
    .map_err(|error| auth::db_error("Gagal membaca layanan", error))?;

    label.ok_or_else(|| "Layanan tidak ditemukan. Muat ulang daftar layanan.".to_string())
}

#[tauri::command]
pub async fn create_item(
    app: AppHandle,
    state: State<'_, AuthState>,
    token: String,
    name: String,
    unit: String,
    price: i64,
    stock: i64,
    is_active: bool,
) -> Result<i64, String> {
    let user = auth::require_role(&state, &token, &["admin"])?;
    let name = validate_name(&name)?;
    let unit = validate_unit(&unit)?;
    let price = validate_amount(price, "Harga", MAX_PRICE)?;
    let stock = validate_amount(stock, "Stok", MAX_STOCK)?;

    let pool = auth::get_pool(&app).await?;
    let mut tx = pool
        .begin()
        .await
        .map_err(|error| auth::db_error("Gagal memulai penyimpanan barang", error))?;

    ensure_unique_item_name(&mut tx, &name, None).await?;

    let result = sqlx::query(
        "INSERT INTO items (name, unit, price, stock, is_active)
         VALUES (?, ?, ?, ?, ?)",
    )
    .bind(&name)
    .bind(&unit)
    .bind(price)
    .bind(stock)
    .bind(active_value(is_active))
    .execute(&mut *tx)
    .await
    .map_err(|error| auth::db_error("Gagal menambah barang", error))?;

    let item_id = result.last_insert_rowid();
    audit::log_action(
        &mut tx,
        &user,
        "create",
        "items",
        item_id,
        &format!("Menambah barang: {name}"),
    )
    .await?;

    tx.commit()
        .await
        .map_err(|error| auth::db_error("Gagal menyimpan barang", error))?;

    Ok(item_id)
}

#[tauri::command]
pub async fn update_item(
    app: AppHandle,
    state: State<'_, AuthState>,
    token: String,
    item_id: i64,
    name: String,
    unit: String,
    price: i64,
    stock: i64,
    is_active: bool,
) -> Result<(), String> {
    let user = auth::require_role(&state, &token, &["admin"])?;
    if item_id <= 0 {
        return Err("Barang tidak valid.".to_string());
    }

    let name = validate_name(&name)?;
    let unit = validate_unit(&unit)?;
    let price = validate_amount(price, "Harga", MAX_PRICE)?;
    let stock = validate_amount(stock, "Stok", MAX_STOCK)?;

    let pool = auth::get_pool(&app).await?;
    let mut tx = pool
        .begin()
        .await
        .map_err(|error| auth::db_error("Gagal memulai pembaruan barang", error))?;

    ensure_unique_item_name(&mut tx, &name, Some(item_id)).await?;

    let result = sqlx::query(
        "UPDATE items
         SET name = ?, unit = ?, price = ?, stock = ?, is_active = ?,
             updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE id = ?",
    )
    .bind(&name)
    .bind(&unit)
    .bind(price)
    .bind(stock)
    .bind(active_value(is_active))
    .bind(item_id)
    .execute(&mut *tx)
    .await
    .map_err(|error| auth::db_error("Gagal memperbarui barang", error))?;

    if result.rows_affected() == 0 {
        return Err("Barang tidak ditemukan. Muat ulang daftar barang.".to_string());
    }

    audit::log_action(
        &mut tx,
        &user,
        "update",
        "items",
        item_id,
        &format!("Memperbarui barang: {name}"),
    )
    .await?;

    tx.commit()
        .await
        .map_err(|error| auth::db_error("Gagal menyimpan perubahan barang", error))?;

    Ok(())
}

#[tauri::command]
pub async fn set_item_active(
    app: AppHandle,
    state: State<'_, AuthState>,
    token: String,
    item_id: i64,
    is_active: bool,
) -> Result<(), String> {
    let user = auth::require_role(&state, &token, &["admin"])?;
    if item_id <= 0 {
        return Err("Barang tidak valid.".to_string());
    }

    let pool = auth::get_pool(&app).await?;
    let mut tx = pool
        .begin()
        .await
        .map_err(|error| auth::db_error("Gagal memulai perubahan status barang", error))?;
    let name = item_name(&mut tx, item_id).await?;

    let result = sqlx::query(
        "UPDATE items
         SET is_active = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE id = ?",
    )
    .bind(active_value(is_active))
    .bind(item_id)
    .execute(&mut *tx)
    .await
    .map_err(|error| auth::db_error("Gagal mengubah status barang", error))?;

    if result.rows_affected() == 0 {
        return Err("Barang tidak ditemukan. Muat ulang daftar barang.".to_string());
    }

    let description = if is_active {
        format!("Mengaktifkan barang: {name}")
    } else {
        format!("Menonaktifkan barang: {name}")
    };
    audit::log_action(&mut tx, &user, "update", "items", item_id, &description).await?;

    tx.commit()
        .await
        .map_err(|error| auth::db_error("Gagal menyimpan status barang", error))?;

    Ok(())
}

#[tauri::command]
pub async fn delete_item(
    app: AppHandle,
    state: State<'_, AuthState>,
    token: String,
    item_id: i64,
) -> Result<(), String> {
    let user = auth::require_role(&state, &token, &["admin"])?;
    if item_id <= 0 {
        return Err("Barang tidak valid.".to_string());
    }

    let pool = auth::get_pool(&app).await?;
    let mut tx = pool
        .begin()
        .await
        .map_err(|error| auth::db_error("Gagal memulai penghapusan barang", error))?;
    let name = item_name(&mut tx, item_id).await?;

    let usage_count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM order_items WHERE item_id = ?")
            .bind(item_id)
            .fetch_one(&mut *tx)
            .await
            .map_err(|error| auth::db_error("Gagal memeriksa pemakaian barang", error))?;

    if usage_count > 0 {
        return Err(format!(
            "Barang \"{name}\" sudah dipakai pada transaksi. Nonaktifkan saja agar riwayat tetap utuh."
        ));
    }

    let result = sqlx::query("DELETE FROM items WHERE id = ?")
        .bind(item_id)
        .execute(&mut *tx)
        .await
        .map_err(|error| auth::db_error("Gagal menghapus barang", error))?;

    if result.rows_affected() == 0 {
        return Err("Barang tidak ditemukan. Muat ulang daftar barang.".to_string());
    }

    audit::log_action(
        &mut tx,
        &user,
        "delete",
        "items",
        item_id,
        &format!("Menghapus barang: {name}"),
    )
    .await?;

    tx.commit()
        .await
        .map_err(|error| auth::db_error("Gagal menyimpan penghapusan barang", error))?;

    Ok(())
}

#[tauri::command]
pub async fn create_service(
    app: AppHandle,
    state: State<'_, AuthState>,
    token: String,
    category: String,
    speed: String,
    unit: String,
    price: i64,
    is_active: bool,
) -> Result<i64, String> {
    let user = auth::require_role(&state, &token, &["admin"])?;
    let category = validate_service_part(&category, "Kategori layanan")?;
    let speed = validate_service_part(&speed, "Kecepatan layanan")?;
    let unit = validate_unit(&unit)?;
    let price = validate_amount(price, "Harga", MAX_PRICE)?;
    let label = service_display_name(&category, &speed);

    let pool = auth::get_pool(&app).await?;
    let mut tx = pool
        .begin()
        .await
        .map_err(|error| auth::db_error("Gagal memulai penambahan layanan", error))?;

    ensure_unique_service(&mut tx, &category, &speed, None).await?;

    let result = sqlx::query(
        "INSERT INTO services (category, speed, unit, price, is_active)
         VALUES (?, ?, ?, ?, ?)",
    )
    .bind(&category)
    .bind(&speed)
    .bind(&unit)
    .bind(price)
    .bind(active_value(is_active))
    .execute(&mut *tx)
    .await
    .map_err(|error| auth::db_error("Gagal menambah layanan", error))?;

    let service_id = result.last_insert_rowid();
    audit::log_action(
        &mut tx,
        &user,
        "create",
        "services",
        service_id,
        &format!("Menambah layanan: {label}"),
    )
    .await?;

    tx.commit()
        .await
        .map_err(|error| auth::db_error("Gagal menyimpan layanan", error))?;

    Ok(service_id)
}

#[tauri::command]
pub async fn update_service(
    app: AppHandle,
    state: State<'_, AuthState>,
    token: String,
    service_id: i64,
    category: String,
    speed: String,
    unit: String,
    price: i64,
    is_active: bool,
) -> Result<(), String> {
    let user = auth::require_role(&state, &token, &["admin"])?;
    if service_id <= 0 {
        return Err("Layanan tidak valid.".to_string());
    }

    let category = validate_service_part(&category, "Kategori layanan")?;
    let speed = validate_service_part(&speed, "Kecepatan layanan")?;
    let unit = validate_unit(&unit)?;
    let price = validate_amount(price, "Harga", MAX_PRICE)?;
    let label = service_display_name(&category, &speed);

    let pool = auth::get_pool(&app).await?;
    let mut tx = pool
        .begin()
        .await
        .map_err(|error| auth::db_error("Gagal memulai pembaruan layanan", error))?;
    service_label(&mut tx, service_id).await?;
    ensure_unique_service(&mut tx, &category, &speed, Some(service_id)).await?;

    let result = sqlx::query(
        "UPDATE services
         SET category = ?, speed = ?, unit = ?, price = ?, is_active = ?,
             updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE id = ?",
    )
    .bind(&category)
    .bind(&speed)
    .bind(&unit)
    .bind(price)
    .bind(active_value(is_active))
    .bind(service_id)
    .execute(&mut *tx)
    .await
    .map_err(|error| auth::db_error("Gagal memperbarui layanan", error))?;

    if result.rows_affected() == 0 {
        return Err("Layanan tidak ditemukan. Muat ulang daftar layanan.".to_string());
    }

    audit::log_action(
        &mut tx,
        &user,
        "update",
        "services",
        service_id,
        &format!("Memperbarui layanan: {label}"),
    )
    .await?;

    tx.commit()
        .await
        .map_err(|error| auth::db_error("Gagal menyimpan perubahan layanan", error))?;

    Ok(())
}

#[tauri::command]
pub async fn delete_service(
    app: AppHandle,
    state: State<'_, AuthState>,
    token: String,
    service_id: i64,
) -> Result<(), String> {
    let user = auth::require_role(&state, &token, &["admin"])?;
    if service_id <= 0 {
        return Err("Layanan tidak valid.".to_string());
    }

    let pool = auth::get_pool(&app).await?;
    let mut tx = pool
        .begin()
        .await
        .map_err(|error| auth::db_error("Gagal memulai penghapusan layanan", error))?;
    let label = service_label(&mut tx, service_id).await?;

    let usage_count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM order_items WHERE service_id = ?")
            .bind(service_id)
            .fetch_one(&mut *tx)
            .await
            .map_err(|error| auth::db_error("Gagal memeriksa pemakaian layanan", error))?;

    if usage_count > 0 {
        return Err(format!(
            "Layanan \"{label}\" sudah dipakai pada transaksi. Nonaktifkan saja agar riwayat tetap utuh."
        ));
    }

    let result = sqlx::query("DELETE FROM services WHERE id = ?")
        .bind(service_id)
        .execute(&mut *tx)
        .await
        .map_err(|error| auth::db_error("Gagal menghapus layanan", error))?;

    if result.rows_affected() == 0 {
        return Err("Layanan tidak ditemukan. Muat ulang daftar layanan.".to_string());
    }

    audit::log_action(
        &mut tx,
        &user,
        "delete",
        "services",
        service_id,
        &format!("Menghapus layanan: {label}"),
    )
    .await?;

    tx.commit()
        .await
        .map_err(|error| auth::db_error("Gagal menyimpan penghapusan layanan", error))?;

    Ok(())
}

#[tauri::command]
pub async fn set_service_active(
    app: AppHandle,
    state: State<'_, AuthState>,
    token: String,
    service_id: i64,
    is_active: bool,
) -> Result<(), String> {
    let user = auth::require_role(&state, &token, &["admin"])?;
    if service_id <= 0 {
        return Err("Layanan tidak valid.".to_string());
    }

    let pool = auth::get_pool(&app).await?;
    let mut tx = pool.begin().await.map_err(|error| {
        auth::db_error("Gagal memulai perubahan status layanan", error)
    })?;
    let label = service_label(&mut tx, service_id).await?;

    let result = sqlx::query(
        "UPDATE services
         SET is_active = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE id = ?",
    )
    .bind(active_value(is_active))
    .bind(service_id)
    .execute(&mut *tx)
    .await
    .map_err(|error| auth::db_error("Gagal mengubah status layanan", error))?;

    if result.rows_affected() == 0 {
        return Err("Layanan tidak ditemukan. Muat ulang daftar layanan.".to_string());
    }

    let description = if is_active {
        format!("Mengaktifkan layanan: {label}")
    } else {
        format!("Menonaktifkan layanan: {label}")
    };
    audit::log_action(
        &mut tx,
        &user,
        "update",
        "services",
        service_id,
        &description,
    )
    .await?;

    tx.commit()
        .await
        .map_err(|error| auth::db_error("Gagal menyimpan status layanan", error))?;

    Ok(())
}
