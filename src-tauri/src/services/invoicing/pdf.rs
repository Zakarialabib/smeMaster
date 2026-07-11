use crate::db::core::schema::Company;
use crate::db::invoicing::schema::{Client, InvoiceWithItems};
use lopdf::content::{Content, Operation};
use lopdf::dictionary;
use lopdf::{Document, Object, Stream};
use std::io::Cursor;

/// Format i64 minor units (centimes) as a 2-decimal display string.
/// E.g. 12345 → "123.45"
fn fmt_amount(amount: i64) -> String {
    format!("{:.2}", amount as f64 / 100.0)
}

/// Format a timestamp (i64 seconds) to a date string "YYYY-MM-DD".
fn fmt_date(timestamp: i64) -> String {
    chrono::DateTime::from_timestamp(timestamp, 0)
        .map(|dt| dt.format("%Y-%m-%d").to_string())
        .unwrap_or_else(|| "N/A".to_string())
}

/// Push a single text operation to the ops vector.
fn push_text(
    ops: &mut Vec<Operation>,
    text: &str,
    font_name: &str,
    font_size: f32,
    x: f32,
    y: f32,
) {
    ops.push(Operation::new("BT", vec![]));
    ops.push(Operation::new(
        "Tf",
        vec![font_name.into(), font_size.into()],
    ));
    ops.push(Operation::new("Td", vec![x.into(), y.into()]));
    ops.push(Operation::new("Tj", vec![Object::string_literal(text)]));
    ops.push(Operation::new("ET", vec![]));
}

/// Generate a professional A4 invoice PDF for a Moroccan company.
///
/// The output includes:
/// - Company header (name, ICE, IF, RC, CNSS)
/// - Invoice metadata (number, date, currency)
/// - Client information
/// - Line items in a table format
/// - Financial totals (subtotal, tax, grand total)
///
/// Uses the `lopdf` crate (already a project dependency) for proper PDF structure.
pub fn generate_invoice_pdf(
    company: &Company,
    client: Option<&Client>,
    invoice_data: &InvoiceWithItems,
) -> Vec<u8> {
    let invoice = &invoice_data.invoice;
    let items = &invoice_data.items;
    let client_name = client.map(|c| c.name.as_str()).unwrap_or("Client");

    // ── Document setup ──────────────────────────────────────────────────
    let mut doc = Document::with_version("1.5");
    let pages_id = doc.new_object_id();

    // Fonts: Helvetica (F1) and Helvetica-Bold (F2)
    let font_id = doc.add_object(dictionary! {
        "Type" => "Font",
        "Subtype" => "Type1",
        "BaseFont" => "Helvetica",
    });
    let font_bold_id = doc.add_object(dictionary! {
        "Type" => "Font",
        "Subtype" => "Type1",
        "BaseFont" => "Helvetica-Bold",
    });

    // Page resources
    let resources_id = doc.add_object(dictionary! {
        "Font" => dictionary! {
            "F1" => font_id,
            "F2" => font_bold_id,
        },
    });

    // ── Content stream ──────────────────────────────────────────────────
    // A4: 595 x 842 points.  Margins: left = 50, right = 545.
    let left = 50.0;
    let right = 545.0;

    let mut ops: Vec<Operation> = Vec::new();

    // ─── Company Header ─────────────────────────────────────────────────
    // Company name (bold, 22pt)
    push_text(&mut ops, company.name.as_str(), "F2", 22.0, left, 800.0);

    // Company legal identifiers (10pt)
    let mut current_y = 770.0;
    if let Some(ice) = &company.ice {
        push_text(
            &mut ops,
            &format!("ICE: {ice}"),
            "F1",
            10.0,
            left,
            current_y,
        );
        current_y -= 14.0;
    }
    if let Some(tax_id) = &company.tax_id {
        push_text(
            &mut ops,
            &format!("IF: {tax_id}"),
            "F1",
            10.0,
            left,
            current_y,
        );
        current_y -= 14.0;
    }
    if let Some(rc) = &company.rc {
        push_text(&mut ops, &format!("RC: {rc}"), "F1", 10.0, left, current_y);
        current_y -= 14.0;
    }
    if let Some(cnss) = &company.cnss {
        push_text(
            &mut ops,
            &format!("CNSS: {cnss}"),
            "F1",
            10.0,
            left,
            current_y,
        );
        current_y -= 14.0;
    }

    // Company address block (9pt)
    if let Some(addr) = &company.address_line1 {
        push_text(&mut ops, addr, "F1", 9.0, left, current_y);
        current_y -= 13.0;
    }
    if let Some(city) = &company.city {
        if let Some(state) = &company.state {
            push_text(
                &mut ops,
                &format!("{city}, {state}"),
                "F1",
                9.0,
                left,
                current_y,
            );
        } else {
            push_text(&mut ops, city, "F1", 9.0, left, current_y);
        }
        current_y -= 13.0;
    }
    if let Some(country) = &company.country {
        push_text(&mut ops, country, "F1", 9.0, left, current_y);
        current_y -= 13.0;
    }
    if let Some(phone) = &company.phone {
        push_text(
            &mut ops,
            &format!("Tel: {phone}"),
            "F1",
            9.0,
            left,
            current_y,
        );
        current_y -= 13.0;
    }
    if let Some(email) = &company.email {
        push_text(
            &mut ops,
            &format!("Email: {email}"),
            "F1",
            9.0,
            left,
            current_y,
        );
        current_y -= 13.0;
    }

    // ─── Separator line ─────────────────────────────────────────────────
    let sep_y = 670.0;
    ops.push(Operation::new("q", vec![]));
    ops.push(Operation::new("w", vec![1.0.into()]));
    ops.push(Operation::new("m", vec![left.into(), sep_y.into()]));
    ops.push(Operation::new("l", vec![right.into(), sep_y.into()]));
    ops.push(Operation::new("S", vec![]));
    ops.push(Operation::new("Q", vec![]));

    // ─── Invoice Title ──────────────────────────────────────────────────
    push_text(&mut ops, "INVOICE", "F2", 18.0, left, 650.0);

    // ─── Invoice Metadata ───────────────────────────────────────────────
    let meta_y_start = 620.0;
    push_text(
        &mut ops,
        &format!("Invoice #: {}", invoice.invoice_number),
        "F2",
        10.0,
        left,
        meta_y_start,
    );
    push_text(
        &mut ops,
        &format!("Date: {}", fmt_date(invoice.issue_date)),
        "F1",
        10.0,
        left,
        meta_y_start - 15.0,
    );
    if let Some(dd) = invoice.due_date {
        push_text(
            &mut ops,
            &format!("Due Date: {}", fmt_date(dd)),
            "F1",
            10.0,
            left,
            meta_y_start - 30.0,
        );
    }
    push_text(
        &mut ops,
        &format!("Currency: {}", invoice.currency),
        "F1",
        10.0,
        left,
        meta_y_start - 45.0,
    );

    // ─── Client Information ─────────────────────────────────────────────
    let client_x = 350.0;
    push_text(&mut ops, "Bill To:", "F2", 10.0, client_x, meta_y_start);
    push_text(
        &mut ops,
        client_name,
        "F1",
        10.0,
        client_x,
        meta_y_start - 15.0,
    );
    if let Some(client) = client {
        let mut client_y = meta_y_start - 30.0;
        if let Some(addr) = &client.address {
            push_text(&mut ops, addr, "F1", 9.0, client_x, client_y);
            client_y -= 13.0;
        }
        if let Some(city) = &client.city {
            let city_str = if let Some(country) = &client.country {
                format!("{city}, {country}")
            } else {
                city.clone()
            };
            push_text(&mut ops, &city_str, "F1", 9.0, client_x, client_y);
            client_y -= 13.0;
        }
        if let Some(email) = &client.email {
            push_text(
                &mut ops,
                &format!("Email: {email}"),
                "F1",
                9.0,
                client_x,
                client_y,
            );
            client_y -= 13.0;
        }
        if let Some(phone) = &client.phone {
            push_text(
                &mut ops,
                &format!("Tel: {phone}"),
                "F1",
                9.0,
                client_x,
                client_y,
            );
        }
    }

    // ─── Line Items Table Header ────────────────────────────────────────
    let table_y = 540.0;
    let col_x = [left, 300.0, 360.0, 420.0, 470.0];
    let col_labels = ["Description", "Qty", "Price", "Tax", "Total"];

    for (i, label) in col_labels.iter().enumerate() {
        push_text(&mut ops, label, "F2", 9.0, col_x[i], table_y);
    }

    // Header underline
    let header_line_y = table_y - 3.0;
    ops.push(Operation::new("q", vec![]));
    ops.push(Operation::new("w", vec![0.5.into()]));
    ops.push(Operation::new("m", vec![left.into(), header_line_y.into()]));
    ops.push(Operation::new(
        "l",
        vec![right.into(), header_line_y.into()],
    ));
    ops.push(Operation::new("S", vec![]));
    ops.push(Operation::new("Q", vec![]));

    // ─── Line Items ─────────────────────────────────────────────────────
    let mut row_y = table_y - 18.0;
    for item in items {
        let desc_short = if item.description.len() > 35 {
            format!("{}…", &item.description[..34])
        } else {
            item.description.clone()
        };

        push_text(&mut ops, &desc_short, "F1", 9.0, col_x[0], row_y);
        push_text(
            &mut ops,
            &format!("{}", item.qty),
            "F1",
            9.0,
            col_x[1],
            row_y,
        );
        push_text(
            &mut ops,
            &fmt_amount(item.unit_price),
            "F1",
            9.0,
            col_x[2],
            row_y,
        );
        push_text(
            &mut ops,
            &format!("{}%", item.tax_rate),
            "F1",
            9.0,
            col_x[3],
            row_y,
        );
        push_text(
            &mut ops,
            &fmt_amount(item.line_total),
            "F1",
            9.0,
            col_x[4],
            row_y,
        );

        row_y -= 15.0;
    }

    // ─── Totals Section ─────────────────────────────────────────────────
    let totals_y = row_y - 10.0;

    push_text(
        &mut ops,
        &format!("Subtotal: {}", fmt_amount(invoice.subtotal)),
        "F1",
        10.0,
        400.0,
        totals_y,
    );
    push_text(
        &mut ops,
        &format!("Tax Total: {}", fmt_amount(invoice.tax_total)),
        "F1",
        10.0,
        400.0,
        totals_y - 16.0,
    );
    push_text(
        &mut ops,
        &format!("Grand Total: {}", fmt_amount(invoice.total_amount)),
        "F2",
        12.0,
        400.0,
        totals_y - 34.0,
    );

    // Total underline
    let total_line_y = totals_y - 36.0;
    ops.push(Operation::new("q", vec![]));
    ops.push(Operation::new("w", vec![1.0.into()]));
    ops.push(Operation::new("m", vec![400.0.into(), total_line_y.into()]));
    ops.push(Operation::new("l", vec![right.into(), total_line_y.into()]));
    ops.push(Operation::new("S", vec![]));
    ops.push(Operation::new("Q", vec![]));

    // ─── Footer ─────────────────────────────────────────────────────────
    push_text(
        &mut ops,
        &format!(
            "Generated by smeMaster | {} | {}",
            company.name,
            fmt_date(invoice.issue_date)
        ),
        "F1",
        7.0,
        left,
        50.0,
    );

    // ── Assemble document ───────────────────────────────────────────────
    let content = Content { operations: ops };
    let content_id = doc.add_object(Stream::new(dictionary! {}, content.encode().unwrap()));

    let page_id = doc.add_object(dictionary! {
        "Type" => "Page",
        "Parent" => pages_id,
        "Contents" => content_id,
        "Resources" => resources_id,
        "MediaBox" => vec![0.into(), 0.into(), 595.into(), 842.into()],
    });

    let pages = dictionary! {
        "Type" => "Pages",
        "Kids" => vec![page_id.into()],
        "Count" => 1,
    };
    doc.objects.insert(pages_id, Object::Dictionary(pages));

    let catalog_id = doc.add_object(dictionary! {
        "Type" => "Catalog",
        "Pages" => pages_id,
    });
    doc.trailer.set("Root", catalog_id);

    // Compress streams for smaller file size
    doc.compress();

    // Serialize to bytes
    let mut cursor = Cursor::new(Vec::new());
    doc.save_to(&mut cursor).unwrap();
    cursor.into_inner()
}
