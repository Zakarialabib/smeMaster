// ── Invoicing Table Integration Tests ───────────────────────────────────────
//
// These tests exercise the full CRUD lifecycle for clients, items, invoices,
// invoice items, company settings, and categories against an in-memory SQLite
// database with all migrations applied.
//
// Run with: cargo test -p smemaster --lib db::tables::invoicing::tests
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use crate::db::tables::test_helpers::helpers::*;
    use crate::db::tables::invoicing::{clients, items, invoices, company_settings, categories};
    use crate::db::invoicing::schema::{Client, InvoiceItem, CompanySetting, Category};
    use crate::invoicing::calc::{
        self, Money, LineInput, LineOutput, TaxMode, calculate_line, calculate_document_totals,
    };

    // ── Client CRUD ─────────────────────────────────────────────────────

    #[tokio::test]
    async fn test_create_client() {
        let pool = create_memory_pool().await;

        let input = clients::CreateClientInput {
            name: "Acme Corp",
            email: Some("billing@acme.com"),
            phone: Some("+212600000000"),
            address: Some("123 Main St"),
            city: Some("Casablanca"),
            country: Some("MA"),
            tax_id: Some("MA123456"),
            role: Some("customer"),
            credit_limit: Some(50000), // 500.00 MAD
            payment_terms: Some(30),
            notes: Some("Preferred customer"),
        };

        let client = clients::create(&pool, input).await.unwrap();
        assert_eq!(client.name, "Acme Corp");
        assert_eq!(client.email.unwrap(), "billing@acme.com");
        assert_eq!(client.role, "customer");
        assert_eq!(client.credit_limit, 50000);
        assert_eq!(client.payment_terms, 30);
        assert!(client.deleted_at.is_none());
    }

    #[tokio::test]
    async fn test_list_clients() {
        let pool = create_memory_pool().await;

        let c1 = clients::CreateClientInput {
            name: "Client A", email: None, phone: None, address: None,
            city: None, country: None, tax_id: None, role: Some("customer"),
            credit_limit: None, payment_terms: None, notes: None,
        };
        let c2 = clients::CreateClientInput {
            name: "Client B", email: None, phone: None, address: None,
            city: None, country: None, tax_id: None, role: Some("supplier"),
            credit_limit: None, payment_terms: None, notes: None,
        };

        clients::create(&pool, c1).await.unwrap();
        clients::create(&pool, c2).await.unwrap();

        let all = clients::list(&pool, None).await.unwrap();
        assert_eq!(all.len(), 2);

        let customers = clients::list(&pool, Some("customer")).await.unwrap();
        // "Client A" has role=customer, "Client B" has role=supplier
        // Query matches WHERE role='customer' OR role='both'
        assert_eq!(customers.len(), 1);
    }

    #[tokio::test]
    async fn test_soft_delete_client() {
        let pool = create_memory_pool().await;

        let input = clients::CreateClientInput {
            name: "Delete Me", email: None, phone: None, address: None,
            city: None, country: None, tax_id: None, role: None,
            credit_limit: None, payment_terms: None, notes: None,
        };
        let client = clients::create(&pool, input).await.unwrap();

        clients::soft_delete(&pool, &client.id).await.unwrap();

        // Should not appear in list (deleted_at IS NULL filter)
        let all = clients::list(&pool, None).await.unwrap();
        assert_eq!(all.len(), 0);

        // But can still be fetched directly
        let deleted = clients::get_by_id(&pool, &client.id).await.unwrap();
        assert!(deleted.deleted_at.is_some());
    }

    #[tokio::test]
    async fn test_update_client() {
        let pool = create_memory_pool().await;

        let input = clients::CreateClientInput {
            name: "Old Name", email: Some("old@test.com"), phone: None,
            address: None, city: None, country: None, tax_id: None,
            role: None, credit_limit: None, payment_terms: None, notes: None,
        };
        let client = clients::create(&pool, input).await.unwrap();

        let update = clients::UpdateClientInput {
            name: Some("New Name"),
            email: Some("new@test.com"),
            phone: None, address: None, city: None, country: None,
            tax_id: None, role: None, credit_limit: None,
            payment_terms: Some(60), notes: None,
        };
        let updated = clients::update(&pool, &client.id, update).await.unwrap();
        assert_eq!(updated.name, "New Name");
        assert_eq!(updated.email.unwrap(), "new@test.com");
        assert_eq!(updated.payment_terms, 60);
    }

    // ── Category CRUD ───────────────────────────────────────────────────

    #[tokio::test]
    async fn test_create_category() {
        let pool = create_memory_pool().await;
        let company_id = insert_test_company(&pool, "cat-co").await;

        let cat = categories::create(&pool, "Office Supplies", &company_id).await.unwrap();
        assert_eq!(cat.name, "Office Supplies");
        assert_eq!(cat.company_id.unwrap(), company_id);
    }

    #[tokio::test]
    async fn test_list_categories() {
        let pool = create_memory_pool().await;
        let company_id = insert_test_company(&pool, "cat-co-2").await;

        categories::create(&pool, "Category A", &company_id).await.unwrap();
        categories::create(&pool, "Category B", &company_id).await.unwrap();

        let cats = categories::list(&pool, &company_id).await.unwrap();
        assert_eq!(cats.len(), 2);
    }

    #[tokio::test]
    async fn test_update_category() {
        let pool = create_memory_pool().await;
        let company_id = insert_test_company(&pool, "cat-co-3").await;
        let cat = categories::create(&pool, "Old Name", &company_id).await.unwrap();

        let updated = categories::update(&pool, &cat.id, "New Name").await.unwrap();
        assert_eq!(updated.name, "New Name");
    }

    // ── Invoice with Items (full lifecycle) ────────────────────────────

    #[tokio::test]
    async fn test_create_invoice_with_items() {
        let pool = create_memory_pool().await;
        let company_id = insert_test_company(&pool, "inv-co").await;
        let client_id = insert_test_client(&pool, "inv-client", &company_id).await;

        // Create invoice
        let input = invoices::CreateInvoiceInput {
            company_id: &company_id,
            client_id: &client_id,
            document_type: "invoice",
            invoice_number: "INV-2026-001",
            issue_date: 1767225600, // 2026-01-01
            due_date: None,
            currency: "MAD",
            notes: Some("Test invoice"),
            created_by: &company_id,
        };
        let invoice = invoices::create(&pool, input).await.unwrap();
        assert_eq!(invoice.invoice_number, "INV-2026-001");
        assert_eq!(invoice.status, "draft");
        assert_eq!(invoice.total_amount, 0);

        // Create items with i64 minor units
        let item1 = items::create(&pool, items::CreateItemInput {
            invoice_id: &invoice.id,
            item_id: None,
            description: "Product A",
            qty: 2.0,
            unit: "pc",
            unit_price: 10000, // 100.00
            tax_rate: 20.0,
            sort_order: 0,
        }).await.unwrap();
        assert_eq!(item1.line_total, 24000); // (2 * 10000) + 20% tax

        let item2 = items::create(&pool, items::CreateItemInput {
            invoice_id: &invoice.id,
            item_id: None,
            description: "Service B",
            qty: 1.0,
            unit: "hr",
            unit_price: 5000, // 50.00
            tax_rate: 10.0,
            sort_order: 1,
        }).await.unwrap();
        assert_eq!(item2.line_total, 5500); // (1 * 5000) + 10% tax

        // Verify items list
        let list = items::list_by_invoice(&pool, &invoice.id).await.unwrap();
        assert_eq!(list.len(), 2);

        // Calculate and update totals
        let subtotal: i64 = list.iter().map(|i| i.unit_price * i.qty as i64).sum();
        let tax_total: i64 = list.iter().map(|i| i.tax_amount).sum();
        let total = subtotal + tax_total;

        invoices::update_totals(&pool, &invoice.id, subtotal, tax_total, total).await.unwrap();

        // Verify updated invoice
        let updated = invoices::get_by_id(&pool, &invoice.id).await.unwrap();
        assert_eq!(updated.subtotal, 25000); // 20000 + 5000
        assert_eq!(updated.tax_total, 4500);  // 4000 + 500
        assert_eq!(updated.total_amount, 29500); // 25000 + 4500
    }

    #[tokio::test]
    async fn test_invoice_status_update() {
        let pool = create_memory_pool().await;
        let company_id = insert_test_company(&pool, "status-co").await;
        let client_id = insert_test_client(&pool, "status-client", &company_id).await;

        let input = invoices::CreateInvoiceInput {
            company_id: &company_id,
            client_id: &client_id,
            document_type: "invoice",
            invoice_number: "INV-STATUS-001",
            issue_date: 1767225600,
            due_date: None,
            currency: "MAD",
            notes: None,
            created_by: &company_id,
        };
        let invoice = invoices::create(&pool, input).await.unwrap();

        invoices::update_status(&pool, &invoice.id, "paid").await.unwrap();
        let updated = invoices::get_by_id(&pool, &invoice.id).await.unwrap();
        assert_eq!(updated.status, "paid");
    }

    #[tokio::test]
    async fn test_invoice_delete_cascades_items() {
        let pool = create_memory_pool().await;
        let company_id = insert_test_company(&pool, "del-co").await;
        let client_id = insert_test_client(&pool, "del-client", &company_id).await;

        let input = invoices::CreateInvoiceInput {
            company_id: &company_id,
            client_id: &client_id,
            document_type: "invoice",
            invoice_number: "INV-DEL-001",
            issue_date: 1767225600,
            due_date: None,
            currency: "MAD",
            notes: None,
            created_by: &company_id,
        };
        let invoice = invoices::create(&pool, input).await.unwrap();

        items::create(&pool, items::CreateItemInput {
            invoice_id: &invoice.id,
            item_id: None,
            description: "Deletable Item",
            qty: 1.0,
            unit: "pc",
            unit_price: 1000,
            tax_rate: 20.0,
            sort_order: 0,
        }).await.unwrap();

        // Delete invoice (CASCADE should remove items)
        invoices::delete(&pool, &invoice.id).await.unwrap();

        // Verify items are gone
        let items = items::list_by_invoice(&pool, &invoice.id).await.unwrap();
        assert_eq!(items.len(), 0);

        // Verify invoice is gone
        assert!(invoices::get_by_id(&pool, &invoice.id).await.is_err());
    }

    // ── Company Settings ────────────────────────────────────────────────

    #[tokio::test]
    async fn test_company_settings_upsert() {
        let pool = create_memory_pool().await;
        let company_id = insert_test_company(&pool, "settings-co").await;

        let input = company_settings::UpsertCompanySettingInput {
            default_currency: Some("MAD"),
            default_tax_rate: Some(20.0),
            invoice_prefix: Some("INV-"),
            invoice_suffix: Some(""),
            quote_prefix: Some("QUO-"),
            default_template_id: None,
            logo_url: None,
            signature_text: Some("Thank you for your business"),
            bank_details: Some("CIH: 1234567890"),
            terms_default: Some("Payment due within 30 days"),
            theme_color: Some("#CE422B"),
            units_enabled: Some("[\"pc\",\"kg\",\"m\",\"hr\"]"),
            tax_position: Some("excluded"),
            decimal_places: Some(2),
        };

        let settings = company_settings::upsert(&pool, &company_id, input).await.unwrap();
        assert_eq!(settings.default_currency, "MAD");
        assert_eq!(settings.default_tax_rate, 20.0);
        assert_eq!(settings.invoice_prefix, "INV-");
    }

    #[tokio::test]
    async fn test_company_settings_get() {
        let pool = create_memory_pool().await;
        let company_id = insert_test_company(&pool, "settings-co-2").await;

        // Should be None before upsert
        let result = company_settings::get_by_company(&pool, &company_id).await.unwrap();
        assert!(result.is_none());

        // Upsert and fetch
        let input = company_settings::UpsertCompanySettingInput {
            default_currency: Some("EUR"), default_tax_rate: Some(20.0),
            invoice_prefix: None, invoice_suffix: None, quote_prefix: None,
            default_template_id: None, logo_url: None, signature_text: None,
            bank_details: None, terms_default: None, theme_color: None,
            units_enabled: None, tax_position: None, decimal_places: None,
        };
        company_settings::upsert(&pool, &company_id, input).await.unwrap();

        let fetched = company_settings::get_by_company(&pool, &company_id).await.unwrap();
        assert!(fetched.is_some());
        assert_eq!(fetched.unwrap().default_currency, "EUR");
    }

    // ── Calculation Engine Tests (pure, no DB) ──────────────────────────

    #[test]
    fn test_calc_line_no_discount() {
        let input = LineInput {
            qty: 2.0,
            unit_price: Money(10000),
            discount_pct: None,
            discount_fixed: None,
            tax_rate: 20.0,
        };
        let output = calculate_line(input);
        assert_eq!(output.subtotal.0, 20000);
        assert_eq!(output.discount.0, 0);
        assert_eq!(output.taxable.0, 20000);
        assert_eq!(output.tax_amount.0, 4000);
        assert_eq!(output.total.0, 24000);
    }

    #[test]
    fn test_calc_line_with_percent_discount() {
        let input = LineInput {
            qty: 2.0,
            unit_price: Money(10000),
            discount_pct: Some(10.0),
            discount_fixed: None,
            tax_rate: 20.0,
        };
        let output = calculate_line(input);
        assert_eq!(output.subtotal.0, 20000);
        assert_eq!(output.discount.0, 2000);
        assert_eq!(output.taxable.0, 18000);
        assert_eq!(output.tax_amount.0, 3600);
        assert_eq!(output.total.0, 21600);
    }

    #[test]
    fn test_calc_line_with_fixed_discount() {
        let input = LineInput {
            qty: 3.0,
            unit_price: Money(5000),
            discount_pct: None,
            discount_fixed: Some(Money(2500)),
            tax_rate: 10.0,
        };
        let output = calculate_line(input);
        assert_eq!(output.subtotal.0, 15000);
        assert_eq!(output.discount.0, 2500);
        assert_eq!(output.taxable.0, 12500);
        assert_eq!(output.tax_amount.0, 1250);
        assert_eq!(output.total.0, 13750);
    }

    #[test]
    fn test_calc_document_totals_basic() {
        let lines = vec![LineOutput {
            subtotal: Money(10000), discount: Money(0),
            taxable: Money(10000), tax_amount: Money(2000),
            total: Money(12000),
        }];
        let totals = calculate_document_totals(&lines, Money(0), 20.0, TaxMode::Excluded, Money(0));
        assert_eq!(totals.net.0, 10000);
        assert_eq!(totals.tax_amount.0, 2000);
        assert_eq!(totals.grand_total.0, 12000);
        assert_eq!(totals.balance_due.0, 12000);
    }

    #[test]
    fn test_calc_document_totals_with_shipping_and_payment() {
        let lines = vec![LineOutput {
            subtotal: Money(10000), discount: Money(0),
            taxable: Money(10000), tax_amount: Money(2000),
            total: Money(12000),
        }];
        let totals = calculate_document_totals(&lines, Money(5000), 20.0, TaxMode::Excluded, Money(3000));

    // net = 10000 - 0 + 3000 (shipping) - 5000 (global discount) = 8000; tax = 2000
    assert_eq!(totals.net.0, 8000);
    assert_eq!(totals.tax_amount.0, 2000);
    assert_eq!(totals.grand_total.0, 10000);
    assert_eq!(totals.balance_due.0, 10000);
    }

    #[test]
    fn test_calc_document_totals_tax_included() {
        let lines = vec![LineOutput {
            subtotal: Money(12000), discount: Money(0),
            taxable: Money(12000), tax_amount: Money(0),
            total: Money(12000),
        }];
        let totals = calculate_document_totals(&lines, Money(0), 20.0, TaxMode::Included, Money(0));

    // Line total = 12000 with 2400 tax already applied; net = 12000, tax = 2400
    assert_eq!(totals.net.0, 12000);
    assert_eq!(totals.tax_amount.0, 2400);
    assert_eq!(totals.grand_total.0, 14400);
    }

    #[test]
    fn test_format_money() {
        assert_eq!(calc::format_money(Money(0)), "0.00");
        assert_eq!(calc::format_money(Money(12345)), "123.45");
        assert_eq!(calc::format_money(Money(100)), "1.00");
        assert_eq!(calc::format_money(Money(-500)), "-5.00");
    }

    // ── Category Deletion ──────────────────────────────────────────────

    #[tokio::test]
    async fn test_delete_category() {
        let pool = create_memory_pool().await;
        let company_id = insert_test_company(&pool, "cat-del").await;
        let cat = categories::create(&pool, "To Delete", &company_id).await.unwrap();

        categories::delete(&pool, &cat.id).await.unwrap();
        assert!(categories::get_by_id(&pool, &cat.id).await.is_err());
    }

    // ── Multi-company isolation ────────────────────────────────────────

    #[tokio::test]
    async fn test_categories_are_isolated_by_company() {
        let pool = create_memory_pool().await;
        let co_a = insert_test_company(&pool, "co-a").await;
        let co_b = insert_test_company(&pool, "co-b").await;

        categories::create(&pool, "A-only", &co_a).await.unwrap();
        categories::create(&pool, "B-only", &co_b).await.unwrap();

        let cat_a = categories::list(&pool, &co_a).await.unwrap();
        let cat_b = categories::list(&pool, &co_b).await.unwrap();
        assert_eq!(cat_a.len(), 1);
        assert_eq!(cat_b.len(), 1);
        assert_eq!(cat_a[0].name, "A-only");
        assert_eq!(cat_b[0].name, "B-only");
    }
}
