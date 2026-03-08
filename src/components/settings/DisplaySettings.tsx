import { useSettings } from '@/hooks/useSettings';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Monitor, Palette, LayoutGrid, BarChart3, Home } from 'lucide-react';

const stagger = {
  container: { hidden: {}, show: { transition: { staggerChildren: 0.06 } } },
  item: {
    hidden: { opacity: 0, y: 14 },
    show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] } },
  },
};

export default function DisplaySettings() {
  const { settings, updateSettings } = useSettings();

  const handleUpdate = async (key: string, value: string) => {
    try {
      await updateSettings({ [key]: value });
      toast.success('Display setting updated');
    } catch {
      toast.error('Failed to update');
    }
  };

  const fields = [
    { key: 'theme', label: 'Theme', icon: Palette, desc: 'System-wide appearance',
      options: [{ v: 'dark', l: 'Dark' }, { v: 'light', l: 'Light' }, { v: 'system', l: 'System' }] },
    { key: 'dashboard_density', label: 'Dashboard Density', icon: LayoutGrid, desc: 'Controls spacing and element size',
      options: [{ v: 'compact', l: 'Compact' }, { v: 'comfortable', l: 'Comfortable' }, { v: 'detailed', l: 'Detailed' }] },
    { key: 'default_landing_tab', label: 'Default Landing Tab', icon: Home, desc: 'First screen on login',
      options: [{ v: 'overview', l: 'Overview' }, { v: 'transactions', l: 'Transactions' }, { v: 'budgets', l: 'Budgets' }, { v: 'reports', l: 'Reports' }] },
    { key: 'chart_preference', label: 'Chart Preference', icon: BarChart3, desc: 'Preferred chart type for reports',
      options: [{ v: 'bar', l: 'Bar Charts' }, { v: 'line', l: 'Line Charts' }, { v: 'area', l: 'Area Charts' }, { v: 'pie', l: 'Pie Charts' }] },
  ];

  return (
    <motion.div variants={stagger.container} initial="hidden" animate="show" className="space-y-5">
      {fields.map((field) => {
        const Icon = field.icon;
        return (
          <motion.div key={field.key} variants={stagger.item}>
            <Card className="overflow-hidden relative group/card">
              <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-primary/5 blur-3xl opacity-0 group-hover/card:opacity-100 transition-opacity duration-500 pointer-events-none" />
              <CardContent className="pt-5 pb-5">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs font-bold">{field.label}</p>
                      <p className="text-[9px] text-muted-foreground">{field.desc}</p>
                    </div>
                  </div>
                  <Select value={(settings as any)[field.key]} onValueChange={(v) => handleUpdate(field.key, v)}>
                    <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {field.options.map(o => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
