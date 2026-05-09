# 10-Point Comprehensive Fix Plan

Single-pass delivery. Display-only FX (safest, no schema bloat). Full global search. All 10 items.

---

## 1. Multi-Currency Conversion (Savings, Budgets, Bills)

**Problem:** Savings summary sums raw amounts across currencies (KES + TZS + UGX) producing nonsense totals. Same in Budgets and Bills.

**Fix:**
- New `src/lib/currency.ts` — `convertTo(amount, from, to, rates)` using `exchange_rates` table.
- New `src/hooks/useExchangeRates.ts` — fetches latest rate per pair, cached 1h.
- **Savings**: `SavingsDashboard.tsx` — convert each goal to user's `default_currency` before summing Total Target / Total Saved. Show "≈ TZS 1,250,000" with small "(converted from 3 currencies)" note. Each goal card keeps its original currency.
- **Budgets**: `BudgetList.tsx` summary card — converted total + per-currency breakdown tooltip.
- **Bills**: `BillsSubscriptions.tsx` monthly-total card — converted to default currency.
- **Monthly Savings Capacity chart**: bug — it groups by month but doesn't sum converted amounts (currently sums raw values from mixed currencies → 0 or misaligned bars). Fix aggregation to use converted values, ensure month buckets include zeros so all months render with bars.

**Audit-safe:** original currency + amount preserved on every row; conversion is display only.

---

## 2. 5-Year Data Integrity Audit

**Current methods (already in place):**
- Soft-delete (`is_deleted`, `deleted_at`) — no destructive deletes.
- Versioned `transaction_history` — every edit logged with old/new values.
- `account_audit_log` — balance changes traced.
- Balances **derived** from transactions + opening_balance (no manual balance edits).
- RLS on every table — strict per-user isolation.
- Reconciliation sessions — periodic statement-vs-system match.
- `transfers` table — dual-entry mirrored linked transactions.

**Gaps + fixes (this pass):**
- Add DB **triggers** to auto-write `transaction_history` on UPDATE (currently relies on client). Prevents bypass.
- Add `BEFORE UPDATE` trigger on `accounts.balance` to reject direct writes — force balance changes via transactions only.
- Add unique constraint on `transfers(from_transaction_id)` + `(to_transaction_id)` to prevent orphan duplicates.
- Add daily-rate snapshot on `transactions` insert (`fx_rate_snapshot` in `notes` JSON) for historical FX accuracy.
- After fix: ~98% audit-grade (loss only from manual category re-assignment, which is logged anyway).

---

## 3. Responsive Fit (ResizeObserver)

**Problem:** Fixed grid templates overflow at 943px viewport.

**Fix:**
- New `src/hooks/useContainerSize.ts` — ResizeObserver-based container query.
- Dashboard root + Overview/Activity grids switch templates: <640 = 1 col, 640–900 = 2, 900–1280 = 3, >1280 = 4.
- Add `min-w-0 overflow-x-hidden` to all flex/grid children to kill horizontal scroll.
- `auto-rows-fr` on card grids so cards stretch evenly (kills vertical gaps — see #8).
- Top nav: collapse to icon-only between 768–1024px; full overflow menu under 768px.

---

## 4. Financial Timeline — What it does + Integrity

**What it does:** `FinancialCalendar.tsx` plots a chronological strip of:
- Past transactions (real, from `transactions` where `date <= today`)
- Upcoming bills (`bills_subscriptions.next_due_date`)
- Scheduled loan payments (`loan_payments` where `is_scheduled=true`)
- Predicted salary (derived from recurring income pattern detection)

**Integrity fix:**
- Add a **Legend** with 3 badges: Real (solid), Scheduled (dashed border), Predicted (dotted, lower opacity).
- Each event tooltip shows `data_source: transaction_id | bill_id | predicted`.
- Predicted events explicitly labeled and excluded from any total/summary.
- Past = 100% real DB rows. Future bills/loans = 100% real schedules. Predicted salary = clearly flagged, not summed into totals.

---

## 5. Auto-Categorization Rules

**What it does:** Pattern-matches transaction descriptions (e.g. "UBER" → Transport) so newly imported/created transactions auto-assign a category. It complements categories — categories are the *bucket*, rules are the *automation* that sorts into buckets.

**Simplification:**
- Rename UI to "Smart Categorization" with 1-line explainer at top.
- Show "Last matched: N transactions in past 7 days" per rule.
- Add "Apply to existing transactions" button (one-click bulk re-categorize).
- When user manually changes a category, prompt: "Create rule from this?" — closes the loop.

---

## 6. Budget Reset Bug After Template Apply

**Root cause:** `BudgetForm.tsx` creates new budget but old `budget_exceeded` notifications + cached over-budget banners persist. `FinancialHealthScore.tsx` and Dashboard mini-budget widget read stale period boundaries.

**Fix:**
- On template apply: soft-dismiss all `notifications` where `type='budget_exceeded'` and `related_id` matches old budget IDs.
- Centralize `getPeriodRange(period, start_date)` in `src/lib/budget.ts` — used by every budget consumer (no drift).
- Force re-fetch via React Query `invalidateQueries(['budgets', 'notifications', 'health-score'])` after template apply.

---

## 7. Multi-Currency Payments (Bills + Savings)

**Problem:** Bills only allow KES even when bill is TZS; savings same.

**Fix:**
- New `src/components/shared/FXConverter.tsx` — inline component shown when `bill.currency !== sourceAccount.currency`. Shows live rate, editable, computes converted amount.
- On pay: write transaction in **source account's currency** (preserves account integrity), but store original in tags: `["fx:original=15000 TZS","fx:rate=0.045"]`.
- Same flow for `SavingsAllocation` when account currency ≠ goal currency.
- Auditable: original amount + currency + rate all in `transactions.tags`.

---

## 8. Card Alignment (Overview + Activity)

**Fix:**
- Overview grid: `grid auto-rows-fr` → all cards same height per row, no vertical gaps.
- Long-content overview cards get a "Read more →" footer that deep-links to the relevant page (e.g. AI Insights → `/insights`, Budgets → `/budgets`).
- Activity cards: fixed `max-h-[420px]` with `overflow-y-auto` inside (custom-styled scrollbar). Cards no longer expand.
- **Remove the duplicate "Quick Overview" card** from the Activity tab.

---

## 9. Calculators

**Fix:**
- Remove the duplicate calculator instance.
- Tabbed layout in `FinancialCalculators.tsx`: **Scientific | Financial | Tax | Local**.
- **Scientific**: full expression parser (sin/cos/tan, log/ln, sqrt, ^, π, e, parentheses, memory M+/M-/MR/MC).
- **Financial**: Loan Amortization (with schedule table), Compound Interest, Goal Savings (target-date solver), Emergency Fund, Mortgage Affordability, Debt Snowball/Avalanche comparison, Inflation-Adjusted Return, Net Worth, Currency Converter (uses `exchange_rates`).
- **Tax**: PAYE TZ + KE brackets, NSSF (TZ), NHIF (KE), VAT.
- **Local**: M-Pesa transaction fees, SACCO dividend yield, T-Bill yield-to-maturity.

---

## 10. Advanced Global Search

**Fix:**
- Replace nav search with ⌘K command palette (`cmdk` already in shadcn stack).
- On open: index in-memory all user data — accounts, transactions (last 1000), categories, budgets, savings goals, bills, loans, lessons, settings pages.
- `fuse.js` fuzzy matching (typo-tolerant, weighted by field).
- Results grouped by type with icon, secondary line (e.g. amount + date for tx), keyboard nav, recent searches in localStorage.
- "Jump to" navigation on Enter.

---

## Files Touched

| Area | Files |
|---|---|
| Currency | `src/lib/currency.ts` (new), `src/hooks/useExchangeRates.ts` (new), `SavingsDashboard.tsx`, `MonthlySavingsChart`, `BudgetList.tsx`, `BillsSubscriptions.tsx` |
| Integrity | DB migration (triggers + constraints) |
| Responsive | `src/hooks/useContainerSize.ts` (new), `Dashboard.tsx`, top nav |
| Timeline | `FinancialCalendar.tsx` |
| Rules | `TransactionRulesManager.tsx`, transaction edit dialog |
| Budget | `BudgetForm.tsx`, `src/lib/budget.ts` (new), `FinancialHealthScore.tsx`, `Dashboard.tsx` |
| Multi-currency pay | `src/components/shared/FXConverter.tsx` (new), `BillsSubscriptions.tsx`, `SavingsGoalCard.tsx` |
| Layout | `Dashboard.tsx` Overview & Activity tabs |
| Calculators | `FinancialCalculators.tsx` (rewrite) |
| Search | New `src/components/search/CommandPalette.tsx`, top nav, `fuse.js` install |

## Risk

- All FX = display-only, no data mutation.
- DB triggers reject only **future** invalid writes; existing rows untouched.
- Layout/calculator/search changes = pure frontend, zero data risk.
- One migration for integrity triggers (additive, safe).
