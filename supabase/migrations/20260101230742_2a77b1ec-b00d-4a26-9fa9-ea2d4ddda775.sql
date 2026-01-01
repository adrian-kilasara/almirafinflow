-- Add tags column to transactions
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';

-- Transaction rules for auto-categorization
CREATE TABLE public.transaction_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description_pattern TEXT NOT NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE CASCADE,
  tags text[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.transaction_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own rules" ON public.transaction_rules FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own rules" ON public.transaction_rules FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own rules" ON public.transaction_rules FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own rules" ON public.transaction_rules FOR DELETE USING (auth.uid() = user_id);

-- Gamification: User streaks
CREATE TABLE public.user_streaks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_activity_date DATE,
  total_transactions INTEGER DEFAULT 0,
  total_savings_added NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.user_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own streaks" ON public.user_streaks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own streaks" ON public.user_streaks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own streaks" ON public.user_streaks FOR UPDATE USING (auth.uid() = user_id);

-- Badges definition
CREATE TABLE public.badges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  category TEXT NOT NULL,
  requirement_type TEXT NOT NULL,
  requirement_value INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert default badges
INSERT INTO public.badges (name, description, icon, category, requirement_type, requirement_value) VALUES
  ('First Steps', 'Added your first transaction', '🎯', 'transactions', 'transaction_count', 1),
  ('Getting Started', 'Added 10 transactions', '📊', 'transactions', 'transaction_count', 10),
  ('Tracker Pro', 'Added 100 transactions', '🏆', 'transactions', 'transaction_count', 100),
  ('Week Warrior', '7-day tracking streak', '🔥', 'streaks', 'streak_days', 7),
  ('Month Master', '30-day tracking streak', '⚡', 'streaks', 'streak_days', 30),
  ('Savings Starter', 'Created your first savings goal', '🐷', 'savings', 'savings_goal_count', 1),
  ('Budget Beginner', 'Created your first budget', '📋', 'budgets', 'budget_count', 1),
  ('Multi-Account', 'Added 3+ accounts', '💳', 'accounts', 'account_count', 3),
  ('Saver Star', 'Saved 10,000 in total', '⭐', 'savings', 'total_saved', 10000),
  ('Finance Master', 'Reached 75+ financial health score', '👑', 'health', 'health_score', 75);

-- User earned badges
CREATE TABLE public.user_badges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  badge_id UUID NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  earned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, badge_id)
);

ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own badges" ON public.user_badges FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own badges" ON public.user_badges FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Financial lessons/education
CREATE TABLE public.financial_lessons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL,
  difficulty TEXT NOT NULL DEFAULT 'beginner',
  duration_minutes INTEGER DEFAULT 5,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert 2026 financial education content
INSERT INTO public.financial_lessons (title, content, category, difficulty, duration_minutes, order_index) VALUES
  ('Understanding Your Net Worth', 'Your net worth is the total value of all your assets minus your liabilities. In 2026, tracking net worth is essential for understanding your true financial position. Calculate it monthly by adding up all account balances and subtracting any debts.', 'basics', 'beginner', 3, 1),
  ('The 50/30/20 Budget Rule', 'Allocate 50% of income to needs (rent, utilities, food), 30% to wants (entertainment, dining out), and 20% to savings and debt repayment. This simple framework helps ensure balanced spending.', 'budgeting', 'beginner', 5, 2),
  ('Emergency Fund Essentials', 'Aim for 3-6 months of expenses in an easily accessible account. In 2026, with economic uncertainties, having this buffer is crucial. Start small - even 1 month is better than nothing.', 'savings', 'beginner', 5, 3),
  ('Mobile Money Best Practices', 'For East African users, mobile money is essential. Keep transaction records, use official apps only, never share PINs, and regularly check statements for unauthorized transactions.', 'security', 'beginner', 4, 4),
  ('Inflation Protection in 2026', 'With global inflation concerns, consider diversifying savings across currencies (USD, KES, TZS) and investing in inflation-resistant assets. Keep only 1-2 months expenses in cash.', 'investing', 'intermediate', 6, 5),
  ('Tracking Business vs Personal', 'Keep business and personal finances completely separate. Use different accounts, track all transfers between them, and maintain clear records for tax purposes.', 'business', 'intermediate', 5, 6),
  ('Smart Expense Categorization', 'Consistent categorization helps identify spending patterns. Create categories that match your lifestyle - Food, Transport, Business, Family, Entertainment. Review monthly for insights.', 'tracking', 'beginner', 4, 7),
  ('Setting SMART Savings Goals', 'Goals should be Specific, Measurable, Achievable, Relevant, and Time-bound. Instead of "save more", try "save KES 50,000 for laptop by March 2026".', 'savings', 'beginner', 5, 8);

-- User lesson progress
CREATE TABLE public.user_lesson_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  lesson_id UUID NOT NULL REFERENCES public.financial_lessons(id) ON DELETE CASCADE,
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, lesson_id)
);

ALTER TABLE public.user_lesson_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own progress" ON public.user_lesson_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own progress" ON public.user_lesson_progress FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create triggers for updated_at
CREATE TRIGGER update_user_streaks_updated_at
  BEFORE UPDATE ON public.user_streaks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();