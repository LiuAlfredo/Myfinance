mod commands;
mod database;
mod database_backup;
mod journey;
mod private_calendar;
mod password_vault;
mod security;

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct AppInfo {
    name: &'static str,
    version: &'static str,
}

#[tauri::command]
fn get_app_info() -> AppInfo {
    AppInfo {
        name: "My Personal Affairs",
        version: env!("CARGO_PKG_VERSION"),
    }
}

pub fn run() {
    tauri::Builder::default()
        .manage(security::SecurityState::new())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            get_app_info,
            security::verify_app_password,
            security::app_password_setup_required,
            security::setup_app_password,
            security::change_app_password,
            security::lock_private_data,
            security::unlock_password_vault,
            security::lock_password_vault,
            password_vault::list_vault_items,
            password_vault::get_vault_item,
            password_vault::save_vault_item,
            password_vault::delete_vault_item,
            commands::get_accounts,
            commands::save_account,
            commands::set_account_active,
            commands::delete_account,
            commands::get_categories,
            commands::save_category,
            commands::set_category_active,
            commands::get_transactions,
            commands::save_transaction,
            commands::delete_transaction,
            commands::create_transfer,
            commands::get_dashboard,
            commands::get_simple_records,
            commands::get_setting,
            commands::set_setting,
            commands::search_all,
            commands::save_recurring,
            commands::get_recurring,
            commands::set_recurring_active,
            commands::delete_recurring,
            commands::save_planned,
            commands::get_planned,
            commands::complete_planned,
            commands::delete_planned,
            commands::cancel_planned,
            commands::save_installment,
            commands::get_installments,
            commands::pay_installment,
            commands::delete_installment,
            commands::cancel_installment,
            commands::save_budget,
            commands::get_budgets,
            commands::delete_budget,
            commands::get_forecast,
            commands::can_buy,
            commands::backup_database,
            commands::restore_database,
            commands::get_file_info,
            journey::get_journey_dashboard,
            journey::get_journey_project,
            journey::save_journey_project,
            journey::delete_journey_project,
            journey::save_journey_project_item,
            journey::delete_journey_project_item,
            journey::save_journey_milestone,
            journey::delete_journey_milestone,
            journey::toggle_journey_milestone,
            journey::add_journey_log,
            journey::delete_journey_log,
            journey::update_journey_log,
            journey::save_journey_idea,
            journey::delete_journey_idea,
            journey::convert_journey_idea,
            journey::save_journey_goal,
            journey::delete_journey_goal,
            private_calendar::get_private_calendar_month,
            private_calendar::get_private_calendar_statistics,
            private_calendar::get_private_calendar_day,
            private_calendar::save_private_calendar_event,
            private_calendar::delete_private_calendar_event
        ])
        .run(tauri::generate_context!())
        .expect("failed to run My Personal Affairs");
}
