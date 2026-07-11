use crate::db::core::schema::Company;
use crate::db::invoicing::schema::{Client, InvoiceWithItems};

/// Helper: format i64 minor units (centimes) as a 2-decimal string.
/// E.g. 12345 → "123.45"
fn fmt_amount(amount: i64) -> String {
    format!("{:.2}", amount as f64 / 100.0)
}

pub fn generate_peppol_xml(
    company: &Company,
    client: Option<&Client>,
    invoice_data: &InvoiceWithItems,
) -> String {
    let invoice = &invoice_data.invoice;
    let items = &invoice_data.items;

    let issue_date = chrono::DateTime::from_timestamp(invoice.issue_date, 0)
        .map(|dt| dt.format("%Y-%m-%d").to_string())
        .unwrap_or_else(|| "2026-01-01".to_string());

    let due_date = invoice
        .due_date
        .and_then(|d| chrono::DateTime::from_timestamp(d, 0))
        .map(|dt| dt.format("%Y-%m-%d").to_string());

    let buyer_name = client.map(|c| c.name.as_str()).unwrap_or("Customer");
    let buyer_email = client
        .and_then(|c| c.email.as_deref())
        .unwrap_or("unknown@example.com");

    let mut xml = String::new();
    xml.push_str("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
    xml.push_str("<Invoice xmlns=\"urn:oasis:names:specification:ubl:schema:xsd:Invoice-2\"\n");
    xml.push_str("         xmlns:cac=\"urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2\"\n");
    xml.push_str("         xmlns:cbc=\"urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2\">\n");

    xml.push_str(&format!("  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:poacc:trns:invoice:3</cbc:CustomizationID>\n"));
    xml.push_str(&format!(
        "  <cbc:ProfileID>urn:fdc:peppol.eu:poacc:bis:billing:3</cbc:ProfileID>\n"
    ));
    xml.push_str(&format!("  <cbc:ID>{}</cbc:ID>\n", invoice.invoice_number));
    xml.push_str(&format!(
        "  <cbc:IssueDate>{}</cbc:IssueDate>\n",
        issue_date
    ));
    if let Some(dd) = due_date {
        xml.push_str(&format!("  <cbc:DueDate>{}</cbc:DueDate>\n", dd));
    }
    xml.push_str(&format!(
        "  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>\n"
    ));
    xml.push_str(&format!(
        "  <cbc:DocumentCurrencyCode>{}</cbc:DocumentCurrencyCode>\n",
        invoice.currency
    ));

    // Seller
    xml.push_str("  <cac:AccountingSupplierParty>\n");
    xml.push_str("    <cac:Party>\n");
    xml.push_str(&format!(
        "      <cac:PartyName><cbc:Name>{}</cbc:Name></cac:PartyName>\n",
        company.name
    ));
    xml.push_str("      <cac:PostalAddress>\n");
    if let Some(line1) = &company.address_line1 {
        xml.push_str(&format!(
            "        <cbc:StreetName>{}</cbc:StreetName>\n",
            line1
        ));
    }
    if let Some(city) = &company.city {
        xml.push_str(&format!("        <cbc:CityName>{}</cbc:CityName>\n", city));
    }
    if let Some(country) = &company.country {
        xml.push_str("        <cac:Country>\n");
        xml.push_str(&format!(
            "          <cbc:IdentificationCode>{}</cbc:IdentificationCode>\n",
            country
        ));
        xml.push_str("        </cac:Country>\n");
    }
    xml.push_str("      </cac:PostalAddress>\n");

    // Morocco Specific Legal Identifiers (DGI)
    if company.ice.is_some() || company.tax_id.is_some() || company.rc.is_some() {
        xml.push_str("      <cac:PartyLegalEntity>\n");
        xml.push_str(&format!(
            "        <cbc:RegistrationName>{}</cbc:RegistrationName>\n",
            company.legal_name.as_ref().unwrap_or(&company.name)
        ));
        if let Some(ice) = &company.ice {
            xml.push_str(&format!(
                "        <cbc:CompanyID schemeID=\"ICE\">{}</cbc:CompanyID>\n",
                ice
            ));
        }
        if let Some(tax_id) = &company.tax_id {
            xml.push_str(&format!(
                "        <cbc:CompanyID schemeID=\"IF\">{}</cbc:CompanyID>\n",
                tax_id
            ));
        }
        if let Some(rc) = &company.rc {
            xml.push_str(&format!(
                "        <cbc:CompanyID schemeID=\"RC\">{}</cbc:CompanyID>\n",
                rc
            ));
        }
        xml.push_str("      </cac:PartyLegalEntity>\n");
    }

    xml.push_str("    </cac:Party>\n");
    xml.push_str("  </cac:AccountingSupplierParty>\n");

    // Buyer
    xml.push_str("  <cac:AccountingCustomerParty>\n");
    xml.push_str("    <cac:Party>\n");
    xml.push_str(&format!(
        "      <cac:PartyName><cbc:Name>{}</cbc:Name></cac:PartyName>\n",
        buyer_name
    ));
    xml.push_str("      <cac:Contact>\n");
    xml.push_str(&format!(
        "        <cbc:ElectronicMail>{}</cbc:ElectronicMail>\n",
        buyer_email
    ));
    xml.push_str("      </cac:Contact>\n");
    xml.push_str("    </cac:Party>\n");
    xml.push_str("  </cac:AccountingCustomerParty>\n");

    // Totals
    xml.push_str("  <cac:LegalMonetaryTotal>\n");
    xml.push_str(&format!(
        "    <cbc:LineExtensionAmount currencyID=\"{}\">{}</cbc:LineExtensionAmount>\n",
        invoice.currency,
        fmt_amount(invoice.subtotal)
    ));
    xml.push_str(&format!(
        "    <cbc:TaxExclusiveAmount currencyID=\"{}\">{}</cbc:TaxExclusiveAmount>\n",
        invoice.currency,
        fmt_amount(invoice.subtotal)
    ));
    xml.push_str(&format!(
        "    <cbc:TaxInclusiveAmount currencyID=\"{}\">{}</cbc:TaxInclusiveAmount>\n",
        invoice.currency,
        fmt_amount(invoice.total_amount)
    ));
    xml.push_str(&format!(
        "    <cbc:PayableAmount currencyID=\"{}\">{}</cbc:PayableAmount>\n",
        invoice.currency,
        fmt_amount(invoice.total_amount)
    ));
    xml.push_str("  </cac:LegalMonetaryTotal>\n");

    // Items
    for (idx, item) in items.iter().enumerate() {
        let unit_price_f64 = item.unit_price as f64 / 100.0;
        let line_total_f64 = unit_price_f64 * item.qty;
        xml.push_str("  <cac:InvoiceLine>\n");
        xml.push_str(&format!("    <cbc:ID>{}</cbc:ID>\n", idx + 1));
        xml.push_str(&format!(
            "    <cbc:InvoicedQuantity unitCode=\"ZZ\">{:.2}</cbc:InvoicedQuantity>\n",
            item.qty
        ));
        xml.push_str(&format!(
            "    <cbc:LineExtensionAmount currencyID=\"{}\">{:.2}</cbc:LineExtensionAmount>\n",
            invoice.currency, line_total_f64
        ));
        xml.push_str("    <cac:Item>\n");
        xml.push_str(&format!(
            "      <cbc:Name>{}</cbc:Name>\n",
            item.description
        ));
        xml.push_str("      <cac:ClassifiedTaxCategory>\n");
        xml.push_str("        <cbc:ID>S</cbc:ID>\n");
        xml.push_str(&format!(
            "        <cbc:Percent>{:.2}</cbc:Percent>\n",
            item.tax_rate
        ));
        xml.push_str("        <cac:TaxScheme>\n");
        xml.push_str("          <cbc:ID>VAT</cbc:ID>\n");
        xml.push_str("        </cac:TaxScheme>\n");
        xml.push_str("      </cac:ClassifiedTaxCategory>\n");
        xml.push_str("    </cac:Item>\n");
        xml.push_str("    <cac:Price>\n");
        xml.push_str(&format!(
            "      <cbc:PriceAmount currencyID=\"{}\">{:.2}</cbc:PriceAmount>\n",
            invoice.currency, unit_price_f64
        ));
        xml.push_str("    </cac:Price>\n");
        xml.push_str("  </cac:InvoiceLine>\n");
    }

    xml.push_str("</Invoice>\n");
    xml
}
