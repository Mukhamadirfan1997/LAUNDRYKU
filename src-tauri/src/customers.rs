use tauri::{AppHandle, State};

use crate::audit;
use crate::auth::{self, AuthState};
use crate::validation::{
    validate_customer_name, validate_optional_text, validate_phone,
};

#[tauri::command]
pub async fn create_customer(
    app: AppHandle,
    state: State<'_, AuthState>,
    token: String,
    name: String,
    phone: String,
    address: Option<String>,
    notes: Option<String>,
) -> Result<i64, String> {
    let user = auth::require_role(&state, &token, &["admin", "kasir"])?;
    let name = validate_customer_name(&name)?;
    let phone = validate_phone(&phone)?;
    let address = validate_optional_text(address, "Alamat", 250)?;
    let notes = validate_optional_text(notes, "Catatan", 500)?;

    let pool = auth::get_pool(&app).await?;
    let mut tx = pool
        .begin()
        .await
        .map_err(|error| auth::db_error("Gagal memulai penambahan pelanggan", error))?;

    let result = sqlx::query(
        "INSERT INTO customers (name, phone, address, notes)
         VALUES (?, ?, ?, ?)",
    )
    .bind(&name)
    .bind(&phone)
    .bind(address.as_deref())
    .bind(notes.as_deref())
    .execute(&mut *tx)
    .await
    .map_err(|error| auth::db_error("Gagal menambah pelanggan", error))?;

    let customer_id = result.last_insert_rowid();
    audit::log_action(
        &mut tx,
        &user,
        "create",
        "customers",
        customer_id,
        &format!("Menambah pelanggan: {name}"),
    )
    .await?;

    tx.commit()
        .await
        .map_err(|error| auth::db_error("Gagal menyimpan pelanggan", error))?;

    Ok(customer_id)
}

#[tauri::command]
pub async fn update_customer(
    app: AppHandle,
    state: State<'_, AuthState>,
    token: String,
    customer_id: i64,
    name: String,
    phone: String,
    address: Option<String>,
    notes: Option<String>,
) -> Result<(), String> {
    let user = auth::require_role(&state, &token, &["admin", "kasir"])?;
    if customer_id <= 0 {
        return Err("Pelanggan tidak valid.".to_string());
    }

    let name = validate_customer_name(&name)?;
    let phone = validate_phone(&phone)?;
    let address = validate_optional_text(address, "Alamat", 250)?;
    let notes = validate_optional_text(notes, "Catatan", 500)?;

    let pool = auth::get_pool(&app).await?;
    let mut tx = pool
        .begin()
        .await
        .map_err(|error| auth::db_error("Gagal memulai pembaruan pelanggan", error))?;

    let result = sqlx::query(
        "UPDATE customers
         SET name = ?, phone = ?, address = ?, notes = ?,
             updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE id = ?",
    )
    .bind(&name)
    .bind(&phone)
    .bind(address.as_deref())
    .bind(notes.as_deref())
    .bind(customer_id)
    .execute(&mut *tx)
    .await
    .map_err(|error| auth::db_error("Gagal memperbarui pelanggan", error))?;

    if result.rows_affected() == 0 {
        return Err("Pelanggan tidak ditemukan. Muat ulang daftar pelanggan.".to_string());
    }

    audit::log_action(
        &mut tx,
        &user,
        "update",
        "customers",
        customer_id,
        &format!("Memperbarui pelanggan: {name}"),
    )
    .await?;

    tx.commit()
        .await
        .map_err(|error| auth::db_error("Gagal menyimpan perubahan pelanggan", error))?;

    Ok(())
}

#[tauri::command]
pub async fn delete_customer(
    app: AppHandle,
    state: State<'_, AuthState>,
    token: String,
    customer_id: i64,
) -> Result<(), String> {
    let user = auth::require_role(&state, &token, &["admin", "kasir"])?;
    if customer_id <= 0 {
        return Err("Pelanggan tidak valid.".to_string());
    }

    let pool = auth::get_pool(&app).await?;
    let mut tx = pool
        .begin()
        .await
        .map_err(|error| auth::db_error("Gagal memulai penghapusan pelanggan", error))?;

    let name: Option<String> = sqlx::query_scalar("SELECT name FROM customers WHERE id = ?")
        .bind(customer_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|error| auth::db_error("Gagal membaca pelanggan", error))?;

    let Some(name) = name else {
        return Err("Pelanggan tidak ditemukan. Muat ulang daftar pelanggan.".to_string());
    };

    // Order lama tetap menyimpan snapshot nama dan nomor HP pelanggan.
    sqlx::query("UPDATE orders SET customer_id = NULL WHERE customer_id = ?")
        .bind(customer_id)
        .execute(&mut *tx)
        .await
        .map_err(|error| auth::db_error("Gagal melepaskan pelanggan dari order", error))?;

    sqlx::query("DELETE FROM customers WHERE id = ?")
        .bind(customer_id)
        .execute(&mut *tx)
        .await
        .map_err(|error| auth::db_error("Gagal menghapus pelanggan", error))?;

    audit::log_action(
        &mut tx,
        &user,
        "delete",
        "customers",
        customer_id,
        &format!("Menghapus pelanggan: {name}"),
    )
    .await?;

    tx.commit()
        .await
        .map_err(|error| auth::db_error("Gagal menyimpan penghapusan pelanggan", error))?;

    Ok(())
}
