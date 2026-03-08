import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Lightbulb, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

const ALL_TIPS = [
  { tip: "Save at least 20% of your income every month.", category: "savings" },
  { tip: "Build a 3-6 month emergency fund before investing.", category: "savings" },
  { tip: "Track every expense — what gets measured gets managed.", category: "budgeting" },
  { tip: "Avoid high-interest credit card debt at all costs.", category: "debt" },
  { tip: "Compound interest is the 8th wonder of the world — start investing early.", category: "investing" },
  { tip: "Automate your savings so you never forget to save.", category: "savings" },
  { tip: "Review your subscriptions monthly — cancel what you don't use.", category: "budgeting" },
  { tip: "Diversify investments across asset classes to reduce risk.", category: "investing" },
  { tip: "Use the 24-hour rule: wait before making non-essential purchases.", category: "spending" },
  { tip: "Set financial goals with specific amounts and deadlines.", category: "planning" },
  { tip: "Pay yourself first — save before you spend.", category: "savings" },
  { tip: "Know the difference between needs and wants.", category: "budgeting" },
  { tip: "Consider mobile money savings accounts for higher interest rates.", category: "savings" },
  { tip: "Negotiate bills and rates regularly — a 5-minute call can save thousands.", category: "spending" },
  { tip: "Build multiple income streams for financial security.", category: "income" },
  { tip: "Protect your finances with insurance — health, life, and property.", category: "security" },
];

export default function FinancialTipsFeed() {
  const [refreshKey, setRefreshKey] = useState(0);

  const tips = useMemo(() => {
    const shuffled = [...ALL_TIPS].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 6);
  }, [refreshKey]);

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'savings': return 'bg-[hsl(var(--income))]/10 text-[hsl(var(--income))]';
      case 'budgeting': return 'bg-primary/10 text-primary';
      case 'investing': return 'bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))]';
      case 'debt': return 'bg-destructive/10 text-destructive';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-[hsl(var(--warning))]" /> Daily Financial Tips
          </span>
          <Button variant="ghost" size="icon" onClick={() => setRefreshKey(k => k + 1)}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {tips.map((t, i) => (
          <div key={`${refreshKey}-${i}`} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border">
            <Lightbulb className="w-4 h-4 text-[hsl(var(--warning))] shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm">{t.tip}</p>
              <span className={`text-[10px] px-1.5 py-0.5 rounded mt-1 inline-block ${getCategoryColor(t.category)}`}>
                {t.category}
              </span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
