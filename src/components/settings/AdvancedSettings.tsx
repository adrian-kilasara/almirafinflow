import { useSettings } from '@/hooks/useSettings';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Wrench, Zap, Gauge, HardDrive } from 'lucide-react';

const stagger = {
  container: { hidden: {}, show: { transition: { staggerChildren: 0.06 } } },
  item: {
    hidden: { opacity: 0, y: 14 },
    show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] } },
  },
};

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
    <motion.div variants={stagger.container} initial="hidden" animate="show" className="space-y-5">
      {/* Realtime */}
      <motion.div variants={stagger.item}>
        <Card className="overflow-hidden relative group/card">
          <CardContent className="py-4 px-5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Zap className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs font-bold">Real-time Recalculation</p>
                  <p className="text-[9px] text-muted-foreground">Instantly recalculate all metrics on every change</p>
                </div>
              </div>
              <Switch checked={settings.realtime_recalculation} onCheckedChange={(v) => handleUpdate('realtime_recalculation', v)} />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Performance */}
      <motion.div variants={stagger.item}>
        <Card className="overflow-hidden relative group/card">
          <CardContent className="py-4 px-5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-[hsl(var(--warning))]/10 flex items-center justify-center shrink-0">
                  <Gauge className="w-4 h-4 text-[hsl(var(--warning))]" />
                </div>
                <div>
                  <p className="text-xs font-bold">Performance Mode</p>
                  <p className="text-[9px] text-muted-foreground">Reduce animations and calculations for low-end devices</p>
                </div>
              </div>
              <Switch checked={settings.performance_mode} onCheckedChange={(v) => handleUpdate('performance_mode', v)} />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Cache */}
      <motion.div variants={stagger.item}>
        <Card className="overflow-hidden relative group/card">
          <CardContent className="pt-5 pb-5 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                <HardDrive className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xs font-bold">Data Cache Duration</p>
                <p className="text-[9px] text-muted-foreground">Days of data to keep in local cache</p>
              </div>
            </div>
            <Input
              type="number"
              min={1}
              max={365}
              value={settings.data_cache_days}
              onChange={(e) => handleUpdate('data_cache_days', Number(e.target.value))}
              className="font-mono"
            />
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
