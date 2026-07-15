# Invoicing

> **Status:** Production-ready | **Commands:** 35

## Architecture

The invoicing module follows a 3-layer design:

1. **Calc Engine** (`src-tauri/src/invoicing/calc.rs`) — Pure Rust math for line items and document totals
2. **Table Layer** (`src-tauri/src/db/tables/invoicing/`) — SQL CRUD per entity (invoices, items, clients, catalog, categories, company settings)
3. **Commands Layer** (`src-tauri/src/commands/invoicing.rs`) — 35 Tauri IPC commands for the frontend

## Key Files

| File                                                    | Purpose                                  |
| ------------------------------------------------------- | ---------------------------------------- |
| `src-tauri/src/invoicing/calc.rs`                       | Line & document total calculation engine |
| `src-tauri/src/commands/invoicing.rs`                   | 35 IPC commands                          |
| `src-tauri/src/db/tables/invoicing/invoices.rs`         | Invoice CRUD                             |
| `src-tauri/src/db/tables/invoicing/items.rs`            | Invoice line items                       |
| `src-tauri/src/db/tables/invoicing/clients.rs`          | Client records                           |
| `src-tauri/src/db/tables/invoicing/catalog_items.rs`    | Product/service catalog                  |
| `src-tauri/src/db/tables/invoicing/categories.rs`       | Invoice categories                       |
| `src-tauri/src/db/tables/invoicing/company_settings.rs` | Company-level defaults                   |
| `src-tauri/src/services/invoicing/pdf.rs`               | PDF generation                           |
| `src-tauri/src/services/invoicing/peppol.rs`            | PEPPOL XML generation                    |
| `src-tauri/src/smtp/`                                   | SMTP dispatch                            |
| `src-tauri/src/pgp/`                                    | PGP encryption                           |

## Calc Engine

The calc engine (`src-tauri/src/invoicing/calc.rs`) uses integer arithmetic in centimes (1 MAD = 100 centimes) to avoid float rounding errors.

- `calculate_line(LineInput) → LineOutput` — Single line: subtotal, discount, taxable, tax, total
- `calculate_document_totals(&[LineOutput], global_discount, tax_rate, tax_mode, shipping) → DocumentTotals` — Aggregated document totals

## Key Flow: Create Invoice

1. Frontend sends `db_create_invoice` with header fields + items
2. Calc engine computes totals via `calculate_document_totals`
3. Invoice header + items stored in DB within a transaction
4. Returns the new Invoice

## Key Flow: Send Invoice

1. Frontend calls `db_send_invoice(id)`
2. System generates PEPPOL XML + PDF
3. PGP-encrypts the PDF if recipient has a public key
4. Dispatches via SMTP (pooled, TLS, timeout + retry)
5. Marks invoice as "sent"
6. Applies stock/ledger side effects

## Key Flow: Pay / Reverse an Invoice (routes through the Wallet)

Marking an invoice **paid** (or back to **unpaid**) in the Invoicing UI calls
`db_update_invoice_status`, which routes the cash movement through the **Company
Wallet** and mirrors it to the ledger:

- **Sale invoice → `paid`** → wallet credited (cash in), ledger `Dr Cash (1000) / Cr AR (1200)`
- **Sale invoice → `unpaid`** → wallet debited (reverse), ledger `Cr Cash (1000) / Dr AR (1200)`
- **Purchase order (bill) → `paid`** → wallet debited (cash out), ledger `Dr AP (2000) / Cr Cash (1000)`
- **Purchase order → `unpaid`** → wallet credited (reverse), ledger `Cr AP (2000) / Dr Cash (1000)`

See the [Company Wallet user guide](../user-guide/wallet.md) for the full money-movement
matrix and how manual top-ups / withdrawals post to Owner's Equity (3000).

## Company Settings

Company settings control defaults: currency, tax rate, invoice numbering prefix/suffix, template, logo, bank details, terms. Stored per-company in SQLite.

## Categories

Categories group invoices by type. Simple name-per-company CRUD.

## Platform Support

- **Desktop (Windows/macOS/Linux):** Full support — PDF generation, SMTP dispatch, PGP
- **Mobile (Android):** Full support via Tauri mobile bridge. UI adapts to screen size.
- **iOS:** Requires macOS build machine. Code compiles, not yet tested.
