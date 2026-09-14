mod database;
mod commands;

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct AppInfo {
    name: &'static str,
    version: &'static str,
}

#[tauri::command]
fn get_app_info() -> AppInfo {
    AppInfo {
        name: "MyFinance",
        version: env!("CARGO_PKG_VERSION"),
    }
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            get_app_info,
            commands::get_accounts, commands::save_account, commands::set_account_active, commands::delete_account,
            commands::get_categories, commands::save_category, commands::set_category_active,
            commands::get_transactions, commands::save_transaction, commands::delete_transaction, commands::create_transfer,
            commands::get_dashboard, commands::get_simple_records, commands::get_setting, commands::set_setting, commands::search_all
            ,commands::save_recurring, commands::get_recurring, commands::set_recurring_active, commands::delete_recurring
            ,commands::save_planned, commands::get_planned, commands::complete_planned, commands::delete_planned, commands::cancel_planned
            ,commands::save_installment, commands::get_installments, commands::pay_installment, commands::delete_installment, commands::cancel_installment
            ,commands::save_budget, commands::get_budgets, commands::delete_budget
            ,commands::get_forecast, commands::can_buy
            ,commands::backup_database, commands::restore_database
            ,commands::get_file_info
        ])
        .run(tauri::generate_context!())
        .expect("failed to run MyFinance");
}
