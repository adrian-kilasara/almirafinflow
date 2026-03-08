import { supabase } from '@/integrations/supabase/client';
import { logActivity } from '@/lib/activityLogger';

/**
 * Cross-module event system. Call these after mutations to propagate
 * effects across the system and persist notifications.
 */

export async function emitTransactionEvent(
  userId: string,
  type: 'income' | 'expense' | 'transfer',
  amount: number,
  description: string,
  accountId: string,
  categoryId?: string | null
) {
  // 0. Log activity
  logActivity(userId, `${type} recorded`, 'transactions', { amount, description, accountId, categoryId });

  // 1. Create notification
  await supabase.from('notifications').insert({
    user_id: userId,
    type: type === 'income' ? 'success' : 'info',
    title: `${type === 'income' ? 'Income' : type === 'expense' ? 'Expense' : 'Transfer'} Recorded`,
    message: `${type === 'income' ? '+' : '-'}${amount} — ${description || 'Transaction'}`,
    module: 'transactions',
  });

  // 2. Check budget alerts
  if (type === 'expense' && categoryId) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

    const { data: budgets } = await supabase
      .from('budgets')
      .select('*')
      .eq('category_id', categoryId);

    if (budgets && budgets.length > 0) {
      const { data: txns } = await supabase
        .from('transactions')
        .select('amount')
        .eq('type', 'expense')
        .eq('category_id', categoryId)
        .gte('date', monthStart)
        .lte('date', monthEnd);

      const totalSpent = (txns || []).reduce((s, t) => s + Number(t.amount), 0);

      for (const budget of budgets) {
        const pct = (totalSpent / Number(budget.amount)) * 100;
        if (pct >= 100) {
          await supabase.from('notifications').insert({
            user_id: userId,
            type: 'warning',
            title: 'Budget Exceeded',
            message: `"${budget.name}" is over budget — spent ${pct.toFixed(0)}%`,
            module: 'budgets',
            related_id: budget.id,
          });
        } else if (pct >= 80) {
          await supabase.from('notifications').insert({
            user_id: userId,
            type: 'warning',
            title: 'Budget Warning',
            message: `"${budget.name}" is at ${pct.toFixed(0)}% — approaching limit`,
            module: 'budgets',
            related_id: budget.id,
          });
        }
      }
    }
  }

  // 3. Check low balance alerts
  const { data: account } = await supabase
    .from('accounts')
    .select('name, balance')
    .eq('id', accountId)
    .single();

  const { data: settings } = await supabase
    .from('user_settings')
    .select('notify_low_balance, low_balance_threshold')
    .eq('user_id', userId)
    .single();

  if (account && settings?.notify_low_balance && Number(account.balance) < Number(settings.low_balance_threshold)) {
    await supabase.from('notifications').insert({
      user_id: userId,
      type: 'warning',
      title: 'Low Balance Alert',
      message: `${account.name} balance is low: ${account.balance}`,
      module: 'accounts',
      related_id: accountId,
    });
  }

  // 4. Smart insight: spending velocity check
  if (type === 'expense') {
    await checkSpendingVelocity(userId);
  }

  // 5. Update streak
  await updateStreak(userId);
}

/**
 * Emit event for transaction edits — re-checks budgets after modification
 */
export async function emitTransactionEditEvent(
  userId: string,
  type: 'income' | 'expense' | 'transfer',
  amount: number,
  description: string,
  accountId: string,
  categoryId?: string | null
) {
  logActivity(userId, 'transaction edited', 'transactions', { amount, description, accountId, categoryId });

  // Re-check budgets after edit
  if (type === 'expense' && categoryId) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

    const { data: budgets } = await supabase.from('budgets').select('*').eq('category_id', categoryId);
    if (budgets && budgets.length > 0) {
      const { data: txns } = await supabase.from('transactions').select('amount')
        .eq('type', 'expense').eq('category_id', categoryId)
        .gte('date', monthStart).lte('date', monthEnd);
      const totalSpent = (txns || []).reduce((s, t) => s + Number(t.amount), 0);
      for (const budget of budgets) {
        const pct = (totalSpent / Number(budget.amount)) * 100;
        if (pct >= 100) {
          await supabase.from('notifications').insert({
            user_id: userId, type: 'warning', title: 'Budget Exceeded',
            message: `"${budget.name}" is over budget — spent ${pct.toFixed(0)}%`,
            module: 'budgets', related_id: budget.id,
          });
        }
      }
    }
  }

  // Check low balance
  const { data: account } = await supabase.from('accounts').select('name, balance').eq('id', accountId).single();
  const { data: settings } = await supabase.from('user_settings').select('notify_low_balance, low_balance_threshold').eq('user_id', userId).single();
  if (account && settings?.notify_low_balance && Number(account.balance) < Number(settings.low_balance_threshold)) {
    await supabase.from('notifications').insert({
      user_id: userId, type: 'warning', title: 'Low Balance Alert',
      message: `${account.name} balance is low: ${account.balance}`,
      module: 'accounts', related_id: accountId,
    });
  }
}

/**
 * Emit event for transaction deletion
 */
export async function emitTransactionDeleteEvent(
  userId: string,
  type: 'income' | 'expense' | 'transfer',
  amount: number,
  description: string,
  accountId: string
) {
  logActivity(userId, 'transaction deleted', 'transactions', { type, amount, description, accountId });

  // Check low balance after deletion (income removed could lower balance)
  if (type === 'income') {
    const { data: account } = await supabase.from('accounts').select('name, balance').eq('id', accountId).single();
    const { data: settings } = await supabase.from('user_settings').select('notify_low_balance, low_balance_threshold').eq('user_id', userId).single();
    if (account && settings?.notify_low_balance && Number(account.balance) < Number(settings.low_balance_threshold)) {
      await supabase.from('notifications').insert({
        user_id: userId, type: 'warning', title: 'Low Balance Alert',
        message: `${account.name} balance dropped after deletion: ${account.balance}`,
        module: 'accounts', related_id: accountId,
      });
    }
  }
}

export async function emitSavingsEvent(
  userId: string,
  goalName: string,
  amount: number,
  currentAmount: number,
  targetAmount: number,
  goalId: string
) {
  const pct = (currentAmount / targetAmount) * 100;
  logActivity(userId, 'savings contribution', 'savings', { goalName, amount, currentAmount, targetAmount });

  if (currentAmount >= targetAmount) {
    await supabase.from('notifications').insert({
      user_id: userId,
      type: 'success',
      title: '🎉 Savings Goal Completed!',
      message: `"${goalName}" has been fully funded!`,
      module: 'savings',
      related_id: goalId,
    });
  } else {
    // Check milestones
    const oldPct = ((currentAmount - amount) / targetAmount) * 100;
    const milestones = [25, 50, 75, 90];
    const hit = milestones.find(m => oldPct < m && pct >= m);
    if (hit) {
      await supabase.from('notifications').insert({
        user_id: userId,
        type: 'success',
        title: `🏆 ${hit}% Milestone!`,
        message: `"${goalName}" is ${hit}% funded!`,
        module: 'savings',
        related_id: goalId,
      });
    }
  }

  // Update streak
  await updateStreak(userId);
}

/**
 * Emit event for savings withdrawal
 */
export async function emitSavingsWithdrawEvent(
  userId: string,
  goalName: string,
  amount: number,
  goalId: string
) {
  logActivity(userId, 'savings withdrawal', 'savings', { goalName, amount });
  await supabase.from('notifications').insert({
    user_id: userId,
    type: 'info',
    title: 'Savings Withdrawal',
    message: `Withdrew ${amount} from "${goalName}"`,
    module: 'savings',
    related_id: goalId,
  });
}

export async function emitStreakEvent(userId: string, streak: number) {
  const milestones = [7, 14, 30, 60, 90, 180, 365];
  if (milestones.includes(streak)) {
    logActivity(userId, `${streak}-day streak milestone`, 'system', { streak });
    await supabase.from('notifications').insert({
      user_id: userId,
      type: 'success',
      title: `🔥 ${streak}-Day Streak!`,
      message: `You've been tracking finances for ${streak} days straight!`,
      module: 'system',
    });
  }
}

/**
 * Emit event for budget creation
 */
export async function emitBudgetEvent(
  userId: string,
  budgetName: string,
  amount: number,
  period: string
) {
  logActivity(userId, 'budget created', 'budgets', { budgetName, amount, period });
  await supabase.from('notifications').insert({
    user_id: userId,
    type: 'info',
    title: 'Budget Created',
    message: `"${budgetName}" — ${amount}/${period}`,
    module: 'budgets',
  });
}

/**
 * Emit event for transfer between accounts
 */
export async function emitTransferEvent(
  userId: string,
  fromName: string,
  toName: string,
  amount: number,
  fromAccountId: string,
  toAccountId: string
) {
  logActivity(userId, 'transfer completed', 'accounts', { fromName, toName, amount });
  await supabase.from('notifications').insert({
    user_id: userId,
    type: 'info',
    title: 'Transfer Completed',
    message: `${amount} moved from "${fromName}" to "${toName}"`,
    module: 'accounts',
  });

  // Check low balance on source
  const { data: account } = await supabase.from('accounts').select('name, balance').eq('id', fromAccountId).single();
  const { data: settings } = await supabase.from('user_settings').select('notify_low_balance, low_balance_threshold').eq('user_id', userId).single();
  if (account && settings?.notify_low_balance && Number(account.balance) < Number(settings.low_balance_threshold)) {
    await supabase.from('notifications').insert({
      user_id: userId, type: 'warning', title: 'Low Balance Alert',
      message: `${account.name} balance is low after transfer: ${account.balance}`,
      module: 'accounts', related_id: fromAccountId,
    });
  }

  await updateStreak(userId);
}

/**
 * Update user streak on any financial activity
 */
async function updateStreak(userId: string) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const { data: streak } = await supabase
      .from('user_streaks')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!streak) {
      // Create initial streak
      await supabase.from('user_streaks').insert({
        user_id: userId,
        current_streak: 1,
        longest_streak: 1,
        last_activity_date: today,
        total_transactions: 1,
      });
      return;
    }

    const lastDate = streak.last_activity_date;
    if (lastDate === today) {
      // Already tracked today, just increment total
      await supabase.from('user_streaks').update({
        total_transactions: (streak.total_transactions || 0) + 1,
      }).eq('id', streak.id);
      return;
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    let newStreak = 1;
    if (lastDate === yesterdayStr) {
      newStreak = (streak.current_streak || 0) + 1;
    }

    const longestStreak = Math.max(newStreak, streak.longest_streak || 0);

    await supabase.from('user_streaks').update({
      current_streak: newStreak,
      longest_streak: longestStreak,
      last_activity_date: today,
      total_transactions: (streak.total_transactions || 0) + 1,
    }).eq('id', streak.id);

    // Check streak milestones
    await emitStreakEvent(userId, newStreak);
  } catch (e) {
    console.warn('Streak update failed:', e);
  }
}

/**
 * Get exchange rate between two currencies
 */
export async function getExchangeRate(from: string, to: string): Promise<number> {
  if (from === to) return 1;

  const { data } = await supabase
    .from('exchange_rates')
    .select('rate')
    .eq('from_currency', from)
    .eq('to_currency', to)
    .order('effective_date', { ascending: false })
    .limit(1)
    .single();

  return data?.rate || 1;
}

/**
 * Convert amount between currencies using stored rates
 */
export async function convertCurrency(amount: number, from: string, to: string): Promise<number> {
  const rate = await getExchangeRate(from, to);
  return amount * rate;
}
