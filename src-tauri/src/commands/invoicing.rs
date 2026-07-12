//! Invoicing domain Tauri command handlers.
//!
//! All 33 commands for managing clients, catalog items, invoices, invoice items,
//! company settings, categories, company info, document generation, and invoice lifecycle.

use serde::Deserialize;
use tauri::{command, State, AppHandle};
use tauri::Manager;
use sqlx::SqlitePool;
use std::fs;

use crate::db::invoicing::schema::{
    Invoice, InvoiceItem, InvoiceWithItems, Client, CatalogItem, CompanySetting, Category,
};
use crate::db::core::schema::Company;
use crate::db::tables::invoicing::{invoices, items, clients, catalog_items, company_settings, categories};
use crate::db::tables::wallet;
use crate::services::invoicing::pdf::generate_invoice_pdf;
use crate::services::invoicing::peppol::generate_peppol_xml;
use crate::invoicing::calc::{Money, LineOutput, calculate_document_totals, TaxMode};
use crate::db::tables::core::accounts;
use crate::db::tables::security::pgp_keys;
use crate::pgp::crypto as pgp_crypto;
use crate::smtp::client as smtp_client;
use lettre::message::{header::ContentType, Attachment, Mailbox, MultiPart, SinglePart};
use lettre::{Address, Message};

// ── Shared request types ───────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct CreateInvoiceItemRequest {
    pub description: String,
    pub qty: f64,
    pub unit: Option<String>,
    pub unit_price: i64,
    pub tax_rate: f64,
    pub sort_order: i64,
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. db_list_invoices — list invoices with optional type/status filters
// ═════════════════════════════════════════════════════════════════════════════

#[command]
pub async fn db_list_invoices(
    pool: State<'_, SqlitePool>,
    company_id: String,
    type_filter: Option<String>,
    status_filter: Option<String>,
) -> Result<Vec<Invoice>, String> {
    match (type_filter, status_filter) {
        (Some(tf), Some(sf)) => {
            sqlx::query_as::<_, Invoice>(
                "SELECT * FROM invoices WHERE company_id = ? AND deleted_at IS NULL AND type = ? AND status = ? ORDER BY created_at DESC"
            )
            .bind(&company_id)
            .bind(&tf)
            .bind(&sf)
            .fetch_all(&*pool)
            .await
            .map_err(|e| format!("Failed to list invoices: {e}"))
        }
        (Some(tf), None) => {
            sqlx::query_as::<_, Invoice>(
                "SELECT * FROM invoices WHERE company_id = ? AND deleted_at IS NULL AND type = ? ORDER BY created_at DESC"
            )
            .bind(&company_id)
            .bind(&tf)
            .fetch_all(&*pool)
            .await
            .map_err(|e| format!("Failed to list invoices: {e}"))
        }
        (None, Some(sf)) => {
            sqlx::query_as::<_, Invoice>(
                "SELECT * FROM invoices WHERE company_id = ? AND deleted_at IS NULL AND status = ? ORDER BY created_at DESC"
            )
            .bind(&company_id)
            .bind(&sf)
            .fetch_all(&*pool)
            .await
            .map_err(|e| format!("Failed to list invoices: {e}"))
        }
        (None, None) => {
            invoices::list(&*pool, &company_id)
                .await
                .map_err(|e| format!("Failed to list invoices: {e}"))
        }
    }
}

// ═════════════════════════════════════════════════════════════════════════════
// 2. db_get_invoice — get a single invoice by id
// ═════════════════════════════════════════════════════════════════════════════

#[command]
pub async fn db_get_invoice(
    pool: State<'_, SqlitePool>,
    id: String,
) -> Result<Invoice, String> {
    invoices::get_by_id(&*pool, &id)
        .await
        .map_err(|e| format!("Invoice not found: {e}"))
}

// ═════════════════════════════════════════════════════════════════════════════
// 3. db_get_invoice_with_items — get invoice + all its items
// ═════════════════════════════════════════════════════════════════════════════

#[command]
pub async fn db_get_invoice_with_items(
    pool: State<'_, SqlitePool>,
    invoice_id: String,
) -> Result<InvoiceWithItems, String> {
    let invoice = invoices::get_by_id(&*pool, &invoice_id)
        .await
        .map_err(|e| format!("Invoice not found: {e}"))?;
    let invoice_items = items::list_by_invoice(&*pool, &invoice_id)
        .await
        .map_err(|e| format!("Failed to load invoice items: {e}"))?;
    Ok(InvoiceWithItems {
        invoice,
        items: invoice_items,
    })
}

// ═════════════════════════════════════════════════════════════════════════════
// 4. db_create_invoice — create invoice with items in a transaction
// ═════════════════════════════════════════════════════════════════════════════

#[command]
pub async fn db_create_invoice(
    pool: State<'_, SqlitePool>,
    company_id: String,
    client_id: String,
    document_type: String,
    invoice_number: String,
    issue_date: i64,
    due_date: Option<i64>,
    currency: String,
    notes: Option<String>,
    items_req: Vec<CreateInvoiceItemRequest>,
) -> Result<Invoice, String> {
    let mut tx = pool.begin().await.map_err(|e| format!("DB begin failed: {e}"))?;

    // 1. Create invoice header
    let input = invoices::CreateInvoiceInput {
        company_id: &company_id,
        client_id: &client_id,
        document_type: &document_type,
        invoice_number: &invoice_number,
        issue_date,
        due_date,
        currency: &currency,
        notes: notes.as_deref(),
        created_by: &company_id,
    };
    let invoice = invoices::create(&mut *tx, input)
        .await
        .map_err(|e| format!("Failed to create invoice: {e}"))?;

    // 2. Insert items and compute line outputs
    let mut line_outputs: Vec<LineOutput> = Vec::with_capacity(items_req.len());

    for item in items_req {
        let create_input = items::CreateItemInput {
            invoice_id: &invoice.id,
            item_id: None,
            description: &item.description,
            qty: item.qty,
            unit: item.unit.as_deref().unwrap_or("pc"),
            unit_price: item.unit_price,
            tax_rate: item.tax_rate,
            sort_order: item.sort_order,
        };
        let created_item = items::create(&mut *tx, create_input)
            .await
            .map_err(|e| format!("Failed to create invoice item: {e}"))?;
        let subtotal = created_item.line_total - created_item.tax_amount;
        line_outputs.push(LineOutput {
            subtotal: Money(subtotal),
            discount: Money(0),
            taxable: Money(subtotal),
            tax_amount: Money(created_item.tax_amount),
            total: Money(created_item.line_total),
        });
    }

    // 3. Compute document totals using the calc engine
    let totals = calculate_document_totals(&line_outputs, Money(0), 0.0, TaxMode::Excluded, Money(0));

    // 4. Update invoice totals in the database
    invoices::update_totals(&mut *tx, &invoice.id, totals.net.0, totals.tax_amount.0, totals.grand_total.0)
        .await
        .map_err(|e| format!("Failed to update totals: {e}"))?;

    tx.commit().await.map_err(|e| format!("DB commit failed: {e}"))?;

    // Return the fully updated invoice
    invoices::get_by_id(&*pool, &invoice.id)
        .await
        .map_err(|e| format!("Failed to reload invoice: {e}"))
}

// ═════════════════════════════════════════════════════════════════════════════
// 5. db_update_invoice — dynamic field update
// ═════════════════════════════════════════════════════════════════════════════

#[command]
pub async fn db_update_invoice(
    pool: State<'_, SqlitePool>,
    id: String,
    status: Option<String>,
    notes: Option<String>,
    date: Option<i64>,
    due_date: Option<i64>,
    currency: Option<String>,
    client_id: Option<String>,
    items: Option<Vec<CreateInvoiceItemRequest>>,
) -> Result<Invoice, String> {
    let mut tx = pool.begin().await.map_err(|e| format!("DB begin failed: {e}"))?;

    invoices::update_invoice(
        &mut *tx, &id,
        status.as_deref(),
        notes.as_deref(),
        date,
        due_date,
        currency.as_deref(),
        client_id.as_deref(),
    )
    .await
    .map_err(|e| format!("Failed to update invoice: {e}"))?;

    if let Some(items_list) = items {
        // Delete existing items for this invoice
        items::delete_by_invoice(&mut *tx, &id)
            .await
            .map_err(|e| format!("Failed to delete invoice items: {e}"))?;

        // Insert new items and compute line outputs
        let mut line_outputs: Vec<LineOutput> = Vec::with_capacity(items_list.len());

        for item in items_list {
            let create_input = items::CreateItemInput {
                invoice_id: &id,
                item_id: None,
                description: &item.description,
                qty: item.qty,
                unit: item.unit.as_deref().unwrap_or("pc"),
                unit_price: item.unit_price,
                tax_rate: item.tax_rate,
                sort_order: item.sort_order,
            };
            let created_item = items::create(&mut *tx, create_input)
                .await
                .map_err(|e| format!("Failed to create invoice item: {e}"))?;
            let subtotal = created_item.line_total - created_item.tax_amount;
            line_outputs.push(LineOutput {
                subtotal: Money(subtotal),
                discount: Money(0),
                taxable: Money(subtotal),
                tax_amount: Money(created_item.tax_amount),
                total: Money(created_item.line_total),
            });
        }

        // Compute document totals using the calc engine
        let totals = calculate_document_totals(
            &line_outputs,
            Money(0),
            0.0,
            TaxMode::Excluded,
            Money(0),
        );

        // Update invoice totals in the database
        invoices::update_totals(
            &mut *tx,
            &id,
            totals.net.0,
            totals.tax_amount.0,
            totals.grand_total.0,
        )
        .await
        .map_err(|e| format!("Failed to update totals: {e}"))?;
    }

    tx.commit().await.map_err(|e| format!("DB commit failed: {e}"))?;

    // Return the updated invoice
    invoices::get_by_id(&*pool, &id)
        .await
        .map_err(|e| format!("Invoice not found after update: {e}"))
}

// ═════════════════════════════════════════════════════════════════════════════
// 6. db_delete_invoice — soft delete
// ═════════════════════════════════════════════════════════════════════════════

#[command]
pub async fn db_delete_invoice(
    pool: State<'_, SqlitePool>,
    id: String,
) -> Result<(), String> {
    invoices::delete(&*pool, &id)
        .await
        .map_err(|e| format!("Failed to delete invoice: {e}"))
}

// ═════════════════════════════════════════════════════════════════════════════
// 7. db_add_invoice_item — add line item to an invoice
// ═════════════════════════════════════════════════════════════════════════════

#[command]
pub async fn db_add_invoice_item(
    pool: State<'_, SqlitePool>,
    invoice_id: String,
    description: String,
    qty: f64,
    unit: Option<String>,
    unit_price: i64,
    tax_rate: f64,
    sort_order: i64,
) -> Result<InvoiceItem, String> {
    let input = items::CreateItemInput {
        invoice_id: &invoice_id,
        item_id: None,
        description: &description,
        qty,
        unit: unit.as_deref().unwrap_or("pc"),
        unit_price,
        tax_rate,
        sort_order,
    };
    let item = items::create(&*pool, input)
        .await
        .map_err(|e| format!("Failed to add item: {e}"))?;

    // Recalculate invoice totals after adding item
    let all_items = items::list_by_invoice(&*pool, &invoice_id)
        .await
        .map_err(|e| format!("Failed to load items for recalculation: {e}"))?;
    let subtotal: i64 = all_items.iter().map(|i| i.line_total - i.tax_amount).sum();
    let tax_total: i64 = all_items.iter().map(|i| i.tax_amount).sum();
    let total = subtotal + tax_total;
    invoices::update_totals(&*pool, &invoice_id, subtotal, tax_total, total)
        .await
        .map_err(|e| format!("Failed to update invoice totals: {e}"))?;

    Ok(item)
}

// ═════════════════════════════════════════════════════════════════════════════
// 8. db_remove_invoice_item — remove line item and recalculate
// ═════════════════════════════════════════════════════════════════════════════

#[command]
pub async fn db_remove_invoice_item(
    pool: State<'_, SqlitePool>,
    item_id: String,
) -> Result<(), String> {
    // Get the invoice_id before deleting the item
    let item = sqlx::query_as::<_, InvoiceItem>(
        "SELECT * FROM invoice_items WHERE id = ?"
    )
    .bind(&item_id)
    .fetch_optional(&*pool)
    .await
    .map_err(|e| format!("Failed to find item: {e}"))?
    .ok_or_else(|| format!("InvoiceItem {item_id} not found"))?;

    let invoice_id = item.invoice_id.clone();

    items::delete(&*pool, &item_id)
        .await
        .map_err(|e| format!("Failed to remove item: {e}"))?;

    // Recalculate invoice totals
    let all_items = items::list_by_invoice(&*pool, &invoice_id)
        .await
        .map_err(|e| format!("Failed to load items for recalculation: {e}"))?;
    let subtotal: i64 = all_items.iter().map(|i| i.line_total - i.tax_amount).sum();
    let tax_total: i64 = all_items.iter().map(|i| i.tax_amount).sum();
    let total = subtotal + tax_total;
    invoices::update_totals(&*pool, &invoice_id, subtotal, tax_total, total)
        .await
        .map_err(|e| format!("Failed to update invoice totals: {e}"))?;

    Ok(())
}

// ═════════════════════════════════════════════════════════════════════════════
// 9. db_update_invoice_status
// ═════════════════════════════════════════════════════════════════════════════

#[command]
pub async fn db_update_invoice_status(
    pool: State<'_, SqlitePool>,
    id: String,
    status: String,
) -> Result<(), String> {
    // Capture the previous status so we can detect a paid/unpaid transition
    // and route the cash movement through the company wallet.
    let prev = invoices::get_by_id(&*pool, &id)
        .await
        .map_err(|e| format!("Invoice not found: {e}"))?;
    let prev_paid = prev.status == "paid";
    let now_paid = status == "paid";

    invoices::update_status(&*pool, &id, &status)
        .await
        .map_err(|e| format!("Failed to update invoice status: {e}"))?;

    // Only act on a change of paid-state: paying an invoice moves cash through
    // the wallet (sale -> credit, bill -> debit); reversing it unwinds the move.
    if now_paid && !prev_paid {
        if let Err(e) = wallet::apply_payment(&*pool, &prev, true).await {
            log::warn!("[invoicing] wallet payment failed for {id}: {e}");
        }
    } else if !now_paid && prev_paid {
        if let Err(e) = wallet::apply_payment(&*pool, &prev, false).await {
            log::warn!("[invoicing] wallet reversal failed for {id}: {e}");
        }
    }

    Ok(())
}

// ═════════════════════════════════════════════════════════════════════════════
// 10. db_list_clients
// ═════════════════════════════════════════════════════════════════════════════

#[command]
pub async fn db_list_clients(
    pool: State<'_, SqlitePool>,
    role: Option<String>,
) -> Result<Vec<Client>, String> {
    clients::list(&*pool, role.as_deref())
        .await
        .map_err(|e| format!("Failed to list clients: {e}"))
}

// ═════════════════════════════════════════════════════════════════════════════
// 11. db_get_client
// ═════════════════════════════════════════════════════════════════════════════

#[command]
pub async fn db_get_client(
    pool: State<'_, SqlitePool>,
    id: String,
) -> Result<Client, String> {
    clients::get_by_id(&*pool, &id)
        .await
        .map_err(|e| format!("Client not found: {e}"))
}

// ═════════════════════════════════════════════════════════════════════════════
// 12. db_create_client
// ═════════════════════════════════════════════════════════════════════════════

#[command]
pub async fn db_create_client(
    pool: State<'_, SqlitePool>,
    company_id: String,
    name: String,
    email: Option<String>,
    phone: Option<String>,
    address: Option<String>,
    city: Option<String>,
    country: Option<String>,
    tax_id: Option<String>,
    role: Option<String>,
    credit_limit: Option<i64>,
    payment_terms: Option<i64>,
    notes: Option<String>,
) -> Result<Client, String> {
    let contact_type = match role.as_deref() {
        Some("supplier") => "supplier",
        _ => "client",
    };
    let input = clients::CreateClientInput {
        company_id: &company_id,
        display_name: &name,
        email: email.as_deref(),
        phone: phone.as_deref(),
        address: address.as_deref(),
        city: city.as_deref(),
        country: country.as_deref(),
        tax_id: tax_id.as_deref(),
        contact_type,
        credit_limit,
        payment_terms,
        notes: notes.as_deref(),
    };
    clients::create(&*pool, input)
        .await
        .map_err(|e| format!("Failed to create client: {e}"))
}

// ═════════════════════════════════════════════════════════════════════════════
// 13. db_update_client
// ═════════════════════════════════════════════════════════════════════════════

#[command]
pub async fn db_update_client(
    pool: State<'_, SqlitePool>,
    id: String,
    name: Option<String>,
    email: Option<Option<String>>,
    phone: Option<Option<String>>,
    address: Option<Option<String>>,
    city: Option<Option<String>>,
    country: Option<Option<String>>,
    tax_id: Option<Option<String>>,
    role: Option<String>,
    credit_limit: Option<i64>,
    payment_terms: Option<i64>,
    notes: Option<Option<String>>,
) -> Result<Client, String> {
    // Convert Option<Option<String>> → Option<&str>:
    //   None           → None            (field not provided, COALESCE keeps existing)
    //   Some(None)     → None            (same — COALESCE can't clear)
    //   Some(Some(v))  → Some(v)         (update field)
    let email = email.as_ref().and_then(|o| o.as_deref());
    let phone = phone.as_ref().and_then(|o| o.as_deref());
    let address = address.as_ref().and_then(|o| o.as_deref());
    let city = city.as_ref().and_then(|o| o.as_deref());
    let country = country.as_ref().and_then(|o| o.as_deref());
    let tax_id = tax_id.as_ref().and_then(|o| o.as_deref());
    let notes = notes.as_ref().and_then(|o| o.as_deref());

    let contact_type = role.as_deref();

    let input = clients::UpdateClientInput {
        display_name: name.as_deref(),
        email,
        phone,
        address,
        city,
        country,
        tax_id,
        contact_type,
        credit_limit,
        payment_terms,
        notes,
    };
    clients::update(&*pool, &id, input)
        .await
        .map_err(|e| format!("Failed to update client: {e}"))
}

// ═════════════════════════════════════════════════════════════════════════════
// 14. db_delete_client — soft delete
// ═════════════════════════════════════════════════════════════════════════════

#[command]
pub async fn db_delete_client(
    pool: State<'_, SqlitePool>,
    id: String,
    hard: Option<bool>,
) -> Result<(), String> {
    if hard.unwrap_or(false) {
        clients::hard_delete(&*pool, &id)
            .await
            .map_err(|e| format!("Failed to permanently delete client: {e}"))
    } else {
        clients::soft_delete(&*pool, &id)
            .await
            .map_err(|e| format!("Failed to delete client: {e}"))
    }
}

// ═════════════════════════════════════════════════════════════════════════════
// 15. db_get_company_settings — get company settings by company ID
// ═════════════════════════════════════════════════════════════════════════════

#[command]
pub async fn db_get_company_settings(
    pool: State<'_, SqlitePool>,
    company_id: String,
) -> Result<Option<CompanySetting>, String> {
    company_settings::get_by_company(&*pool, &company_id)
        .await
        .map_err(|e| format!("Failed to get company settings: {e}"))
}

// ═════════════════════════════════════════════════════════════════════════════
// 16. db_upsert_company_settings — create or update company settings
// ═════════════════════════════════════════════════════════════════════════════

#[command]
pub async fn db_upsert_company_settings(
    pool: State<'_, SqlitePool>,
    company_id: String,
    default_currency: Option<String>,
    default_tax_rate: Option<f64>,
    invoice_prefix: Option<String>,
    invoice_suffix: Option<String>,
    quote_prefix: Option<String>,
    default_template_id: Option<String>,
    logo_url: Option<String>,
    signature_text: Option<String>,
    bank_details: Option<String>,
    terms_default: Option<String>,
    theme_color: Option<String>,
    units_enabled: Option<String>,
    tax_position: Option<String>,
    decimal_places: Option<i64>,
) -> Result<CompanySetting, String> {
    let input = company_settings::UpsertCompanySettingInput {
        default_currency: default_currency.as_deref(),
        default_tax_rate,
        invoice_prefix: invoice_prefix.as_deref(),
        invoice_suffix: invoice_suffix.as_deref(),
        quote_prefix: quote_prefix.as_deref(),
        default_template_id: default_template_id.as_deref(),
        logo_url: logo_url.as_deref(),
        signature_text: signature_text.as_deref(),
        bank_details: bank_details.as_deref(),
        terms_default: terms_default.as_deref(),
        theme_color: theme_color.as_deref(),
        units_enabled: units_enabled.as_deref(),
        tax_position: tax_position.as_deref(),
        decimal_places,
    };
    company_settings::upsert(&*pool, &company_id, input)
        .await
        .map_err(|e| format!("Failed to upsert company settings: {e}"))
}

// ═════════════════════════════════════════════════════════════════════════════
// 17. db_delete_company_settings — delete company settings for a company
// ═════════════════════════════════════════════════════════════════════════════

#[command]
pub async fn db_delete_company_settings(
    pool: State<'_, SqlitePool>,
    company_id: String,
) -> Result<(), String> {
    company_settings::delete(&*pool, &company_id)
        .await
        .map_err(|e| format!("Failed to delete company settings: {e}"))
}

// ═════════════════════════════════════════════════════════════════════════════
// 18. db_list_categories — list categories for a company
// ═════════════════════════════════════════════════════════════════════════════

#[command]
pub async fn db_list_categories(
    pool: State<'_, SqlitePool>,
    company_id: String,
) -> Result<Vec<Category>, String> {
    categories::list(&*pool, &company_id)
        .await
        .map_err(|e| format!("Failed to list categories: {e}"))
}

// ═════════════════════════════════════════════════════════════════════════════
// 19. db_get_category — get a single category by ID
// ═════════════════════════════════════════════════════════════════════════════

#[command]
pub async fn db_get_category(
    pool: State<'_, SqlitePool>,
    id: String,
) -> Result<Category, String> {
    categories::get_by_id(&*pool, &id)
        .await
        .map_err(|e| format!("Failed to get category: {e}"))
}

// ═════════════════════════════════════════════════════════════════════════════
// 20. db_create_category — create a new category
// ═════════════════════════════════════════════════════════════════════════════

#[command]
pub async fn db_create_category(
    pool: State<'_, SqlitePool>,
    name: String,
    company_id: String,
) -> Result<Category, String> {
    categories::create(&*pool, &name, &company_id)
        .await
        .map_err(|e| format!("Failed to create category: {e}"))
}

// ═════════════════════════════════════════════════════════════════════════════
// 21. db_update_category — update a category name
// ═════════════════════════════════════════════════════════════════════════════

#[command]
pub async fn db_update_category(
    pool: State<'_, SqlitePool>,
    id: String,
    name: String,
) -> Result<Category, String> {
    categories::update(&*pool, &id, &name)
        .await
        .map_err(|e| format!("Failed to update category: {e}"))
}

// ═════════════════════════════════════════════════════════════════════════════
// 22. db_delete_category — delete a category
// ═════════════════════════════════════════════════════════════════════════════

#[command]
pub async fn db_delete_category(
    pool: State<'_, SqlitePool>,
    id: String,
) -> Result<(), String> {
    categories::delete(&*pool, &id)
        .await
        .map_err(|e| format!("Failed to delete category: {e}"))
}

// ═════════════════════════════════════════════════════════════════════════════
// 23. db_list_items — list catalog items for a company
// ═════════════════════════════════════════════════════════════════════════════

#[command]
pub async fn db_list_items(
    pool: State<'_, SqlitePool>,
    company_id: String,
) -> Result<Vec<CatalogItem>, String> {
    catalog_items::list_by_company(&*pool, &company_id)
        .await
        .map_err(|e| format!("Failed to list catalog items: {e}"))
}

// ═════════════════════════════════════════════════════════════════════════════
// 24. db_get_item — get a single catalog item
// ═════════════════════════════════════════════════════════════════════════════

#[command]
pub async fn db_get_item(
    pool: State<'_, SqlitePool>,
    id: String,
) -> Result<CatalogItem, String> {
    catalog_items::get_by_id(&*pool, &id)
        .await
        .map_err(|e| format!("Catalog item not found: {e}"))
}

// ═════════════════════════════════════════════════════════════════════════════
// 25. db_create_item — create a catalog item
// ═════════════════════════════════════════════════════════════════════════════

#[command]
pub async fn db_create_item(
    pool: State<'_, SqlitePool>,
    name: String,
    description: Option<String>,
    item_type: String,
    sku: Option<String>,
    unit: String,
    buy_price: i64,
    sell_price: i64,
    stock_qty: f64,
    stock_alert: f64,
    tax_rate: f64,
    barcode: Option<String>,
    image_url: Option<String>,
    company_id: String,
) -> Result<CatalogItem, String> {
    let input = catalog_items::CreateCatalogItemInput {
        name: &name,
        description: description.as_deref(),
        item_type: &item_type,
        sku: sku.as_deref(),
        unit: &unit,
        buy_price,
        sell_price,
        stock_qty,
        stock_alert,
        tax_rate,
        barcode: barcode.as_deref(),
        image_url: image_url.as_deref(),
        company_id: &company_id,
    };
    catalog_items::create(&*pool, input)
        .await
        .map_err(|e| format!("Failed to create catalog item: {e}"))
}

// ═════════════════════════════════════════════════════════════════════════════
// 26. db_update_item — update a catalog item
// ═════════════════════════════════════════════════════════════════════════════

#[command]
pub async fn db_update_item(
    pool: State<'_, SqlitePool>,
    id: String,
    name: Option<String>,
    description: Option<String>,
    item_type: Option<String>,
    sku: Option<String>,
    unit: Option<String>,
    buy_price: Option<i64>,
    sell_price: Option<i64>,
    stock_qty: Option<f64>,
    stock_alert: Option<f64>,
    tax_rate: Option<f64>,
    barcode: Option<String>,
    image_url: Option<String>,
    active: Option<i64>,
) -> Result<CatalogItem, String> {
    let input = catalog_items::UpdateCatalogItemInput {
        name: name.as_deref(),
        description: description.as_ref().map(|s| Some(s.as_str())),
        item_type: item_type.as_deref(),
        sku: sku.as_ref().map(|s| Some(s.as_str())),
        unit: unit.as_deref(),
        buy_price,
        sell_price,
        stock_qty,
        stock_alert,
        tax_rate,
        barcode: barcode.as_ref().map(|s| Some(s.as_str())),
        image_url: image_url.as_ref().map(|s| Some(s.as_str())),
        active,
    };
    catalog_items::update(&*pool, &id, input)
        .await
        .map_err(|e| format!("Failed to update item: {e}"))
}

// ═════════════════════════════════════════════════════════════════════════════
// 27. db_delete_item — soft delete (set active=0)
// ═════════════════════════════════════════════════════════════════════════════

#[command]
pub async fn db_delete_item(
    pool: State<'_, SqlitePool>,
    id: String,
) -> Result<(), String> {
    catalog_items::soft_delete(&*pool, &id)
        .await
        .map_err(|e| format!("Failed to delete catalog item: {e}"))
}

// ═════════════════════════════════════════════════════════════════════════════
// 28. db_get_company
// ═════════════════════════════════════════════════════════════════════════════

#[command]
pub async fn db_get_company(
    pool: State<'_, SqlitePool>,
    company_id: String,
) -> Result<Company, String> {
    sqlx::query_as::<_, Company>("SELECT * FROM companies WHERE id = ?")
        .bind(&company_id)
        .fetch_optional(&*pool)
        .await
        .map_err(|e| format!("DB error: {e}"))?
        .ok_or_else(|| format!("Company {company_id} not found"))
}

// ═════════════════════════════════════════════════════════════════════════════
// 29. db_update_company — update company fields incl. ICE/IF/RC/CNSS
// ═════════════════════════════════════════════════════════════════════════════

#[command]
pub async fn db_update_company(
    pool: State<'_, SqlitePool>,
    company_id: String,
    name: Option<String>,
    legal_name: Option<Option<String>>,
    email: Option<Option<String>>,
    phone: Option<Option<String>>,
    address_line1: Option<Option<String>>,
    address_line2: Option<Option<String>>,
    city: Option<Option<String>>,
    state: Option<Option<String>>,
    postal_code: Option<Option<String>>,
    country: Option<Option<String>>,
    website: Option<Option<String>>,
    industry: Option<Option<String>>,
    timezone: Option<String>,
    logo_url: Option<Option<String>>,
    ice: Option<Option<String>>,
    tax_id: Option<Option<String>>,
    rc: Option<Option<String>>,
    cnss: Option<Option<String>>,
) -> Result<Company, String> {
    let now = chrono::Utc::now().timestamp();

    sqlx::query_as::<_, Company>(
        r#"
        UPDATE companies SET
            name = COALESCE(?, name),
            legal_name = COALESCE(?, legal_name),
            email = COALESCE(?, email),
            phone = COALESCE(?, phone),
            address_line1 = COALESCE(?, address_line1),
            address_line2 = COALESCE(?, address_line2),
            city = COALESCE(?, city),
            state = COALESCE(?, state),
            postal_code = COALESCE(?, postal_code),
            country = COALESCE(?, country),
            website = COALESCE(?, website),
            industry = COALESCE(?, industry),
            timezone = COALESCE(?, timezone),
            logo_url = COALESCE(?, logo_url),
            ice = COALESCE(?, ice),
            tax_id = COALESCE(?, tax_id),
            rc = COALESCE(?, rc),
            cnss = COALESCE(?, cnss),
            updated_at = ?
        WHERE id = ?
        RETURNING *
        "#,
    )
    .bind(name)
    .bind(legal_name)
    .bind(email)
    .bind(phone)
    .bind(address_line1)
    .bind(address_line2)
    .bind(city)
    .bind(state)
    .bind(postal_code)
    .bind(country)
    .bind(website)
    .bind(industry)
    .bind(timezone)
    .bind(logo_url)
    .bind(ice)
    .bind(tax_id)
    .bind(rc)
    .bind(cnss)
    .bind(now)
    .bind(&company_id)
    .fetch_optional(&*pool)
    .await
    .map_err(|e| format!("Failed to update company: {e}"))?
    .ok_or_else(|| format!("Company {company_id} not found"))
}

// ═════════════════════════════════════════════════════════════════════════════
// 30. db_generate_invoice_documents — generate PEPPOL XML + PDF, save to vault
// ═════════════════════════════════════════════════════════════════════════════

#[command]
pub async fn db_generate_invoice_documents(
    pool: State<'_, SqlitePool>,
    app_handle: AppHandle,
    invoice_id: String,
) -> Result<(String, String), String> {
    // Fetch invoice with items
    let invoice_with_items = db_get_invoice_with_items(pool.clone(), invoice_id.clone()).await?;
    let invoice = &invoice_with_items.invoice;

    // Fetch company info
    let company: Company = sqlx::query_as::<_, Company>("SELECT * FROM companies WHERE id = ?")
        .bind(&invoice.company_id)
        .fetch_optional(&*pool)
        .await
        .map_err(|e| format!("DB error: {e}"))?
        .ok_or_else(|| format!("Company {} not found", invoice.company_id))?;

    // Fetch client info
    let client: Option<Client> = sqlx::query_as::<_, Client>(
        "SELECT * FROM clients WHERE id = ?",
    )
    .bind(&invoice.client_id)
    .fetch_optional(&*pool)
    .await
    .map_err(|e| format!("DB error: {e}"))?;

    // Generate documents
    let xml = generate_peppol_xml(&company, client.as_ref(), &invoice_with_items);
    let pdf_bytes = generate_invoice_pdf(&company, client.as_ref(), &invoice_with_items);

    // Save to vault
    let app_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to resolve app data dir: {e}"))?;
    let vault_dir = app_dir
        .join("vault")
        .join(&invoice.company_id)
        .join("invoices");
    fs::create_dir_all(&vault_dir).map_err(|e| format!("Failed to create vault dir: {e}"))?;

    let xml_filename = format!("invoice_{}.xml", invoice.invoice_number);
    let xml_path = vault_dir.join(&xml_filename);
    fs::write(&xml_path, &xml).map_err(|e| format!("Failed to write XML: {e}"))?;

    let pdf_filename = format!("invoice_{}.pdf", invoice.invoice_number);
    let pdf_path = vault_dir.join(&pdf_filename);
    fs::write(&pdf_path, &pdf_bytes).map_err(|e| format!("Failed to write PDF: {e}"))?;

    let xml_path_str = xml_path.to_string_lossy().to_string();
    let pdf_path_str = pdf_path.to_string_lossy().to_string();

    // Update paths in DB
    invoices::update_xml_path(&*pool, &invoice.id, &xml_path_str)
        .await
        .map_err(|e| format!("Failed to save XML path: {e}"))?;
    invoices::update_pdf_path(&*pool, &invoice.id, &pdf_path_str)
        .await
        .map_err(|e| format!("Failed to save PDF path: {e}"))?;

    Ok((xml_path_str, pdf_path_str))
}

// ═════════════════════════════════════════════════════════════════════════════
// 31. db_send_invoice — generate PDF + PEPPOL XML, dispatch over SMTP (with optional PGP encryption), then mark as sent
// ═════════════════════════════════════════════════════════════════════════════

#[command]
pub async fn db_send_invoice(
    pool: State<'_, SqlitePool>,
    id: String,
    to: Option<String>,
) -> Result<String, String> {
    // 1. Verify invoice exists and is not cancelled
    let invoice = invoices::get_by_id(&*pool, &id)
        .await
        .map_err(|e| format!("Invoice not found: {e}"))?;

    if invoice.status == "cancelled" {
        return Err("Cannot send a cancelled invoice".to_string());
    }

    // Track whether the invoice was already sent, so stock + ledger side
    // effects are applied exactly once (on the first dispatch).
    let was_sent = invoice.status == "sent";

    // Capture invoice fields before `invoice` is moved into InvoiceWithItems
    let company_id = invoice.company_id.clone();
    let client_id = invoice.client_id.clone();
    let invoice_number = invoice.invoice_number.clone();
    let total_amount = invoice.total_amount;
    let currency = invoice.currency.clone();

    // 2. Load items + assemble the document model
    let invoice_items = items::list_by_invoice(&*pool, &id)
        .await
        .map_err(|e| format!("Failed to load invoice items: {e}"))?;
    let invoice_with_items = InvoiceWithItems {
        invoice,
        items: invoice_items,
    };

    // 3. Load company + client
    let company: Company = sqlx::query_as::<_, Company>("SELECT * FROM companies WHERE id = ?")
        .bind(&company_id)
        .fetch_optional(&*pool)
        .await
        .map_err(|e| format!("DB error: {e}"))?
        .ok_or_else(|| format!("Company {company_id} not found"))?;

    let client: Option<Client> = sqlx::query_as::<_, Client>("SELECT * FROM clients WHERE id = ?")
        .bind(&client_id)
        .fetch_optional(&*pool)
        .await
        .map_err(|e| format!("DB error: {e}"))?;

    // 4. Resolve sender + recipient addresses
    let from_email = company
        .email
        .clone()
        .ok_or_else(|| "Cannot send invoice: the company has no email address".to_string())?;
    let client_email = to
        .clone()
        .or_else(|| client.as_ref().and_then(|c| c.email.clone()))
        .ok_or_else(|| {
            "Cannot send invoice: provide a recipient email or a client with an email address".to_string()
        })?;

    // 5. Resolve the sending SMTP account for this company
    let account = accounts::get_by_company(&*pool, &company.id)
        .await
        .map_err(|e| format!("Failed to load mail account: {e}"))?
        .into_iter()
        .next()
        .ok_or_else(|| {
            "Cannot send invoice: no SMTP account is configured for this company".to_string()
        })?;
    let smtp_config = accounts::to_smtp_config(&account)
        .map_err(|e| format!("SMTP configuration incomplete: {e}"))?;

    // 6. Generate the invoice documents (PDF + PEPPOL XML)
    let xml = generate_peppol_xml(&company, client.as_ref(), &invoice_with_items);
    let pdf_bytes = generate_invoice_pdf(&company, client.as_ref(), &invoice_with_items);

    // 7. Build attachments (optionally PGP-encrypt the PDF for the recipient)
    let pdf_filename = format!("invoice_{invoice_number}.pdf");
    let pdf_attachment: SinglePart = match pgp_keys::get_by_user_id(&*pool, &account.id, &client_email).await {
        Ok(Some(key)) => match pgp_crypto::encrypt_bytes(&pdf_bytes, &key.public_key) {
            Ok(encrypted) => Attachment::new(format!("{pdf_filename}.pgp"))
                .body(encrypted, ContentType::parse("application/pgp-encrypted").unwrap_or(ContentType::TEXT_PLAIN)),
            Err(_) => build_pdf_attachment(&pdf_bytes, &pdf_filename),
        },
        _ => build_pdf_attachment(&pdf_bytes, &pdf_filename),
    };

    let xml_attachment: SinglePart = Attachment::new(format!("invoice_{invoice_number}.xml"))
        .body(xml.into_bytes(), ContentType::parse("application/xml").unwrap_or(ContentType::TEXT_PLAIN));

    let body = SinglePart::plain(format!(
        "Dear {},\n\nPlease find attached invoice {} for {:.2} {}.\n\nBest regards,\n{}",
        client.as_ref().map(|c| c.display_name.as_str()).unwrap_or("Client"),
        invoice_number,
        total_amount as f64 / 100.0,
        currency,
        company.name,
    ));

    // 8. Build and validate the MIME message
    let from_addr: Address = from_email
        .parse()
        .map_err(|_| format!("Invalid sender email address: {from_email}"))?;
    let to_addr: Address = client_email
        .parse()
        .map_err(|_| format!("Invalid recipient email address: {client_email}"))?;

    let message = Message::builder()
        .from(Mailbox::new(None, from_addr))
        .to(Mailbox::new(None, to_addr))
        .subject(format!("Invoice {invoice_number} from {}", company.name))
        .multipart(
            MultiPart::mixed()
                .singlepart(body)
                .singlepart(pdf_attachment)
                .singlepart(xml_attachment),
        )
        .map_err(|e| format!("Failed to build email: {e}"))?;

    // 9. Dispatch over SMTP
    smtp_client::send_message(&smtp_config, message)
        .await
        .map_err(|e| e.message)?;

    // 10. Mark as sent
    invoices::update_status(&*pool, &id, "sent")
        .await
        .map_err(|e| format!("Failed to update invoice status: {e}"))?;

    // 11. Inventory + ledger side effects (applied once, on first dispatch)
    if !was_sent {
        if let Err(e) = invoices::apply_stock_effect(&*pool, &id).await {
            log::warn!("[invoicing] stock update failed for {id}: {e}");
        }
        if let Err(e) = crate::db::tables::accounting::post_invoice_journal(&*pool, &id).await {
            log::warn!("[invoicing] journal posting failed for {id}: {e}");
        }
    }

    Ok(format!("Invoice {invoice_number} sent to {client_email}"))
}

/// Build a plaintext PDF [`SinglePart`] attachment from raw bytes.
fn build_pdf_attachment(pdf_bytes: &[u8], filename: &str) -> SinglePart {
    Attachment::new(filename.to_string()).body(
        pdf_bytes.to_vec(),
        ContentType::parse("application/pdf").unwrap_or(ContentType::TEXT_PLAIN),
    )
}

// ═════════════════════════════════════════════════════════════════════════════
// 32. db_calculate_invoice — recalculate totals from existing items
// ═════════════════════════════════════════════════════════════════════════════

#[command]
pub async fn db_calculate_invoice(
    pool: State<'_, SqlitePool>,
    invoice_id: String,
) -> Result<Invoice, String> {
    let items_list = items::list_by_invoice(&*pool, &invoice_id)
        .await
        .map_err(|e| format!("Failed to load invoice items: {e}"))?;

    let line_outputs: Vec<LineOutput> = items_list.iter().map(|i| {
        let subtotal = i.line_total - i.tax_amount;
        LineOutput {
            subtotal: Money(subtotal),
            discount: Money(0),
            taxable: Money(subtotal),
            tax_amount: Money(i.tax_amount),
            total: Money(i.line_total),
        }
    }).collect();

    let totals = calculate_document_totals(&line_outputs, Money(0), 0.0, TaxMode::Excluded, Money(0));

    invoices::update_totals(&*pool, &invoice_id, totals.net.0, totals.tax_amount.0, totals.grand_total.0)
        .await
        .map_err(|e| format!("Failed to update totals: {e}"))?;

    invoices::get_by_id(&*pool, &invoice_id)
        .await
        .map_err(|e| format!("Invoice not found after recalculation: {e}"))
}

// ═════════════════════════════════════════════════
// 33. db_list_low_stock — catalog items at/below alert threshold
// ═════════════════════════════════════════════════

#[command]
pub async fn db_list_low_stock(
    pool: State<'_, SqlitePool>,
    company_id: String,
) -> Result<Vec<CatalogItem>, String> {
    catalog_items::list_low_stock(&*pool, &company_id)
        .await
        .map_err(|e| e.to_string())
}
