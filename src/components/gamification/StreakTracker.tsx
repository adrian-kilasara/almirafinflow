import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Flame, Target, Zap, Calendar } from 'lucide-react';
import { todayInTz, dateKeyInTz, addDaysToKey } from '@/lib/datetime';
import type { UserStreak } from '@/types/finance';

interface StreakTrackerProps {
  transactions: { date: string }[];
  onStreakUpdate?: (streak: UserStreak) => void;
}

export default function StreakTracker({ transactions, onStreakUpdate }: StreakTrackerProps) {
  const [streak, setStreak] = useState<UserStreak | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAndUpdateStreak();
  }, [transactions]);

  const fetchAndUpdateStreak = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      // Fetch existing streak
      const { data: existingStreak } = await supabase
        .from('user_streaks')
        .select('*')
        .eq('user_id', userData.user.id)
        .maybeSingle();

      // Build set of activity day-keys in the user's timezone
      const activityKeys = new Set<string>(
        transactions.map(t => {
          // t.date is already 'YYYY-MM-DD' — treat as a calendar day directly
          if (/^\d{4}-\d{2}-\d{2}$/.test(t.date)) return t.date;
          return dateKeyInTz(new Date(t.date));
        })
      );

      const todayKey = todayInTz();
      const yesterdayKey = addDaysToKey(todayKey, -1);

      let currentStreak = 0;
      let cursor: string | null = null;
      if (activityKeys.has(todayKey)) cursor = todayKey;
      else if (activityKeys.has(yesterdayKey)) cursor = yesterdayKey;

      while (cursor && activityKeys.has(cursor)) {
        currentStreak++;
        cursor = addDaysToKey(cursor, -1);
      }

      // Determine the most recent activity day-key
      let lastActivityDate: string | null = null;
      for (const k of activityKeys) {
        if (!lastActivityDate || k > lastActivityDate) lastActivityDate = k;
      }

      const streakData = {
        current_streak: currentStreak,
        longest_streak: Math.max(currentStreak, existingStreak?.longest_streak || 0),
        last_activity_date: lastActivityDate,
        total_transactions: transactions.length,
      };

      if (existingStreak) {
        const { data: updated } = await supabase
          .from('user_streaks')
          .update(streakData)
          .eq('id', existingStreak.id)
          .select()
          .single();
        
        if (updated) {
          setStreak(updated as UserStreak);
          onStreakUpdate?.(updated as UserStreak);
        }
      } else {
        const { data: created } = await supabase
          .from('user_streaks')
          .insert({
            user_id: userData.user.id,
            ...streakData,
            total_savings_added: 0,
          })
          .select()
          .single();
        
        if (created) {
          setStreak(created as UserStreak);
          onStreakUpdate?.(created as UserStreak);
        }
      }
    } catch (error) {
      console.error('Error updating streak:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return null;
  }

  const stats = [
    {
      icon: Flame,
      label: 'Current Streak',
      value: streak?.current_streak || 0,
      suffix: 'days',
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
    },
    {
      icon: Target,
      label: 'Best Streak',
      value: streak?.longest_streak || 0,
      suffix: 'days',
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      icon: Zap,
      label: 'Total Logged',
      value: streak?.total_transactions || 0,
      suffix: '',
      color: 'text-warning',
      bgColor: 'bg-warning/10',
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <Card key={index} className="bg-card/50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg ${stat.bgColor} flex items-center justify-center`}>
                <Icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className="text-lg font-bold">
                  {stat.value}
                  {stat.suffix && <span className="text-xs font-normal text-muted-foreground ml-1">{stat.suffix}</span>}
                </p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
