## Goal

Two parallel workstreams:
1. **Security hardening** — session timeout, logout on refresh, "clear all data" option.
2. **Deep audit pass** — cross-check every module for logical integrity, double-counting, orphan records, duplicate features, and fraud-prone gaps.

---

## Part A — Security (concrete code changes)

### A1. Auto-logout after 5 minutes of inactivity
- New hook `src/hooks/useIdleLogout.ts`:
  - Listens to `mousemove`, `keydown`, `click`, `touchstart`, `scroll`, `visibilitychange`.
  - Resets a 5-minute timer on each event.
  - On expiry → `supabase.auth.signOut()` + toast "Signed out due to inactivity" + redirect `/auth`.
  - Cross-tab sync via `BroadcastChannel('finflow-activity')` so activity in one tab keeps all tabs alive, and logout propagates.
- Mount inside `AuthProvider` (only active when `user` is present).

### A2. Logout on every page refresh
- Switch Supabase client (`src/integrations/supabase/client.ts`) from `localStorage` to `sessionStorage` **and** set `persistSession: false`. This guarantees a hard reload (Cmd-R, browser restart, new tab) drops the session.
- Add a `beforeunload` safeguard that calls `supabase.auth.signOut({ scope: 'local' })` to clear any in-memory tokens.
- Note: this is intentionally aggressive — users will re-enter credentials on every refresh. Confirm below.

### A3. "Clear all data" option
- `DataManagementSettings.tsx` already has "Clear All Transactions". Add a new card **"Clear ALL Data (keep account)"** that wipes:
  transactions, transaction_history, transfers, budgets, savings_allocations, savings_goals, accounts, account_audit_log, categories, bills_subscriptions, investments, loans + loan_payments, recurring_schedules, transaction_rules, financial_tips, notifications, user_streaks, user_badges, user_lesson_progress, reconciliation_sessions.
- Two-step confirm dialog (type "DELETE" to enable button).
- Logs to `activity_logs` before wipe.

---

## Part B — Deep audit & cross-check (per module)

For each module I will read the live code and produce a written findings report (no code changes in this plan step — fixes proposed separately once you approve them). The report covers: **logical correctness, double-counting risk, orphan/dangling records, duplicate UI/feature, fraud surface**.

Modules to audit:

1. **Accounts** — balance derivation (opening + transactions + transfers), soft-delete leakage, audit log completeness.
2. **Transactions** — duplicate-prevention fingerprint, FX tagging consistency, edit/delete writing to `transaction_history`, receipt path vs URL.
3. **Transfers** — dual-entry mirroring, cross-currency rate stored both sides, deletion symmetry.
4. **Budgets** — period math via `getPeriodRange`, strict vs flexible mode enforcement, currency conversion in aggregates, notification cleanup on template change.
5. **Savings** — allocation = real transaction, deletion refunds source, currency conversion vs goal currency, trigger `recalculate_savings_goal_amount` correctness.
6. **Bills & Subscriptions** — FX pay-from-any-account, recurring schedule linkage, no duplicate posting from `process-recurring`.
7. **Loans** — payment splits (principal/interest), balance recompute, payoff status.
8. **Investments** — cost basis, current value FX, no double-count with accounts.
9. **Reports** — period sync with budgets, conversion consistency, action box references real numbers.
10. **Dashboard / Net Worth** — assets − liabilities, FX, no inclusion of soft-deleted rows.
11. **Predictive / AI** — inputs source the same converted figures.
12. **Notifications** — no stale rows after budget reset, dedupe key.
13. **Activity log** — every mutation writes one row; no silent paths.
14. **Settings → Data Control** — export covers every table; deletion symmetric with new "clear all".
15. **Tools / Calculators / Education** — confirm the remaining duplicate calculator was removed and scientific + extra financial calculators are in place (carry-over from previous turn).
16. **Search (⌘K)** — confirm no stale primitive search path remains.

Deliverable for Part B: a single findings document with severity (Critical / High / Medium / Low), exact file + line, and a one-line fix recommendation. You then approve which fixes to implement.

---

## Questions before I build

1. **Refresh-logout is harsh** (every Cmd-R kicks the user). Confirm you want this, or would you prefer "logout only on browser/tab close" (achievable with `sessionStorage` keeping the session within the tab but dropping on close)?
2. For "Clear all data", keep **profile + user_settings + categories** as defaults the user can re-use, or wipe those too?
3. Audit deliverable: do you want the full findings report in chat, or written to `.lovable/audit-report.md` in the repo?

---

## Technical notes

- Idle timer uses a single `setTimeout` reset on throttled (250 ms) activity events to avoid perf cost.
- `sessionStorage` switch will invalidate every currently-signed-in session on first deploy — expected.
- The bulk delete in A3 runs sequentially with `Promise.allSettled` so a single table failure doesn't abort the rest; failures are surfaced in toast.
- All new destructive actions write to `activity_logs` with `action='data_wipe'` for forensic trail.
