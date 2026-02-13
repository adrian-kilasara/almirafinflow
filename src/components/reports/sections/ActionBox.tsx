import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2 } from 'lucide-react';

interface Props {
  items: string[];
  spendingSpike: { pctAbove: number } | null;
}

export default function ActionBox({ items, spendingSpike }: Props) {
  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <CheckCircle2 className="w-4 h-4 text-primary" /> What To Do Now
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {spendingSpike && (
          <div className="p-2 rounded-lg bg-expense/10 border border-expense/20 text-xs text-expense">
            ⚠️ Today you spent {spendingSpike.pctAbove}% more than your 7-day average
          </div>
        )}
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-2 text-sm">
            <span className="text-primary mt-0.5 font-bold text-xs">{i + 1}.</span>
            <span className="text-foreground/90">{item}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
