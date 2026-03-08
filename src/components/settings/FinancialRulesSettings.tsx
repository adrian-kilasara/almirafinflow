import { useSettings } from '@/hooks/useSettings';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Calculator, PiggyBank, TrendingDown, HeartPulse, AlertTriangle } from 'lucide-react';

const stagger = {
  container: { hidden: {}, show: { transition: { staggerChildren: 0.06 } } },
  item: {
    hidden: { opacity: 0, y: 14 },
    show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] } },
  },
};

export default function FinancialRulesSettings() {
  const { settings, updateSettings } = useSettings();

  const handleUpdate = async (key: string, value: any) => {
    try {
      await updateSettings({ [key]: value });
      toast.success('Financial rule updated');
    } catch {
      toast.error('Failed to update');
    }
  };

  const totalWeight = settings.health_weight_savings + settings.health_weight_debt +
    settings.health_weight_investments + settings.health_weight_cashflow;

  const weights = [
    { key: 'health_weight_savings', label: 'Savings', color: 'bg-income' },
    { key: 'health_weight_debt', label: 'Debt', color: 'bg-expense' },
    { key: 'health_weight_investments', label: 'Investments', color: 'bg-primary' },
    { key: 'health_weight_cashflow', label: 'Cash Flow', color: 'bg-[hsl(var(--warning))]' },
  ];

  return (
    <motion.div variants={stagger.container} initial="hidden" animate="show" className="space-y-5">
      {/* Budget Behavior */}
      <motion.div variants={stagger.item}>
        <Card className="overflow-hidden relative group/card">
          <div className="absolute -top-16 -right-16 w-40 h-40 rounded-full bg-primary/5 blur-3xl opacity-0 group-hover/card:opacity-100 transition-opacity duration-500 pointer-events-none" />
          <CardContent className="pt-5 pb-5 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                <Calculator className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xs font-bold">Budget Behavior</p>
                <p className="text-[9px] text-muted-foreground">Controls how budgets operate across the system</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Budget Mode</Label>
              <Select value={settings.budget_mode} onValueChange={(v) => handleUpdate('budget_mode', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="strict">Strict — Warn on over-budget spending</SelectItem>
                  <SelectItem value="flexible">Flexible — Track without restrictions</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/30">
              <div>
                <p className="text-xs font-bold">Auto-Rollover Unused Budget</p>
                <p className="text-[9px] text-muted-foreground">Carry forward unspent budget to next period</p>
              </div>
              <Switch checked={settings.budget_rollover} onCheckedChange={(v) => handleUpdate('budget_rollover', v)} />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Savings Automation */}
      <motion.div variants={stagger.item}>
        <Card className="overflow-hidden relative group/card">
          <CardContent className="pt-5 pb-5 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-income/10 flex items-center justify-center">
                <PiggyBank className="w-4 h-4 text-income" />
              </div>
              <div>
                <p className="text-xs font-bold">Savings Automation</p>
                <p className="text-[9px] text-muted-foreground">Automate your savings strategy</p>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/30">
              <div>
                <p className="text-xs font-bold">Round-Up Savings</p>
                <p className="text-[9px] text-muted-foreground">Round up transactions and save the difference</p>
              </div>
              <Switch checked={settings.savings_round_up} onCheckedChange={(v) => handleUpdate('savings_round_up', v)} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Auto-Save % of Income</Label>
              <Input
                type="number"
                min={0}
                max={100}
                placeholder="e.g. 10"
                value={settings.savings_auto_percentage ?? ''}
                onChange={(e) => {
                  const val = e.target.value ? Number(e.target.value) : null;
                  handleUpdate('savings_auto_percentage', val);
                }}
                className="font-mono"
              />
              <p className="text-[9px] text-muted-foreground">Leave empty to disable</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Debt Strategy */}
      <motion.div variants={stagger.item}>
        <Card className="overflow-hidden relative group/card">
          <CardContent className="pt-5 pb-5 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-expense/10 flex items-center justify-center">
                <TrendingDown className="w-4 h-4 text-expense" />
              </div>
              <div>
                <p className="text-xs font-bold">Debt Strategy</p>
                <p className="text-[9px] text-muted-foreground">Choose your debt repayment approach</p>
              </div>
            </div>
            <Select value={settings.debt_strategy} onValueChange={(v) => handleUpdate('debt_strategy', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="avalanche">Avalanche — Highest interest first</SelectItem>
                <SelectItem value="snowball">Snowball — Smallest balance first</SelectItem>
                <SelectItem value="custom">Custom — Manual prioritization</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </motion.div>

      {/* Health Score Weights */}
      <motion.div variants={stagger.item}>
        <Card className="overflow-hidden relative group/card">
          <div className="absolute -bottom-12 -right-12 w-36 h-36 rounded-full bg-primary/5 blur-3xl opacity-0 group-hover/card:opacity-100 transition-opacity duration-500 pointer-events-none" />
          <CardContent className="pt-5 pb-5 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                  <HeartPulse className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs font-bold">Health Score Weights</p>
                  <p className="text-[9px] text-muted-foreground">Must sum to 100</p>
                </div>
              </div>
              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg ${
                totalWeight === 100 ? 'bg-income/10 text-income' : 'bg-expense/10 text-expense'
              }`}>
                {totalWeight}/100
              </span>
            </div>

            {/* Visual bar */}
            <div className="flex gap-0.5 h-3 rounded-full overflow-hidden bg-muted">
              {weights.map((w) => {
                const val = (settings as any)[w.key];
                return val > 0 ? (
                  <motion.div
                    key={w.key}
                    className={`${w.color} first:rounded-l-full last:rounded-r-full`}
                    initial={{ width: 0 }}
                    animate={{ width: `${val}%` }}
                    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
                  />
                ) : null;
              })}
            </div>

            {weights.map(({ key, label, color }) => (
              <div key={key} className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label className="text-xs font-medium flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
                    {label}
                  </Label>
                  <span className="text-xs font-mono font-bold text-muted-foreground">{(settings as any)[key]}%</span>
                </div>
                <Slider
                  value={[(settings as any)[key]]}
                  onValueChange={([v]) => handleUpdate(key, v)}
                  min={0}
                  max={100}
                  step={5}
                />
              </div>
            ))}

            {totalWeight !== 100 && (
              <div className="flex items-center gap-2 text-xs text-expense p-2.5 rounded-xl bg-expense/5 border border-expense/10">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                Weights must sum to 100. Currently: {totalWeight}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
