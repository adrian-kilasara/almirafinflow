-- Enable RLS on badges table and allow all authenticated users to read (badges are global definitions)
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view badges" ON public.badges FOR SELECT USING (true);

-- Enable RLS on financial_lessons table and allow all authenticated users to read
ALTER TABLE public.financial_lessons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view lessons" ON public.financial_lessons FOR SELECT USING (true);