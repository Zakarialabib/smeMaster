use tauri::{command, State};
use sqlx::SqlitePool;
use crate::db::invoicing::schema::{Invoice, InvoiceWithItems};
use crate::db::tables::invoicing::{invoices, items};
use crate::db::core::schema::Company;
use crate::services::invoicing::pdf::generate_invoice_pdf;
use crate::services::invoicing::peppol::generate_peppol_xml;
use std::fs;
use std::path::PathBuf;

#[command]
pub async fn list_invoices(
    pool: State<'_, SqlitePool>,
    company_id: String,
) -> Result<Vec<Invoice>, String> {
    invoices::list(&pool, &company_id).await.map_err(|e| e.to_string())
}

#[command]
pub async fn get_invoice_with_items(
    pool: State<'_, SqlitePool>,
    invoice_id: String,
) -> Result<InvoiceWithItems, String> {
    let invoice = invoices::get_by_id(&pool, &invoice_id).await.map_err(|e| e.to_string())?;
    let items = items::list_by_invoice(&pool, &invoice_id).await.map_err(|e| e.to_string())?;
    Ok(InvoiceWithItems { invoice, items })
}

#[derive(serde::Deserialize)]
pub struct CreateInvoiceItemRequest {
    pub description: String,
    pub quantity: f64,
    pub unit_price: f64,
    pub tax_rate: f64,
    pub sort_order: i64,
}

#[command]
pub async fn create_invoice(
    pool: State<'_, SqlitePool>,
    company_id: String,
    contact_id: Option<String>,
    document_type: String,
    invoice_number: String,
    issue_date: i64,
    due_date: Option<i64>,
    currency: String,
    notes: Option<String>,
    items_req: Vec<CreateInvoiceItemRequest>,
) -> Result<Invoice, String> {
    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;

    // 1. Create Invoice
    let invoice = invoices::create(
        &pool,
        &company_id,
        contact_id.as_deref(),
        &document_type,
        &invoice_number,
        issue_date,
        due_date,
        &currency,
        notes.as_deref(),
    ).await.map_err(|e| e.to_string())?;

    // 2. Create Items & Calculate Totals
    let mut subtotal = 0.0;
    let mut tax_total = 0.0;

    for item in items_req {
        let created_item = items::create(
            &pool,
            &invoice.id,
            &item.description,
            item.quantity,
            item.unit_price,
            item.tax_rate,
            item.sort_order,
        ).await.map_err(|e| e.to_string())?;

        subtotal += item.quantity * item.unit_price;
        tax_total += created_item.tax_amount;
    }

    let total_amount = subtotal + tax_total;

    // 3. Update Invoice Totals
    invoices::update_totals(&pool, &invoice.id, subtotal, tax_total, total_amount)
        .await.map_err(|e| e.to_string())?;

    tx.commit().await.map_err(|e| e.to_string())?;

    invoices::get_by_id(&pool, &invoice.id).await.map_err(|e| e.to_string())
}

#[command]
pub async fn generate_invoice_documents(
    pool: State<'_, SqlitePool>,
    app_handle: tauri::AppHandle,
    invoice_id: String,
) -> Result<(String, String), String> {
    let invoice_with_items = get_invoice_with_items(pool.clone(), invoice_id.clone()).await?;
    let invoice = &invoice_with_items.invoice;

    // Fetch company info
    let company: Company = sqlx::query_as::<_, Company>("SELECT * FROM companies WHERE id = ?")
        .bind(&invoice.company_id)
        .fetch_one(&*pool)
        .await
        .map_err(|e| e.to_string())?;

    // Fetch contact info
    let contact = if let Some(cid) = &invoice.contact_id {
        sqlx::query_as::<_, crate::db::contacts::schema::Contact>("SELECT * FROM contacts WHERE id = ?")
            .bind(cid)
            .fetch_optional(&*pool)
            .await
            .map_err(|e| e.to_string())?
    } else {
        None
    };

    let xml = generate_peppol_xml(&company, contact.as_ref(), &invoice_with_items);
    let pdf_bytes = generate_invoice_pdf(&company, contact.as_ref(), &invoice_with_items);

    // Save to Vault
    let app_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let vault_dir = app_dir.join("vault").join(&invoice.company_id).join("invoices");
    fs::create_dir_all(&vault_dir).map_err(|e| e.to_string())?;

    let xml_filename = format!("invoice_{}.xml", invoice.invoice_number);
    let xml_path = vault_dir.join(&xml_filename);
    fs::write(&xml_path, &xml).map_err(|e| e.to_string())?;

    let pdf_filename = format!("invoice_{}.pdf", invoice.invoice_number);
    let pdf_path = vault_dir.join(&pdf_filename);
    fs::write(&pdf_path, &pdf_bytes).map_err(|e| e.to_string())?;

    let xml_path_str = xml_path.to_string_lossy().to_string();
    let pdf_path_str = pdf_path.to_string_lossy().to_string();

    invoices::update_xml_path(&pool, &invoice.id, &xml_path_str).await.map_err(|e| e.to_string())?;
    invoices::update_pdf_path(&pool, &invoice.id, &pdf_path_str).await.map_err(|e| e.to_string())?;

    Ok((xml_path_str, pdf_path_str))
}
