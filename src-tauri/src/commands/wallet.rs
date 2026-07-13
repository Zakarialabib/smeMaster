// ── Wallet commands (company cash hub) ──────────────────────────────────────
//
// The wallet is the business's cash on hand. Invoice payments credit it,
// expense/bill payments debit it, and manual top-ups/withdrawals are booked
// against Owner's Equity. Every movement is mirrored into the ledger so the
// balance sheet stays consistent.

use sqlx::SqlitePool;
use tauri::State;
use tauri::{command};
use crate::db::tables::wallet;
use crate::db::tables::wallet::Wallet;

#[command]
pub async fn db_ensure_wallet(pool: State<'_, SqlitePool>, company_id: String) -> Result<Wallet, String> {
    wallet::ensure(&*pool, &company_id, "MAD").await.map_err(|e| e.to_string())
}

#[command]
pub async fn db_get_wallet(pool: State<'_, SqlitePool>, company_id: String) -> Result<Wallet, String> {
    wallet::get_or_ensure(&*pool, &company_id).await.map_err(|e| e.to_string())
}

#[command]
pub async fn db_credit_wallet(
    pool: State<'_, SqlitePool>,
    company_id: String,
    amount: i64,
    reference: Option<String>,
    description: Option<String>,
) -> Result<Wallet, String> {
    let w = wallet::credit(&*pool, &company_id, amount).await.map_err(|e| e.to_string())?;
    let ref_ = reference.unwrap_or_else(|| w.id.clone());
    let desc = description.unwrap_or_else(|| "Wallet top-up".to_string());
    if let Err(e) = crate::db::tables::accounting::post_capital_movement(
        &*pool,
        &company_id,
        amount,
        true,
        &ref_,
        &desc,
        &w.currency,
    )
    .await
    {
        log::warn!("[wallet] ledger top-up failed for {company_id}: {e}");
    }
    Ok(w)
}

#[command]
pub async fn db_debit_wallet(
    pool: State<'_, SqlitePool>,
    company_id: String,
    amount: i64,
    reference: Option<String>,
    description: Option<String>,
) -> Result<Wallet, String> {
    let w = wallet::debit(&*pool, &company_id, amount).await.map_err(|e| e.to_string())?;
    let ref_ = reference.unwrap_or_else(|| w.id.clone());
    let desc = description.unwrap_or_else(|| "Wallet withdrawal".to_string());
    if let Err(e) = crate::db::tables::accounting::post_capital_movement(
        &*pool,
        &company_id,
        amount,
        false,
        &ref_,
        &desc,
        &w.currency,
    )
    .await
    {
        log::warn!("[wallet] ledger withdrawal failed for {company_id}: {e}");
    }
    Ok(w)
}
