import { useState } from 'react';
import { useSettings } from '@/hooks/useSettings';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Globe, Coins, Calendar, Clock } from 'lucide-react';
import type { CurrencyCode } from '@/types/finance';

const stagger = {
  container: { hidden: {}, show: { transition: { staggerChildren: 0.06 } } },
  item: {
    hidden: { opacity: 0, y: 14 },
    show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] } },
  },
};

const currencies: { value: CurrencyCode; label: string }[] = [
  { value: 'KES', label: 'KES - Kenyan Shilling' },
  { value: 'TZS', label: 'TZS - Tanzanian Shilling' },
  { value: 'UGX', label: 'UGX - Ugandan Shilling' },
  { value: 'RWF', label: 'RWF - Rwandan Franc' },
  { value: 'BIF', label: 'BIF - Burundian Franc' },
  { value: 'ETB', label: 'ETB - Ethiopian Birr' },
  { value: 'USD', label: 'USD - US Dollar' },
  { value: 'EUR', label: 'EUR - Euro' },
  { value: 'GBP', label: 'GBP - British Pound' },
];

const dateFormats = [
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY (31/12/2026)' },
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY (12/31/2026)' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (2026-12-31)' },
];

const timezones = [
  { value: 'Africa/Dar_es_Salaam', label: 'East Africa Time (EAT)' },
  { value: 'Africa/Nairobi', label: 'Nairobi (EAT)' },
  { value: 'Africa/Kampala', label: 'Kampala (EAT)' },
  { value: 'Africa/Kigali', label: 'Kigali (CAT)' },
  { value: 'Africa/Addis_Ababa', label: 'Addis Ababa (EAT)' },
  { value: 'UTC', label: 'UTC' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'America/New_York', label: 'New York (EST/EDT)' },
];

const months = ['january','february','march','april','may','june','july','august','september','october','november','december'];

export default function LocalizationSettings() {
  const { settings, updateSettings } = useSettings();

  const handleChange = async (key: string, value: string) => {
    try {
      await updateSettings({ [key]: value });
      toast.success(`${key.replace(/_/g, ' ')} updated system-wide`);
    } catch {
      toast.error('Failed to update setting');
    }
  };

  return (
    <motion.div variants={stagger.container} initial="hidden" animate="show" className="space-y-5">
      {/* Currency */}
      <motion.div variants={stagger.item}>
        <Card className="overflow-hidden relative group/card">
          <div className="absolute -top-16 -right-16 w-40 h-40 rounded-full bg-primary/5 blur-3xl opacity-0 group-hover/card:opacity-100 transition-opacity duration-500 pointer-events-none" />
          <CardContent className="pt-5 pb-5 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                <Coins className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xs font-bold">System Currency</p>
                <p className="text-[9px] text-muted-foreground">Applies to dashboard, reports, transactions, budgets, exports</p>
              </div>
            </div>
            <Select value={settings.default_currency} onValueChange={(v) => handleChange('default_currency', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {currencies.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </motion.div>

      {/* Regional */}
      <motion.div variants={stagger.item}>
        <Card className="overflow-hidden relative group/card">
          <div className="absolute -bottom-12 -left-12 w-32 h-32 rounded-full bg-primary/5 blur-3xl opacity-0 group-hover/card:opacity-100 transition-opacity duration-500 pointer-events-none" />
          <CardContent className="pt-5 pb-5 space-y-5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                <Globe className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xs font-bold">Regional Preferences</p>
                <p className="text-[9px] text-muted-foreground">Date format, timezone, and financial year</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Date Format
                </Label>
                <Select value={settings.date_format} onValueChange={(v) => handleChange('date_format', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {dateFormats.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Timezone
                </Label>
                <Select value={settings.timezone} onValueChange={(v) => handleChange('timezone', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {timezones.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Financial Year Starts</Label>
                <Select value={settings.financial_year_start} onValueChange={(v) => handleChange('financial_year_start', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {months.map(m => <SelectItem key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-[9px] text-muted-foreground">Important for annual reports and tax calculations</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
