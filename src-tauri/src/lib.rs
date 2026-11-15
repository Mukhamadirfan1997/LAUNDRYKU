use serde::Serialize;
use tauri::Manager;
use tauri_plugin_sql::{Migration, MigrationKind};

mod audit;
mod auth;
mod catalog;
mod customers;
mod expenses;
mod orders;
mod reports;
mod settings;
mod validation;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AppInfo {
    name: String,
    version: String,
    identifier: String,
    db_path: String,
}

/// Informasi dasar aplikasi untuk ditampilkan di UI dan halaman pengaturan.
#[tauri::command]
fn app_info(app: tauri::AppHandle) -> Result<AppInfo, String> {
    let db_dir = app
        .path()
        .app_config_dir()
        .map_err(|err| format!("Gagal menentukan folder data aplikasi: {err}"))?;

    Ok(AppInfo {
        name: "LaundryKu".to_string(),
        version: app.package_info().version.to_string(),
        identifier: app.config().identifier.clone(),
        db_path: db_dir.join("laundryku.db").display().to_string(),
    })
}

fn migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "buat_skema_awal",
            sql: include_str!("../migrations/0001_init.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "seed_profil_layanan_kategori",
            sql: include_str!("../migrations/0002_seed.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "layanan_kustom_crud",
            sql: include_str!("../migrations/0003_custom_services.sql"),
            kind: MigrationKind::Up,
        },
    ]
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:laundryku.db", migrations())
                .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .manage(auth::AuthState::default())
        .invoke_handler(tauri::generate_handler![
            app_info,
            auth::login,
            auth::logout,
            auth::validate_session,
            auth::log_activity,
            catalog::create_item,
            catalog::update_item,
            catalog::set_item_active,
            catalog::delete_item,
            catalog::create_service,
            catalog::update_service,
            catalog::set_service_active,
            catalog::delete_service,
            customers::create_customer,
            customers::update_customer,
            customers::delete_customer,
            orders::create_order,
            orders::update_order_status,
            orders::record_payment,
            expenses::create_expense_category,
            expenses::update_expense_category,
            expenses::set_expense_category_active,
            expenses::delete_expense_category,
            expenses::create_expense,
            expenses::update_expense,
            expenses::delete_expense,
            reports::log_report_export,
            settings::update_business_profile,
            settings::create_employee,
            settings::update_employee,
            settings::set_employee_active,
            settings::delete_employee,
            settings::create_user_account,
            settings::update_user_account,
            settings::set_user_account_active,
            settings::delete_user_account,
            settings::change_password,
            settings::prepare_database_backup,
            settings::finalize_database_backup,
            settings::discard_database_backup,
            settings::restore_database
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            if let Ok(dir) = app.path().app_config_dir() {
                let _ = std::fs::create_dir_all(&dir);
                log::info!("Folder data LaundryKu: {}", dir.display());
            }

            // Plugin SQL sudah memuat database lewat konfigurasi preload,
            // sehingga tabel siap sebelum akun admin awal dibuat.
            let handle = app.handle().clone();
            tauri::async_runtime::block_on(async move {
                if let Err(error) = auth::ensure_default_admin(&handle).await {
                    log::error!("Gagal menyiapkan akun admin awal: {error}");
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("gagal menjalankan aplikasi LaundryKu");
}
