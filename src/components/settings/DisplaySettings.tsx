import { useSettings } from '@/hooks/useSettings';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Monitor } from 'lucide-react';

export default function DisplaySettings() {
  const { settings, updateSettings } = useSettings();

  const handleUpdate = async (key: string, value: any) => {
    try {
      await updateSettings({ [key]: value });
      toast.success('Display setting updated');
    } catch {
      toast.error('Failed to update');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Monitor className="w-5 h-5" />
          Display & UI
        </CardTitle>
        <CardDescription>Customize your visual experience (secondary settings)</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Theme</Label>
          <Select value={settings.theme} onValueChange={(v) => handleUpdate('theme', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="dark">Dark</SelectItem>
              <SelectItem value="light">Light</SelectItem>
              <SelectItem value="system">System</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Dashboard Density</Label>
          <Select value={settings.dashboard_density} onValueChange={(v) => handleUpdate('dashboard_density', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="compact">Compact</SelectItem>
              <SelectItem value="comfortable">Comfortable</SelectItem>
              <SelectItem value="detailed">Detailed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Default Landing Tab</Label>
          <Select value={settings.default_landing_tab} onValueChange={(v) => handleUpdate('default_landing_tab', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="overview">Overview</SelectItem>
              <SelectItem value="transactions">Transactions</SelectItem>
              <SelectItem value="budgets">Budgets</SelectItem>
              <SelectItem value="reports">Reports</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Chart Preference</Label>
          <Select value={settings.chart_preference} onValueChange={(v) => handleUpdate('chart_preference', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="bar">Bar Charts</SelectItem>
              <SelectItem value="line">Line Charts</SelectItem>
              <SelectItem value="area">Area Charts</SelectItem>
              <SelectItem value="pie">Pie Charts</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
