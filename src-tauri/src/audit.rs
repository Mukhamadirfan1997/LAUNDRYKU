use sqlx::{Sqlite, Transaction};

use crate::auth::{self, SessionUser};

/// Menulis log aktivitas di dalam transaksi yang sama dengan perubahan data.
///
/// Dengan cara ini perubahan data dan jejak audit tidak bisa terpisah: bila
/// salah satu gagal, seluruh transaksi dibatalkan.
pub(crate) async fn log_action(
    tx: &mut Transaction<'_, Sqlite>,
    user: &SessionUser,
    action: &str,
    entity: &str,
    entity_id: i64,
    description: &str,
) -> Result<(), String> {
    sqlx::query(
        "INSERT INTO activity_logs
            (user_id, user_name, action, entity, entity_id, description)
         VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(user.id)
    .bind(&user.username)
    .bind(action)
    .bind(entity)
    .bind(entity_id)
    .bind(description)
    .execute(&mut **tx)
    .await
    .map_err(|error| auth::db_error("Gagal mencatat aktivitas", error))?;

    Ok(())
}
