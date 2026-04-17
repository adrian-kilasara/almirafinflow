

# Loans Realism + Timezone-Aware System Plan

## What's Wrong Today

### Issue 1 — Loans are "negative spending"
When a loan payment is recorded, the system creates an **expense transaction** on the linked asset account. Side effects:
- Reports show it as a regular expense (inflates monthly spending).
- Health score / spending categories distort it.
- Taking a loan **adds no money** to any cash account — yet in reality, a loan disburses funds into your bank/M-Pesa. Right now you only see debt rise without seeing the cash arrive.

### Issue 2 — Every new loan creates a new account
`LoanForm` always calls `accounts.insert(...)`. If you top up Fuliza three times, you get three "Fuliza" accounts cluttering both Loans and Accounts views.

### Issue 3 — Timezone uses browser/UTC time
All over the codebase (`new Date().toISOString().split('T')[0]`, streaks, audit logs, "today's expenses", weekly velocity, budget month windows) the system uses **UTC** or **browser local time**. A user in `Africa/Dar_es_Salaam` logging at 1 AM gets data attributed to "yesterday" by UTC. Streaks break, daily reports lie, achievements miss.

---

## Proposed Fix

### A. Loan Lifecycle Redesign (no redundancy)

**Two new transaction semantics — neither pollutes income/expense reports:**

| Action | What user does | What system does |
|---|---|---|
| **Disburse loan** | Add new loan → pick destination asset account | Liability balance = principal owed. Asset account balance += disbursed amount. Tagged `loan-disbursement` (excluded from expense/income totals). |
| **Spend the loaned money** | Normal expense from the asset account | A regular expense — same as any other. Loan balance is **untouched**. |
| **Repay loan** | Loans tab → "Record Payment" | Asset account balance −= payment. Liability balance −= principal portion. Tagged `loan-repayment` (excluded from expense totals; surfaces under "Debt Repayments" instead). |
| **Top up existing loan** | Loans tab → existing loan → "Borrow More" | Increases liability balance + asset balance. Logs to audit. **No new account row.** |

**Result:** Spending the borrowed money looks like normal spending (because it is). Repayment is a separate flow that doesn't double-count. Net worth still works because liability ↑ and asset ↑ cancel out at disbursement.

**Reports update**: filter out `tags @> {'loan-disbursement','loan-repayment'}` from income/expense aggregates and surface them in a dedicated "Debt Activity" line.

### B. Loan = Account Re-use

`LoanForm` will check for an existing active liability with the same `name + institution_name + currency` for the user. If found:
- Switch into "Top up" mode (preselect that loan, add to balance, log to `account_audit_log`).
- Otherwise create as today.

Same logic on the Loans dashboard "Add Loan" button.

### C. Timezone-Aware Date Engine

**Core principle:** the user's `settings.timezone` (already stored in `user_settings`) becomes the single source of truth for "today", "this week", "this month".

**New helper module** — `src/lib/datetime.ts`:
```text
todayInTz()              → 'YYYY-MM-DD' in user's tz
nowInTz()                → Date object shifted into user's tz
startOfDayInTz(date)     → midnight in user's tz, returned as UTC instant
monthRangeInTz()         → {start, end} for current month in user's tz
weekRangeInTz()          → ditto
isSameDayInTz(a, b)      → boolean
```
Backed by `Intl.DateTimeFormat` (no extra deps).

**Refactor sweep** — replace every `new Date().toISOString().split('T')[0]` and every `new Date(now.getFullYear(), now.getMonth(), 1)` style pattern with these helpers in:
- `src/lib/events.ts` (streaks, weekly velocity, monthly windows)
- `src/components/reports/hooks/useReportData.ts` (period ranges)
- `src/components/gamification/StreakTracker.tsx`
- `src/components/dashboard/*` (CalendarSummary, SpendingHeatmap, PredictiveCashFlow)
- `src/components/calendar/*`
- `src/components/activity/ActivityLog.tsx`
- `src/components/budgets/*`
- `src/components/transactions/TransactionForm.tsx` (default date)
- `src/components/loans/LoanPaymentForm.tsx`
- `src/components/savings/*`
- `src/lib/format.ts` (`getCurrentMonthRange`, `getCurrentWeekRange`, `formatRelativeDate`)

**Data entry vs. data attribution rule (your specific concern):**
- The user can still freely backdate transactions (today / yesterday / last week) — the date field is respected as-is.
- BUT any "automatic" timestamp the system generates (audit logs, streak `last_activity_date`, "this is today's spending" comparisons, notification dedup, weekly summary windows) uses **the user's timezone's current day**, never UTC and never the device's local day if it differs from settings.

This makes streaks, achievements, fraud detection, and reports honest regardless of where the device clock thinks it is.

### D. Settings Surface

A single read-only banner in Settings → Localization showing the **current effective timezone** + "It is currently {time} ({date}) for your account". Reassures the user that the system is operating on their tz.

---

## Database Changes

Minimal — existing tables already support this:
- No new columns needed for the loan refactor (we're using existing `accounts` + `account_audit_log` + transaction `tags`).
- Optionally add a `loan_account_id` column to `transactions` for direct linkage on repayments (cleaner queries than tag filtering). I recommend **yes** — one nullable uuid column.

---

## Files Changed/Created

| File | Action |
|---|---|
| `src/lib/datetime.ts` | NEW — timezone helpers |
| `src/lib/format.ts` | Update month/week/relative helpers to use tz |
| `src/lib/events.ts` | Replace UTC dates; streak + alerts use tz |
| `src/components/loans/LoanForm.tsx` | Detect duplicate loan → top-up flow |
| `src/components/loans/LoanPaymentForm.tsx` | Tag repayment, link via `loan_account_id`, exclude from expense reports |
| `src/components/loans/LoanTopUpForm.tsx` | NEW — borrow more on existing loan |
| `src/components/loans/LoansDashboard.tsx` | Show disbursement + repayment history; "Borrow More" button |
| `src/components/reports/hooks/useReportData.ts` | Exclude loan-disbursement / loan-repayment from income/expense; tz-aware ranges; new "Debt Activity" metric |
| `src/components/dashboard/*` (5 files) | tz-aware date math |
| `src/components/transactions/TransactionForm.tsx` | Default date = `todayInTz()` |
| `src/components/budgets/BudgetForm.tsx` | Default date = `todayInTz()` |
| `src/components/gamification/StreakTracker.tsx` | tz-aware day comparison |
| `src/components/calendar/*` | tz-aware "today" highlight |
| `src/components/activity/ActivityLog.tsx` | tz-aware grouping |
| `src/components/settings/LocalizationSettings.tsx` | Show effective tz + clock |
| Migration | Add `loan_account_id uuid` to `transactions` (nullable, indexed) |

---

## Why This Is Safe & Efficient

- **No data loss**: existing transactions keep working; new tag/column only affects new loan flows.
- **No double counting**: loan disbursement and repayment carry tags filtered out of regular income/expense math.
- **No schema bloat**: 1 nullable column, reuses `accounts`, `account_audit_log`, `transactions`.
- **One source of truth for time**: every "today" in the app routes through `datetime.ts`.
- **Honest streaks & reports**: backdated entries land on their actual date; daily/weekly aggregates always align with the user's calendar day.
- **Fraud-resistant**: audit logs stamp the tz-current moment alongside UTC `created_at`, so manipulation attempts are visible in both frames.

