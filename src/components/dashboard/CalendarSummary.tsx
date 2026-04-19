import { useMemo, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/format';
import { Calendar, CalendarClock, TrendingUp, TrendingDown, ChevronRight, Repeat, Wallet } from 'lucide-react';
import { format, isToday, isTomorrow, parseISO, addDays, isSameMonth } from 'date-fns';
import { motion } from 'framer-motion';
import type { Transaction, Budget, SavingsGoal } from '@/types/finance';
import { todayInTz } from '@/lib/datetime';

interface CalendarSummaryProps {
  transactions: Transaction[];
  budgets: Budget[];
  savingsGoals: SavingsGoal[];
  onNavigate?: () => void;
}

export default function CalendarSummary({ transactions, budgets, savingsGoals, onNavigate }: CalendarSummaryProps) {
  const [bills, setBills] = useState<any[]>([]);
  const [recurringSchedules, setRecurringSchedules] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([
      supabase.from('bills_subscriptions').select('*').eq('is_active', true),
      supabase.from('recurring_schedules').select('*').eq('is_active', true),
    ]).then(([billsRes, schedRes]) => {
      if (billsRes.data) setBills(billsRes.data);
      if (schedRes.data) setRecurringSchedules(schedRes.data);
    });
  }, []);

  const today = new Date();
  const next7 = addDays(today, 7);

  const upcoming = useMemo(() => {
    const events: { date: string; label: string; amount: number; type: 'income' | 'expense' | 'bill' | 'goal' | 'recurring' | 'salary'; icon: string }[] = [];

    // Bills
    bills.forEach(b => {
      if (b.next_due_date) {
        const d = parseISO(b.next_due_date);
        if (d >= today && d <= next7) {
          const prefix = isToday(d) ? 'Today' : isTomorrow(d) ? 'Tomorrow' : format(d, 'EEE');
          events.push({ date: b.next_due_date, label: `${prefix} · ${b.name}`, amount: Number(b.amount), type: 'bill', icon: '📋' });
        }
      }
    });

    // Recurring schedules
    recurringSchedules.forEach(s => {
      if (s.next_run_date) {
        const d = parseISO(s.next_run_date);
        if (d >= today && d <= next7) {
          const template = s.template_data as any;
          const prefix = isToday(d) ? 'Today' : isTomorrow(d) ? 'Tomorrow' : format(d, 'EEE');
          events.push({
            date: s.next_run_date,
            label: `${prefix} · ${s.description || 'Recurring'}`,
            amount: Number(template?.amount || 0),
            type: 'recurring',
            icon: '🔄',
          });
        }
      }
    });

    // Savings goal target dates
    savingsGoals.forEach(g => {
      if (g.target_date && !g.is_completed) {
        const d = parseISO(g.target_date);
        if (isSameMonth(d, today) && d >= today) {
          events.push({ date: g.target_date, label: `🎯 ${g.name} target`, amount: Number(g.target_amount), type: 'goal', icon: '🎯' });
        }
      }
    });

    // Predicted salary (income pattern detection)
    const incomes = transactions.filter(t => t.type === 'income');
    const dayOfMonthCounts: Record<number, number> = {};
    incomes.forEach(t => {
      const dom = new Date(t.date).getDate();
      dayOfMonthCounts[dom] = (dayOfMonthCounts[dom] || 0) + 1;
    });
    for (const [dom, count] of Object.entries(dayOfMonthCounts)) {
      if (count >= 2) {
        const d = new Date(today.getFullYear(), today.getMonth(), Number(dom));
        if (d >= today && d <= next7) {
          const avgAmount = incomes
            .filter(t => new Date(t.date).getDate() === Number(dom))
            .reduce((s, t) => s + Number(t.amount), 0) / count;
          const prefix = isToday(d) ? 'Today' : isTomorrow(d) ? 'Tomorrow' : format(d, 'EEE');
          events.push({ date: format(d, 'yyyy-MM-dd'), label: `${prefix} · Salary (predicted)`, amount: Math.round(avgAmount), type: 'salary', icon: '💰' });
        }
      }
    }

    return events.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5);
  }, [bills, recurringSchedules, savingsGoals, transactions, today, next7]);

  const todayStr = todayInTz();
  const todayTxns = useMemo(() => transactions.filter(t => t.date === todayStr), [transactions, todayStr]);
  const todayIncome = todayTxns.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
  const todayExpense = todayTxns.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);

  const stagger = {
    container: { hidden: {}, show: { transition: { staggerChildren: 0.06 } } },
    item: { hidden: { opacity: 0, x: -8 }, show: { opacity: 1, x: 0, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] } } },
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'bill': return <CalendarClock className="w-3 h-3 text-[hsl(var(--warning))] shrink-0" />;
      case 'recurring': return <Repeat className="w-3 h-3 text-primary shrink-0" />;
      case 'salary': return <Wallet className="w-3 h-3 text-income shrink-0" />;
      default: return <CalendarClock className="w-3 h-3 text-primary shrink-0" />;
    }
  };

  return (
    <Card className="h-full border-primary/10">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
              <Calendar className="w-3 h-3 text-primary" />
            </div>
            <div>
              <p className="text-xs font-semibold">Timeline</p>
              <p className="text-[9px] text-muted-foreground">{format(today, 'EEEE, MMM d')}</p>
            </div>
          </div>
          {onNavigate && (
            <Button variant="ghost" size="sm" className="text-[10px] text-primary h-6 px-2 gap-0.5" onClick={onNavigate}>
              View <ChevronRight className="w-3 h-3" />
            </Button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="p-2 rounded-lg bg-income/5 border border-income/10">
            <div className="flex items-center gap-1 mb-0.5">
              <TrendingUp className="w-2.5 h-2.5 text-income" />
              <span className="text-[9px] text-muted-foreground">Today In</span>
            </div>
            <p className="text-xs font-bold font-mono text-income">{formatCurrency(todayIncome)}</p>
          </div>
          <div className="p-2 rounded-lg bg-expense/5 border border-expense/10">
            <div className="flex items-center gap-1 mb-0.5">
              <TrendingDown className="w-2.5 h-2.5 text-expense" />
              <span className="text-[9px] text-muted-foreground">Today Out</span>
            </div>
            <p className="text-xs font-bold font-mono text-expense">{formatCurrency(todayExpense)}</p>
          </div>
        </div>

        {upcoming.length > 0 ? (
          <motion.div variants={stagger.container} initial="hidden" animate="show" className="space-y-1.5">
            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Upcoming 7 Days</p>
            {upcoming.map((e, i) => (
              <motion.div key={i} variants={stagger.item} className="flex items-center justify-between p-2 rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-2 min-w-0">
                  {getEventIcon(e.type)}
                  <span className="text-[11px] truncate">{e.label}</span>
                </div>
                <span className={`text-[10px] font-mono font-semibold shrink-0 ${
                  e.type === 'salary' ? 'text-income' : e.type === 'bill' ? 'text-expense' : 'text-primary'
                }`}>
                  {e.type === 'bill' ? '-' : e.type === 'salary' ? '+' : ''}{formatCurrency(e.amount)}
                </span>
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <div className="text-center py-3">
            <Calendar className="w-6 h-6 mx-auto mb-1 text-muted-foreground/20" />
            <p className="text-[10px] text-muted-foreground">No upcoming events this week</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
