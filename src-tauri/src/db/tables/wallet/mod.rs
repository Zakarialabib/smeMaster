// ── Company cash wallet ──────────────────────────────────────────────────────
//
// The wallet is the business's "cash on hand" for a company. It is the single
// source of truth for available cash, and every movement (invoice payment in,
// expense/bill payment out, manual top-up/withdrawal) is mirrored into the
// double-entry ledger via the Cash account (1000) so the balance sheet stays
// consistent.
//
//   Sale invoice paid   -> credit wallet, ledger Dr Cash / Cr AR (1200)
//   Sale invoice unpaid -> debit  wallet, ledger Cr Cash / Dr AR (1200)  [reverse]
//   Bill (purchase) paid   -> debit  wallet, ledger Dr AP (2000) / Cr Cash
//   Bill (purchase) unpaid -> credit wallet, ledger Cr AP (2000) / Dr Cash [reverse]

use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use sqlx::{FromRow, SqlitePool};

use crate::db::error::AppDbError;
use crate::db::invoicing::schema::Invoice;
use crate::db::tables::accounting;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Wallet {
    pub id: String,
    pub company_id: String,
    pub currency: String,
    pub balance: i64,
    pub created_at: i64,
    pub updated_at: i64,
}

fn now() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

/// Idempotent: create the (single) wallet for a company if it does not exist.
pub async fn ensure(pool: &SqlitePool, company_id: &str, currency: &str) -> Result<Wallet, AppDbError> {
    if let Some(w) = get(pool, company_id).await? {
        return Ok(w);
    }
    let id = format!("wallet_{company_id}");
    let ts = now();
    sqlx::query(
        "INSERT INTO wallets (id, company_id, currency, balance, created_at, updated_at)
         VALUES (?, ?, ?, 0, ?, ?)",
    )
    .bind(&id)
    .bind(company_id)
    .bind(currency)
    .bind(ts)
    .bind(ts)
    .execute(pool)
    .await
    .map_err(AppDbError::Database)?;
    get(pool, company_id)
        .await?
        .ok_or_else(|| AppDbError::NotFound(format!("wallet {id} not found after insert")))
}

/// Fetch the company's wallet (if any).
pub async fn get(pool: &SqlitePool, company_id: &str) -> Result<Option<Wallet>, AppDbError> {
    sqlx::query_as::<_, Wallet>("SELECT * FROM wallets WHERE company_id = ?")
        .bind(company_id)
        .fetch_optional(pool)
        .await
        .map_err(AppDbError::Database)
}

/// Get the wallet, creating it on demand (defaults to MAD).
pub async fn get_or_ensure(pool: &SqlitePool, company_id: &str) -> Result<Wallet, AppDbError> {
    match get(pool, company_id).await? {
        Some(w) => Ok(w),
        None => ensure(pool, company_id, "MAD").await,
    }
}

async fn set_balance(pool: &SqlitePool, id: &str, balance: i64) -> Result<(), AppDbError> {
    let ts = now();
    sqlx::query("UPDATE wallets SET balance = ?, updated_at = ? WHERE id = ?")
        .bind(balance)
        .bind(ts)
        .bind(id)
        .execute(pool)
        .await
        .map_err(AppDbError::Database)?;
    Ok(())
}

/// Increase the wallet balance (cash in).
pub async fn credit(pool: &SqlitePool, company_id: &str, amount: i64) -> Result<Wallet, AppDbError> {
    let mut w = get_or_ensure(pool, company_id).await?;
    w.balance += amount;
    set_balance(pool, &w.id, w.balance).await?;
    w.updated_at = now();
    Ok(w)
}

/// Decrease the wallet balance (cash out). Balances may go negative (overdraft).
pub async fn debit(pool: &SqlitePool, company_id: &str, amount: i64) -> Result<Wallet, AppDbError> {
    let mut w = get_or_ensure(pool, company_id).await?;
    w.balance -= amount;
    set_balance(pool, &w.id, w.balance).await?;
    w.updated_at = now();
    Ok(w)
}

/// Route an invoice payment (or its reversal) through the wallet + ledger.
///
/// `is_payment = true`  means the invoice just transitioned to `paid`.
/// `is_payment = false` means it was un-paid (reversal).
pub async fn apply_payment(pool: &SqlitePool, invoice: &Invoice, is_payment: bool) -> Result<(), AppDbError> {
    let company_id = &invoice.company_id;
    accounting::ensure_defaults(pool, company_id).await?;

    if invoice.document_type == "purchase_order" {
        // Expense / bill: paid -> cash out (debit), un-paid -> reverse (credit).
        if is_payment {
            debit(pool, company_id, invoice.total_amount).await?;
        } else {
            credit(pool, company_id, invoice.total_amount).await?;
        }
    } else {
        // Sale invoice: paid -> cash in (credit), un-paid -> reverse (debit).
        if is_payment {
            credit(pool, company_id, invoice.total_amount).await?;
        } else {
            debit(pool, company_id, invoice.total_amount).await?;
        }
    }

    accounting::post_invoice_payment(pool, &invoice.id, is_payment).await
}
