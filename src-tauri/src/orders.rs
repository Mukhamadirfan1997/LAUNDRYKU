use serde::{Deserialize, Serialize};
use sqlx::{Sqlite, Transaction};
use tauri::{AppHandle, State};

use crate::audit;
use crate::auth::{self, AuthState, SessionUser};
use crate::validation::{
    format_rupiah, validate_customer_name, validate_date, validate_optional_text, validate_phone,
};

const MAX_PRICE: i64 = 1_000_000_000;
const MAX_SUBTOTAL: i64 = 1_000_000_000_000;
const MAX_QTY: f64 = 100_000.0;
const MAX_LINES: usize = 50;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OrderLineInput {
    pub line_type: String,
    pub ref_id: i64,
    pub price: i64,
    pub qty: f64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatedOrder {
    pub id: i64,
    pub order_number: String,
}

fn status_label(status: &str) -> &'static str {
    match status {
        "proses" => "Proses",
        "selesai" => "Selesai",
        _ => "Masuk",
    }
}

fn validate_status(value: &str) -> Result<&str, String> {
    match value.trim().to_lowercase().as_str() {
        "masuk" => Ok("masuk"),
        "proses" => Ok("proses"),
        "selesai" => Ok("selesai"),
        _ => Err("Status order tidak valid.".to_string()),
    }
}

fn validate_payment_method(value: &str) -> Result<&str, String> {
    match value.trim().to_lowercase().as_str() {
        "tunai" => Ok("tunai"),
        "transfer" => Ok("transfer"),
        "qris" => Ok("qris"),
        _ => Err("Metode pembayaran tidak valid.".to_string()),
    }
}

async fn next_order_number(
    tx: &mut Transaction<'_, Sqlite>,
    order_date: &str,
) -> Result<String, String> {
    let prefix = format!("LDR-{}-", order_date.replace('-', ""));
    let last_sequence: Option<i64> = sqlx::query_scalar(
        "SELECT MAX(CAST(SUBSTR(order_number, 14) AS INTEGER))
         FROM orders
         WHERE order_number LIKE ?",
    )
    .bind(format!("{prefix}%"))
    .fetch_one(&mut **tx)
    .await
    .map_err(|error| auth::db_error("Gagal membuat nomor order", error))?;

    let next = last_sequence.unwrap_or(0) + 1;
    Ok(format!("{prefix}{next:04}"))
}

async fn resolve_customer(
    tx: &mut Transaction<'_, Sqlite>,
    user: &SessionUser,
    customer_id: Option<i64>,
    customer_name: &str,
    customer_phone: &str,
) -> Result<(i64, String, String), String> {
    if let Some(id) = customer_id {
        if id <= 0 {
            return Err("Pelanggan tidak valid.".to_string());
        }

        let row: Option<(String, String)> =
            sqlx::query_as("SELECT name, phone FROM customers WHERE id = ?")
                .bind(id)
                .fetch_optional(&mut **tx)
                .await
                .map_err(|error| auth::db_error("Gagal membaca pelanggan", error))?;

        return match row {
            Some((name, phone)) => Ok((id, name, phone)),
            None => Err(
                "Pelanggan yang dipilih tidak ditemukan. Muat ulang daftar pelanggan."
                    .to_string(),
            ),
        };
    }

    let name = validate_customer_name(customer_name)?;
    let phone = validate_phone(customer_phone)?;

    let existing: Option<i64> =
        sqlx::query_scalar("SELECT id FROM customers WHERE phone = ? LIMIT 1")
            .bind(&phone)
            .fetch_optional(&mut **tx)
            .await
            .map_err(|error| auth::db_error("Gagal memeriksa pelanggan", error))?;

    if let Some(id) = existing {
        return Ok((id, name, phone));
    }

    let result = sqlx::query("INSERT INTO customers (name, phone) VALUES (?, ?)")
        .bind(&name)
        .bind(&phone)
        .execute(&mut **tx)
        .await
        .map_err(|error| auth::db_error("Gagal menyimpan pelanggan baru", error))?;

    let id = result.last_insert_rowid();
    audit::log_action(
        tx,
        user,
        "create",
        "customers",
        id,
        &format!("Menambah pelanggan dari transaksi: {name}"),
    )
    .await?;

    Ok((id, name, phone))
}

#[tauri::command]
pub async fn create_order(
    app: AppHandle,
    state: State<'_, AuthState>,
    token: String,
    customer_id: Option<i64>,
    customer_name: String,
    customer_phone: String,
    order_date: String,
    notes: Option<String>,
    lines: Vec<OrderLineInput>,
) -> Result<CreatedOrder, String> {
    let user = auth::require_role(&state, &token, &["admin", "kasir"])?;
    let order_date = validate_date(&order_date)?;
    let notes = validate_optional_text(notes, "Catatan", 500)?;

    if lines.is_empty() {
        return Err("Tambahkan minimal satu layanan atau barang.".to_string());
    }
    if lines.len() > MAX_LINES {
        return Err(format!("Maksimal {MAX_LINES} baris dalam satu order."));
    }

    let pool = auth::get_pool(&app).await?;
    let mut tx = pool
        .begin()
        .await
        .map_err(|error| auth::db_error("Gagal memulai transaksi baru", error))?;

    let (customer_id, customer_name, customer_phone) = resolve_customer(
        &mut tx,
        &user,
        customer_id,
        &customer_name,
        &customer_phone,
    )
    .await?;

    let order_number = next_order_number(&mut tx, &order_date).await?;

    let order_result = sqlx::query(
        "INSERT INTO orders
            (order_number, customer_id, customer_name, customer_phone, order_date,
             status, payment_status, total, notes, created_by)
         VALUES (?, ?, ?, ?, ?, 'masuk', 'belum_bayar', 0, ?, ?)",
    )
    .bind(&order_number)
    .bind(customer_id)
    .bind(&customer_name)
    .bind(&customer_phone)
    .bind(&order_date)
    .bind(notes.as_deref())
    .bind(user.id)
    .execute(&mut *tx)
    .await
    .map_err(|error| auth::db_error("Gagal membuat order", error))?;

    let order_id = order_result.last_insert_rowid();
    let mut total: i64 = 0;

    for line in &lines {
        let line_type = line.line_type.trim().to_lowercase();
        if line.ref_id <= 0 {
            return Err("Item transaksi tidak valid.".to_string());
        }
        if !line.qty.is_finite() || line.qty <= 0.0 || line.qty > MAX_QTY {
            return Err("Jumlah (qty) harus lebih dari 0 dan maksimal 100.000.".to_string());
        }
        if !(0..=MAX_PRICE).contains(&line.price) {
            return Err("Harga tidak valid.".to_string());
        }

        let (name_snapshot, unit): (String, String) = match line_type.as_str() {
            "service" => {
                let row = sqlx::query_as::<_, (String, String)>(
                    "SELECT category || ' - ' || speed, unit
                     FROM services
                     WHERE id = ? AND is_active = 1",
                )
                .bind(line.ref_id)
                .fetch_optional(&mut *tx)
                .await
                .map_err(|error| auth::db_error("Gagal membaca layanan", error))?;

                row.ok_or_else(|| {
                    "Salah satu layanan tidak ditemukan atau sudah nonaktif. Muat ulang daftar layanan."
                        .to_string()
                })?
            }
            "item" => {
                let row = sqlx::query_as::<_, (String, String)>(
                    "SELECT name, unit FROM items WHERE id = ? AND is_active = 1",
                )
                .bind(line.ref_id)
                .fetch_optional(&mut *tx)
                .await
                .map_err(|error| auth::db_error("Gagal membaca barang", error))?;

                row.ok_or_else(|| {
                    "Salah satu barang tidak ditemukan atau sudah nonaktif. Muat ulang daftar barang."
                        .to_string()
                })?
            }
            _ => return Err("Jenis item transaksi tidak valid.".to_string()),
        };

        let subtotal = (line.price as f64 * line.qty).round() as i64;
        if subtotal > MAX_SUBTOTAL {
            return Err("Subtotal item terlalu besar.".to_string());
        }

        total = total
            .checked_add(subtotal)
            .ok_or_else(|| "Total order terlalu besar.".to_string())?;

        let service_id = if line_type == "service" {
            Some(line.ref_id)
        } else {
            None
        };
        let item_id = if line_type == "item" {
            Some(line.ref_id)
        } else {
            None
        };

        sqlx::query(
            "INSERT INTO order_items
                (order_id, line_type, service_id, item_id, name_snapshot, unit,
                 price, qty, subtotal)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(order_id)
        .bind(&line_type)
        .bind(service_id)
        .bind(item_id)
        .bind(&name_snapshot)
        .bind(&unit)
        .bind(line.price)
        .bind(line.qty)
        .bind(subtotal)
        .execute(&mut *tx)
        .await
        .map_err(|error| auth::db_error("Gagal menyimpan item order", error))?;
    }

    if total <= 0 {
        return Err("Total order harus lebih dari 0.".to_string());
    }
    if total > MAX_SUBTOTAL {
        return Err("Total order terlalu besar.".to_string());
    }

    sqlx::query(
        "UPDATE orders
         SET total = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE id = ?",
    )
    .bind(total)
    .bind(order_id)
    .execute(&mut *tx)
    .await
    .map_err(|error| auth::db_error("Gagal memperbarui total order", error))?;

    audit::log_action(
        &mut tx,
        &user,
        "create",
        "orders",
        order_id,
        &format!(
            "Membuat order {order_number} untuk {customer_name} dengan total {}",
            format_rupiah(total)
        ),
    )
    .await?;

    tx.commit()
        .await
        .map_err(|error| auth::db_error("Gagal menyimpan transaksi", error))?;

    Ok(CreatedOrder {
        id: order_id,
        order_number,
    })
}

#[tauri::command]
pub async fn update_order_status(
    app: AppHandle,
    state: State<'_, AuthState>,
    token: String,
    order_id: i64,
    status: String,
) -> Result<(), String> {
    let user = auth::require_role(&state, &token, &["admin", "kasir", "operator"])?;
    if order_id <= 0 {
        return Err("Order tidak valid.".to_string());
    }
    let status = validate_status(&status)?;

    let pool = auth::get_pool(&app).await?;
    let mut tx = pool
        .begin()
        .await
        .map_err(|error| auth::db_error("Gagal memulai perubahan status order", error))?;

    let current: Option<(String, String)> =
        sqlx::query_as("SELECT order_number, status FROM orders WHERE id = ?")
            .bind(order_id)
            .fetch_optional(&mut *tx)
            .await
            .map_err(|error| auth::db_error("Gagal membaca order", error))?;

    let Some((order_number, previous_status)) = current else {
        return Err("Order tidak ditemukan. Muat ulang daftar order.".to_string());
    };

    if previous_status == status {
        return Ok(());
    }

    sqlx::query(
        "UPDATE orders
         SET status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE id = ?",
    )
    .bind(status)
    .bind(order_id)
    .execute(&mut *tx)
    .await
    .map_err(|error| auth::db_error("Gagal mengubah status order", error))?;

    audit::log_action(
        &mut tx,
        &user,
        "status_change",
        "orders",
        order_id,
        &format!(
            "Mengubah status order {order_number} dari {} menjadi {}",
            status_label(&previous_status),
            status_label(status)
        ),
    )
    .await?;

    tx.commit()
        .await
        .map_err(|error| auth::db_error("Gagal menyimpan status order", error))?;

    Ok(())
}

#[tauri::command]
pub async fn record_payment(
    app: AppHandle,
    state: State<'_, AuthState>,
    token: String,
    order_id: i64,
    amount: i64,
    method: String,
    note: Option<String>,
) -> Result<(), String> {
    let user = auth::require_role(&state, &token, &["admin", "kasir"])?;
    if order_id <= 0 {
        return Err("Order tidak valid.".to_string());
    }
    if amount <= 0 || amount > MAX_SUBTOTAL {
        return Err("Nominal pembayaran tidak valid.".to_string());
    }
    let method = validate_payment_method(&method)?;
    let note = validate_optional_text(note, "Catatan pembayaran", 250)?;

    let pool = auth::get_pool(&app).await?;
    let mut tx = pool
        .begin()
        .await
        .map_err(|error| auth::db_error("Gagal memulai pembayaran", error))?;

    let order: Option<(String, i64)> =
        sqlx::query_as("SELECT order_number, total FROM orders WHERE id = ?")
            .bind(order_id)
            .fetch_optional(&mut *tx)
            .await
            .map_err(|error| auth::db_error("Gagal membaca order", error))?;

    let Some((order_number, total)) = order else {
        return Err("Order tidak ditemukan. Muat ulang daftar order.".to_string());
    };

    let paid: i64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(amount), 0) FROM payments WHERE order_id = ?",
    )
    .bind(order_id)
    .fetch_one(&mut *tx)
    .await
    .map_err(|error| auth::db_error("Gagal membaca pembayaran order", error))?;

    let remaining = (total - paid).max(0);
    if remaining <= 0 {
        return Err("Order ini sudah lunas.".to_string());
    }
    if amount > remaining {
        return Err(format!(
            "Nominal pembayaran melebihi sisa tagihan ({}).",
            format_rupiah(remaining)
        ));
    }

    sqlx::query(
        "INSERT INTO payments (order_id, amount, method, note, created_by)
         VALUES (?, ?, ?, ?, ?)",
    )
    .bind(order_id)
    .bind(amount)
    .bind(method)
    .bind(note.as_deref())
    .bind(user.id)
    .execute(&mut *tx)
    .await
    .map_err(|error| auth::db_error("Gagal menyimpan pembayaran", error))?;

    let new_paid = paid + amount;
    let payment_status = if new_paid >= total { "lunas" } else { "dp" };

    sqlx::query(
        "UPDATE orders
         SET payment_status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE id = ?",
    )
    .bind(payment_status)
    .bind(order_id)
    .execute(&mut *tx)
    .await
    .map_err(|error| auth::db_error("Gagal memperbarui status pembayaran", error))?;

    audit::log_action(
        &mut tx,
        &user,
        "payment",
        "orders",
        order_id,
        &format!(
            "Menerima pembayaran {} via {} untuk order {order_number}",
            format_rupiah(amount),
            method
        ),
    )
    .await?;

    tx.commit()
        .await
        .map_err(|error| auth::db_error("Gagal menyimpan pembayaran", error))?;

    Ok(())
}
