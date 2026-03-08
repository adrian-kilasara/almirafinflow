import { useSettings } from '@/hooks/useSettings';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Bell } from 'lucide-react';
import { formatCurrency } from '@/lib/format';

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

  const notifications = [
    { key: 'notify_low_balance', label: 'Low Balance Alerts', desc: 'Get notified when account balance drops below threshold' },
    { key: 'notify_budget_exceeded', label: 'Budget Exceeded', desc: 'Alert when spending exceeds budget limits' },
    { key: 'notify_debt_reminder', label: 'Debt Payment Reminders', desc: 'Reminders for upcoming debt payments' },
    { key: 'notify_goal_progress', label: 'Goal Progress', desc: 'Updates on savings goal milestones' },
    { key: 'notify_risk_alerts', label: 'Risk Alerts', desc: 'Alerts for unusual spending patterns or risks' },
    { key: 'notify_weekly_summary', label: 'Weekly Financial Summary', desc: 'Receive weekly performance overview' },
    { key: 'notify_monthly_report', label: 'Monthly Report', desc: 'Comprehensive monthly financial report' },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="w-5 h-5" />
          Notification Preferences
        </CardTitle>
        <CardDescription>Each notification triggers real system events and data checks</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {notifications.map(({ key, label, desc }) => (
          <div key={key} className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{label}</Label>
              <p className="text-sm text-muted-foreground">{desc}</p>
            </div>
            <Switch
              checked={(settings as any)[key]}
              onCheckedChange={(v) => handleToggle(key, v)}
            />
          </div>
        ))}

        <div className="border-t border-border pt-4 space-y-2">
          <Label>Low Balance Threshold</Label>
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
          />
          <p className="text-xs text-muted-foreground">
            Alert when any account falls below {formatCurrency(settings.low_balance_threshold)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
