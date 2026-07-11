use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Invoice {
    pub id: String,
    pub company_id: String,
    pub contact_id: Option<String>,
    pub document_type: String,
    pub invoice_number: String,
    pub status: String,
    pub issue_date: i64,
    pub due_date: Option<i64>,
    pub currency: String,
    pub subtotal: f64,
    pub tax_total: f64,
    pub total_amount: f64,
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
    pub description: String,
    pub quantity: f64,
    pub unit_price: f64,
    pub tax_rate: f64,
    pub tax_amount: f64,
    pub total_amount: f64,
    pub sort_order: i64,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InvoiceWithItems {
    #[serde(flatten)]
    pub invoice: Invoice,
    pub items: Vec<InvoiceItem>,
}
