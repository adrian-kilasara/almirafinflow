import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { HelpCircle, CheckCircle, XCircle, RotateCcw, Trophy } from 'lucide-react';

interface Question {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

const quizzes: { category: string; icon: string; questions: Question[] }[] = [
  {
    category: 'Budgeting Basics',
    icon: '📊',
    questions: [
      {
        question: 'What is the 50/30/20 budgeting rule?',
        options: ['50% savings, 30% needs, 20% wants', '50% needs, 30% wants, 20% savings', '50% wants, 30% savings, 20% needs', '50% investments, 30% needs, 20% wants'],
        correctIndex: 1,
        explanation: 'The 50/30/20 rule allocates 50% of income to needs, 30% to wants, and 20% to savings and debt repayment.',
      },
      {
        question: 'What is an emergency fund typically recommended to cover?',
        options: ['1 month of expenses', '3-6 months of expenses', '1 year of expenses', '2 weeks of expenses'],
        correctIndex: 1,
        explanation: 'Financial experts recommend 3-6 months of living expenses in an emergency fund.',
      },
      {
        question: 'Which is the best strategy to avoid overspending?',
        options: ['Use only credit cards', 'Track all expenses', 'Spend first, save later', 'Ignore small purchases'],
        correctIndex: 1,
        explanation: 'Tracking expenses helps identify spending patterns and prevent overspending.',
      },
    ],
  },
  {
    category: 'Saving Strategies',
    icon: '🐷',
    questions: [
      {
        question: 'What is "paying yourself first"?',
        options: ['Buying what you want first', 'Saving before spending', 'Taking a salary advance', 'Investing in yourself only'],
        correctIndex: 1,
        explanation: 'Paying yourself first means setting aside savings before spending on anything else.',
      },
      {
        question: 'What is the benefit of automated savings?',
        options: ['Higher interest rates', 'Removes the temptation to spend', 'Locks your money permanently', 'No benefit over manual saving'],
        correctIndex: 1,
        explanation: 'Automated savings removes the temptation to spend money that should be saved.',
      },
      {
        question: 'Round-up savings means:',
        options: ['Rounding up your salary', 'Saving spare change from transactions', 'Doubling your savings monthly', 'Rounding down expenses'],
        correctIndex: 1,
        explanation: 'Round-up savings automatically saves the spare change from each transaction.',
      },
    ],
  },
  {
    category: 'Investing Fundamentals',
    icon: '📈',
    questions: [
      {
        question: 'What is compound interest?',
        options: ['Interest on the principal only', 'Interest on both principal and accumulated interest', 'A fixed interest payment', 'Interest paid only at maturity'],
        correctIndex: 1,
        explanation: 'Compound interest is interest earned on both the initial principal and previously accumulated interest.',
      },
      {
        question: 'What does diversification mean in investing?',
        options: ['Putting all money in one stock', 'Spreading investments across different assets', 'Only investing in bonds', 'Investing in one sector'],
        correctIndex: 1,
        explanation: 'Diversification means spreading investments to reduce risk.',
      },
      {
        question: 'What is the primary risk of investing in stocks?',
        options: ['No risk at all', 'Market volatility and potential loss', 'Guaranteed returns', 'Fixed income only'],
        correctIndex: 1,
        explanation: 'Stocks carry market risk — their value can go up or down.',
      },
    ],
  },
];

export default function FinancialQuizzes() {
  const [selectedQuiz, setSelectedQuiz] = useState<number | null>(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [completed, setCompleted] = useState(false);

  const quiz = selectedQuiz !== null ? quizzes[selectedQuiz] : null;
  const question = quiz ? quiz.questions[currentQ] : null;

  const handleAnswer = (idx: number) => {
    if (answered) return;
    setSelectedAnswer(idx);
    setAnswered(true);
    if (idx === question!.correctIndex) setScore(s => s + 1);
  };

  const nextQuestion = () => {
    if (currentQ + 1 >= quiz!.questions.length) {
      setCompleted(true);
    } else {
      setCurrentQ(c => c + 1);
      setSelectedAnswer(null);
      setAnswered(false);
    }
  };

  const resetQuiz = () => {
    setSelectedQuiz(null);
    setCurrentQ(0);
    setSelectedAnswer(null);
    setAnswered(false);
    setScore(0);
    setCompleted(false);
  };

  if (completed && quiz) {
    const pct = (score / quiz.questions.length) * 100;
    return (
      <Card>
        <CardContent className="p-6 text-center space-y-4">
          <Trophy className={`w-12 h-12 mx-auto ${pct >= 70 ? 'text-[hsl(var(--warning))]' : 'text-muted-foreground'}`} />
          <h3 className="text-lg font-bold">{quiz.category} — Results</h3>
          <p className="text-2xl font-bold font-mono">{score}/{quiz.questions.length}</p>
          <p className="text-sm text-muted-foreground">
            {pct >= 90 ? 'Excellent! You\'re a financial expert!' : pct >= 70 ? 'Great job! Keep learning!' : 'Keep studying, you\'ll get there!'}
          </p>
          <Progress value={pct} className={pct >= 70 ? '[&>div]:bg-[hsl(var(--income))]' : ''} />
          <Button onClick={resetQuiz} variant="outline"><RotateCcw className="w-4 h-4 mr-1" /> Try Another Quiz</Button>
        </CardContent>
      </Card>
    );
  }

  if (quiz && question) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center justify-between">
            <span>{quiz.icon} {quiz.category}</span>
            <span className="text-xs text-muted-foreground">{currentQ + 1}/{quiz.questions.length}</span>
          </CardTitle>
          <Progress value={((currentQ + 1) / quiz.questions.length) * 100} className="h-1" />
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="font-medium text-sm">{question.question}</p>
          <div className="space-y-2">
            {question.options.map((opt, i) => {
              let cls = 'border border-border hover:bg-muted/50';
              if (answered) {
                if (i === question.correctIndex) cls = 'border-[hsl(var(--income))] bg-[hsl(var(--income))]/10';
                else if (i === selectedAnswer) cls = 'border-destructive bg-destructive/10';
                else cls = 'border-border opacity-50';
              }
              return (
                <button
                  key={i}
                  onClick={() => handleAnswer(i)}
                  disabled={answered}
                  className={`w-full text-left p-3 rounded-lg text-sm transition-all flex items-center gap-2 ${cls}`}
                >
                  {answered && i === question.correctIndex && <CheckCircle className="w-4 h-4 text-[hsl(var(--income))] shrink-0" />}
                  {answered && i === selectedAnswer && i !== question.correctIndex && <XCircle className="w-4 h-4 text-destructive shrink-0" />}
                  {!answered && <span className="w-5 h-5 rounded-full border border-border flex items-center justify-center text-xs shrink-0">{String.fromCharCode(65 + i)}</span>}
                  {opt}
                </button>
              );
            })}
          </div>
          {answered && (
            <div className="p-3 rounded-lg bg-muted/50 border border-border">
              <p className="text-xs text-muted-foreground">{question.explanation}</p>
            </div>
          )}
          {answered && (
            <div className="flex justify-end">
              <Button size="sm" onClick={nextQuestion}>
                {currentQ + 1 >= quiz.questions.length ? 'See Results' : 'Next Question'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <HelpCircle className="w-4 h-4 text-primary" /> Knowledge Quizzes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {quizzes.map((q, i) => (
          <button
            key={i}
            onClick={() => { setSelectedQuiz(i); setCurrentQ(0); setScore(0); setAnswered(false); setSelectedAnswer(null); setCompleted(false); }}
            className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors text-left"
          >
            <span className="text-xl">{q.icon}</span>
            <div className="flex-1">
              <p className="font-medium text-sm">{q.category}</p>
              <p className="text-xs text-muted-foreground">{q.questions.length} questions</p>
            </div>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}
