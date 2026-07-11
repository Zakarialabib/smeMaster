#[cfg(test)]
mod tests {
    use crate::db::tables::test_helpers::helpers::*;
    use crate::db::tables::invoicing::{invoices, items};

    #[tokio::test]
    async fn test_create_invoice_with_items() {
        let pool = create_memory_pool().await;
        let company_id = insert_test_company(&pool, "comp1").await;
        let contact_id = insert_test_contact(&pool, "cont1").await;

        let invoice = invoices::create(
            &pool,
            &company_id,
            Some(&contact_id),
            "invoice",
            "INV-2025-001",
            1735689600, // 2025-01-01
            None,
            "MAD",
            Some("Test notes"),
        ).await.unwrap();

        assert_eq!(invoice.invoice_number, "INV-2025-001");

        items::create(&pool, &invoice.id, "Product 1", 2.0, 100.0, 20.0, 0).await.unwrap();
        items::create(&pool, &invoice.id, "Product 2", 1.0, 50.0, 20.0, 1).await.unwrap();

        let list_items = items::list_by_invoice(&pool, &invoice.id).await.unwrap();
        assert_eq!(list_items.len(), 2);

        let subtotal: f64 = list_items.iter().map(|i| i.quantity * i.unit_price).sum();
        let tax_total: f64 = list_items.iter().map(|i| i.tax_amount).sum();
        let total = subtotal + tax_total;

        invoices::update_totals(&pool, &invoice.id, subtotal, tax_total, total).await.unwrap();

        let updated = invoices::get_by_id(&pool, &invoice.id).await.unwrap();
        assert_eq!(updated.total_amount, 300.0);
    }
}
