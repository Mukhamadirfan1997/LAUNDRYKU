use tauri::{AppHandle, State};

use crate::auth::{self, AuthState};
use crate::validation::validate_text;

/// Mencatat ekspor laporan setelah file berhasil disimpan.
///
/// Ekspor laporan hanya boleh dilakukan Admin, sehingga pemeriksaan role
/// dilakukan kembali di Rust dan tidak bergantung pada tampilan frontend.
#[tauri::command]
pub async fn log_report_export(
    app: AppHandle,
    state: State<'_, AuthState>,
    token: String,
    report_type: String,
    period_label: String,
    format: String,
) -> Result<(), String> {
    let user = auth::require_role(&state, &token, &["admin"])?;

    let report_type = match report_type.trim() {
        "Bulanan" => "Bulanan",
        "Tahunan" => "Tahunan",
        _ => return Err("Jenis laporan tidak dikenal.".to_string()),
    };
    let period_label = validate_text(&period_label, "Periode laporan", 1, 40)?;
    let format = match format.trim() {
        "PDF" => "PDF",
        "Excel" => "Excel",
        _ => return Err("Format laporan tidak dikenal.".to_string()),
    };

    let description = format!(
        "Mengekspor laporan {report_type} {period_label} ({format})"
    );

    let pool = auth::get_pool(&app).await?;
    sqlx::query(
        "INSERT INTO activity_logs
            (user_id, user_name, action, entity, entity_id, description)
         VALUES (?, ?, 'export', 'reports', NULL, ?)",
    )
    .bind(user.id)
    .bind(&user.username)
    .bind(&description)
    .execute(&pool)
    .await
    .map_err(|error| auth::db_error("Gagal mencatat aktivitas ekspor laporan", error))?;

    Ok(())
}
