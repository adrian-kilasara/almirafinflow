import { useSettings } from '@/hooks/useSettings';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Sparkles, Brain, Shield, Clock } from 'lucide-react';

const stagger = {
  container: { hidden: {}, show: { transition: { staggerChildren: 0.06 } } },
  item: {
    hidden: { opacity: 0, y: 14 },
    show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] } },
  },
};

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
    <motion.div variants={stagger.container} initial="hidden" animate="show" className="space-y-5">
      {/* Toggle */}
      <motion.div variants={stagger.item}>
        <Card className="overflow-hidden relative group/card border-primary/10 bg-gradient-to-br from-primary/[0.03] via-card to-card">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl pointer-events-none" />
          <CardContent className="py-5 px-5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <motion.div
                  className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center"
                  animate={{ rotate: [0, 4, -4, 0] }}
                  transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
                >
                  <Sparkles className="w-5 h-5 text-primary" />
                </motion.div>
                <div>
                  <p className="text-sm font-bold">AI Insights Engine</p>
                  <p className="text-[9px] text-muted-foreground">Personalized financial advice powered by AI</p>
                </div>
              </div>
              <Switch checked={settings.ai_enabled} onCheckedChange={(v) => handleUpdate('ai_enabled', v)} />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Advice Mode */}
      <motion.div variants={stagger.item}>
        <Card className="overflow-hidden relative group/card">
          <CardContent className="pt-5 pb-5 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                <Brain className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xs font-bold">Advice Mode</p>
                <p className="text-[9px] text-muted-foreground">How AI approaches your financial advice</p>
              </div>
            </div>
            <Select value={settings.ai_advice_mode} onValueChange={(v) => handleUpdate('ai_advice_mode', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="conservative">Conservative — Focus on safety & savings</SelectItem>
                <SelectItem value="balanced">Balanced — Mix of growth & security</SelectItem>
                <SelectItem value="aggressive">Aggressive — Focus on growth & investment</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </motion.div>

      {/* Risk Tolerance */}
      <motion.div variants={stagger.item}>
        <Card className="overflow-hidden relative group/card">
          <CardContent className="pt-5 pb-5 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                <Shield className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xs font-bold">Risk Tolerance</p>
                <p className="text-[9px] text-muted-foreground">Your risk appetite for AI suggestions</p>
              </div>
            </div>
            <Select value={settings.ai_risk_tolerance} onValueChange={(v) => handleUpdate('ai_risk_tolerance', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low — Preserve capital, minimize risk</SelectItem>
                <SelectItem value="moderate">Moderate — Balanced risk/reward</SelectItem>
                <SelectItem value="high">High — Accept higher risk for growth</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </motion.div>

      {/* Frequency */}
      <motion.div variants={stagger.item}>
        <Card className="overflow-hidden relative group/card">
          <CardContent className="pt-5 pb-5 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                <Clock className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xs font-bold">Insight Frequency</p>
                <p className="text-[9px] text-muted-foreground">How often new AI tips are generated</p>
              </div>
            </div>
            <Select value={settings.insight_frequency} onValueChange={(v) => handleUpdate('insight_frequency', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
