mod backup_management;
mod cloud_backup;
mod commands;
mod database;
mod database_backup;
mod journey;
mod life;
mod password_vault;
mod private_calendar;
mod security;
mod workspace_search;

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
        .setup(|app| {
            database::initialize(app.handle())
                .map_err(|e| format!("数据库升级失败，原数据保留：{e}"))?;
            Ok(())
        })
        .manage(security::SecurityState::new())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            get_app_info,
            workspace_search::search_workspace,
            life::routines::list_task_routines,
            life::routines::save_task_routine,
            life::routines::generate_routine_tasks,
            life::routines::list_routine_history,
            life::routines::skip_routine_occurrence,
            life::subscriptions::list_subscriptions,
            life::subscriptions::save_subscription,
            life::subscriptions::pay_subscription,
            life::subscriptions::list_subscription_payments,
            backup_management::get_backup_status,
            backup_management::open_backup_directory,
            backup_management::save_backup_config,
            backup_management::run_automatic_backup,
            backup_management::preview_database_backup,
            cloud_backup::generate_cloud_recovery_key,
            cloud_backup::save_cloud_backup_config,
            cloud_backup::save_cloud_backup_policy,
            cloud_backup::get_cloud_backup_status,
            cloud_backup::test_cloud_backup,
            cloud_backup::list_cloud_backups,
            cloud_backup::upload_cloud_backup,
            cloud_backup::run_automatic_cloud_backup,
            cloud_backup::cleanup_cloud_backups,
            cloud_backup::set_cloud_backup_pinned,
            cloud_backup::delete_cloud_backup,
            cloud_backup::preview_cloud_backup,
            cloud_backup::restore_cloud_backup,
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
            life::tasks::list_daily_tasks,
            life::tasks::save_daily_task,
            life::tasks::set_daily_task_status,
            life::tasks::delete_daily_task,
            life::tasks::convert_journey_item_to_task,
            life::events::list_daily_events,
            life::events::get_daily_event,
            life::events::save_daily_event,
            life::events::delete_daily_event,
            life::notes::list_knowledge_notes,
            life::notes::get_knowledge_note,
            life::notes::save_knowledge_note,
            life::note_resources::stage_note_draft,
            life::note_resources::list_note_resources,
            life::note_resources::discard_note_draft,
            life::note_resources::restore_note_version,
            life::note_resources::import_note_attachment,
            life::note_resources::export_note_attachment,
            life::note_resources::delete_note_attachment,
            life::notes::set_knowledge_note_state,
            life::notes::delete_knowledge_note_permanently,
            life::today::set_today_project_pinned,
            life::today::get_today_summary,
            life::today::get_today_section,
            life::today::reorder_today_projects,
            commands::get_accounts,
            commands::save_account,
            commands::set_account_active,
            commands::delete_account,
            commands::get_categories,
            commands::save_category,
            commands::set_category_active,
            commands::get_transactions,
            commands::get_transactions_page,
            commands::save_transaction,
            commands::delete_transaction,
            commands::create_transfer,
            commands::get_transfers,
            commands::delete_transfer,
            commands::get_dashboard,
            commands::get_simple_records,
            commands::get_setting,
            commands::set_setting,
            commands::search_all,
            commands::save_recurring,
            commands::get_recurring,
            commands::set_recurring_active,
            commands::delete_recurring,
            commands::post_recurring,
            commands::undo_recurring_payment,
            commands::save_planned,
            commands::get_planned,
            commands::complete_planned,
            commands::undo_planned,
            commands::delete_planned,
            commands::cancel_planned,
            commands::save_installment,
            commands::get_installments,
            commands::pay_installment,
            commands::undo_installment_payment,
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
