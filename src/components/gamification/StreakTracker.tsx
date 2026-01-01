import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Flame, Target, Zap, Calendar } from 'lucide-react';
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

      // Calculate streak based on transactions
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const sortedDates = [...new Set(
        transactions.map(t => {
          const d = new Date(t.date);
          d.setHours(0, 0, 0, 0);
          return d.getTime();
        })
      )].sort((a, b) => b - a);

      let currentStreak = 0;
      let checkDate = today.getTime();

      // Check if there's activity today or yesterday to start counting
      const hasActivityToday = sortedDates.includes(checkDate);
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const hasActivityYesterday = sortedDates.includes(yesterday.getTime());

      if (hasActivityToday || hasActivityYesterday) {
        if (!hasActivityToday) {
          checkDate = yesterday.getTime();
        }

        // Count consecutive days
        for (let i = 0; i < sortedDates.length; i++) {
          if (sortedDates.includes(checkDate)) {
            currentStreak++;
            checkDate -= 24 * 60 * 60 * 1000; // Go back one day
          } else {
            break;
          }
        }
      }

      const lastActivityDate = sortedDates.length > 0 
        ? new Date(sortedDates[0]).toISOString().split('T')[0]
        : null;

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
