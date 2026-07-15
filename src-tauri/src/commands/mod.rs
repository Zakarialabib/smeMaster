pub mod ai;
pub mod accounting;
pub mod account_import;
pub mod wallet;
pub mod calendar;
pub mod comms;
pub mod compliance;
pub mod contacts;
pub mod core;
pub mod crm;
pub mod deals;
pub mod db;
pub mod deliverability;
pub mod discovery;
pub mod idle;
pub mod imap;
pub mod invoicing;
pub mod logging;
pub mod security;
pub mod settings;
pub mod smtp;
pub mod sync;
pub mod system;
#[cfg(target_os = "android")]
pub mod system_android;
#[cfg(desktop)]
pub mod system_desktop;
pub mod pos;
pub mod tasks;
pub mod updater_commands;
pub mod onboarding_cmds;
pub mod workflows;

pub use idle::IdleRegistry;

use tauri::{Manager, Builder, Wry, Emitter};

use crate::error::{SerializedError, ERR_DB, ERR_INTERNAL};

// ============================================================================
// MASTER TAURI COMMAND REGISTRATION
// ============================================================================
//
// IMPORTANT: In Tauri v2, calling `builder.invoke_handler(...)` MULTIPLE TIMES
// REPLACES the previous handler. Each module's `register()` used to call
// invoke_handler locally, which meant only the LAST module registered was
// actually reachable (causing "Command X not found" errors).
//
// All `#[tauri::command]` functions are now registered in a SINGLE
// `generate_handler!` macro here. Each module's `register()` is a no-op
// pass-through (kept for future cross-module side effects if needed).
//
// To add a new command:
//   1. Add the `#[tauri::command]` function to its domain module
//   2. Add `module_name::fn_name` to the macro below (use `crate::` for
//      top-level modules, no prefix for submodules of `commands::`)
// ============================================================================

/// Master register function — single source of truth for ALL command handlers.
pub fn register(builder: Builder<Wry>) -> Builder<Wry> {
    builder.invoke_handler(tauri::generate_handler![
            // Reserved — not called by the frontend (see offline_queue.rs)
            crate::services::offline_queue::db_queue_offline_action,
            crate::services::offline_queue::db_take_offline_actions,
            crate::events::emit::emit_domain_event,
            // === android (mobile-only, plugin handles rest) ===
            #[cfg(target_os = "android")]
            crate::android::get_pending_share,
            #[cfg(target_os = "android")]
            crate::android::get_android_contacts,
            #[cfg(target_os = "android")]
            crate::android::get_android_calendar_events,

            // === assets (3 commands) ===
            crate::assets::get_cache_size,
            crate::assets::clear_cache,
            crate::assets::get_attachment_cache_path,

            // === background (6 commands) — also registered by plugin, but
            //   JS invokes these without `plugin:` prefix, so they must also
            //   live in the master handler.
            crate::background::schedule_background_sync,
            crate::background::cancel_background_sync,
            crate::background::get_background_sync_status,
            crate::background::register_background_accounts,
            crate::background::get_background_sync_prefs,
            crate::background::set_background_sync_prefs,

            // === system (cross-platform) ===
            system::get_system_info,
            system::is_auto_launch_enabled,
            system::enable_auto_launch,
            system::disable_auto_launch,

            // === system_android (mobile-only) ===
            #[cfg(target_os = "android")]
            system_android::check_biometric,
            #[cfg(target_os = "android")]
            system_android::authenticate_biometric,
            #[cfg(target_os = "android")]
            system_android::close_splashscreen,

            // === system_desktop (desktop-only) ===
            #[cfg(desktop)]
            system_desktop::set_tray_tooltip,
            #[cfg(desktop)]
            system_desktop::reset_window_state,
            #[cfg(desktop)]
            system_desktop::open_devtools,

            // === deliverability (submodules) ===
            crate::deliverability::diagnostic::check_domain_health,
            crate::deliverability::dnsbl::check_dnsbl_cmd,
            crate::deliverability::intelligence::get_remediation,
            crate::deliverability::sentinel::run_sentinel_check,
            crate::deliverability::sentinel::get_sentinel_alerts,

            // === device (3 in device/mod.rs + 6 in device/sync_commands) ===
            crate::device::get_pairings,
            crate::device::save_device_pairing,
            crate::device::remove_device_pairing,
            crate::device::sync_commands::push_changes,
            crate::device::sync_commands::pull_changes,
            crate::device::sync_commands::ack_sync,
            crate::device::sync_commands::sync_log_get_history,
            crate::device::sync_commands::record_change,
            crate::device::sync_commands::sync_log_maintenance,

            // === dns ===
            crate::dns::check_dns_records,

            // === export (submodules) ===
            crate::export::backup_restore::create_backup,
            crate::export::backup_restore::restore_backup,
            crate::export::backup_restore::list_backups,
            crate::export::data_export::export_contacts_csv,
            crate::export::data_export::export_contacts_vcard,
            crate::export::data_export::export_tasks_csv,
            crate::export::data_export::export_calendar_ics,
            crate::export::mbox::append_to_mbox,
            crate::export::pdf_report::export_analytics_report,
            crate::export::scheduler::get_backup_config,
            crate::export::scheduler::set_backup_config,
            crate::export::scheduler::toggle_backup,
            crate::export::types::get_export_formats,
            crate::export::types::validate_export_config,

            // === licensing (submodules) ===
            crate::licensing::hardware_id::get_hardware_id,
            #[cfg(any(debug_assertions, test))]
            crate::licensing::hardware_id::clear_hardware_id_cache,
            crate::licensing::license::validate_license,
            crate::licensing::license::activate_license,
            crate::licensing::license::deactivate_license,
            crate::licensing::license::check_feature_access,
            crate::licensing::license::get_license_info,
            #[cfg(any(debug_assertions, test))]
            crate::licensing::license::generate_test_license,

            // === notifications (only callable from main invoke_handler) ===
            crate::notifications::register_fcm_token,
            crate::notifications::handle_incoming_push,
            crate::notifications::get_push_status,

            // === oauth (4 commands) ===
            crate::oauth::start_oauth_server,
            crate::oauth::oauth_exchange_token,
            crate::oauth::start_oauth_browser,
            crate::oauth::oauth_refresh_token,

            // === orchestrator ===
            crate::orchestrator::onboarding::is_system_initialized,
            crate::orchestrator::onboarding::complete_onboarding,
            crate::orchestrator::services::get_sync_health_summary,
            crate::orchestrator::gating::get_subsystem_status,
            crate::orchestrator::gating::get_tool_state,
            crate::orchestrator::gating::apply_tool_state,

            // === commands::onboarding_cmds (6 commands) ===
            onboarding_cmds::db_save_onboarding_step,
            onboarding_cmds::db_get_onboarding_progress,
            onboarding_cmds::db_seed_demo_preset,
            onboarding_cmds::db_finalize_onboarding,
            onboarding_cmds::db_has_email_accounts,
            onboarding_cmds::db_get_tool_status,

            // === pairing (3 commands) ===
            crate::pairing::generate_qr_token,
            crate::pairing::verify_device_token,
            crate::pairing::get_qr_payload,

            // === pgp (decrypt + cache + keyring + crypto) ===
            crate::pgp::decrypt_message,
            crate::pgp::pgp_cache_passphrase,
            crate::pgp::pgp_get_cached_passphrase,
            crate::pgp::pgp_clear_passphrase_cache,
            crate::pgp::crypto::encrypt,
            crate::pgp::keyring::generate_key,
            crate::pgp::keyring::get_key_info_cmd,
            crate::pgp::keyring::rotate_pgp_key,

            // === platform ===
            crate::platform::get_platform,

            // === vault (all commands in vault/ops.rs) ===
            crate::vault::ops::get_vault_root,
            crate::vault::ops::copy_to_vault,
            crate::vault::ops::copy_to_vault_encrypted,
            crate::vault::ops::delete_from_vault,
            crate::vault::ops::list_vault_dir,
            crate::vault::ops::read_vault_file,
            crate::vault::ops::copy_vault_to_downloads,
            crate::vault::ops::create_vault_dir,
            crate::vault::ops::set_vault_pin,
            crate::vault::ops::verify_vault_pin,
            crate::vault::ops::has_vault_pin,
            crate::vault::ops::move_vault_item,
            crate::vault::ops::rename_vault_item,
            crate::vault::ops::copy_vault_item,
            crate::vault::ops::get_vault_size,
            crate::vault::ops::search_vault,
            crate::vault::ops::get_vault_items_by_category,
            crate::vault::ops::db_get_vault_items,
            crate::vault::ops::db_delete_vault_items_by_account,
            crate::vault::ops::db_count_vault_items,

            // === commands::ai (9 commands) ===
            ai::ai_download_model,
            ai::ai_load_embedding_model,
            ai::ai_index_emails,
            ai::ai_query_rag,
            ai::ai_search_by_vector,
            ai::ai_get_models_dir,
            ai::ai_delete_model,
            ai::ai_get_vector_db_path,
            ai::ai_reset_vector_db,
            ai::ai_get_email_chunks,
            ai::ai_insert_provider_vectors,
            ai::db_get_ai_cache,
            ai::db_set_ai_cache,
            ai::db_delete_ai_cache,
            ai::db_delete_ai_cache_by_thread,
            ai::db_get_ai_config_by_type,
            ai::db_upsert_ai_config,
            ai::db_delete_ai_config,
            ai::db_list_ai_configs,
            ai::db_upsert_ai_cache,

            // === commands::calendar (15 commands) ===
            calendar::db_list_calendars,
            calendar::db_list_calendar_events,
            calendar::db_get_calendar_by_id,
            calendar::db_create_calendar,
            calendar::db_update_calendar,
            calendar::db_delete_calendar,
            calendar::db_get_calendar_event_by_id,
            calendar::db_create_calendar_event,
            calendar::db_update_calendar_event,
            calendar::db_delete_calendar_event,
            calendar::db_list_snooze_presets,
            calendar::db_create_snooze_preset,
            calendar::db_delete_snooze_preset,
            calendar::db_get_calendar_by_remote_id,
            calendar::db_get_calendar_event_by_google_id,
            calendar::db_calendar_provider_type,
            calendar::db_calendar_list_calendars,
            calendar::db_calendar_test_connection,
            calendar::db_calendar_create_event,
            calendar::db_calendar_update_event,
            calendar::db_calendar_delete_event,

            // === commands::comms (112 commands) ===
            comms::db_list_filter_rules,
            comms::db_create_filter_rule,
            comms::db_list_templates,
            comms::db_list_templates_paginated,
            comms::db_get_template,
            comms::db_count_templates,
            comms::db_upsert_template,
            comms::db_delete_template,
            comms::db_increment_template_usage,
            comms::db_update_template,
            comms::db_get_favorite_templates,
            comms::db_get_most_used_templates,
            comms::db_get_templates_by_type,
            comms::db_list_template_categories,
            comms::db_upsert_template_category,
            comms::db_delete_template_category,
            comms::db_insert_template_ignore,
            comms::db_count_template_categories,
            comms::db_insert_template_category_ignore,
            comms::db_get_template_content,
            comms::db_list_signatures,
            comms::db_list_local_drafts,
            comms::db_list_scheduled_emails,
            comms::db_list_smart_folders,
            comms::db_list_quick_steps,
            comms::db_list_quick_replies,
            comms::db_list_send_as_aliases,
            comms::db_list_composer_presets,
            comms::db_get_signature,
            comms::db_upsert_signature,
            comms::db_delete_signature,
            comms::db_update_signature,
            comms::db_clear_default_signature,
            comms::db_insert_signature_ignore,
            comms::db_upsert_quick_step,
            comms::db_update_quick_step,
            comms::db_delete_quick_step,
            comms::db_reorder_quick_steps,
            comms::db_upsert_quick_reply,
            comms::db_delete_quick_reply,
            comms::db_increment_quick_reply_usage,
            comms::db_insert_quick_reply_ignore,
            comms::db_upsert_smart_folder,
            comms::db_upsert_filter_condition,
            comms::db_update_smart_folder,
            comms::db_delete_smart_folder,
            comms::db_get_local_draft,
            comms::db_upsert_local_draft,
            comms::db_delete_local_draft,
            comms::db_upsert_send_as_alias,
            comms::db_delete_send_as_alias,
            comms::db_set_sender_credential,
            comms::db_get_sender_credentials,
            comms::db_update_scheduled_email_status,
            comms::db_delete_scheduled_email,
            comms::db_update_filter,
            comms::db_delete_filter,
            comms::db_log_filter_match,
            comms::db_delete_filter_logs_older_than,
            comms::db_count_filter_rules,
            comms::db_get_enabled_filter_rules,
            comms::db_get_filter_rule,
            comms::db_get_filter_stats,
            comms::db_get_filter_logs,
            comms::db_get_recent_filter_logs,
            comms::db_get_filter_log_stats,
            comms::db_update_smart_folder_sort_order,
            comms::db_set_default_alias,
            comms::db_mark_draft_synced,
            comms::db_set_thread_categories_batch,
            comms::db_bulk_update_message_imap_folder,
            comms::db_list_thread_categories,
            comms::db_upsert_thread_category,
            comms::db_get_signature_account,
            comms::db_get_default_signature,
            comms::db_count_quick_replies,
            comms::db_get_enabled_quick_steps,
            comms::db_get_filter_group_operator,
            comms::db_delete_filter_condition,
            comms::db_upsert_filter_group,
            comms::db_delete_filter_group,
            comms::db_create_scheduled_email,
            comms::db_get_send_as_alias,
            comms::db_get_primary_alias,
            comms::db_create_send_as_alias,
            comms::db_update_send_as_alias,
            comms::db_delete_send_as_alias_full,
            comms::db_get_composer_preset,
            comms::db_get_default_composer_preset,
            comms::db_create_composer_preset,
            comms::db_update_composer_preset,
            comms::db_delete_composer_preset,
            comms::db_update_filter_rule_full,
            comms::db_delete_filter_full,
            comms::db_get_local_draft_full,
            comms::db_get_local_draft_by_remote,
            comms::db_get_quick_reply,
            comms::db_create_quick_reply,
            comms::db_increment_quick_reply_usage_for_account,
            comms::db_get_quick_step,
            comms::db_create_quick_step,
            comms::db_update_quick_step_full,
            comms::db_list_pending_scheduled_emails,
            comms::db_get_scheduled_email,
            comms::db_update_scheduled_email_status_full,
            comms::db_delete_scheduled_email_full,
            comms::db_get_signature_full,
            comms::db_create_signature,
            comms::db_get_smart_folder,
            comms::db_create_smart_folder,
            comms::db_update_smart_folder_full,
            comms::db_get_template_category,
            comms::db_create_template_category,
            comms::db_update_template_category,
            comms::db_get_template_full,
            comms::db_create_campaign_template,
            comms::db_list_campaign_schedules,
            comms::db_reorder_templates,
            comms::db_search_templates,

            // === commands::compliance (13 commands) ===
            compliance::db_list_compliance_profiles,
            compliance::db_list_compliance_checks,
            compliance::db_get_compliance_profile_by_code,
            compliance::db_create_compliance_profile,
            compliance::db_get_compliance_check,
            compliance::db_set_compliance_profile_active,
            compliance::db_set_default_compliance_profile,
            compliance::db_get_compliance_profile,
            compliance::db_upsert_compliance_profile,
            compliance::db_delete_compliance_profile,
            compliance::db_insert_compliance_profile_ignore,
            compliance::db_insert_compliance_check,
            compliance::db_delete_old_compliance_checks,

            // === commands::contacts (82 commands) ===
            contacts::db_dashboard_contacts_total,
            contacts::db_dashboard_contacts_active,
            contacts::db_dashboard_contacts_new_week,
            contacts::db_dashboard_recent_activity,
            contacts::db_dashboard_email_volume,
            contacts::db_dashboard_email_heatmap,
            contacts::db_dashboard_contact_growth,
            contacts::db_get_contact_count_for_group,
            contacts::db_contact_campaigns,
            contacts::db_contact_email_count,
            contacts::db_contact_file_count,
            contacts::db_contact_groups,
            contacts::db_contact_tags,
            contacts::db_contact_workflow_rule_count,
            contacts::db_list_contacts,
            contacts::db_count_contacts,
            contacts::db_get_contact,
            contacts::db_get_contact_by_email,
            contacts::db_upsert_contact,
            contacts::db_update_contact,
            contacts::db_delete_contact,
            contacts::db_get_contact_stats,
            contacts::db_get_contact_label_by_id,
            contacts::db_list_contact_labels,
            contacts::db_create_contact_label,
            contacts::db_delete_contact_label,
            contacts::db_list_contact_groups,
            contacts::db_create_contact_group,
            contacts::db_add_contact_to_group,
            contacts::db_remove_contact_from_group,
            contacts::db_add_entity_link,
            contacts::db_remove_entity_link,
            contacts::db_get_linked_entities,
            contacts::db_list_segments,
            contacts::db_create_segment,
            contacts::db_execute_segment_query,
            contacts::db_log_engagement,
            contacts::db_get_engagement_history,
            contacts::db_get_contact_files,
            contacts::db_search_contact_files,
            contacts::db_get_contact_file_by_id,
            contacts::db_create_contact_file_struct,
            contacts::db_delete_contact_file_by_id,
            contacts::db_create_contact_file,
            contacts::db_get_contact_files_by_sender,
            contacts::db_get_contact_files_by_account,
            contacts::db_get_contact_files_by_category,
            contacts::db_get_contact_file_categories,
            contacts::db_update_contact_file_category,
            contacts::db_toggle_contact_file_starred,
            contacts::db_delete_contact_file,
            contacts::db_get_contact_tag_by_id,
            contacts::db_upsert_contact_tag,
            contacts::db_get_contact_count_for_tag,
            contacts::db_get_contact_group_by_id,
            contacts::db_delete_contact_group_by_id,
            contacts::db_get_contact_group_full_members,
            contacts::db_upsert_contact_group,
            contacts::db_delete_contact_group,
            contacts::db_get_contact_group_member_count,
            contacts::db_get_contact_group_members,
            contacts::db_delete_contact_segment_by_id,
            contacts::db_upsert_segment,
            contacts::db_delete_segment,
            contacts::db_search_contacts,
            contacts::db_get_contact_with_stats,
            contacts::db_update_contact_score,
            contacts::db_get_contacts_needing_score_update,
            contacts::db_get_contact_engagement_data,
            contacts::db_merge_contacts,
            contacts::db_get_engagement_by_entity,
            contacts::db_get_engagement_trend,
            contacts::db_get_engagement_for_entity,
            contacts::db_get_entity_pivots_by_pivot,
            contacts::db_get_entity_graph,
            contacts::db_get_contact_activity,
            contacts::db_get_attachments_from_contact,
            contacts::db_get_contacts_from_same_domain,
            contacts::db_get_latest_auth_result,
            contacts::db_get_recent_threads_with_contact,
            contacts::db_campaign_recipients_count_by_contact,
            contacts::db_contact_files_count_by_contact,
            contacts::db_batch_update_contact_scores,
            contacts::db_create_dynamic_segment,
            contacts::db_delete_dynamic_segment,
            contacts::db_update_dynamic_segment_refresh,
            contacts::db_get_engagement_data_for_contact,
            contacts::db_list_import_history,

            // === commands::core (58 commands) ===
            core::db_get_account,
            core::db_list_accounts,
            core::db_create_account,
            core::db_update_account,
            core::db_delete_account,
            core::db_get_account_by_email,
            core::db_update_account_last_sync,
            core::db_get_messages_for_thread,
            core::db_upsert_message,
            core::db_delete_message,
            core::db_search_messages,
            core::db_update_message_flags,
            core::db_bulk_update_message_thread,
            core::db_delete_account_messages,
            core::db_get_recent_sent_messages,
            core::db_get_threads,
            core::db_get_thread,
            core::db_update_thread_metadata,
            core::db_batch_update_threads,
            core::db_upsert_thread,
            core::db_set_thread_importance,
            core::db_categorize_thread,
            core::db_delete_thread,
            core::db_delete_account_threads,
            core::db_get_all_threads,
            core::db_get_thread_last_sender,
            core::db_get_thread_count,
            core::db_get_label_unread_count,
            core::db_get_all_label_unread_counts,
            core::db_get_unread_inbox_count,
            core::db_get_muted_thread_ids,
            core::db_enrich_threads_with_sender,
            core::db_get_threads_for_category,
            core::db_set_thread_labels,
            core::db_get_thread_label_ids,
            core::db_update_thread_flags,
            core::db_get_expired_snoozed_threads,
            core::db_snooze_thread,
            core::db_unsnooze_thread,
            core::db_add_thread_label,
            core::db_remove_thread_label,
            core::db_get_labels_for_account,
            core::db_upsert_label,
            core::db_delete_label,
            core::db_delete_labels_for_account,
            core::db_update_label_sort_order,
            core::db_get_attachments_for_message,
            core::db_save_attachment_locally,
            core::db_upsert_attachment,
            core::db_get_attachments_for_account,
            core::db_get_attachment_senders,
            core::db_get_folder_sync_state,
            core::db_upsert_folder_sync_state,
            core::db_delete_folder_sync_state,
            core::db_clear_folder_sync_states,
            core::db_list_folder_sync_states,
            core::db_get_pending_scheduled_emails,
            core::db_create_attachment,
            core::db_get_label,
            core::db_get_message,
            core::db_get_message_by_folder_and_uid,
            core::db_create_sync_job,
            core::db_get_sync_job,
            core::db_update_sync_job_progress,
            core::db_mark_sync_job_done,
            core::db_list_sync_jobs,
            core::db_record_sync_conflict,
            core::db_list_sync_conflicts,
            core::db_resolve_sync_conflict,

            // === commands::crm (46 commands) ===
            crm::db_dashboard_campaigns_total,
            crm::db_dashboard_campaigns_sent,
            crm::db_dashboard_campaigns_open_rate,
            crm::db_dashboard_campaigns_click_rate,
            crm::db_list_campaigns,
            crm::db_list_campaigns_by_contact,
            crm::db_list_backup_schedules,
            crm::db_insert_analytics_snapshot,
            crm::db_update_campaign_ab_test_config,
            crm::db_set_recipient_variant,
            crm::db_insert_warming_log,
            crm::db_remove_phishing_allowlist,
            crm::db_remove_image_allowlist,
            crm::db_hold_bundled_thread,
            crm::db_release_held_threads,
            crm::db_update_bundle_rule_delivered,
            crm::db_list_bundle_rules,
            crm::db_upsert_bundle_rule,
            crm::db_delete_bundle_rule,
            crm::db_insert_bounce,
            crm::db_insert_suppression,
            crm::db_remove_suppression,
            crm::db_create_campaign,
            crm::db_get_campaign,
            crm::db_delete_campaign,
            crm::db_update_campaign_status,
            crm::db_get_campaign_stats_by_status,
            crm::db_increment_campaign_sent_count,
            crm::db_create_backup_schedule,
            crm::db_update_backup_schedule,
            crm::db_delete_backup_schedule,
            crm::db_update_backup_schedule_last_run,
            crm::db_list_warming,
            crm::db_upsert_warming,
            crm::db_update_warming,
            crm::db_delete_warming,
            crm::db_list_campaign_recipients,
            crm::db_get_campaign_recipient_status,
            crm::db_upsert_campaign_recipient,
            crm::db_update_campaign_recipient_status,
            crm::db_delete_campaign_recipient,
            crm::db_get_campaigns_for_contact,
            crm::db_list_utm_clicks,
            crm::db_create_utm_click,
            crm::db_list_utm_links,
            crm::db_get_utm_link,
            crm::db_create_utm_link,
            crm::db_increment_utm_click_count,
            crm::db_delete_utm_link,
            crm::db_create_campaign_with_recipients,
            crm::db_send_campaign,
            crm::db_add_campaign_recipients_bulk,

            // === commands::db (10 commands) ===
            db::db_execute_search_query,
            #[cfg(debug_assertions)]
            db::db_execute_insert,
            db::db_unified_search,
            db::db_reseed_demo,
            db::db_reset_and_reseed,
            db::db_init_background_services,
            db::db_wipe_all_data,
            db::db_reset_onboarding,
            db::db_health_stats,
            db::db_sync_status,
            db::db_bootstrap_state,
            db::db_status_snapshot,
            db::db_set_offline_available,
            db::db_remove_offline_available,
            db::db_list_offline_available,
            db::db_export_logs,
            db::db_get_migration_history,
            db::db_rollback_migrations,

            // === commands::deliverability (27 commands) ===
            deliverability::db_list_deliverability_configs,
            deliverability::db_list_deliverability_events,
            deliverability::db_list_newsletter_bundles,
            deliverability::db_list_blacklist_cache,
            deliverability::db_upsert_blacklist_cache,
            deliverability::db_delete_blacklist_cache,
            deliverability::db_list_arf_reports,
            deliverability::db_create_arf_report,
            deliverability::db_update_arf_report_processed,
            deliverability::db_get_arf_report,
            deliverability::db_delete_arf_report,
            deliverability::db_create_blacklist_check,
            deliverability::db_update_blacklist_check_result,
            deliverability::db_get_bundle_rule,
            deliverability::db_list_bundled_threads,
            deliverability::db_add_to_bundle,
            deliverability::db_remove_from_bundle,
            deliverability::db_get_bundled_threads_by_category,
            deliverability::db_get_deliverability_config_by_type,
            deliverability::db_upsert_deliverability_config,
            deliverability::db_delete_deliverability_config,
            deliverability::db_create_deliverability_event,
            deliverability::db_get_newsletter_bundle,
            deliverability::db_create_newsletter_bundle,
            deliverability::db_update_newsletter_bundle,
            deliverability::db_delete_newsletter_bundle,

            // === commands::deliverability — blacklist monitoring (19 commands) ===
            deliverability::db_list_blacklist_monitors,
            deliverability::db_get_blacklist_monitor,
            deliverability::db_create_blacklist_monitor,
            deliverability::db_update_blacklist_monitor,
            deliverability::db_delete_blacklist_monitor,
            deliverability::db_list_delist_requests,
            deliverability::db_get_delist_request,
            deliverability::db_create_delist_request,
            deliverability::db_update_delist_request_status,
            deliverability::db_delete_delist_request,
            deliverability::db_get_bulk_check_job,
            deliverability::db_list_bulk_check_jobs,
            deliverability::db_create_bulk_check_job,
            deliverability::db_update_bulk_check_job_progress,
            deliverability::db_complete_bulk_check_job,
            deliverability::db_fail_bulk_check_job,
            deliverability::db_get_reputation_score,
            deliverability::db_upsert_reputation_score,
            deliverability::db_get_alert_preferences,
            deliverability::db_upsert_alert_preferences,
            deliverability::db_get_subscriptions,

            // === commands::idle (2 commands) ===
            idle::start_idle,
            idle::stop_idle,

            // === commands::discovery (2 commands) ===
            discovery::discover_provider,
            discovery::discover_caldav_settings,

            // === commands::account_import (2 commands) ===
            account_import::scan_system_accounts,
            account_import::validate_discovered_account,

            // === commands::sync (protocol-abstracted) ===
            sync::sync_protocol_full,
            sync::sync_protocol_delta,
            sync::send_protocol,
            sync::test_protocol_connection,
            sync::create_graph_draft,

            // === commands::imap (27 commands) ===
            imap::imap_test_connection,
            imap::imap_list_folders,
            imap::imap_fetch_messages,
            imap::imap_fetch_new_uids,
            imap::imap_search,
            imap::imap_set_flags,
            imap::imap_move_messages,
            imap::imap_delete_messages,
            imap::imap_get_folder_status,
            imap::imap_fetch_attachment,
            imap::imap_append_message,
            imap::imap_sync,
            imap::imap_search_all_uids,
            imap::imap_fetch_message_body,
            imap::imap_fetch_raw_message,
            imap::imap_delta_check,
            imap::imap_sync_folder,
            imap::imap_search_folder,
            imap::imap_raw_fetch_diagnostic,
            imap::batch_imap_set_flags,
            imap::batch_imap_move,
            imap::batch_imap_delete,
            imap::batch_imap_fetch_metadata,
            imap::imap_fetch_message_headers,
            imap::imap_sync_folder_headers,
            imap::imap_batch_mark_read,
            imap::imap_mark_read,

            // === commands::invoicing (33 commands) ===
            invoicing::db_list_invoices,
            invoicing::db_get_invoice,
            invoicing::db_get_invoice_with_items,
            invoicing::db_create_invoice,
            invoicing::db_update_invoice,
            invoicing::db_delete_invoice,
            invoicing::db_add_invoice_item,
            invoicing::db_remove_invoice_item,
            invoicing::db_update_invoice_status,
            invoicing::db_list_clients,
            invoicing::db_get_client,
            invoicing::db_create_client,
            invoicing::db_update_client,
            invoicing::db_delete_client,
            invoicing::db_get_company_settings,
            invoicing::db_upsert_company_settings,
            invoicing::db_delete_company_settings,
            invoicing::db_list_categories,
            invoicing::db_get_category,
            invoicing::db_create_category,
            invoicing::db_update_category,
            invoicing::db_delete_category,
            invoicing::db_list_items,
            invoicing::db_get_item,
            invoicing::db_create_item,
            invoicing::db_update_item,
            invoicing::db_delete_item,
            invoicing::db_get_company,
            invoicing::db_update_company,
            invoicing::db_list_companies,
            invoicing::db_create_company,
            invoicing::db_generate_invoice_documents,
            invoicing::db_send_invoice,
            invoicing::db_calculate_invoice,
            invoicing::db_list_low_stock,

            // === commands::accounting (5 commands) ===
            accounting::db_ensure_chart_of_accounts,
            accounting::db_list_chart_of_accounts,
            accounting::db_list_journal_entries,
            accounting::db_post_invoice_journal,
            accounting::db_get_profit_and_loss,

            // === commands::wallet (4 commands) ===
            wallet::db_ensure_wallet,
            wallet::db_get_wallet,
            wallet::db_credit_wallet,
            wallet::db_debit_wallet,

            // === commands::logging (4 commands) ===
            logging::get_logs,
            logging::clear_logs,
            logging::log_event,
            logging::log_error_command,

            // === commands::security (21 commands) ===
            security::db_list_pgp_keys,
            security::db_upsert_pgp_key,
            security::db_delete_pgp_key,
            security::db_get_pgp_key,
            security::db_get_pgp_key_by_key_id,
            security::db_create_pgp_key,
            security::db_check_allowlist_target,
            security::db_list_allowlist,
            security::db_get_link_scan_result,
            security::db_upsert_link_scan_result,
            security::db_delete_link_scan_results,
            security::db_remove_notification_vip,
            security::db_list_notification_vips,
            security::db_upsert_notification_vip,
            security::db_delete_notification_vip,
            security::db_list_image_allowlist,
            security::db_upsert_image_allowlist,
            security::db_delete_image_allowlist,
            security::db_list_phishing_allowlist,
            security::db_upsert_phishing_allowlist,
            security::db_delete_phishing_allowlist,
            security::db_license_key_exists,
            security::db_get_license,
            security::db_save_license,
            security::db_delete_license,

            // === commands::settings (14 commands) ===
            settings::db_get_setting,
            settings::db_set_setting,
            settings::db_delete_setting,
            settings::db_list_settings,
            settings::db_get_theme_preference,
            settings::db_set_theme_preference,
            settings::db_cache_attachment,
            settings::db_clear_attachment_cache,
            settings::db_evict_single_attachment_cache,
            settings::db_list_writing_style_profiles,
            settings::db_upsert_writing_style_profile,
            settings::db_delete_writing_style_profile,
            settings::db_count_signatures,
            settings::db_count_compliance_profiles,

            // === commands::smtp (2 commands) ===
            smtp::smtp_send_email,
            smtp::smtp_test_connection,

            // === commands::tasks (26 commands) ===
            tasks::db_dashboard_tasks_due_today,
            tasks::db_dashboard_tasks_incomplete,
            tasks::db_dashboard_tasks_overdue,
            tasks::db_list_tasks,
            tasks::db_list_task_tags,
            tasks::db_get_task,
            tasks::db_get_task_by_id,
            tasks::db_create_task,
            tasks::db_update_task,
            tasks::db_delete_task,
            tasks::db_complete_task,
            tasks::db_uncomplete_task,
            tasks::db_reorder_tasks,
            tasks::db_get_incomplete_task_count,
            tasks::db_get_tasks_for_contact,
            tasks::db_get_tasks_due_for_reminder,
            tasks::db_get_tasks_with_workflow,
            tasks::db_get_task_tags,
            tasks::db_upsert_task_tag,
            tasks::db_delete_task_tag,
            tasks::db_get_task_tag_by_tag,
            tasks::db_get_tasks_for_account,
            tasks::db_get_tasks_with_contacts,
            tasks::db_get_tasks_with_contacts_paginated,
            tasks::db_count_tasks,
            tasks::db_get_tasks_for_thread,
            tasks::db_get_subtasks,
            tasks::db_tasks_count_by_contact,

            // === commands::updater_commands (5 commands) ===
            updater_commands::verify_update_checksum,
            updater_commands::get_rollback_version,
            updater_commands::needs_rollback,
            updater_commands::mark_successful_launch,
            updater_commands::get_app_version,

            // === pos (11 commands) ===
            pos::pos_get_hardware_configs,
            pos::pos_test_printer,
            pos::pos_print_receipt,
            pos::pos_open_cash_drawer,
            pos::db_list_products,
            pos::db_search_products,
            pos::db_create_product,
            pos::db_update_product,
            pos::db_delete_product,
            pos::db_record_sale,
            pos::db_list_sales,
            pos::db_list_sale_items,

            // === commands::workflows (28 commands) ===
            workflows::db_dashboard_workflow_rules_total,
            workflows::db_dashboard_workflow_rules_active,
            workflows::db_list_workflow_rules,
            workflows::db_list_workflow_rules_paginated,
            workflows::db_count_workflow_rules,
            workflows::db_list_active_workflow_rules,
            workflows::db_upsert_workflow_rule,
            workflows::db_update_workflow_rule_active,
            workflows::db_delete_workflow_rule,
            workflows::db_get_workflow_rule,
            workflows::db_get_follow_up_reminder,
            workflows::db_create_follow_up_reminder,
            workflows::db_list_due_follow_up_reminders,
            workflows::db_get_pending_operation,
            workflows::db_create_pending_operation,
            workflows::db_list_retryable_operations,
            workflows::db_increment_pending_retry,
            workflows::db_list_follow_up_reminders,
            workflows::db_list_pending_operations,
            workflows::db_update_operation_status,
            workflows::db_increment_retry,
            workflows::db_delete_pending_ops_by_ids,
            workflows::db_clear_failed_operations,
            workflows::db_retry_failed_operations,
            workflows::db_upsert_pending_operation,
            workflows::db_delete_pending_operation,
            workflows::db_update_follow_up_status,
            workflows::db_cancel_follow_up_for_thread,
            workflows::db_upsert_follow_up_reminder,
            workflows::db_delete_follow_up_reminder,

            // === Cleanup Rules ===
            workflows::db_list_cleanup_rules,
            workflows::db_upsert_cleanup_rule,
            workflows::db_delete_cleanup_rule,
            workflows::db_list_cleanup_history,
            workflows::db_execute_cleanup_rule,

            // === Workflow Execution Logs ===
            workflows::db_list_workflow_execution_logs,
            workflows::db_count_workflow_execution_logs,

            // === Deals / Pipeline (CRM sales) ===
            deals::db_create_deal,
            deals::db_update_deal,
            deals::db_delete_deal,
            deals::db_get_deal,
            deals::db_list_deals,
            deals::db_move_deal_stage,
            deals::db_create_pipeline,
            deals::db_list_pipelines,
            deals::db_create_deal_stage,
            deals::db_list_deal_stages,
            deals::db_get_deal_stage,
            deals::db_ensure_default_pipeline,
            deals::db_recompute_scores,

            // === reset_app (defined in this file) ===
            reset_app,
    ])
}

/// Reset the app after a full data wipe.
///
/// Called after `db_wipe_all_data` has dropped all tables and cleared caches.
/// This command re-creates the database schema, marks the system as initialized
/// (skipping the onboarding wizard), clears seed flags so seeding re-runs, and
/// deletes the tauri-store prefs file for a truly fresh start — then restarts.
///
/// After restart the orchestrator sees `is_initialized = true`, transitions to
/// Ready, and `useSeedOnFirstRun` detects missing seed flags → full reseed.
#[tauri::command]
pub async fn reset_app(
    app: tauri::AppHandle,
    pool: tauri::State<'_, sqlx::SqlitePool>,
) -> Result<(), SerializedError> {
    let app_data_dir = app.path().app_data_dir()
        .map_err(|e| SerializedError::new(ERR_INTERNAL, e.to_string()))?;

    // ── 1. Recreate database schema ───────────────────────────────────
    // Tables were dropped by db_wipe_all_data; run migrations to rebuild them.
    crate::db::migrations::run_migrations(&pool)
        .await
        .map_err(|e| SerializedError::new(ERR_DB, format!("Migration failed: {e}")))?;
    log::info!("[reset_app] Database schema recreated");

    // ── 2. Mark system as initialized ─────────────────────────────────
    // Bypass the onboarding wizard so the app transitions to Ready directly.
    let now = chrono::Utc::now().timestamp();
    sqlx::query(
        "INSERT INTO app_config (key, value, updated_at) \
         VALUES ('is_initialized', 'true', ?) \
         ON CONFLICT(key) DO UPDATE SET value = 'true', updated_at = ?"
    )
    .bind(now)
    .bind(now)
    .execute(pool.inner())
    .await
    .map_err(|e| SerializedError::from(format!("Failed to set is_initialized: {e}")))?;
    log::info!("[reset_app] System marked as initialized (onboarding skipped)");

    // ── 3. Clear seed flags ───────────────────────────────────────────
    // Forces useSeedOnFirstRun to re-seed the full demo dataset on next launch.
    sqlx::query(
        "DELETE FROM settings WHERE key IN ('demo_full_seeded', 'demo_data_seeded')"
    )
    .execute(pool.inner())
    .await
    .map_err(|e| SerializedError::from(format!("Failed to clear seed flags: {e}")))?;
    log::info!("[reset_app] Seed flags cleared");

    // ── 4. Clear tauri-store prefs file ───────────────────────────────
    // Also removes localStorage-backed prefs for a completely clean slate.
    let prefs_path = app_data_dir.join("smemaster.prefs.json");
    if tokio::fs::try_exists(&prefs_path).await.unwrap_or(false) {
        let _ = tokio::fs::remove_file(&prefs_path).await;
        log::info!("[reset_app] Tauri-store prefs cleared");
    }

    // ── 5. Reload the frontend instead of restarting the whole process ──
    // `app.restart()` re-spawns the binary, which kills the Vite dev server during
    // `tauri dev` and forces a full re-seed on launch. A soft webview reload (mirroring
    // simple-signage's reset flow) keeps the dev server alive, preserves the now-empty
    // database (the orchestrator does NOT re-run on a webview reload, so no demo data is
    // re-seeded), and lets the freshly-migrated schema be re-read immediately.
    let _ = app.emit("app:reset-complete", ());
    log::info!("[reset_app] reset complete — emitting app:reset-complete for frontend reload");
    Ok(())
}
