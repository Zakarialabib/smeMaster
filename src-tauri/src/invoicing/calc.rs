use serde::{Deserialize, Serialize};

/// Represents an amount of money in the smallest currency unit (e.g., centimes).
/// For MAD (Moroccan Dirham), 1 MAD = 100 centimes, so `Money(10000)` = 100.00 MAD.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct Money(pub i64);

/// Input parameters for calculating a single invoice line.
pub struct LineInput {
    pub qty: f64,
    pub unit_price: Money,
    pub discount_pct: Option<f64>,
    pub discount_fixed: Option<Money>,
    pub tax_rate: f64,
}

/// Result of a single invoice line calculation.
#[derive(Debug, Clone, Copy)]
pub struct LineOutput {
    pub subtotal: Money,
    pub discount: Money,
    pub taxable: Money,
    pub tax_amount: Money,
    pub total: Money,
}

/// Whether tax is added on top of the subtotal or included in the unit price.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum TaxMode {
    /// Tax is added on top of the taxable amount (most B2B).
    Excluded,
    /// Tax is included in the unit price (retail / TTC).
    Included,
}

/// Aggregated totals for an entire invoice document.
#[derive(Debug, Clone, Copy)]
pub struct DocumentTotals {
    /// Net amount after line discounts, shipping, and global discount.
    pub net: Money,
    /// Total tax across all lines.
    pub tax_amount: Money,
    /// Net + tax.
    pub grand_total: Money,
    /// Amount still owed (equals `grand_total` minus any payments applied elsewhere).
    pub balance_due: Money,
}

/// Calculate a single invoice line.
///
/// Returns the subtotal (qty × unit_price), any discount, the taxable amount,
/// the calculated tax, and the final line total.
pub fn calculate_line(input: LineInput) -> LineOutput {
    let qty_f = input.qty;
    let unit_price_i = input.unit_price.0;

    // subtotal = qty × unit_price (rounded to nearest integer)
    let subtotal_i = (qty_f * unit_price_i as f64).round() as i64;

    // discount = either percentage of subtotal, fixed amount, or zero
    let discount_i = match (input.discount_pct, input.discount_fixed) {
        (Some(pct), _) => (subtotal_i as f64 * (pct / 100.0)).round() as i64,
        (_, Some(fixed)) => fixed.0.min(subtotal_i),
        _ => 0,
    };

    let taxable_i = subtotal_i - discount_i;
    let tax_amount_i = (taxable_i as f64 * (input.tax_rate / 100.0)).round() as i64;
    let total_i = taxable_i + tax_amount_i;

    LineOutput {
        subtotal: Money(subtotal_i),
        discount: Money(discount_i),
        taxable: Money(taxable_i),
        tax_amount: Money(tax_amount_i),
        total: Money(total_i),
    }
}

/// Calculate totals across all invoice lines.
///
/// * `lines` — output from [`calculate_line`] for each line item.
/// * `global_discount` — an extra discount applied after line items.
/// * `tax_rate` — the overall tax rate (used only in `TaxMode::Excluded`).
/// * `tax_mode` — whether tax is excluded from or included in line totals.
/// * `shipping` — shipping / handling charge.
pub fn calculate_document_totals(
    lines: &[LineOutput],
    global_discount: Money,
    _tax_rate: f64,
    _tax_mode: TaxMode,
    shipping: Money,
) -> DocumentTotals {
    // Each line already carries its own subtotal/discount/tax. The document
    // level simply aggregates them and applies shipping + a global discount.
    let subtotal: i64 = lines.iter().map(|l| l.subtotal.0).sum();
    let line_discount: i64 = lines.iter().map(|l| l.discount.0).sum();
    let net_base = subtotal - line_discount + shipping.0 - global_discount.0;
    let net = Money(net_base.max(0));
    let tax_amount: i64 = lines.iter().map(|l| l.tax_amount.0).sum();
    let grand_total = Money(net.0 + tax_amount);

    DocumentTotals {
        net,
        tax_amount: Money(tax_amount),
        grand_total,
        balance_due: grand_total,
    }
}

/// Format a [`Money`] amount as a decimal string with two fraction digits
/// (e.g. `Money(12345)` → `"123.45"`, `Money(-500)` → `"-5.00"`).
pub fn format_money(m: Money) -> String {
    let negative = m.0 < 0;
    let abs = m.0.unsigned_abs();
    let major = abs / 100;
    let minor = abs % 100;
    let body = format!("{}.{:02}", major, minor);
    if negative {
        format!("-{}", body)
    } else {
        body
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calculate_line_basic() {
        let output = calculate_line(LineInput {
            qty: 2.0,
            unit_price: Money(10000), // 100.00 MAD
            discount_pct: None,
            discount_fixed: None,
            tax_rate: 20.0,
        });
        assert_eq!(output.subtotal.0, 20000);
        assert_eq!(output.tax_amount.0, 4000);
        assert_eq!(output.total.0, 24000);
    }

    #[test]
    fn test_calculate_line_with_percent_discount() {
        let output = calculate_line(LineInput {
            qty: 2.0,
            unit_price: Money(10000),
            discount_pct: Some(10.0), // 10% off
            discount_fixed: None,
            tax_rate: 20.0,
        });
        assert_eq!(output.subtotal.0, 20000);
        assert_eq!(output.discount.0, 2000);
        assert_eq!(output.taxable.0, 18000);
        assert_eq!(output.tax_amount.0, 3600);
        assert_eq!(output.total.0, 21600);
    }

    #[test]
    fn test_calculate_line_with_fixed_discount() {
        let output = calculate_line(LineInput {
            qty: 2.0,
            unit_price: Money(10000),
            discount_pct: None,
            discount_fixed: Some(Money(1500)),
            tax_rate: 20.0,
        });
        assert_eq!(output.subtotal.0, 20000);
        assert_eq!(output.discount.0, 1500);
        assert_eq!(output.taxable.0, 18500);
        assert_eq!(output.total.0, 22200);
    }

    #[test]
    fn test_calculate_document_totals_excluded() {
        let lines = vec![
            calculate_line(LineInput {
                qty: 2.0,
                unit_price: Money(10000),
                discount_pct: None,
                discount_fixed: None,
                tax_rate: 20.0,
            }),
            calculate_line(LineInput {
                qty: 1.0,
                unit_price: Money(5000),
                discount_pct: None,
                discount_fixed: None,
                tax_rate: 10.0,
            }),
        ];

        let totals = calculate_document_totals(&lines, Money(0), 20.0, TaxMode::Excluded, Money(0));

        // Line 1: 24000, Line 2: 5500, Total: 29500, no extra tax
        assert_eq!(totals.grand_total.0, 29500);
    }
}
