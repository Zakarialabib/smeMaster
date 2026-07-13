use serde::{Deserialize, Serialize};
use sqlx::FromRow;

// ── Invoice ─────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Invoice {
    pub id: String,
    pub company_id: String,
    pub client_id: String,
    #[serde(rename = "type")]
    #[sqlx(rename = "type")]
    pub document_type: String,
    #[serde(rename = "document_number")]
    #[sqlx(rename = "document_number")]
    pub invoice_number: String,
    pub status: String,
    pub issue_date: i64,
    pub due_date: Option<i64>,
    pub currency: String,
    pub subtotal: i64,
    pub tax_total: i64,
    pub total_amount: i64,
    pub notes: Option<String>,
    pub peppol_xml_path: Option<String>,
    pub pdf_path: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct InvoiceItem {
    pub id: String,
    pub invoice_id: String,
    pub item_id: Option<String>,
    pub description: String,
    pub qty: f64,
    pub unit: String,
    pub unit_price: i64,
    pub tax_rate: f64,
    pub tax_amount: i64,
    pub line_total: i64,
    pub sort_order: i64,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InvoiceWithItems {
    #[serde(flatten)]
    pub invoice: Invoice,
    pub items: Vec<InvoiceItem>,
}

// ── Client (customer / supplier) ────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Client {
    pub id: String,
    pub company_id: String,
    pub display_name: String,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub address: Option<String>,
    pub city: Option<String>,
    pub country: Option<String>,
    pub tax_id: Option<String>,
    pub contact_type: String,
    pub credit_limit: i64,
    pub payment_terms: i64,
    pub notes: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
    pub deleted_at: Option<i64>,
}

// ── Catalog Item (product / service) ────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct CatalogItem {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    #[serde(rename = "type")]
    pub item_type: String,
    pub sku: Option<String>,
    pub unit: String,
    pub buy_price: i64,
    pub sell_price: i64,
    pub stock_qty: f64,
    pub stock_alert: f64,
    pub tax_rate: f64,
    pub barcode: Option<String>,
    pub image_url: Option<String>,
    pub active: i64,
    pub company_id: String,
    pub category_id: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

// ── Company Settings (per-tenant) ───────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct CompanySetting {
    pub company_id: String,
    pub default_currency: String,
    pub default_tax_rate: f64,
    pub invoice_prefix: String,
    pub invoice_suffix: String,
    pub quote_prefix: String,
    pub default_template_id: Option<String>,
    pub logo_url: Option<String>,
    pub signature_text: Option<String>,
    pub bank_details: Option<String>,
    pub terms_default: Option<String>,
    pub theme_color: String,
    pub units_enabled: String,
    pub tax_position: String,
    pub decimal_places: i64,
    pub updated_at: i64,
}

// ── Category (lightweight item grouping) ────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Category {
    pub id: String,
    pub name: String,
    pub company_id: Option<String>,
    pub created_at: i64,
}
