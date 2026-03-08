import { useSettings } from '@/hooks/useSettings';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Sparkles } from 'lucide-react';

export default function AIInsightsSettings() {
  const { settings, updateSettings } = useSettings();

  const handleUpdate = async (key: string, value: any) => {
    try {
      await updateSettings({ [key]: value });
      toast.success('AI setting updated — affects all future insights');
    } catch {
      toast.error('Failed to update');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-5 h-5" />
          AI & Insights Engine
        </CardTitle>
        <CardDescription>Configure how AI analyzes your finances and generates advice</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Enable AI Insights</Label>
            <p className="text-sm text-muted-foreground">Turn on/off personalized financial advice</p>
          </div>
          <Switch checked={settings.ai_enabled} onCheckedChange={(v) => handleUpdate('ai_enabled', v)} />
        </div>

        <div className="space-y-2">
          <Label>Advice Mode</Label>
          <Select value={settings.ai_advice_mode} onValueChange={(v) => handleUpdate('ai_advice_mode', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="conservative">Conservative — Focus on safety & savings</SelectItem>
              <SelectItem value="balanced">Balanced — Mix of growth & security</SelectItem>
              <SelectItem value="aggressive">Aggressive — Focus on growth & investment</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Risk Tolerance Profile</Label>
          <Select value={settings.ai_risk_tolerance} onValueChange={(v) => handleUpdate('ai_risk_tolerance', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low — Preserve capital, minimize risk</SelectItem>
              <SelectItem value="moderate">Moderate — Balanced risk/reward</SelectItem>
              <SelectItem value="high">High — Accept higher risk for growth</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Insight Frequency</Label>
          <Select value={settings.insight_frequency} onValueChange={(v) => handleUpdate('insight_frequency', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Controls how often new AI tips are generated</p>
        </div>
      </CardContent>
    </Card>
  );
}
