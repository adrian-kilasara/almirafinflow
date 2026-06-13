# FinFlow 2026 — Integrity & Fraud Audit Report

Date: 2026-06-13
Scope: every financial-mutation path, cross-module side effects, duplicate features.
Methodology: code read of all `accounts`, `transactions`, `transfers`, `savings`, `bills`, `loans`, `investments`, `reports`, `process-recurring` server function, plus DB triggers. Severities: **C**ritical / **H**igh / **M**edium / **L**ow.

---

## 1. Account balance arithmetic — **CRITICAL**

**Every** balance mutation in the app uses read-modify-write on a client-cached `account.balance`:

```ts
// src/components/accounts/TransferForm.tsx:100
supabase.from('accounts').update({ balance: Number(from.balance) - amt }).eq('id', from.id)
// src/components/transactions/TransactionList.tsx:172, :250, :286
// src/components/transactions/TransactionForm.tsx:146
// src/components/bills/BillsSubscriptions.tsx:269
// src/components/savings/SavingsGoalCard.tsx:166, :197
// supabase/functions/process-recurring/index.ts:92, :140
```

Risks (all real, all silent):
- Two tabs open → second submit overwrites first → **balance drift / lost money**.
- Slow network → user clicks "Transfer" twice → double-debit (no idempotency key).
- Background recurring schedule fires while user manually edits same account → either change is lost.
- `account.balance` is sometimes a string from PostgREST; arithmetic relies on `Number(...)` and a stale snapshot.

**Fix (single change, eliminates all 7 sites):**
1. Stop storing `accounts.balance` as a mutable field. Compute it via a SQL view `account_balances` = opening + Σ(income) − Σ(expense) ± Σ(transfers).
2. OR, if you keep the column, add an RPC `apply_balance_delta(account_id uuid, delta numeric)` that does `UPDATE accounts SET balance = balance + $delta WHERE id = $1 RETURNING balance` inside a single statement. Replace every client write with this RPC. No race possible.

---

## 2. Transfer = 7 non-atomic writes — **CRITICAL**

`TransferForm.onSubmit` performs, sequentially: insert outflow tx → insert inflow tx → update from-balance → update to-balance → insert transfers row → insert 2 audit rows → emit event. Any failure after step 1 leaves the DB inconsistent (orphan transaction, undeducted balance, missing audit row).

**Fix:** wrap the whole transfer in a single `create_transfer` Postgres function (SECURITY DEFINER) that runs in one transaction. The client passes `{from, to, amount, fx_rate, description}` and receives the transfer id. Roll back on any internal error.

---

## 3. Recurring processor — **HIGH**

`supabase/functions/process-recurring/index.ts`:
- **Currency bug (line 140):** for `type='savings'` it subtracts `template.amount` from the source account but never converts to the account's currency when goal currency ≠ account currency. If a TZS goal auto-saves from a KES account, KES balance is reduced by a TZS number → wildly wrong.
- **Missing audit row** for savings auto-runs (manual savings writes one; cron does not).
- **No idempotency:** if the function is invoked twice on the same day (cron retry, manual run), the `next_run_date <= today` check + `total_runs++` after the insert means the second invocation re-posts the same schedule. Add an idempotency guard: `UPDATE recurring_schedules SET next_run_date = ..., total_runs = total_runs + 1 WHERE id = $1 AND last_run_date IS DISTINCT FROM today RETURNING ...` and only insert the transaction if a row was returned.
- **Notification spam:** every successful run inserts a notification with no dedupe key.

---

## 4. Savings — **HIGH**

`SavingsGoalCard.handleAddFunds` (line 144):
- Cross-currency conversion is correct on deposit, but `handleWithdraw` (line 183) does **not** convert when the destination account's currency differs from the goal's → returned amount is wrong.
- The trigger `tg_recalculate_savings_goal_amount` recomputes `current_amount` after each allocation, so the manual `is_completed` check on line 168 uses the **pre-trigger** value of `goal.current_amount`. Concurrent allocations can both see "not completed" and miss the milestone toast (cosmetic, but the `is_completed` flag is also not transactional with the allocation — a second concurrent add could leave the goal at >100% with `is_completed=false`).
- No FX note is written on withdrawals (only on deposits).

---

## 5. Transaction delete — **HIGH**

`TransactionList.handleDelete` (line 271):
- Reverses balance using cached value → see Finding #1.
- Does **not** insert a `transaction_history` row before deleting. The "versioned transaction history" promised in core memory therefore has a hole: deletes leave no trail. Either soft-delete (set `is_deleted=true`) or write a `transaction_history` snapshot with `action='delete'` first.
- No `activity_logs` row written → forensic gap.
- Receipt file in storage is not removed when the transaction is deleted → orphan storage objects accrue forever.

---

## 6. Soft-delete leakage — **HIGH**

Memory says soft-delete (`is_deleted`) is the source of truth, but several queries fetch without filtering:

```
grep -rn "from('transactions').select" src | head
src/components/transactions/TransactionList.tsx — no is_deleted filter
src/pages/Dashboard.tsx — no is_deleted filter in dashboard load
```

A soft-deleted transaction will still appear in totals, net-worth chart, reports, and budget burn. Add `.eq('is_deleted', false)` to **every** read query, or create a `transactions_active` view and switch all reads to it.

---

## 7. Bills payment — **MEDIUM**

`BillsSubscriptions.tsx:269` deducts `totalCostInAccountCurrency` directly from `targetAccount.balance` (cached). Same race as Finding #1. Also: when a bill is paid, the bill is marked paid in the same flow; if the balance update succeeds but the bill `update` fails, the user is silently double-charged on next manual pay.

---

## 8. Hard-delete account leaves orphans — **MEDIUM**

`DataManagementSettings.handleDeleteAccount` does **not** delete: `transfers`, `transaction_history`, `bills_subscriptions`, `investments`, `loans`, `loan_payments`, `recurring_schedules`, `notifications`, `account_audit_log`, `reconciliation_sessions`, `activity_logs`. Those rows persist with a dangling `user_id`. (The new **Clear ALL Data** action added in this turn covers them; mirror the same table list inside `handleDeleteAccount`.)

---

## 9. Investments vs accounts — **MEDIUM**

`InvestmentTracker` stores cost basis and current value. If the user funded the investment from an account, both the account's balance and the investment's value count toward net worth → **double-count**. Decision needed: either treat investments as an account type, or auto-create an offsetting expense transaction at purchase and an offsetting income at sale.

---

## 10. Notifications dedupe — **MEDIUM**

`notifications` table has no unique constraint on `(user_id, type, module, dedupe_key)`. Budget-exceeded notifications can be inserted on every dashboard load if the gating logic ever has a bug. Add a `dedupe_key TEXT` column + partial unique index `(user_id, dedupe_key) WHERE dedupe_key IS NOT NULL`.

---

## 11. FX rate provenance — **MEDIUM**

`useExchangeRates` reads `exchange_rates`. INSERT is now restricted to `service_role` ✓. But:
- No staleness check — a rate inserted months ago is used as-is in conversions for budgets, savings, reports.
- No "as-of" snapshot on stored cross-currency transactions: when a TZS-budget aggregates a 6-month-old KES expense, today's rate is applied retroactively → past months silently re-value. Store `fx_rate_used` on the transaction at write time (the FX tag note is text-only and not numerically queryable).

---

## 12. Reports period sync — **LOW**

`getPeriodRange` is used by both budgets and reports — good. Confirmed identical semantics. No finding here, kept for completeness.

---

## 13. Duplicate features — **LOW**

- **⌘K search**: now sources accounts, transactions, budgets, goals, categories ✓ no duplicate found.
- **Calculators**: `FinancialCalculators.tsx` contains the financial calculators; a separate basic calculator widget mentioned in the previous turn was not located. The user reported "two same function in one place" — this needs an explicit re-check with the user pointing at the screen (or screenshot) because greps show only one calculator container.

---

## Priority fix order (recommended)

1. **#1 + #2**: introduce `apply_balance_delta` RPC and `create_transfer` RPC. Removes 90 % of fraud surface.
2. **#5 + #6**: soft-delete enforcement + transaction_history on delete.
3. **#3**: fix recurring FX bug and add idempotency.
4. **#4**: fix savings withdraw FX.
5. **#8**: align `handleDeleteAccount` table list with the new Clear-ALL action.
6. **#7, #9, #10, #11**: schedule for next sprint.

Approve which items you want patched next and I will implement them with full migrations + code edits.
