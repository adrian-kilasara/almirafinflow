import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, Lock } from 'lucide-react';
import type { Badge, UserBadge } from '@/types/finance';

interface UserBadgesProps {
  transactionCount: number;
  accountCount: number;
  budgetCount: number;
  savingsGoalCount: number;
  currentStreak: number;
  totalSaved: number;
  healthScore: number;
}

export default function UserBadges({
  transactionCount,
  accountCount,
  budgetCount,
  savingsGoalCount,
  currentStreak,
  totalSaved,
  healthScore,
}: UserBadgesProps) {
  const [badges, setBadges] = useState<Badge[]>([]);
  const [earnedBadges, setEarnedBadges] = useState<UserBadge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBadges();
  }, []);

  const fetchBadges = async () => {
    try {
      const [badgesRes, userBadgesRes] = await Promise.all([
        supabase.from('badges').select('*').order('requirement_value'),
        supabase.from('user_badges').select('*'),
      ]);

      if (badgesRes.data) setBadges(badgesRes.data as Badge[]);
      if (userBadgesRes.data) setEarnedBadges(userBadgesRes.data as UserBadge[]);
    } catch (error) {
      console.error('Error fetching badges:', error);
    } finally {
      setLoading(false);
    }
  };

  // Check and award new badges
  useEffect(() => {
    if (badges.length === 0) return;

    const checkAndAwardBadges = async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      for (const badge of badges) {
        // Skip if already earned
        if (earnedBadges.some(eb => eb.badge_id === badge.id)) continue;

        let shouldAward = false;

        switch (badge.requirement_type) {
          case 'transaction_count':
            shouldAward = transactionCount >= badge.requirement_value;
            break;
          case 'streak_days':
            shouldAward = currentStreak >= badge.requirement_value;
            break;
          case 'savings_goal_count':
            shouldAward = savingsGoalCount >= badge.requirement_value;
            break;
          case 'budget_count':
            shouldAward = budgetCount >= badge.requirement_value;
            break;
          case 'account_count':
            shouldAward = accountCount >= badge.requirement_value;
            break;
          case 'total_saved':
            shouldAward = totalSaved >= badge.requirement_value;
            break;
          case 'health_score':
            shouldAward = healthScore >= badge.requirement_value;
            break;
        }

        if (shouldAward) {
          await supabase.from('user_badges').insert({
            user_id: userData.user.id,
            badge_id: badge.id,
          });
          // Refresh earned badges
          fetchBadges();
        }
      }
    };

    checkAndAwardBadges();
  }, [badges, earnedBadges, transactionCount, currentStreak, savingsGoalCount, budgetCount, accountCount, totalSaved, healthScore]);

  const isEarned = (badgeId: string) => earnedBadges.some(eb => eb.badge_id === badgeId);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse">Loading badges...</div>
        </CardContent>
      </Card>
    );
  }

  const earnedCount = earnedBadges.length;
  const totalCount = badges.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-warning" />
            Achievements
          </div>
          <span className="text-sm font-normal text-muted-foreground">
            {earnedCount}/{totalCount}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-5 gap-3">
          {badges.map((badge) => {
            const earned = isEarned(badge.id);
            return (
              <div
                key={badge.id}
                className={`relative flex flex-col items-center p-2 rounded-lg transition-all ${
                  earned
                    ? 'bg-primary/10'
                    : 'bg-muted/30 opacity-50'
                }`}
                title={`${badge.name}: ${badge.description}`}
              >
                <span className="text-2xl">{badge.icon}</span>
                <span className="text-[10px] text-center mt-1 line-clamp-1">{badge.name}</span>
                {!earned && (
                  <Lock className="absolute top-1 right-1 w-3 h-3 text-muted-foreground" />
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
