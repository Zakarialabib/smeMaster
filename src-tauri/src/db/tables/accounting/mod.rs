//! ERP accounting: chart of accounts + double-entry journal.
//!
//! A lightweight double-entry ledger. Invoices posted to the ledger generate
//! journal entries against a per-company chart of accounts (seeded on demand
//! from a standard template). Profit & loss is computed by aggregating the
//! revenue/expense account balances from `journal_entries`.

use sqlx::SqlitePool;

use crate::db::error::AppDbError;
use crate::db::tables::invoicing::invoices;

/// A single account in a company's chart of accounts.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, sqlx::FromRow)]
pub struct Account {
    pub id: String,
    pub company_id: String,
    pub code: String,
    pub name: String,
    /// `asset` | `liability` | `equity` | `revenue` | `expense`
    pub account_type: String,
    /// `debit` | `credit` — the side that increases the balance.
    pub normal_balance: String,
    pub parent_id: Option<String>,
    pub is_active: i64,
    pub created_at: i64,
    pub updated_at: i64,
}

/// A single (one-sided) journal line.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, sqlx::FromRow)]
pub struct JournalEntry {
    pub id: String,
    pub company_id: String,
    pub entry_date: i64,
    pub reference: Option<String>,
    pub description: Option<String>,
    pub account_id: String,
    pub debit: i64,
    pub credit: i64,
    pub currency: String,
    pub created_at: i64,
}

/// Aggregated profit & loss for a company.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct PnlResult {
    pub revenue: i64,
    pub expenses: i64,
    pub net: i64,
}

/// Standard chart-of-accounts template seeded per company.
/// (code, name, account_type, normal_balance)
const DEFAULT_CHART: &[(&str, &str, &str, &str)] = &[
    ("1000", "Cash", "asset", "debit"),
    ("1200", "Accounts Receivable", "asset", "debit"),
    ("1300", "Inventory", "asset", "debit"),
    ("2000", "Accounts Payable", "liability", "credit"),
    ("2200", "Tax Payable", "liability", "credit"),
    ("3000", "Owner's Equity", "equity", "credit"),
    ("4000", "Sales Revenue", "revenue", "credit"),
    ("5000", "Cost of Goods Sold", "expense", "debit"),
    ("6000", "Operating Expenses", "expense", "debit"),
];

/// Ensure the company has a chart of accounts; seed any missing default accounts.
///
/// Each default account is seeded only if its `code` is absent, so companies
/// that were already seeded pick up newly-added accounts (e.g. Owner's Equity)
/// on the next ledger operation.
pub async fn ensure_defaults(pool: &SqlitePool, company_id: &str) -> Result<(), AppDbError> {
    let now = chrono::Utc::now().timestamp();
    for (code, name, account_type, normal_balance) in DEFAULT_CHART {
        let exists: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM chart_of_accounts WHERE company_id = ? AND code = ?",
        )
        .bind(company_id)
        .bind(code)
        .fetch_one(pool)
        .await
        .map_err(AppDbError::Database)?;
        if exists > 0 {
            continue;
        }
        let id = uuid::Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO chart_of_accounts \
             (id, company_id, code, name, account_type, normal_balance, is_active, created_at, updated_at) \
             VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)",
        )
        .bind(&id)
        .bind(company_id)
        .bind(code)
        .bind(name)
        .bind(account_type)
        .bind(normal_balance)
        .bind(now)
        .bind(now)
        .execute(pool)
        .await
        .map_err(AppDbError::Database)?;
    }
    Ok(())
}

/// Fetch a chart-of-accounts row by its stable `code`.
pub async fn get_by_code(pool: &SqlitePool, company_id: &str, code: &str) -> Result<Account, AppDbError> {
    sqlx::query_as::<_, Account>(
        "SELECT * FROM chart_of_accounts WHERE company_id = ? AND code = ?",
    )
    .bind(company_id)
    .bind(code)
    .fetch_optional(pool)
    .await
    .map_err(AppDbError::Database)?
    .ok_or_else(|| AppDbError::NotFound(format!("Account {code} not found for company {company_id}")))
}

/// List a company's chart of accounts ordered by code.
pub async fn list_by_company(pool: &SqlitePool, company_id: &str) -> Result<Vec<Account>, AppDbError> {
    sqlx::query_as::<_, Account>(
        "SELECT * FROM chart_of_accounts WHERE company_id = ? ORDER BY code ASC",
    )
    .bind(company_id)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Post an invoice to the ledger as double-entry journal entries.
///
/// Sale (invoice / delivery_bill): Dr 1200 AR, Cr 4000 Revenue, Cr 2200 Tax.
/// Purchase (purchase_order):    Dr 1300 Inventory, Dr 2200 Tax, Cr 2000 AP.
pub async fn post_invoice_journal(pool: &SqlitePool, invoice_id: &str) -> Result<(), AppDbError> {
    let invoice = invoices::get_by_id(pool, invoice_id).await?;
    ensure_defaults(pool, &invoice.company_id).await?;
    let company_id = &invoice.company_id;
    let now = chrono::Utc::now().timestamp();

    if invoice.document_type == "purchase_order" {
        let inventory = get_by_code(pool, company_id, "1300").await?;
        let tax = get_by_code(pool, company_id, "2200").await?;
        let ap = get_by_code(pool, company_id, "2000").await?;
        insert_entry(pool, company_id, invoice_id, &format!("Purchase {}", invoice.invoice_number), &inventory.id, invoice.subtotal, 0, &invoice.currency, now).await?;
        insert_entry(pool, company_id, invoice_id, &format!("Purchase tax {}", invoice.invoice_number), &tax.id, invoice.tax_total, 0, &invoice.currency, now).await?;
        insert_entry(pool, company_id, invoice_id, &format!("Purchase AP {}", invoice.invoice_number), &ap.id, 0, invoice.total_amount, &invoice.currency, now).await?;
    } else {
        let ar = get_by_code(pool, company_id, "1200").await?;
        let revenue = get_by_code(pool, company_id, "4000").await?;
        let tax = get_by_code(pool, company_id, "2200").await?;
        insert_entry(pool, company_id, invoice_id, &format!("Invoice {}", invoice.invoice_number), &ar.id, invoice.total_amount, 0, &invoice.currency, now).await?;
        insert_entry(pool, company_id, invoice_id, &format!("Sales {}", invoice.invoice_number), &revenue.id, 0, invoice.subtotal, &invoice.currency, now).await?;
        insert_entry(pool, company_id, invoice_id, &format!("Sales tax {}", invoice.invoice_number), &tax.id, 0, invoice.tax_total, &invoice.currency, now).await?;
    }
    Ok(())
}

/// Insert a single journal line.
pub async fn insert_entry(
    pool: &SqlitePool,
    company_id: &str,
    reference: &str,
    description: &str,
    account_id: &str,
    debit: i64,
    credit: i64,
    currency: &str,
    created_at: i64,
) -> Result<(), AppDbError> {
    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO journal_entries \
         (id, company_id, entry_date, reference, description, account_id, debit, credit, currency, created_at) \
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(company_id)
    .bind(created_at)
    .bind(reference)
    .bind(description)
    .bind(account_id)
    .bind(debit)
    .bind(credit)
    .bind(currency)
    .bind(created_at)
    .execute(pool)
    .await
    .map_err(AppDbError::Database)?;
    Ok(())
}

/// List a company's journal entries in chronological order.
pub async fn list_journal_entries(pool: &SqlitePool, company_id: &str) -> Result<Vec<JournalEntry>, AppDbError> {
    sqlx::query_as::<_, JournalEntry>(
        "SELECT * FROM journal_entries WHERE company_id = ? ORDER BY created_at ASC",
    )
    .bind(company_id)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Compute profit & loss: revenue (credit balances) minus expenses (debit balances).
pub async fn profit_and_loss(pool: &SqlitePool, company_id: &str) -> Result<PnlResult, AppDbError> {
    let rows: Vec<(String, i64, i64)> = sqlx::query_as(
        "SELECT coa.account_type, COALESCE(SUM(je.debit),0), COALESCE(SUM(je.credit),0) \
         FROM journal_entries je \
         JOIN chart_of_accounts coa ON coa.id = je.account_id \
         WHERE je.company_id = ? AND coa.account_type IN ('revenue','expense') \
         GROUP BY coa.account_type",
    )
    .bind(company_id)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)?;

    let mut revenue = 0i64;
    let mut expenses = 0i64;
    for (account_type, debit, credit) in rows {
        if account_type == "revenue" {
            revenue += credit - debit;
        } else if account_type == "expense" {
            expenses += debit - credit;
        }
    }
    Ok(PnlResult { revenue, expenses, net: revenue - expenses })
}

/// Post (or reverse) the cash movement for an invoice payment, keeping the
/// company wallet in sync with the ledger's Cash account.
///
/// Sale paid     -> Dr Cash (1000) / Cr AR (1200)
/// Sale reversed -> Cr Cash (1000) / Dr AR (1200)
/// Bill paid     -> Dr AP (2000) / Cr Cash (1000)
/// Bill reversed -> Cr AP (2000) / Dr Cash (1000)
pub async fn post_invoice_payment(
    pool: &SqlitePool,
    invoice_id: &str,
    is_payment: bool,
) -> Result<(), AppDbError> {
    let invoice = invoices::get_by_id(pool, invoice_id).await?;
    let company_id = &invoice.company_id;
    let now = chrono::Utc::now().timestamp();
    let total = invoice.total_amount;
    let currency = &invoice.currency;
    let ref_no = invoice.invoice_number.clone();

    if invoice.document_type == "purchase_order" {
        let ap = get_by_code(pool, company_id, "2000").await?;
        let cash = get_by_code(pool, company_id, "1000").await?;
        if is_payment {
            insert_entry(pool, company_id, invoice_id, &format!("Pay bill {ref_no}"), &ap.id, total, 0, currency, now).await?;
            insert_entry(pool, company_id, invoice_id, &format!("Cash out {ref_no}"), &cash.id, 0, total, currency, now).await?;
        } else {
            insert_entry(pool, company_id, invoice_id, &format!("Reverse pay bill {ref_no}"), &ap.id, 0, total, currency, now).await?;
            insert_entry(pool, company_id, invoice_id, &format!("Reverse cash out {ref_no}"), &cash.id, total, 0, currency, now).await?;
        }
    } else {
        let ar = get_by_code(pool, company_id, "1200").await?;
        let cash = get_by_code(pool, company_id, "1000").await?;
        if is_payment {
            insert_entry(pool, company_id, invoice_id, &format!("Cash in {ref_no}"), &cash.id, total, 0, currency, now).await?;
            insert_entry(pool, company_id, invoice_id, &format!("Clear AR {ref_no}"), &ar.id, 0, total, currency, now).await?;
        } else {
            insert_entry(pool, company_id, invoice_id, &format!("Reverse cash in {ref_no}"), &cash.id, 0, total, currency, now).await?;
            insert_entry(pool, company_id, invoice_id, &format!("Reverse clear AR {ref_no}"), &ar.id, total, 0, currency, now).await?;
        }
    }
    Ok(())
}

/// Book a manual wallet movement (owner deposit / withdrawal) against Owner's
/// Equity so the ledger stays balanced. `is_inflow` true = top-up (Dr Cash /
/// Cr Equity), false = withdrawal (Dr Equity / Cr Cash).
pub async fn post_capital_movement(
    pool: &SqlitePool,
    company_id: &str,
    amount: i64,
    is_inflow: bool,
    reference: &str,
    description: &str,
    currency: &str,
) -> Result<(), AppDbError> {
    ensure_defaults(pool, company_id).await?;
    let now = chrono::Utc::now().timestamp();
    let cash = get_by_code(pool, company_id, "1000").await?;
    let equity = get_by_code(pool, company_id, "3000").await?;
    if is_inflow {
        insert_entry(pool, company_id, reference, description, &cash.id, amount, 0, currency, now).await?;
        insert_entry(pool, company_id, reference, description, &equity.id, 0, amount, currency, now).await?;
    } else {
        insert_entry(pool, company_id, reference, description, &equity.id, amount, 0, currency, now).await?;
        insert_entry(pool, company_id, reference, description, &cash.id, 0, amount, currency, now).await?;
    }
    Ok(())
}
