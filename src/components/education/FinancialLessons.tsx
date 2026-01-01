import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  GraduationCap, BookOpen, CheckCircle, Clock, 
  ChevronRight, Award, Sparkles 
} from 'lucide-react';
import { toast } from 'sonner';
import type { FinancialLesson, UserLessonProgress } from '@/types/finance';

export default function FinancialLessons() {
  const [lessons, setLessons] = useState<FinancialLesson[]>([]);
  const [progress, setProgress] = useState<UserLessonProgress[]>([]);
  const [selectedLesson, setSelectedLesson] = useState<FinancialLesson | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLessons();
  }, []);

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

      // Check if already completed
      if (progress.some(p => p.lesson_id === lessonId)) {
        toast.info('Lesson already completed!');
        return;
      }

      const { error } = await supabase.from('user_lesson_progress').insert({
        user_id: userData.user.id,
        lesson_id: lessonId,
      });

      if (error) throw error;

      toast.success('Lesson completed! Keep learning!');
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
      case 'beginner': return 'bg-income/20 text-income';
      case 'intermediate': return 'bg-warning/20 text-warning';
      case 'advanced': return 'bg-expense/20 text-expense';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse">Loading lessons...</div>
        </CardContent>
      </Card>
    );
  }

  if (selectedLesson) {
    return (
      <Card variant="glass">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setSelectedLesson(null)}
            >
              ← Back
            </Button>
          </div>
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
                    <Clock className="w-3 h-3" />
                    {selectedLesson.duration_minutes} min
                  </span>
                </div>
              </div>
            </div>
            
            <div className="prose prose-invert max-w-none">
              <p className="text-muted-foreground leading-relaxed">
                {selectedLesson.content}
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            {isCompleted(selectedLesson.id) ? (
              <div className="flex items-center gap-2 text-income">
                <CheckCircle className="w-5 h-5" />
                <span>Completed</span>
              </div>
            ) : (
              <Button onClick={() => markAsComplete(selectedLesson.id)}>
                <CheckCircle className="w-4 h-4 mr-2" />
                Mark as Complete
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-primary" />
            Financial Education
          </div>
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-warning" />
            <span className="text-sm font-normal">
              {completedCount}/{totalCount} lessons
            </span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Your Progress</span>
            <span className="font-medium">{Math.round(completionPercentage)}%</span>
          </div>
          <Progress value={completionPercentage} className="h-2" />
        </div>

        {/* Lessons List */}
        <div className="space-y-2">
          {lessons.map((lesson) => {
            const completed = isCompleted(lesson.id);
            return (
              <button
                key={lesson.id}
                onClick={() => setSelectedLesson(lesson)}
                className={`w-full p-3 rounded-lg flex items-center gap-3 transition-all text-left ${
                  completed
                    ? 'bg-income/5 border border-income/20'
                    : 'bg-muted/30 hover:bg-muted/50 border border-transparent'
                }`}
              >
                <span className="text-xl flex-shrink-0">
                  {completed ? '✅' : getCategoryIcon(lesson.category)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className={`font-medium text-sm truncate ${completed ? 'text-income' : ''}`}>
                    {lesson.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${getDifficultyColor(lesson.difficulty)}`}>
                      {lesson.difficulty}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {lesson.duration_minutes} min
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
