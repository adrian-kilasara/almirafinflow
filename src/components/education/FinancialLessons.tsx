import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  GraduationCap, BookOpen, CheckCircle, Clock,
  ChevronRight, Award, Sparkles, Calculator, Bot, HelpCircle, Lightbulb,
  Trophy, Flame, Star,
} from 'lucide-react';
import { toast } from 'sonner';
import type { FinancialLesson, UserLessonProgress, Transaction, Category, Budget, SavingsGoal, Account } from '@/types/finance';
import FinancialCalculators from './FinancialCalculators';
import AIFinancialCoach from './AIFinancialCoach';
import FinancialQuizzes from './FinancialQuizzes';
import FinancialTipsFeed from './FinancialTipsFeed';

interface FinancialLessonsProps {
  transactions?: Transaction[];
  categories?: Category[];
  budgets?: Budget[];
  savingsGoals?: SavingsGoal[];
  accounts?: Account[];
}

export default function FinancialLessons({ transactions = [], categories = [], budgets = [], savingsGoals = [], accounts = [] }: FinancialLessonsProps) {
  const [lessons, setLessons] = useState<FinancialLesson[]>([]);
  const [progress, setProgress] = useState<UserLessonProgress[]>([]);
  const [selectedLesson, setSelectedLesson] = useState<FinancialLesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('lessons');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  useEffect(() => { fetchLessons(); }, []);

  const fetchLessons = async () => {
    try {
      const [lessonsRes, progressRes] = await Promise.all([
        supabase.from('financial_lessons').select('*').order('order_index'),
        supabase.from('user_lesson_progress').select('*'),
      ]);
      if (lessonsRes.data) setLessons(lessonsRes.data as FinancialLesson[]);
      if (progressRes.data) setProgress(progressRes.data as UserLessonProgress[]);
    } catch (error) {
      console.error('Error fetching lessons:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsComplete = async (lessonId: string) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');
      if (progress.some(p => p.lesson_id === lessonId)) { toast.info('Already completed!'); return; }

      const { error } = await supabase.from('user_lesson_progress').insert({
        user_id: userData.user.id,
        lesson_id: lessonId,
      });
      if (error) throw error;

      const completedCount = progress.length + 1;
      const milestones = [5, 10, 20, 50];
      const milestone = milestones.find(m => completedCount === m);
      if (milestone) toast.success(`🏆 ${milestone} lessons completed! Keep it up!`);
      else toast.success('Lesson completed! Keep learning!');

      fetchLessons();
      setSelectedLesson(null);
    } catch (error: any) {
      toast.error(error.message || 'Failed to mark lesson complete');
    }
  };

  const isCompleted = (lessonId: string) => progress.some(p => p.lesson_id === lessonId);
  const completedCount = progress.length;
  const totalCount = lessons.length;
  const completionPercentage = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  const lessonCategories = useMemo(() => {
    const cats = [...new Set(lessons.map(l => l.category))];
    return cats;
  }, [lessons]);

  const filteredLessons = useMemo(() => {
    if (!categoryFilter) return lessons;
    return lessons.filter(l => l.category === categoryFilter);
  }, [lessons, categoryFilter]);

  // Recommended: incomplete lessons from categories with most completions
  const recommended = useMemo(() => {
    const incomplete = lessons.filter(l => !isCompleted(l.id));
    return incomplete.slice(0, 3);
  }, [lessons, progress]);

  // Continue learning: next incomplete after last completed
  const continueLesson = useMemo(() => {
    if (progress.length === 0) return lessons[0] || null;
    const lastCompletedId = progress[progress.length - 1]?.lesson_id;
    const idx = lessons.findIndex(l => l.id === lastCompletedId);
    for (let i = idx + 1; i < lessons.length; i++) {
      if (!isCompleted(lessons[i].id)) return lessons[i];
    }
    return lessons.find(l => !isCompleted(l.id)) || null;
  }, [lessons, progress]);

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'basics': return '📚';
      case 'budgeting': return '📊';
      case 'savings': return '🐷';
      case 'security': return '🔒';
      case 'investing': return '📈';
      case 'business': return '💼';
      case 'tracking': return '📝';
      default: return '💡';
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-[hsl(var(--income))]/20 text-[hsl(var(--income))]';
      case 'intermediate': return 'bg-[hsl(var(--warning))]/20 text-[hsl(var(--warning))]';
      case 'advanced': return 'bg-destructive/20 text-destructive';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  if (loading) {
    return <Card><CardContent className="p-6"><div className="animate-pulse">Loading lessons...</div></CardContent></Card>;
  }

  // Lesson detail view
  if (selectedLesson) {
    return (
      <Card variant="glass">
        <CardHeader>
          <Button variant="ghost" size="sm" onClick={() => setSelectedLesson(null)}>← Back to Lessons</Button>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl">{getCategoryIcon(selectedLesson.category)}</span>
              <div>
                <h2 className="text-xl font-bold">{selectedLesson.title}</h2>
                <div className="flex items-center gap-3 mt-1">
                  <span className={`text-xs px-2 py-1 rounded-full ${getDifficultyColor(selectedLesson.difficulty)}`}>
                    {selectedLesson.difficulty}
                  </span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {selectedLesson.duration_minutes} min
                  </span>
                  <span className="text-xs text-muted-foreground capitalize">{selectedLesson.category}</span>
                </div>
              </div>
            </div>

            <div className="prose prose-invert max-w-none">
              <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">{selectedLesson.content}</p>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            {isCompleted(selectedLesson.id) ? (
              <div className="flex items-center gap-2 text-[hsl(var(--income))]">
                <CheckCircle className="w-5 h-5" /> Completed
              </div>
            ) : (
              <Button onClick={() => markAsComplete(selectedLesson.id)}>
                <CheckCircle className="w-4 h-4 mr-2" /> Mark as Complete
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <GraduationCap className="w-5 h-5" /> Financial Education
        </h2>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Award className="w-4 h-4 text-[hsl(var(--warning))]" />
          {completedCount}/{totalCount} lessons
        </div>
      </div>

      {/* Progress Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <BookOpen className="w-5 h-5 mx-auto mb-1 text-primary" />
            <p className="text-xs text-muted-foreground">Lessons</p>
            <p className="text-lg font-bold">{totalCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <CheckCircle className="w-5 h-5 mx-auto mb-1 text-[hsl(var(--income))]" />
            <p className="text-xs text-muted-foreground">Completed</p>
            <p className="text-lg font-bold">{completedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Star className="w-5 h-5 mx-auto mb-1 text-[hsl(var(--warning))]" />
            <p className="text-xs text-muted-foreground">Progress</p>
            <p className="text-lg font-bold">{Math.round(completionPercentage)}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Trophy className="w-5 h-5 mx-auto mb-1 text-primary" />
            <p className="text-xs text-muted-foreground">Categories</p>
            <p className="text-lg font-bold">{categories.length}</p>
          </CardContent>
        </Card>
      </div>

      <Progress value={completionPercentage} className="h-2" />

      {/* Continue Learning */}
      {continueLesson && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4">
            <p className="text-xs text-primary font-medium mb-2 flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Continue Learning
            </p>
            <button
              onClick={() => setSelectedLesson(continueLesson)}
              className="w-full flex items-center gap-3 text-left"
            >
              <span className="text-2xl">{getCategoryIcon(continueLesson.category)}</span>
              <div className="flex-1">
                <p className="font-semibold text-sm">{continueLesson.title}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${getDifficultyColor(continueLesson.difficulty)}`}>
                    {continueLesson.difficulty}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{continueLesson.duration_minutes} min</span>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-primary" />
            </button>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-muted/50">
          <TabsTrigger value="lessons" className="gap-1"><BookOpen className="w-3.5 h-3.5" /> Lessons</TabsTrigger>
          <TabsTrigger value="quizzes" className="gap-1"><HelpCircle className="w-3.5 h-3.5" /> Quizzes</TabsTrigger>
          <TabsTrigger value="tools" className="gap-1"><Calculator className="w-3.5 h-3.5" /> Tools</TabsTrigger>
          <TabsTrigger value="coach" className="gap-1"><Bot className="w-3.5 h-3.5" /> AI Coach</TabsTrigger>
          <TabsTrigger value="tips" className="gap-1"><Lightbulb className="w-3.5 h-3.5" /> Tips</TabsTrigger>
        </TabsList>

        {/* Lessons Tab */}
        <TabsContent value="lessons" className="space-y-4">
          {/* Category Filter */}
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={categoryFilter === null ? 'default' : 'outline'}
              onClick={() => setCategoryFilter(null)}
              className="text-xs"
            >All</Button>
            {categories.map(cat => (
              <Button
                key={cat}
                size="sm"
                variant={categoryFilter === cat ? 'default' : 'outline'}
                onClick={() => setCategoryFilter(cat)}
                className="text-xs"
              >
                {getCategoryIcon(cat)} {cat}
              </Button>
            ))}
          </div>

          {/* Recommended */}
          {!categoryFilter && recommended.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Recommended for You
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {recommended.map(lesson => (
                  <button
                    key={lesson.id}
                    onClick={() => setSelectedLesson(lesson)}
                    className="p-3 rounded-lg bg-muted/30 hover:bg-muted/50 border border-border transition-all text-left"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span>{getCategoryIcon(lesson.category)}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${getDifficultyColor(lesson.difficulty)}`}>
                        {lesson.difficulty}
                      </span>
                    </div>
                    <p className="text-sm font-medium truncate">{lesson.title}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{lesson.duration_minutes} min</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Full Lessons List */}
          <div className="space-y-2">
            {filteredLessons.map((lesson) => {
              const completed = isCompleted(lesson.id);
              return (
                <button
                  key={lesson.id}
                  onClick={() => setSelectedLesson(lesson)}
                  className={`w-full p-3 rounded-lg flex items-center gap-3 transition-all text-left ${
                    completed
                      ? 'bg-[hsl(var(--income))]/5 border border-[hsl(var(--income))]/20'
                      : 'bg-muted/30 hover:bg-muted/50 border border-transparent'
                  }`}
                >
                  <span className="text-xl shrink-0">{completed ? '✅' : getCategoryIcon(lesson.category)}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium text-sm truncate ${completed ? 'text-[hsl(var(--income))]' : ''}`}>
                      {lesson.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${getDifficultyColor(lesson.difficulty)}`}>
                        {lesson.difficulty}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{lesson.duration_minutes} min</span>
                      <span className="text-[10px] text-muted-foreground capitalize">{lesson.category}</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </button>
              );
            })}
            {filteredLessons.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">No lessons in this category yet</p>
            )}
          </div>
        </TabsContent>

        {/* Quizzes Tab */}
        <TabsContent value="quizzes">
          <FinancialQuizzes />
        </TabsContent>

        {/* Tools Tab */}
        <TabsContent value="tools">
          <FinancialCalculators />
        </TabsContent>

        {/* AI Coach Tab */}
        <TabsContent value="coach">
          <AIFinancialCoach />
        </TabsContent>

        {/* Tips Tab */}
        <TabsContent value="tips">
          <FinancialTipsFeed />
        </TabsContent>
      </Tabs>
    </div>
  );
}
