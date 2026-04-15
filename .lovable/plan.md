

# Loan Management Section Plan

## Current State

Your system already supports loans partially — accounts can be classified as `liability` with types like "Bank Loan", "Mobile Loan", "SACCO Loan". However, there is no dedicated loan tracking with repayment schedules, interest calculations, or payment-to-account linking.

## What We Will Build

A dedicated **Loans** tab in the Dashboard that leverages existing `accounts` (classification=liability) as the source of truth — no new tables for loan entities. Instead, we add **loan metadata columns** to the existing `accounts` table and a small `loan_payments` table to track scheduled vs actual payments.

## Database Changes

**Alter `accounts` table** — add loan-specific columns (only used when classification=liability):
- `interest_rate` (numeric, nullable) — annual interest rate %
- `loan_term_months` (integer, nullable) — total repayment period
- `loan_start_date` (date, nullable) — when the loan started
- `monthly_payment` (numeric, nullable) — fixed monthly installment
- `loan_type` (text, nullable) — personal, mortgage, business, mobile, informal
- `linked_account_id` (uuid, nullable) — the asset account payments come from (e.g., cash or bank)

**New `loan_payments` table** — tracks each repayment:
- `id`, `user_id`, `loan_account_id` (references the liability account), `amount`, `principal_portion`, `interest_portion`, `payment_date`, `is_scheduled` (bool), `transaction_id` (nullable — links to the actual expense transaction when paid), `status` (scheduled/paid/missed), `created_at`
- RLS: users can only CRUD their own rows

## How It Connects

- When a user **records a loan payment**, the system automatically:
  1. Creates an expense transaction on the linked asset account (cash/bank)
  2. Reduces the liability account balance by the principal portion
  3. Logs both in `account_audit_log`
- This reuses the existing transaction + audit infrastructure with zero redundancy
- Net worth calculations already subtract liabilities, so loans are reflected immediately

## Frontend Components

| Component | Purpose |
|-----------|---------|
| `src/components/loans/LoansDashboard.tsx` | Main tab — summary cards (total debt, monthly obligations, next payment), list of active loans |
| `src/components/loans/LoanCard.tsx` | Individual loan display — balance, rate, progress bar, next payment date |
| `src/components/loans/LoanForm.tsx` | Add/edit a loan (creates a liability account with loan metadata) |
| `src/components/loans/LoanDetailPanel.tsx` | Amortization schedule, payment history, payoff projections |
| `src/components/loans/LoanPaymentForm.tsx` | Record a payment — auto-creates transaction on linked account |

## Dashboard Integration

- Add a `loans` nav item between Bills and Savings in `navItems` array
- Lazy-load `LoansDashboard` like other tabs
- The Overview tab's net worth and financial health already account for liability balances

## Files to Create/Modify

| File | Action |
|------|--------|
| Migration SQL | Add columns to `accounts`, create `loan_payments` table with RLS |
| `src/components/loans/LoansDashboard.tsx` | New |
| `src/components/loans/LoanCard.tsx` | New |
| `src/components/loans/LoanForm.tsx` | New |
| `src/components/loans/LoanDetailPanel.tsx` | New |
| `src/components/loans/LoanPaymentForm.tsx` | New |
| `src/pages/Dashboard.tsx` | Add loans tab + nav item |
| `src/types/finance.ts` | Add LoanPayment interface |

## Efficiency Notes

- No new "loans" table — liability accounts ARE the loans, extended with metadata columns
- Payments flow through the existing transaction system
- Audit logging reuses `account_audit_log`
- Net worth, reports, and health score automatically include loan data

