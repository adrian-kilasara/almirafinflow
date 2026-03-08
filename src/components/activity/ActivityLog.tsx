import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { ScrollText, Shield, CreditCard, Receipt, Folder, PiggyBank, User, Settings, Sparkles, ChevronDown } from 'lucide-react';
import { formatRelativeDate } from '@/lib/format';

interface ActivityEntry {
  id: string;
  action: string;
  module: string;
  details: Record<string, unknown>;
  created_at: string;
}

const MODULE_ICONS: Record<string, typeof Shield> = {
  auth: Shield,
  accounts: CreditCard,
  transactions: Receipt,
  budgets: Folder,
  savings: PiggyBank,
  profile: User,
  settings: Settings,
  system: Sparkles,
};

const MODULE_COLORS: Record<string, string> = {
  auth: 'text-[hsl(var(--warning))]',
  accounts: 'text-primary',
  transactions: 'text-income',
  budgets: 'text-expense',
  savings: 'text-primary',
  profile: 'text-muted-foreground',
  settings: 'text-muted-foreground',
  system: 'text-primary',
};

const stagger = {
  container: { hidden: {}, show: { transition: { staggerChildren: 0.04 } } },
  item: {
    hidden: { opacity: 0, x: -12 },
    show: { opacity: 1, x: 0, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] } },
  },
};

export default function ActivityLog() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<ActivityEntry[]>([]);
  const [limit, setLimit] = useState(20);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    if (!user) return;
    fetchLogs();
  }, [user, limit]);

  const fetchLogs = async () => {
    setLoading(true);
    const query = supabase
      .from('activity_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    const { data } = await query;
    if (data) setLogs(data as ActivityEntry[]);
    setLoading(false);
  };

  const modules = ['all', ...new Set(logs.map(l => l.module))];
  const filtered = filter === 'all' ? logs : logs.filter(l => l.module === filter);

  // Group by date
  const grouped = filtered.reduce<Record<string, ActivityEntry[]>>((acc, log) => {
    const day = new Date(log.created_at).toLocaleDateString();
    (acc[day] ||= []).push(log);
    return acc;
  }, {});

  return (
    <Card className="border-primary/10">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <ScrollText className="w-3.5 h-3.5 text-primary" />
            </div>
            Activity Log
            <span className="text-[9px] bg-muted/50 text-muted-foreground px-2 py-0.5 rounded-full font-normal">{logs.length} entries</span>
          </CardTitle>
        </div>

        {/* Filter pills */}
        <div className="flex gap-1 overflow-x-auto pb-1 mt-2 scrollbar-hide">
          {modules.map(m => (
            <button
              key={m}
              onClick={() => setFilter(m)}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-semibold capitalize shrink-0 transition-colors ${
                filter === m
                  ? 'bg-primary/10 text-primary border border-primary/20'
                  : 'text-muted-foreground hover:text-foreground bg-muted/20'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 rounded-xl bg-muted/30 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <ScrollText className="w-10 h-10 mx-auto mb-3 text-muted-foreground/20" />
            <p className="text-sm text-muted-foreground">No activity recorded yet</p>
            <p className="text-[10px] text-muted-foreground mt-1">Actions will appear here as you use the system</p>
          </div>
        ) : (
          <motion.div variants={stagger.container} initial="hidden" animate="show" className="space-y-4">
            {Object.entries(grouped).map(([date, entries]) => (
              <div key={date} className="space-y-1.5">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-1">{date}</p>
                {entries.map((log) => {
                  const Icon = MODULE_ICONS[log.module] || Sparkles;
                  const color = MODULE_COLORS[log.module] || 'text-muted-foreground';
                  return (
                    <motion.div
                      key={log.id}
                      variants={stagger.item}
                      className="flex items-start gap-3 p-2.5 rounded-xl bg-muted/15 hover:bg-muted/30 transition-colors group"
                    >
                      <div className={`w-7 h-7 rounded-lg bg-muted/30 flex items-center justify-center shrink-0 mt-0.5`}>
                        <Icon className={`w-3.5 h-3.5 ${color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium">{log.action}</p>
                        {log.details && Object.keys(log.details).length > 0 && (
                          <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                            {Object.entries(log.details).slice(0, 3).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <span className={`text-[9px] capitalize px-1.5 py-0.5 rounded-md bg-muted/30 ${color}`}>{log.module}</span>
                        <p className="text-[9px] text-muted-foreground mt-1">{formatRelativeDate(log.created_at)}</p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ))}

            {logs.length >= limit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLimit(l => l + 20)}
                className="w-full text-xs rounded-xl h-9"
              >
                <ChevronDown className="w-3.5 h-3.5 mr-1" /> Load More
              </Button>
            )}
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}
