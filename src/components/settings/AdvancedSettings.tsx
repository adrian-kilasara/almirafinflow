import { useSettings } from '@/hooks/useSettings';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Wrench } from 'lucide-react';

export default function AdvancedSettings() {
  const { settings, updateSettings } = useSettings();

  const handleUpdate = async (key: string, value: any) => {
    try {
      await updateSettings({ [key]: value });
      toast.success('Advanced setting updated');
    } catch {
      toast.error('Failed to update');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wrench className="w-5 h-5" />
          Advanced Settings
        </CardTitle>
        <CardDescription>System behavior and performance tuning</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Real-time Recalculation</Label>
            <p className="text-sm text-muted-foreground">Instantly recalculate all metrics on every change</p>
          </div>
          <Switch checked={settings.realtime_recalculation} onCheckedChange={(v) => handleUpdate('realtime_recalculation', v)} />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Performance Mode</Label>
            <p className="text-sm text-muted-foreground">Reduce animations and calculations for low-end devices</p>
          </div>
          <Switch checked={settings.performance_mode} onCheckedChange={(v) => handleUpdate('performance_mode', v)} />
        </div>

        <div className="space-y-2">
          <Label>Data Cache Duration (days)</Label>
          <Input
            type="number"
            min={1}
            max={365}
            value={settings.data_cache_days}
            onChange={(e) => handleUpdate('data_cache_days', Number(e.target.value))}
          />
          <p className="text-xs text-muted-foreground">How many days of data to keep in local cache for faster loading</p>
        </div>
      </CardContent>
    </Card>
  );
}
