
# Comprehensive Audit & Polish — 12-Point Fix Plan

A deep, end-to-end audit grounded in real code. Each item below is a real issue I confirmed in your codebase, with the exact fix and the integrity check it solves.

---

## 1. Navigation Bar — Smarter, Adaptive, Premium Feel

**Today:** Top-bar with 11 tabs that overflows on tablets, no keyboard nav, no command palette, no collapsing for narrow screens. Mobile uses a full-screen Sheet (heavy).

**Fix:**
- **Desktop:** Adaptive top-bar with smart overflow. When viewport is too narrow, low-priority tabs (Activity, Investments, Loans) collapse into a "More ▾" dropdown. Active tab always visible.
- **New: ⌘K Command Palette** — instant fuzzy search to jump to any tab/action ("Add expense", "Open budgets"). Uses existing `Command` shadcn component.
- **Keyboard nav:** ←/→ arrow keys cycle tabs when nav is focused; numeric keys 1-9 jump directly.
- **Visual upgrade:** Glassmorphic pill indicator (already partly there) refined with a subtle glow + sliding spring animation. Active badge counts (over-budget, overdue bills) shown as live red dots.
- **Mobile:** Replace heavy Sheet with a sleeker bottom-anchored adaptive drawer that slides up — faster, thumb-friendly, fits PWA UX.
- **Breadcrumb context:** When inside a sub-view (e.g. Account Detail), show a tiny breadcrumb under the nav so users always know where they are.

---

## 2. Smart Insights — Why It Feels Broken

**Diagnosis (`AISmartInsights.tsx` line 27-35):** Uses `new Date().getMonth()` (browser-local), but transactions store TZ-aware date keys. On a UTC vs Africa/Dar_es_Salaam boundary, the "this month" filter misses or includes wrong rows. **Also**, the weekend/weekday calculator (line 62-67) divides by transaction-count, not day-count — totally wrong math, often produces "weekend spike" warnings that aren't real.

**Fix:**
- Replace all `new Date()` month/day math with `todayInTz()` + `addDaysToKey` from `src/lib/datetime.ts`.
- Fix weekend/weekday math: divide totals by **calendar weekend-days vs weekday-days in the period**, not by transaction counts.
- Filter out loan-disbursement / loan-repayment / bill-payment tags so the "spending spike" alerts don't fire for non-discretionary flows.
- Add a **"Last refreshed at"** stamp + manual refresh button so users know it's live.
- Insights now only fire when statistically meaningful (min 5 txns in compared period) — silences noise.

---

## 3. AI Advisor (Financial Coach) — What's Broken

**Diagnosis (`AIFinancialCoach.tsx` line 99):** `currency: 'TZS'` is **hardcoded** — it ignores the user's `default_currency` setting. The system prompt also doesn't receive `riskTolerance` / `adviceMode` (line 45-46 of edge function expect them but client never sends them). And there's no error visibility when Gemini returns 200 but with an empty stream.

**Fix:**
- Pass `currency: settings.default_currency`, `riskTolerance: settings.ai_risk_tolerance`, `adviceMode: settings.ai_advice_mode` in the request body.
- Add **conversation persistence** in `localStorage` so chats survive a refresh.
- Surface streaming errors with a visible retry chip if the SSE stream closes prematurely.
- Add 3 user-data-aware **default starter prompts** (e.g. "Why did my X spending jump?", "Plan to clear my Y loan in N months") computed live from real metrics.
- Show a typing indicator + an "AI is analyzing your data..." stage so the user knows real data was loaded before the answer.

---

## 4. Predictive Cash Flow — Why It's Inaccurate

**Diagnosis (`PredictiveCashFlow.tsx` line 31, 39-40):** 
- `totalBalance` includes **liability accounts** as positive cash — your loan balances *add* to projected runway, completely false.
- Daily averages divide by 30 even when only 5 days of data exist → wildly inflated/deflated rates.
- Bills/recurring schedules are summed across **all currencies as if equal** (TZS, USD, KES) — currency mixing fraud risk.
- "Low balance < 10000" is hardcoded — should use `settings.low_balance_threshold`.

**Fix:**
- Use **only asset accounts** (`classification === 'asset' && is_active && !is_archived`) for `totalBalance`.
- Compute averages over `min(actual_days_with_data, 30)` — real data only.
- Group projections **per currency** (or convert to user's `default_currency` via `exchange_rates` table) — never mix.
- Use `settings.low_balance_threshold` for the warning trigger.
- Weight projection: weekday burn vs weekend burn (data shows people spend differently). Add confidence band shown as a soft area around the projection line.
- Surface **assumption tooltip**: "Based on N days of data · X bills · Y recurring schedules" so users trust the math.

---

## 5. Loans Strictly on Liability Accounts — Audit Hardening

**Already enforced (✅):** `LoanForm.tsx` line 163 always inserts `classification: 'liability'`. `LoansDashboard` filters `classification === 'liability'`. **Loan disbursement transactions were already removed** (no income tx on creation).

**But there's a leak:** `AccountForm.tsx` (lines 22-23, 39-52) lets a user create an asset account with **negative opening_balance** — that's a "loss on asset" loophole. And there's no DB-level guard preventing a user from manually flipping a loan to `classification: 'asset'`.

**Fix:**
- **Client-side:** `AccountForm` validates `opening_balance >= 0` for assets (loans go through `LoanForm` only).
- **DB trigger (migration):** A `BEFORE INSERT/UPDATE` trigger on `accounts` rejects any asset row with negative opening_balance and any liability row created outside the loan flow without `loan_type`.
- **Repayment flow (`LoanPaymentForm`):** Hard-block selection of a liability source account (you can only pay a loan *from* an asset). Already partially there — make the filter explicit and the error message clear.
- **Audit:** Add a one-shot "Loans Audit" notification that surfaces if any existing liability account is missing `loan_type`/`interest_rate` so historical data gets cleaned.

---

## 6. Floating + Button — Tighter Pill, No Empty Halo

**Today (`FloatingTransactionForm.tsx` line 169):** Container uses `flex flex-col items-center gap-2 sm:gap-3` with no explicit width, but the action row (`actions`) renders 3 vertical chips with labels above the FAB — when collapsed the wrapper still reserves rectangular space.

**Fix:**
- Reduce wrapper padding/gap; use `w-fit h-fit` so when closed nothing but the circle is interactive.
- Make the FAB a proper **perfect circle** with a subtle outer ring on hover and a tighter shadow (no square halo).
- When opened, action chips fan out in a **radial arc** above the FAB instead of a vertical column — looks premium, takes less vertical space, and on mobile feels modern.
- Remove the `bg-background/80 backdrop-blur` overlay (it darkens the whole screen unnecessarily) — replace with a soft local gradient behind just the chips.

---

## 7. Budget Templates — Start Counting From Apply Date

**Diagnosis (`BudgetForm.tsx` line 161):** Templates set `start_date: todayInTz()` ✅ — but `BudgetCard.tsx` line 43-52 (`getPeriodRange`) **ignores the budget's `start_date`** and uses `startOfMonth(now)` instead. So spend-vs-budget pulls *all* transactions for the calendar month regardless of when the budget was created. **That's the bug.**

**Fix:**
- In `BudgetCard.tsx` and `BudgetList.tsx`, replace `getPeriodRange(period)` with `getPeriodRange(period, budget.start_date)` — the period range starts from `max(start_of_period, budget.start_date)`.
- For monthly budgets created mid-month: spent = expenses **after `start_date`** within the current period.
- For weekly/daily: same logic.
- Add a **"Counts from {date}"** badge on each budget card so users see exactly when tracking began.
- Apply the same fix in the dashboard's budget mini-widget (line 822) and `useReportData` if it counts spend-vs-budget.

---

## 8. Bills — Pay Multiple Months Forward

**Today (`BillsSubscriptions.tsx` line 175-247):** `markPaid` always advances `next_due_date` by exactly **one frequency cycle** and creates **one** transaction. No bulk-pay support.

**Fix:**
- New **"Pay forward"** UI in the pay popover: a stepper "Pay [1 ▾] months" (1-12). Validates: total = `bill.amount × months`, must not exceed source account balance.
- On submit: creates **N separate transactions** (one per cycle, with `date` = cycle's due date) so reports are accurate per month, then advances `next_due_date` by N cycles.
- Adds a small note on bill card: **"Paid through {month}, next due in {days}"** computed from actual `last_paid_date` + N cycles.
- Adds a **"Bill paid forward"** activity log entry for audit traceability.
- Confirmation dialog shows: "Pay 3 months of Netflix (45,000 TZS) from M-Pesa? Next due Jul 12."

---

## 9. Overview Cards — Equal Heights, Read More for Density

**Today:** The asymmetric bento (line 705) has cards with wildly varying content lengths — Streak vs Quick Overview vs Health Score — causing ragged column ends. Inner cards (Accounts/Budgets/Savings) show 4 items each which overflows on lg viewports.

**Fix:**
- All overview tiles get a **fixed visual budget**: max 3 items shown + a `View all →` link to the corresponding tab (already partial — making it consistent).
- Cards in the same row get `h-full` + `flex flex-col` so they end at the same line, regardless of content.
- For data-rich tiles (Health Score, Predictive CashFlow), introduce a **"Show more"** collapse that reveals additional detail without breaking grid alignment.
- Use `min-h-[X]` on row groupings so a card with 1 item doesn't shrink to a tiny pill while neighbors are tall.
- Tighten the "Quick Overview" mini-stats to match Streak height exactly via grid template rows.

---

## 10. Remove Duplicate "Financial Education" Entry

**Today:** Avatar dropdown (line 472) has `Financial Education` → switches to the `learn` tab. The nav bar already has `Learn` (line 341). Redundant.

**Fix:** Remove the `Financial Education` `DropdownMenuItem` from the user-avatar dropdown. Keep only `Settings` and `Sign Out` there.

---

## 11. Financial Calculators — Tanzania + Global

Add a new module `src/components/calculators/FinancialCalculators.tsx` (lazy-loaded inside the Learn tab as a sub-section). Each calculator pulls real defaults from the user's accounts when relevant.

**Calculators to include (industry-standard + EAC-relevant):**

| Calculator | Use case | Local relevance |
|---|---|---|
| **Loan Repayment** | Monthly installment on a loan | EAC bank rates, Fuliza, NMB, KCB |
| **Compound Interest** | Future value of savings | UTT AMIS Liquid Fund, SACCO dividends |
| **Goal Savings** | "How much per month to reach X by date Y" | Vikoba, chama planning |
| **Emergency Fund** | Recommended buffer (3-6 months expenses) | Auto-pulls from real `monthlyExpenses` |
| **Debt Snowball / Avalanche** | Optimal payoff order across all loans | Already have `debt_strategy` setting — feed in real loans |
| **Net Worth** | Assets − Liabilities | Live from `accounts` |
| **Inflation-Adjusted Return** | Real vs nominal return | TZ inflation ~3-5%, KE ~6-8% |
| **Tax Estimator (PAYE)** | TZ PAYE bands & KE brackets | Local rate tables built-in |
| **Mortgage Affordability** | Max property price by income | Ratio rules per country |
| **Currency Conversion** | Multi-currency ops | Uses live `exchange_rates` table |
| **Retirement (NSSF/NHIF)** | Future pension projection | TZ NSSF / KE NSSF formulas |
| **Investment Diversification** | Recommended split | T-Bills + DSE/NSE + MMF + Crypto |

Each calculator: clean form on the left, live result + chart on the right, "Save to my plan" button that creates a goal/budget/note.

---

## 12. Hover Highlighting on Reports Charts

**Today:** Recharts default tooltip — flat, no theming, charts feel static.

**Fix:**
- Custom `<ChartTooltipContent>` (already in `src/components/ui/chart.tsx`) with glassmorphic background, primary-color border, smooth fade-in.
- On hover: bar/segment gets a **2px primary-color stroke** + soft glow shadow + subtle scale (1.02).
- Crosshair line follows cursor with a soft gradient.
- All chart segments get matching hover variants — pies, bars, lines, areas.
- Apply consistently to: `EnhancedReports`, `NetWorthChart`, `BudgetCard` drilldown, `AccountDetailPanel` 6-month chart, `SpendingHeatmap`.

---

## 🛡️ Deep Integrity Audit — Issues Found & Locked Down

| # | Risk | Where | Fix |
|---|---|---|---|
| A | **Floating-point drift on balances** — direct read-modify-write on `accounts.balance` (line 116, 235-237 of bills, etc.) loses precision and races on concurrent writes | Multiple components write `balance: oldBalance ± amount` | Migrate to **derived balance**: a postgres function `compute_account_balance(account_id)` summing transactions + opening_balance. Read-only display — never write. (Already partly the design philosophy per memory.) |
| B | **Currency mixing in totals** — `totalBalance` and `netPosition` (Dashboard line 250, 1117-1122) sum balances across TZS+KES+USD as if equal | Dashboard hero, PredictiveCashFlow | Group by currency. Show user's **default_currency total** using `exchange_rates` for conversion, with a small "+other currencies" indicator |
| C | **Budget vs spend currency mismatch** — `BudgetCard` doesn't filter txns by budget currency | `BudgetCard.tsx` | Filter `transactions.currency === budget.currency` (or convert) |
| D | **Bill payment uses account currency** but the bill stores its own currency (line 220) — silently overrides | `BillsSubscriptions.tsx` | Reject pay if `bill.currency !== account.currency` (or convert via `exchange_rates`) with a clear UI message |
| E | **Health score gives free 20 pts** for any savings goal (line 309) — even one with 0 progress | Dashboard line 305-311 | Score must reflect *progress*, not existence |
| F | **No transaction soft-delete on bill removal** — deleting a bill leaves orphan tx tagged `bill-payment` with broken reference | `BillsSubscriptions.tsx` line 169 | Keep tx but null any FK; or convert delete to soft-archive (`is_active = false`) |
| G | **Reconciliation race** — `transaction_history` log writes are not transactional with the transaction insert | Multiple | Wrap the insert+history in a Supabase RPC (single transaction) — prevents partial states that auditors flag |
| H | **Transfer round-trip math** — cross-currency transfers store `exchange_rate` once (`transfers` table) but if rate changes later, historical reports recompute wrong totals | `TransferForm.tsx` | Always read the *stored* rate from the `transfers` row, never live-recompute |

---

## Files Touched (Summary)

| File | Change |
|---|---|
| `src/pages/Dashboard.tsx` | Nav (overflow + ⌘K), avatar dropdown cleanup, equal-height grid, asset-only totals |
| `src/components/transactions/FloatingTransactionForm.tsx` | Tight circular FAB, radial action arc, no full-screen overlay |
| `src/components/dashboard/AISmartInsights.tsx` | TZ-aware filters, fixed weekend math, exclude tagged tx, refresh button |
| `src/components/dashboard/SmartSpendingDetection.tsx` | Same TZ + tag-exclusion fixes |
| `src/components/dashboard/PredictiveCashFlow.tsx` | Asset-only balance, real-day averaging, per-currency, settings-threshold |
| `src/components/education/AIFinancialCoach.tsx` | Pass currency/risk/advice settings, persist chat, retry chip, dynamic prompts |
| `src/components/budgets/BudgetCard.tsx`, `BudgetList.tsx` | Honor `start_date` in period calcs, currency filter |
| `src/components/bills/BillsSubscriptions.tsx` | Pay-forward stepper (1-12 months), currency match guard, soft-archive |
| `src/components/accounts/AccountForm.tsx` | Reject negative asset opening balance |
| `src/components/loans/LoanPaymentForm.tsx` | Filter source accounts to assets only |
| `src/components/calculators/FinancialCalculators.tsx` | NEW — 12 calculators |
| `src/components/reports/EnhancedReports.tsx` + `chart.tsx` | Hover highlighting, glow tooltips |
| `src/lib/balance.ts` | NEW — derived balance helper |
| **DB migration** | `accounts` insert/update trigger; reconciliation RPC for tx+history |

## Why This Is Safe

- All math fixes are **additive** and read-side — no data loss.
- DB triggers reject only **future** invalid writes, existing rows untouched.
- Currency-grouping displays a clean **default-currency total** with conversions stored audit-trail-friendly.
- Calculators are **pure UI** — no schema impact.
- Nav, FAB, hover styles are **CSS/component changes** — zero risk to data.
- Pay-forward bills generates **N real transactions** with correct dates — fully auditable, no shortcuts.
