import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/format';
import {
  PiggyBank, Target, TrendingUp, Trophy, Clock, Download, Zap, ArrowUpRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { SavingsGoal, Transaction, Account } from '@/types/finance';
import SavingsGoalForm from './SavingsGoalForm';
import SavingsGoalCard from './SavingsGoalCard';

interface SavingsDashboardProps {
  savingsGoals: SavingsGoal[];
  transactions: Transaction[];
  accounts: Account[];
  onRefresh: () => void;
}

const spring = { type: 'spring' as const, stiffness: 400, damping: 30 };
const stagger = { staggerChildren: 0.06, delayChildren: 0.1 };

export default function SavingsDashboard({ savingsGoals, transactions, accounts, onRefresh }: SavingsDashboardProps) {
  const stats = useMemo(() => {
    const totalTarget = savingsGoals.reduce((s, g) => s + Number(g.target_amount), 0);
    const totalSaved = savingsGoals.reduce((s, g) => s + Number(g.current_amount), 0);
    const completed = savingsGoals.filter(g => g.is_completed).length;
    const active = savingsGoals.filter(g => !g.is_completed);
    const overallPct = totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0;

    const upcoming = active
      .filter(g => g.target_date)
      .sort((a, b) => new Date(a.target_date!).getTime() - new Date(b.target_date!).getTime())
      .slice(0, 3);

    const now = new Date();
    const monthlySaved: { month: string; amount: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStart = d.toISOString().split('T')[0];
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
      const income = transactions.filter(t => t.type === 'income' && t.date >= monthStart && t.date <= monthEnd).reduce((s, t) => s + Number(t.amount), 0);
      const expenses = transactions.filter(t => t.type === 'expense' && t.date >= monthStart && t.date <= monthEnd).reduce((s, t) => s + Number(t.amount), 0);
      monthlySaved.push({ month: d.toLocaleDateString('en', { month: 'short' }), amount: Math.max(income - expenses, 0) });
    }

    return { totalTarget, totalSaved, completed, active, overallPct, upcoming, monthlySaved, total: savingsGoals.length };
  }, [savingsGoals, transactions]);

  const exportCSV = () => {
    const header = 'Goal,Target,Saved,Progress,Status,Target Date\n';
    const rows = savingsGoals.map(g => {
      const pct = Number(g.target_amount) > 0 ? ((Number(g.current_amount) / Number(g.target_amount)) * 100).toFixed(1) : '0';
      return `"${g.name}",${g.target_amount},${g.current_amount},${pct}%,${g.is_completed ? 'Completed' : 'Active'},${g.target_date || 'N/A'}`;
    }).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'savings_goals.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  // SVG ring for hero
  const ringRadius = 52;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference - (ringCircumference * Math.min(stats.overallPct, 100)) / 100;

  return (
    <motion.div initial="hidden" animate="visible" variants={{ visible: { transition: stagger } }} className="space-y-6">
      {/* Header */}
      <motion.div variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }} className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <PiggyBank className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold">Savings Goals</h2>
            <p className="text-[10px] text-muted-foreground">{stats.total} goals · {stats.completed} completed</p>
          </div>
        </div>
        <div className="flex gap-2">
          {savingsGoals.length > 0 && (
            <Button variant="outline" size="sm" onClick={exportCSV}>
              <Download className="w-4 h-4 mr-1" /> Export
            </Button>
          )}
          <SavingsGoalForm onSuccess={onRefresh} transactions={transactions} />
        </div>
      </motion.div>

      {/* Hero Card with Ring Gauge */}
      {savingsGoals.length > 0 && (
        <motion.div variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}>
          <Card className="overflow-hidden relative">
            {/* Ambient glow */}
            <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-primary/8 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full bg-income/6 blur-3xl pointer-events-none" />

            <CardContent className="p-6 relative z-10">
              <div className="flex flex-col md:flex-row items-center gap-6">
                {/* SVG Circular Gauge */}
                <div className="relative w-32 h-32 shrink-0">
                  <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                    <circle cx="60" cy="60" r={ringRadius} fill="none" stroke="hsl(var(--muted))" strokeWidth="6" />
                    <motion.circle
                      cx="60" cy="60" r={ringRadius}
                      fill="none"
                      stroke="hsl(var(--primary))"
                      strokeWidth="6"
                      strokeLinecap="round"
                      strokeDasharray={ringCircumference}
                      initial={{ strokeDashoffset: ringCircumference }}
                      animate={{ strokeDashoffset: ringOffset }}
                      transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <motion.span
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.5, ...spring }}
                      className="text-2xl font-black font-mono text-primary"
                    >
                      {stats.overallPct.toFixed(0)}%
                    </motion.span>
                    <span className="text-[9px] text-muted-foreground font-medium uppercase tracking-wider">saved</span>
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3 w-full">
                  {[
                    { label: 'Total Target', value: formatCurrency(stats.totalTarget), icon: Target, color: 'text-primary' },
                    { label: 'Total Saved', value: formatCurrency(stats.totalSaved), icon: PiggyBank, color: 'text-income' },
                    { label: 'Completed', value: `${stats.completed}/${stats.total}`, icon: Trophy, color: 'text-[hsl(var(--warning))]' },
                    { label: 'Active', value: `${stats.active.length}`, icon: Zap, color: 'text-primary' },
                  ].map((stat, i) => (
                    <motion.div
                      key={stat.label}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 + i * 0.08 }}
                      className="p-3 rounded-xl bg-muted/30 border border-border/50 text-center"
                    >
                      <stat.icon className={`w-4 h-4 mx-auto mb-1.5 ${stat.color}`} />
                      <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium">{stat.label}</p>
                      <p className={`text-sm font-bold font-mono mt-0.5 ${stat.color}`}>{stat.value}</p>
                    </motion.div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Monthly Savings Trend */}
      {savingsGoals.length > 0 && stats.monthlySaved.some(m => m.amount > 0) && (
        <motion.div variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
                  <TrendingUp className="w-3 h-3 text-primary" />
                </div>
                Monthly Savings Capacity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-2 h-28">
                {stats.monthlySaved.map((m, i) => {
                  const max = Math.max(...stats.monthlySaved.map(x => x.amount), 1);
                  const h = (m.amount / max) * 100;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1.5 group">
                      <motion.div
                        className="w-full relative overflow-hidden rounded-t-md bg-primary/10"
                        initial={{ scaleY: 0 }}
                        animate={{ scaleY: 1 }}
                        transition={{ delay: 0.3 + i * 0.08, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                        style={{ height: `${Math.max(h, 6)}%`, transformOrigin: 'bottom' }}
                      >
                        <div className="absolute inset-0 bg-gradient-to-t from-primary to-primary/70 rounded-t-md" />
                        {/* Hover tooltip */}
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-card border border-border rounded-md px-2 py-0.5 text-[9px] font-mono opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-lg z-10">
                          {formatCurrency(m.amount)}
                        </div>
                      </motion.div>
                      <span className="text-[10px] text-muted-foreground font-medium">{m.month}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Upcoming Deadlines */}
      {stats.upcoming.length > 0 && (
        <motion.div variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-[hsl(var(--warning))]/10 flex items-center justify-center">
                  <Clock className="w-3 h-3 text-[hsl(var(--warning))]" />
                </div>
                Upcoming Deadlines
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {stats.upcoming.map((g, i) => {
                const days = Math.ceil((new Date(g.target_date!).getTime() - Date.now()) / 86400000);
                const pct = Number(g.target_amount) > 0 ? (Number(g.current_amount) / Number(g.target_amount)) * 100 : 0;
                const urgencyColor = days < 0 ? 'text-destructive' : days < 14 ? 'text-[hsl(var(--warning))]' : 'text-muted-foreground';

                // Mini ring
                const miniR = 14;
                const miniC = 2 * Math.PI * miniR;
                const miniO = miniC - (miniC * Math.min(pct, 100)) / 100;

                return (
                  <motion.div
                    key={g.id}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 + i * 0.08 }}
                    className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-border/40 hover:bg-muted/40 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      {/* Mini ring gauge */}
                      <div className="relative w-9 h-9 shrink-0">
                        <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                          <circle cx="18" cy="18" r={miniR} fill="none" stroke="hsl(var(--muted))" strokeWidth="3" />
                          <motion.circle
                            cx="18" cy="18" r={miniR}
                            fill="none"
                            stroke="hsl(var(--primary))"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeDasharray={miniC}
                            initial={{ strokeDashoffset: miniC }}
                            animate={{ strokeDashoffset: miniO }}
                            transition={{ duration: 0.8, delay: 0.3 + i * 0.1 }}
                          />
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold font-mono">{pct.toFixed(0)}%</span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold flex items-center gap-1.5">
                          <span>{g.icon || '🎯'}</span>
                          {g.name}
                        </p>
                        <p className={`text-[10px] font-medium ${urgencyColor}`}>
                          {days > 0 ? `${days} days left` : days === 0 ? 'Due today' : `${Math.abs(days)} days overdue`}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-mono font-semibold">{formatCurrency(Number(g.current_amount))}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">/ {formatCurrency(Number(g.target_amount))}</p>
                    </div>
                  </motion.div>
                );
              })}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Goal Cards */}
      {savingsGoals.length > 0 ? (
        <div className="space-y-5">
          {/* Active Goals */}
          {stats.active.length > 0 && (
            <motion.div variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: stagger } }} className="space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
                  <ArrowUpRight className="w-3 h-3 text-primary" />
                </div>
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Active Goals ({stats.active.length})</h3>
                <div className="flex-1 h-px bg-gradient-to-r from-border/30 to-transparent" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {stats.active.map((goal, i) => (
                  <SavingsGoalCard key={goal.id} goal={goal} onRefresh={onRefresh} index={i} />
                ))}
              </div>
            </motion.div>
          )}

          {/* Completed Goals */}
          {stats.completed > 0 && (
            <motion.div variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: stagger } }} className="space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-lg bg-income/10 flex items-center justify-center">
                  <Trophy className="w-3 h-3 text-income" />
                </div>
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Completed ({stats.completed})</h3>
                <div className="flex-1 h-px bg-gradient-to-r from-border/30 to-transparent" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {savingsGoals.filter(g => g.is_completed).map((goal, i) => (
                  <SavingsGoalCard key={goal.id} goal={goal} onRefresh={onRefresh} index={i} />
                ))}
              </div>
            </motion.div>
          )}
        </div>
      ) : (
        <motion.div variants={{ hidden: { opacity: 0, scale: 0.95 }, visible: { opacity: 1, scale: 1 } }}>
          <Card className="border-dashed border-2">
            <CardContent className="py-16 text-center">
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
                className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-muted/30 flex items-center justify-center"
              >
                <PiggyBank className="w-8 h-8 text-muted-foreground/30" />
              </motion.div>
              <p className="font-bold text-lg">No savings goals yet</p>
              <p className="text-sm text-muted-foreground mt-1 mb-4">Start saving for your dreams</p>
              <SavingsGoalForm onSuccess={onRefresh} transactions={transactions} />
            </CardContent>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
}
