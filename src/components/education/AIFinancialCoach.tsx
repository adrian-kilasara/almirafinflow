import { useState, useRef, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Bot, Send, Loader2, User, Sparkles, TrendingUp, PiggyBank, ShieldCheck, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { useSettings } from '@/hooks/useSettings';
import type { Account, Transaction, Category, Budget, SavingsGoal } from '@/types/finance';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface AIFinancialCoachProps {
  accounts?: Account[];
  transactions?: Transaction[];
  categories?: Category[];
  budgets?: Budget[];
  savingsGoals?: SavingsGoal[];
}

const SUGGESTED_QUESTIONS = [
  { icon: TrendingUp, text: "Analyze my spending and suggest where I can save", color: "text-[hsl(var(--income))]" },
  { icon: PiggyBank, text: "Create a savings plan to grow my wealth this year", color: "text-primary" },
  { icon: ShieldCheck, text: "How healthy are my finances? Give me a score breakdown", color: "text-[hsl(var(--chart-3))]" },
  { icon: Sparkles, text: "What's the best investment strategy for my income level?", color: "text-[hsl(var(--warning))]" },
];

const QUICK_PROMPTS = [
  "How to reduce expenses?",
  "Emergency fund tips",
  "Debt payoff strategy",
  "Budget optimization",
  "Mobile money investing",
  "SACCO vs bank savings",
];

export default function AIFinancialCoach({
  accounts = [],
  transactions = [],
  categories = [],
  budgets = [],
  savingsGoals = [],
}: AIFinancialCoachProps) {
  const { settings } = useSettings();
  const CHAT_KEY = 'finflow:coach:chat';
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const raw = localStorage.getItem(CHAT_KEY);
      return raw ? (JSON.parse(raw) as Message[]) : [];
    } catch { return []; }
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Persist chat across reloads
  useEffect(() => {
    try { localStorage.setItem(CHAT_KEY, JSON.stringify(messages)); } catch { /* ignore */ }
  }, [messages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingContent]);

  // Build financial context from real data
  const financialContext = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    const monthTxns = transactions.filter(t => t.date >= monthStart && t.date <= monthEnd);

    const monthlyIncome = monthTxns.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
    const monthlyExpenses = monthTxns.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
    const netWorth = accounts.reduce((s, a) => s + Number(a.balance), 0);

    // Top spending categories
    const catSpending: Record<string, { name: string; amount: number }> = {};
    monthTxns.filter(t => t.type === 'expense').forEach(t => {
      const cat = categories.find(c => c.id === t.category_id);
      const catName = cat?.name || 'Uncategorized';
      if (!catSpending[catName]) catSpending[catName] = { name: catName, amount: 0 };
      catSpending[catName].amount += Number(t.amount);
    });
    const topCategories = Object.values(catSpending).sort((a, b) => b.amount - a.amount).slice(0, 5);

    // Budget status
    const budgetStatus = budgets.map(b => {
      const spent = monthTxns
        .filter(t => t.type === 'expense' && (b.category_id ? t.category_id === b.category_id : true))
        .reduce((s, t) => s + Number(t.amount), 0);
      const limit = Number(b.amount);
      return { name: b.name, spent, limit, percentage: Math.round((spent / limit) * 100), over: spent > limit };
    });

    // Savings progress
    const savingsProgress = savingsGoals.map(g => ({
      name: g.name,
      current: Number(g.current_amount),
      target: Number(g.target_amount),
      percentage: Math.round((Number(g.current_amount) / Number(g.target_amount)) * 100),
    }));

    return {
      netWorth,
      currency: settings.default_currency,
      riskTolerance: settings.ai_risk_tolerance,
      adviceMode: settings.ai_advice_mode,
      monthlyIncome,
      monthlyExpenses,
      netCashFlow: monthlyIncome - monthlyExpenses,
      savingsRate: monthlyIncome > 0 ? Math.round(((monthlyIncome - monthlyExpenses) / monthlyIncome) * 100) : 0,
      healthScore: Math.min(100, Math.round(
        (accounts.length > 0 ? 20 : 0) +
        (transactions.length >= 10 ? 20 : transactions.length * 2) +
        (budgets.length > 0 ? 20 : 0) +
        (savingsGoals.length > 0 ? 20 : 0) +
        ((monthlyIncome > 0 && (monthlyIncome - monthlyExpenses) / monthlyIncome >= 0.2) ? 20 : 10)
      )),
      accountCount: accounts.length,
      budgetCount: budgets.length,
      savingsGoalCount: savingsGoals.length,
      topCategories,
      budgetStatus,
      savingsProgress,
    };
  }, [accounts, transactions, categories, budgets, savingsGoals, settings.default_currency, settings.ai_risk_tolerance, settings.ai_advice_mode]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: Message = { role: 'user', content: text.trim() };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setLoading(true);
    setStreamingContent('');

    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/financial-coach`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            messages: updatedMessages,
            financialContext,
          }),
        }
      );

      if (!resp.ok) {
        if (resp.status === 429) { toast.error('Too many requests. Please wait a moment.'); return; }
        if (resp.status === 402) { toast.error('AI credits exhausted. Add credits in workspace settings.'); return; }
        throw new Error('Failed to get AI response');
      }

      if (!resp.body) throw new Error('No response body');

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let assistantSoFar = '';
      let textBuffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantSoFar += content;
              setStreamingContent(assistantSoFar);
            }
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }

      // Flush remaining
      if (textBuffer.trim()) {
        for (let raw of textBuffer.split('\n')) {
          if (!raw) continue;
          if (raw.endsWith('\r')) raw = raw.slice(0, -1);
          if (raw.startsWith(':') || raw.trim() === '') continue;
          if (!raw.startsWith('data: ')) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) assistantSoFar += content;
          } catch { /* ignore */ }
        }
      }

      setMessages(prev => [...prev, { role: 'assistant', content: assistantSoFar }]);
      setStreamingContent('');
    } catch (e: any) {
      toast.error(e.message || 'Failed to get response');
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setStreamingContent('');
    try { localStorage.removeItem(CHAT_KEY); } catch { /* ignore */ }
  };

  return (
    <Card className="flex flex-col h-[600px] overflow-hidden border-primary/10">
      <CardHeader className="pb-3 shrink-0 border-b border-border bg-card">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Bot className="w-4 h-4 text-primary" />
            </div>
            <div>
              <span>FinFlow AI Coach</span>
              <p className="text-xs font-normal text-muted-foreground">Powered by AI • Analyzes your real financial data</p>
            </div>
          </CardTitle>
          {messages.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearChat} className="text-muted-foreground">
              <RotateCcw className="w-3.5 h-3.5 mr-1" /> Clear
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col overflow-hidden p-0">
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          <AnimatePresence mode="popLayout">
            {messages.length === 0 && !streamingContent ? (
              <motion.div
                key="welcome"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-5 py-2"
              >
                {/* Financial snapshot pills */}
                <div className="flex flex-wrap gap-2 justify-center">
                  <div className="px-3 py-1.5 rounded-full bg-muted/50 border border-border text-xs">
                    💰 Net Worth: <span className="font-mono font-semibold text-foreground">{financialContext.netWorth.toLocaleString()}</span>
                  </div>
                  <div className="px-3 py-1.5 rounded-full bg-muted/50 border border-border text-xs">
                    📊 Health: <span className="font-mono font-semibold text-primary">{financialContext.healthScore}/100</span>
                  </div>
                  <div className="px-3 py-1.5 rounded-full bg-muted/50 border border-border text-xs">
                    📈 Savings Rate: <span className="font-mono font-semibold text-[hsl(var(--income))]">{financialContext.savingsRate}%</span>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground text-center max-w-md mx-auto">
                  I have access to your real financial data. Ask me anything about your finances and I'll give you personalized, actionable advice.
                </p>

                {/* Main suggested questions */}
                <div className="grid gap-2">
                  {SUGGESTED_QUESTIONS.map((q, i) => {
                    const Icon = q.icon;
                    return (
                      <motion.button
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.08 }}
                        onClick={() => sendMessage(q.text)}
                        className="flex items-center gap-3 text-left p-3 rounded-xl border border-border hover:bg-muted/50 hover:border-primary/20 transition-all group"
                      >
                        <div className={`w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform ${q.color}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">{q.text}</span>
                      </motion.button>
                    );
                  })}
                </div>

                {/* Quick prompt chips */}
                <div className="flex flex-wrap gap-1.5 justify-center pt-1">
                  {QUICK_PROMPTS.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(q)}
                      className="text-xs px-3 py-1.5 rounded-full border border-border hover:bg-primary/10 hover:border-primary/30 hover:text-primary transition-all text-muted-foreground"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </motion.div>
            ) : (
              <>
                {messages.map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {msg.role === 'assistant' && (
                      <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-1">
                        <Bot className="w-3.5 h-3.5 text-primary" />
                      </div>
                    )}
                    <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground rounded-br-md'
                        : 'bg-muted/50 border border-border rounded-bl-md'
                    }`}>
                      {msg.role === 'assistant' ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1.5 prose-ul:my-1.5 prose-li:my-0.5 prose-headings:my-2 prose-strong:text-foreground">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      ) : (
                        msg.content
                      )}
                    </div>
                    {msg.role === 'user' && (
                      <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-1">
                        <User className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </motion.div>
                ))}
              </>
            )}
          </AnimatePresence>

          {/* Streaming indicator */}
          {streamingContent && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex gap-2.5"
            >
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-1">
                <Bot className="w-3.5 h-3.5 text-primary" />
              </div>
              <div className="max-w-[85%] rounded-2xl rounded-bl-md px-4 py-3 text-sm bg-muted/50 border border-border">
                <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1.5 prose-ul:my-1.5 prose-li:my-0.5 prose-headings:my-2 prose-strong:text-foreground">
                  <ReactMarkdown>{streamingContent}</ReactMarkdown>
                </div>
              </div>
            </motion.div>
          )}

          {/* Loading dots */}
          {loading && !streamingContent && (
            <div className="flex gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Bot className="w-3.5 h-3.5 text-primary" />
              </div>
              <div className="bg-muted/50 border border-border rounded-2xl rounded-bl-md px-4 py-3 flex gap-1">
                <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="p-3 border-t border-border shrink-0 bg-card/50">
          <form onSubmit={(e) => { e.preventDefault(); sendMessage(input); }} className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your finances..."
              disabled={loading}
              className="flex-1 rounded-xl bg-muted/30 border-border/50 focus-visible:border-primary/40"
            />
            <Button
              type="submit"
              size="icon"
              disabled={loading || !input.trim()}
              className="rounded-xl shrink-0"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}
