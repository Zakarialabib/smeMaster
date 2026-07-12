//! ERP accounting Tauri command handlers.

use tauri::{command, State};
use sqlx::SqlitePool;

use crate::db::tables::accounting::{self, Account, JournalEntry, PnlResult};

/// Seed the standard chart of accounts for a company (idempotent).
#[command]
pub async fn db_ensure_chart_of_accounts(
    pool: State<'_, SqlitePool>,
    company_id: String,
) -> Result<(), String> {
    accounting::ensure_defaults(&*pool, &company_id)
        .await
        .map_err(|e| e.to_string())
}

/// List a company's chart of accounts.
#[command]
pub async fn db_list_chart_of_accounts(
    pool: State<'_, SqlitePool>,
    company_id: String,
) -> Result<Vec<Account>, String> {
    accounting::list_by_company(&*pool, &company_id)
        .await
        .map_err(|e| e.to_string())
}

/// List a company's journal entries.
#[command]
pub async fn db_list_journal_entries(
    pool: State<'_, SqlitePool>,
    company_id: String,
) -> Result<Vec<JournalEntry>, String> {
    accounting::list_journal_entries(&*pool, &company_id)
        .await
        .map_err(|e| e.to_string())
}

/// Manually post an invoice to the ledger (usually done on send).
#[command]
pub async fn db_post_invoice_journal(
    pool: State<'_, SqlitePool>,
    invoice_id: String,
) -> Result<(), String> {
    accounting::post_invoice_journal(&*pool, &invoice_id)
        .await
        .map_err(|e| e.to_string())
}

/// Compute profit & loss for a company.
#[command]
pub async fn db_get_profit_and_loss(
    pool: State<'_, SqlitePool>,
    company_id: String,
) -> Result<PnlResult, String> {
    accounting::profit_and_loss(&*pool, &company_id)
        .await
        .map_err(|e| e.to_string())
}
