import { supabase } from '@/integrations/supabase/client';

/**
 * Centralized activity logger — records every meaningful user action
 * for audit trail, security review, and behavioral insights.
 */
export async function logActivity(
  userId: string,
  action: string,
  module: string,
  details: Record<string, unknown> = {}
) {
  try {
    await supabase.from('activity_logs').insert({
      user_id: userId,
      action,
      module,
      details,
    } as any);
  } catch (e) {
    console.warn('Activity log failed:', e);
  }
}

// Convenience wrappers
export const logTransactionAction = (userId: string, action: string, details: Record<string, unknown> = {}) =>
  logActivity(userId, action, 'transactions', details);

export const logAccountAction = (userId: string, action: string, details: Record<string, unknown> = {}) =>
  logActivity(userId, action, 'accounts', details);

export const logBudgetAction = (userId: string, action: string, details: Record<string, unknown> = {}) =>
  logActivity(userId, action, 'budgets', details);

export const logSavingsAction = (userId: string, action: string, details: Record<string, unknown> = {}) =>
  logActivity(userId, action, 'savings', details);

export const logProfileAction = (userId: string, action: string, details: Record<string, unknown> = {}) =>
  logActivity(userId, action, 'profile', details);

export const logAuthAction = (userId: string, action: string, details: Record<string, unknown> = {}) =>
  logActivity(userId, action, 'auth', details);

export const logSettingsAction = (userId: string, action: string, details: Record<string, unknown> = {}) =>
  logActivity(userId, action, 'settings', details);
