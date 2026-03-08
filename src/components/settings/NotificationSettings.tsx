import { useSettings } from '@/hooks/useSettings';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Bell, AlertTriangle, Target, TrendingDown, PiggyBank, Activity, FileText, BarChart3, DollarSign } from 'lucide-react';
import { formatCurrency } from '@/lib/format';

const stagger = {
  container: { hidden: {}, show: { transition: { staggerChildren: 0.05 } } },
  item: {
    hidden: { opacity: 0, y: 14 },
    show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] } },
  },
};

const notifications = [
  { key: 'notify_low_balance', label: 'Low Balance Alerts', desc: 'When account balance drops below threshold', icon: AlertTriangle, color: 'text-expense' },
  { key: 'notify_budget_exceeded', label: 'Budget Exceeded', desc: 'When spending exceeds budget limits', icon: Target, color: 'text-[hsl(var(--warning))]' },
  { key: 'notify_debt_reminder', label: 'Debt Payment Reminders', desc: 'Upcoming debt payments', icon: TrendingDown, color: 'text-primary' },
  { key: 'notify_goal_progress', label: 'Goal Progress', desc: 'Savings goal milestones', icon: PiggyBank, color: 'text-income' },
  { key: 'notify_risk_alerts', label: 'Risk Alerts', desc: 'Unusual spending patterns', icon: Activity, color: 'text-expense' },
  { key: 'notify_weekly_summary', label: 'Weekly Summary', desc: 'Weekly performance overview', icon: BarChart3, color: 'text-primary' },
  { key: 'notify_monthly_report', label: 'Monthly Report', desc: 'Comprehensive monthly report', icon: FileText, color: 'text-income' },
];

export default function NotificationSettings() {
  const { settings, updateSettings } = useSettings();

  const handleToggle = async (key: string, value: boolean) => {
    try {
      await updateSettings({ [key]: value });
      toast.success('Notification preference updated');
    } catch {
      toast.error('Failed to update');
    }
  };

  const activeCount = notifications.filter(n => (settings as any)[n.key]).length;

  return (
    <motion.div variants={stagger.container} initial="hidden" animate="show" className="space-y-5">
      {/* Status */}
      <motion.div variants={stagger.item}>
        <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/30">
          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
            <Bell className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-bold">{activeCount}/{notifications.length} notifications active</p>
            <p className="text-[9px] text-muted-foreground">Each triggers real system events and data checks</p>
          </div>
        </div>
      </motion.div>

      {/* Notification Toggles */}
      {notifications.map(({ key, label, desc, icon: Icon, color }) => (
        <motion.div key={key} variants={stagger.item}>
          <Card className="overflow-hidden relative group/card">
            <CardContent className="py-4 px-5">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-muted/50 flex items-center justify-center shrink-0">
                    <Icon className={`w-4 h-4 ${color}`} />
                  </div>
                  <div>
                    <p className="text-xs font-bold">{label}</p>
                    <p className="text-[9px] text-muted-foreground">{desc}</p>
                  </div>
                </div>
                <Switch
                  checked={(settings as any)[key]}
                  onCheckedChange={(v) => handleToggle(key, v)}
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}

      {/* Threshold */}
      <motion.div variants={stagger.item}>
        <Card className="overflow-hidden relative group/card border-primary/10">
          <CardContent className="pt-5 pb-5 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xs font-bold">Low Balance Threshold</p>
                <p className="text-[9px] text-muted-foreground">Alert when any account falls below {formatCurrency(settings.low_balance_threshold)}</p>
              </div>
            </div>
            <Input
              type="number"
              value={settings.low_balance_threshold}
              onChange={(e) => {
                const val = Number(e.target.value);
                if (val >= 0) {
                  updateSettings({ low_balance_threshold: val });
                  toast.success('Threshold updated');
                }
              }}
              className="font-mono"
            />
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
