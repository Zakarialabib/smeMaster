//! Invoicing domain Tauri command handlers.
//!
//! All 24 commands for managing clients, catalog items, invoices, invoice items,
//! company info, document generation, and invoice lifecycle.

use serde::Deserialize;
use tauri::{command, State, AppHandle};
use tauri::Manager;
use sqlx::SqlitePool;
use std::fs;

use crate::db::invoicing::schema::{
    Invoice, InvoiceItem, InvoiceWithItems, Client, CatalogItem,
};
use crate::db::core::schema::Company;
use crate::db::tables::invoicing::{invoices, items, clients, catalog_items};
use crate::services::invoicing::pdf::generate_invoice_pdf;
use crate::services::invoicing::peppol::generate_peppol_xml;

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

    // 2. Insert items and calculate totals
    let mut subtotal: i64 = 0;
    let mut tax_total: i64 = 0;

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
        subtotal += created_item.line_total - created_item.tax_amount;
        tax_total += created_item.tax_amount;
    }

    let total_amount = subtotal + tax_total;

    // 3. Update invoice totals
    invoices::update_totals(&mut *tx, &invoice.id, subtotal, tax_total, total_amount)
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
) -> Result<(), String> {
    invoices::update_invoice(
        &*pool, &id,
        status.as_deref(),
        notes.as_deref(),
        date,
        due_date,
        currency.as_deref(),
        client_id.as_deref(),
    )
    .await
    .map_err(|e| format!("Failed to update invoice: {e}"))
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
    invoices::update_status(&*pool, &id, &status)
        .await
        .map_err(|e| format!("Failed to update invoice status: {e}"))
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
    let input = clients::CreateClientInput {
        name: &name,
        email: email.as_deref(),
        phone: phone.as_deref(),
        address: address.as_deref(),
        city: city.as_deref(),
        country: country.as_deref(),
        tax_id: tax_id.as_deref(),
        role: role.as_deref(),
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

    let input = clients::UpdateClientInput {
        name: name.as_deref(),
        email,
        phone,
        address,
        city,
        country,
        tax_id,
        role: role.as_deref(),
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
) -> Result<(), String> {
    clients::soft_delete(&*pool, &id)
        .await
        .map_err(|e| format!("Failed to delete client: {e}"))
}

// ═════════════════════════════════════════════════════════════════════════════
// 15. db_list_items — list catalog items for a company
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
// 16. db_get_item — get a single catalog item
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
// 17. db_create_item — create a catalog item
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
// 18. db_update_item — update a catalog item
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
    let now = chrono::Utc::now().timestamp();
    sqlx::query(
        r#"UPDATE items SET
            name = COALESCE(?, name),
            description = COALESCE(?, description),
            type = COALESCE(?, type),
            sku = COALESCE(?, sku),
            unit = COALESCE(?, unit),
            buy_price = COALESCE(?, buy_price),
            sell_price = COALESCE(?, sell_price),
            stock_qty = COALESCE(?, stock_qty),
            stock_alert = COALESCE(?, stock_alert),
            tax_rate = COALESCE(?, tax_rate),
            barcode = COALESCE(?, barcode),
            image_url = COALESCE(?, image_url),
            active = COALESCE(?, active),
            updated_at = ?
        WHERE id = ?"#,
    )
    .bind(name)
    .bind(description)
    .bind(item_type)
    .bind(sku)
    .bind(unit)
    .bind(buy_price)
    .bind(sell_price)
    .bind(stock_qty)
    .bind(stock_alert)
    .bind(tax_rate)
    .bind(barcode)
    .bind(image_url)
    .bind(active)
    .bind(now)
    .bind(&id)
    .execute(&*pool)
    .await
    .map_err(|e| format!("Failed to update item: {e}"))?;

    sqlx::query_as::<_, CatalogItem>("SELECT * FROM items WHERE id = ?")
        .bind(&id)
        .fetch_optional(&*pool)
        .await
        .map_err(|e| format!("DB error: {e}"))?
        .ok_or_else(|| format!("Item {id} not found after update"))
}

// ═════════════════════════════════════════════════════════════════════════════
// 19. db_delete_item — soft delete (set active=0)
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
// 20. db_get_company
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
// 21. db_update_company — update company fields incl. ICE/IF/RC/CNSS
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
// 22. db_generate_invoice_documents — generate PEPPOL XML + PDF, save to vault
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
// 23. db_send_invoice — stub: mark invoice as sent and return status
// ═════════════════════════════════════════════════════════════════════════════

#[command]
pub async fn db_send_invoice(
    pool: State<'_, SqlitePool>,
    id: String,
) -> Result<String, String> {
    // Verify invoice exists
    let invoice = invoices::get_by_id(&*pool, &id)
        .await
        .map_err(|e| format!("Invoice not found: {e}"))?;

    if invoice.status == "cancelled" {
        return Err("Cannot send a cancelled invoice".to_string());
    }

    // Update status to 'sent'
    invoices::update_status(&*pool, &id, "sent")
        .await
        .map_err(|e| format!("Failed to update invoice status: {e}"))?;

    Ok(format!("Invoice {} marked as sent", invoice.invoice_number))
}

// ═════════════════════════════════════════════════════════════════════════════
// 24. db_calculate_invoice — recalculate totals from existing items
// ═════════════════════════════════════════════════════════════════════════════

#[command]
pub async fn db_calculate_invoice(
    pool: State<'_, SqlitePool>,
    invoice_id: String,
) -> Result<Invoice, String> {
    let items_list = items::list_by_invoice(&*pool, &invoice_id)
        .await
        .map_err(|e| format!("Failed to load invoice items: {e}"))?;

    let subtotal: i64 = items_list.iter().map(|i| i.line_total - i.tax_amount).sum();
    let tax_total: i64 = items_list.iter().map(|i| i.tax_amount).sum();
    let total_amount = subtotal + tax_total;

    invoices::update_totals(&*pool, &invoice_id, subtotal, tax_total, total_amount)
        .await
        .map_err(|e| format!("Failed to update totals: {e}"))?;

    invoices::get_by_id(&*pool, &invoice_id)
        .await
        .map_err(|e| format!("Invoice not found after recalculation: {e}"))
}
