# Company Wallet

> **Module:** ERP Console → **Cash** tab
> **Works on:** Desktop (Windows / macOS / Linux) and Mobile (Android) — the same responsive screen, adaptive layout.

The **Company Wallet** is the single source of truth for your business's cash on hand. Every euro, dirham, or dollar that moves through the ERP — a sale invoice paid, a supplier bill settled, an owner deposit, a cash withdrawal — flows through this wallet and is mirrored into the double-entry ledger so your balance sheet always balances.

This guide covers what the wallet is, how to use it day-to-day, and how it stays in sync with the accounting books.

---

## Where to find it

1. Open the **ERP Console** from the sidebar.
2. Pick the company you want from the **company switcher** in the top-right.
3. Click the **Cash** tab (wallet icon).

The wallet is created automatically the first time you open it for a company — you never have to set it up manually.

---

## The wallet screen

### Balance hero

The top card shows your **Cash on hand** for the selected company:

- The big number is your current balance in the company currency (e.g. `MAD`, `EUR`, `USD`).
- A green accent means you have positive cash.
- A red accent with an **Overdraft** message means the balance has dropped below zero (for example, a bill was marked paid before the cash landed). This is allowed — it simply flags that the business is running on negative cash.

### Cash in / Cash out

Two summary tiles below the hero show the running totals of all money that has come **in** and gone **out** through the wallet.

### Movements feed

The **Wallet movements** list is your live transaction history. It is derived directly from the **Cash (1000)** account in the ledger, so every entry here also appears in *ERP Console → Accounting*.

- **Green ↓** = cash in (a debit to the Cash account)
- **Red ↑** = cash out (a credit to the Cash account)
- Each row shows the date, a description, and a reference (invoice number, deposit note, etc.)

On desktop it's a table; on mobile it collapses into clean cards that stack vertically for one-thumb reading.

---

## Top up (deposit cash)

Use this when you put money into the business — an owner deposit, a loan drawdown, or a cash injection.

1. Click **Top up**.
2. Enter the **amount** in major currency units (e.g. `1000` for 1,000 DH).
3. Tap a **preset chip** (`100 / 500 / 1,000 / 5,000`) for a quick fill.
4. Optionally add a **note** (e.g. "Owner deposit").
5. Click **Top up**.

Behind the scenes the wallet balance increases and a journal entry is posted:

```
Dr Cash (1000)      +amount
   Cr Owner's Equity (3000)   -amount
```

So the ledger stays balanced automatically.

---

## Withdraw (take cash out)

Use this for owner draws, petty cash, or any cash leaving the business.

1. Click **Withdraw**.
2. Enter the **amount** and an optional **note**.
3. Click **Withdraw**.

This posts the reverse entry:

```
Dr Owner's Equity (3000)   +amount
   Cr Cash (1000)                -amount
```

> Withdrawals can take the balance negative (overdraft). The UI flags this clearly rather than blocking it, because real businesses sometimes run on borrowed cash.

---

## How sales, invoicing, and expenses route through the wallet

This is the core rule: **all ERP money movement goes through the wallet.**

| Action                                            | Wallet effect                          | Ledger effect                                   |
| ------------------------------------------------- | -------------------------------------- | ----------------------------------------------- |
| **Sale invoice marked `paid`**                    | Cash in (credit)                      | Dr Cash (1000) / Cr Accounts Receivable (1200)  |
| **Sale invoice reversed to `unpaid`**            | Cash out (reverse)                    | Cr Cash (1000) / Dr Accounts Receivable (1200)  |
| **Supplier bill (purchase order) marked `paid`** | Cash out (debit)                      | Dr Accounts Payable (2000) / Cr Cash (1000)     |
| **Supplier bill reversed to `unpaid`**           | Cash in (reverse)                     | Cr Accounts Payable (2000) / Dr Cash (1000)     |
| **Manual top-up**                                | Cash in                               | Dr Cash (1000) / Cr Owner's Equity (3000)       |
| **Manual withdrawal**                             | Cash out                              | Dr Owner's Equity (3000) / Cr Cash (1000)       |

So the moment you mark an invoice **paid** in Invoicing, the wallet balance updates and the cash movement appears in the movements feed — no extra step needed.

---

## Tips & notes

- **One wallet per company.** Switching companies in the company switcher shows that company's own cash balance.
- **Payments are reversible.** Marking a paid invoice back to `unpaid` unwinds the wallet movement and the ledger entry, so nothing is double-counted.
- **The wallet and the ledger never disagree.** Every wallet change writes a journal entry; if a ledger post ever fails, the wallet update still succeeds and the system logs a warning so you can reconcile later.
- **Currency** is set when the wallet is first created (defaults to `MAD`) and matches the company's accounting currency.

---

## Troubleshooting

| Symptom                                  | What it means                                                     | What to do                                            |
| ---------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------- |
| Balance shows a negative (red) number   | Cash has gone below zero (overdraft)                              | Top up, or check that a recent bill/expense is correct |
| A paid invoice didn't change the balance | The invoice may already have been `paid` (no transition occurred) | Toggle status to `unpaid` then back to `paid`         |
| Movements feed is empty                  | No cash has moved yet for this company                            | Mark an invoice paid, or use Top up / Withdraw        |

---

## Related docs

- [Invoicing](../04-FEATURES/36-invoicing.md) — creating and sending invoices
- [ERP Console overview](../04-FEATURES/) — Accounting, Reports, Stock tabs
- [Project status](../STATUS.md) — wallet implementation notes
