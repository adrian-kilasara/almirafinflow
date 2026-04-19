-- Add report view mode preference to user_settings
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS report_view_mode TEXT NOT NULL DEFAULT 'simple';

-- Insert savings achievement badges (idempotent)
INSERT INTO public.badges (name, description, icon, category, requirement_type, requirement_value)
SELECT * FROM (VALUES
  ('First Goal',     'Completed your first savings goal',     '🥇', 'savings', 'goals_completed',  1),
  ('Goal Crusher',   'Completed 5 savings goals',             '🏆', 'savings', 'goals_completed',  5),
  ('Big Saver',      'Saved over 1,000,000 in your currency', '💎', 'savings', 'savings_total',    1000000),
  ('Consistent',     'Saved in 3 consecutive months',         '🔥', 'savings', 'savings_months',   3)
) AS v(name, description, icon, category, requirement_type, requirement_value)
WHERE NOT EXISTS (
  SELECT 1 FROM public.badges b WHERE b.name = v.name
);