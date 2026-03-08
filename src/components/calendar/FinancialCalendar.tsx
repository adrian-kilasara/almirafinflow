import { useState, useMemo, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/format';
import {
  ChevronLeft, ChevronRight, Calendar, TrendingUp, TrendingDown,
  ArrowLeftRight, CalendarClock, PiggyBank, Target, Receipt, Repeat, Wallet
} from 'lucide-react';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameDay, addMonths, subMonths, isToday, isSameMonth, parseISO
} from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import type { Transaction, Budget, SavingsGoal } from '@/types/finance';

interface FinancialCalendarProps {
  transactions: Transaction[];
  budgets: Budget[];
  savingsGoals: SavingsGoal[];
}

interface CalendarEvent {
  id: string;
  type: 'income' | 'expense' | 'transfer' | 'bill' | 'savings' | 'budget_reset' | 'recurring' | 'salary';
  title: string;
  amount: number;
  color: string;
}

export default function FinancialCalendar({ transactions, budgets, savingsGoals }: FinancialCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
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

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPadding = monthStart.getDay();

  // Predict salary dates from income patterns
  const predictedSalaryDates = useMemo(() => {
    const incomes = transactions.filter(t => t.type === 'income').sort((a, b) => a.date.localeCompare(b.date));
    if (incomes.length < 2) return [];

    // Find recurring income day-of-month
    const dayOfMonthCounts: Record<number, { count: number; totalAmount: number; desc: string }> = {};
    incomes.forEach(t => {
      const dom = new Date(t.date).getDate();
      if (!dayOfMonthCounts[dom]) dayOfMonthCounts[dom] = { count: 0, totalAmount: 0, desc: '' };
      dayOfMonthCounts[dom].count++;
      dayOfMonthCounts[dom].totalAmount += Number(t.amount);
      dayOfMonthCounts[dom].desc = t.description || 'Salary';
    });

    // If any day-of-month has 2+ incomes, predict it as salary day
    const predictions: { date: string; amount: number; desc: string }[] = [];
    for (const [dom, data] of Object.entries(dayOfMonthCounts)) {
      if (data.count >= 2) {
        const d = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), Number(dom));
        if (d >= monthStart && d <= monthEnd) {
          predictions.push({
            date: format(d, 'yyyy-MM-dd'),
            amount: Math.round(data.totalAmount / data.count),
            desc: data.desc,
          });
        }
      }
    }
    return predictions;
  }, [transactions, currentMonth, monthStart, monthEnd]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    const addEvent = (dateKey: string, event: CalendarEvent) => {
      if (!map.has(dateKey)) map.set(dateKey, []);
      map.get(dateKey)!.push(event);
    };

    // Transactions
    transactions.forEach(t => {
      const dateKey = t.date.split('T')[0];
      addEvent(dateKey, {
        id: t.id, type: t.type as CalendarEvent['type'],
        title: t.description || t.type, amount: Number(t.amount),
        color: t.type === 'income' ? 'bg-income' : t.type === 'expense' ? 'bg-expense' : 'bg-primary',
      });
    });

    // Bills
    bills.forEach(b => {
      if (b.next_due_date) {
        addEvent(b.next_due_date, { id: `bill-${b.id}`, type: 'bill', title: `📋 ${b.name} due`, amount: Number(b.amount), color: 'bg-[hsl(var(--warning))]' });
      }
    });

    // Recurring schedules
    recurringSchedules.forEach(s => {
      if (s.next_run_date) {
        const d = parseISO(s.next_run_date);
        if (isSameMonth(d, currentMonth)) {
          const template = s.template_data as any;
          const type = template?.type || 'expense';
          addEvent(s.next_run_date, {
            id: `recurring-${s.id}`, type: 'recurring',
            title: `🔄 ${s.description || 'Recurring ' + type}`,
            amount: Number(template?.amount || 0),
            color: type === 'income' ? 'bg-income/60' : 'bg-expense/60',
          });
        }
      }
    });

    // Predicted salary
    predictedSalaryDates.forEach(p => {
      // Only show prediction if no actual income exists on that date
      const existing = map.get(p.date);
      const hasIncome = existing?.some(e => e.type === 'income');
      if (!hasIncome) {
        addEvent(p.date, { id: `salary-${p.date}`, type: 'salary', title: `💰 ${p.desc} (predicted)`, amount: p.amount, color: 'bg-income/40' });
      }
    });

    // Budget resets
    budgets.forEach(b => {
      if (b.period === 'monthly') {
        const firstOfMonth = format(monthStart, 'yyyy-MM-dd');
        addEvent(firstOfMonth, { id: `budget-${b.id}`, type: 'budget_reset', title: `🔄 ${b.name} resets`, amount: Number(b.amount), color: 'bg-primary/60' });
      }
    });

    // Savings goal target dates
    savingsGoals.forEach(g => {
      if (g.target_date) {
        const targetMonth = g.target_date.substring(0, 7);
        const currentViewMonth = format(currentMonth, 'yyyy-MM');
        if (targetMonth === currentViewMonth) {
          addEvent(g.target_date, { id: `goal-${g.id}`, type: 'savings', title: `🎯 ${g.name} target`, amount: Number(g.target_amount), color: 'bg-income/60' });
        }
      }
    });

    return map;
  }, [transactions, bills, recurringSchedules, predictedSalaryDates, budgets, savingsGoals, currentMonth, monthStart]);

  const monthSummary = useMemo(() => {
    let income = 0, expense = 0, billsDue = 0, recurringTotal = 0;
    transactions.forEach(t => {
      const d = parseISO(t.date);
      if (isSameMonth(d, currentMonth)) {
        if (t.type === 'income') income += Number(t.amount);
        else if (t.type === 'expense') expense += Number(t.amount);
      }
    });
    bills.forEach(b => {
      if (b.next_due_date) {
        const d = parseISO(b.next_due_date);
        if (isSameMonth(d, currentMonth)) billsDue += Number(b.amount);
      }
    });
    recurringSchedules.forEach(s => {
      if (s.next_run_date && isSameMonth(parseISO(s.next_run_date), currentMonth)) {
        const template = s.template_data as any;
        recurringTotal += Number(template?.amount || 0);
      }
    });
    return { income, expense, net: income - expense, billsDue, recurringTotal };
  }, [transactions, bills, recurringSchedules, currentMonth]);

  const selectedEvents = selectedDate ? eventsByDate.get(format(selectedDate, 'yyyy-MM-dd')) || [] : [];
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const getEventIcon = (type: CalendarEvent['type']) => {
    switch (type) {
      case 'income': return <TrendingUp className="w-3 h-3 text-income" />;
      case 'expense': return <TrendingDown className="w-3 h-3 text-expense" />;
      case 'transfer': return <ArrowLeftRight className="w-3 h-3 text-primary" />;
      case 'bill': return <CalendarClock className="w-3 h-3 text-[hsl(var(--warning))]" />;
      case 'savings': return <PiggyBank className="w-3 h-3 text-income" />;
      case 'budget_reset': return <Target className="w-3 h-3 text-primary" />;
      case 'recurring': return <Repeat className="w-3 h-3 text-primary" />;
      case 'salary': return <Wallet className="w-3 h-3 text-income" />;
      default: return <Receipt className="w-3 h-3" />;
    }
  };

  return (
    <Card className="border-primary/10">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm">
            <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
              <Calendar className="w-3 h-3 text-primary" />
            </div>
            Financial Timeline
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}><ChevronLeft className="w-4 h-4" /></Button>
            <span className="text-xs font-semibold min-w-[120px] text-center">{format(currentMonth, 'MMMM yyyy')}</span>
            <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}><ChevronRight className="w-4 h-4" /></Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Month Summary */}
        <div className="grid grid-cols-5 gap-1.5">
          {[
            { label: 'Income', value: formatCurrency(monthSummary.income), color: 'text-income' },
            { label: 'Expenses', value: formatCurrency(monthSummary.expense), color: 'text-expense' },
            { label: 'Net', value: formatCurrency(monthSummary.net), color: monthSummary.net >= 0 ? 'text-income' : 'text-expense' },
            { label: 'Bills', value: formatCurrency(monthSummary.billsDue), color: 'text-[hsl(var(--warning))]' },
            { label: 'Recurring', value: formatCurrency(monthSummary.recurringTotal), color: 'text-primary' },
          ].map(s => (
            <div key={s.label} className="text-center p-1.5 rounded-lg bg-muted/30">
              <p className="text-[8px] text-muted-foreground uppercase tracking-wider">{s.label}</p>
              <p className={`text-[10px] font-bold font-mono ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1">
          {weekDays.map(d => (
            <div key={d} className="text-center text-[10px] font-medium text-muted-foreground py-1.5">{d}</div>
          ))}
          {Array.from({ length: startPadding }).map((_, i) => <div key={`pad-${i}`} className="aspect-square" />)}
          {days.map(day => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const events = eventsByDate.get(dateKey) || [];
            const isSelected = selectedDate && isSameDay(day, selectedDate);
            const today = isToday(day);

            const hasIncome = events.some(e => e.type === 'income' || e.type === 'salary');
            const hasExpense = events.some(e => e.type === 'expense');
            const hasBill = events.some(e => e.type === 'bill');
            const hasRecurring = events.some(e => e.type === 'recurring');
            const hasGoal = events.some(e => e.type === 'savings' || e.type === 'budget_reset');

            return (
              <button
                key={day.toISOString()}
                onClick={() => setSelectedDate(day)}
                className={`aspect-square p-0.5 rounded-lg flex flex-col items-center justify-center transition-all text-xs relative ${
                  isSelected ? 'bg-primary text-primary-foreground shadow-md' :
                  today ? 'bg-primary/15 border border-primary/30' :
                  events.length > 0 ? 'bg-muted/40 hover:bg-muted/70' : 'hover:bg-muted/30'
                }`}
              >
                <span className="font-medium">{format(day, 'd')}</span>
                {events.length > 0 && !isSelected && (
                  <div className="flex gap-px mt-0.5">
                    {hasIncome && <div className="w-1 h-1 rounded-full bg-income" />}
                    {hasExpense && <div className="w-1 h-1 rounded-full bg-expense" />}
                    {hasBill && <div className="w-1 h-1 rounded-full bg-[hsl(var(--warning))]" />}
                    {hasRecurring && <div className="w-1 h-1 rounded-full bg-primary/60" />}
                    {hasGoal && <div className="w-1 h-1 rounded-full bg-primary" />}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 text-[9px] text-muted-foreground">
          <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-income" /> Income/Salary</span>
          <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-expense" /> Expense</span>
          <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--warning))]" /> Bill</span>
          <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-primary/60" /> Recurring</span>
          <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-primary" /> Goal</span>
        </div>

        {/* Selected Day Details */}
        <AnimatePresence mode="wait">
          {selectedDate && (
            <motion.div
              key={format(selectedDate, 'yyyy-MM-dd')}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="p-3 rounded-xl bg-muted/30 border border-border/30 space-y-2"
            >
              <p className="text-xs font-semibold">{format(selectedDate, 'EEEE, MMMM d, yyyy')}</p>
              {selectedEvents.length > 0 ? (
                <div className="space-y-1.5">
                  {selectedEvents.map((e, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-background/50">
                      <div className="flex items-center gap-2">
                        {getEventIcon(e.type)}
                        <span className="text-xs">{e.title}</span>
                      </div>
                      <span className={`text-xs font-mono font-semibold ${
                        e.type === 'income' || e.type === 'savings' || e.type === 'salary' ? 'text-income' : e.type === 'expense' || e.type === 'bill' ? 'text-expense' : 'text-foreground'
                      }`}>
                        {e.type === 'income' || e.type === 'salary' ? '+' : e.type === 'expense' || e.type === 'bill' ? '-' : ''}{formatCurrency(e.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground">No events on this day</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
