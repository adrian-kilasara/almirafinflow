import { useSettings } from '@/hooks/useSettings';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';
import { Calculator, PiggyBank, TrendingDown, HeartPulse } from 'lucide-react';

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

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="w-5 h-5" />
            Budget Behavior
          </CardTitle>
          <CardDescription>Control how budgets operate across the system</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Budget Mode</Label>
            <Select value={settings.budget_mode} onValueChange={(v) => handleUpdate('budget_mode', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="strict">Strict — Warn on over-budget spending</SelectItem>
                <SelectItem value="flexible">Flexible — Track without restrictions</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Auto-Rollover Unused Budget</Label>
              <p className="text-sm text-muted-foreground">Carry forward unspent budget to next period</p>
            </div>
            <Switch checked={settings.budget_rollover} onCheckedChange={(v) => handleUpdate('budget_rollover', v)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PiggyBank className="w-5 h-5" />
            Savings Automation
          </CardTitle>
          <CardDescription>Automate your savings strategy</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Round-Up Savings</Label>
              <p className="text-sm text-muted-foreground">Round up transactions and save the difference</p>
            </div>
            <Switch checked={settings.savings_round_up} onCheckedChange={(v) => handleUpdate('savings_round_up', v)} />
          </div>

          <div className="space-y-2">
            <Label>Auto-Save Percentage of Income</Label>
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
            />
            <p className="text-xs text-muted-foreground">Leave empty to disable. Set to % of income to auto-allocate.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="w-5 h-5" />
            Debt Strategy
          </CardTitle>
          <CardDescription>Choose your debt repayment approach</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HeartPulse className="w-5 h-5" />
            Health Score Weights
          </CardTitle>
          <CardDescription>
            Adjust how your financial health score is calculated (must sum to 100). Currently: {totalWeight}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {[
            { key: 'health_weight_savings', label: 'Savings Weight' },
            { key: 'health_weight_debt', label: 'Debt Weight' },
            { key: 'health_weight_investments', label: 'Investments Weight' },
            { key: 'health_weight_cashflow', label: 'Cash Flow Weight' },
          ].map(({ key, label }) => (
            <div key={key} className="space-y-2">
              <div className="flex justify-between">
                <Label>{label}</Label>
                <span className="text-sm font-mono text-muted-foreground">{(settings as any)[key]}%</span>
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
            <p className="text-sm text-destructive font-medium">⚠ Weights must sum to 100. Currently: {totalWeight}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
