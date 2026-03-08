import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { formatCurrency } from '@/lib/format';
import { Calculator, TrendingUp, Landmark, PiggyBank } from 'lucide-react';

type CalcType = 'savings' | 'compound' | 'loan';

export default function FinancialCalculators() {
  const [activeCalc, setActiveCalc] = useState<CalcType>('savings');

  // Savings calculator state
  const [savingsMonthly, setSavingsMonthly] = useState(10000);
  const [savingsMonths, setSavingsMonths] = useState(12);
  const [savingsRate, setSavingsRate] = useState(5);

  // Compound interest state
  const [compPrincipal, setCompPrincipal] = useState(100000);
  const [compRate, setCompRate] = useState(8);
  const [compYears, setCompYears] = useState(10);

  // Loan calculator state
  const [loanAmount, setLoanAmount] = useState(500000);
  const [loanRate, setLoanRate] = useState(12);
  const [loanMonths, setLoanMonths] = useState(24);

  const savingsResult = useMemo(() => {
    const r = savingsRate / 100 / 12;
    if (r === 0) return savingsMonthly * savingsMonths;
    return savingsMonthly * ((Math.pow(1 + r, savingsMonths) - 1) / r);
  }, [savingsMonthly, savingsMonths, savingsRate]);

  const compoundResult = useMemo(() => {
    return compPrincipal * Math.pow(1 + compRate / 100, compYears);
  }, [compPrincipal, compRate, compYears]);

  const loanResult = useMemo(() => {
    const r = loanRate / 100 / 12;
    if (r === 0) return loanAmount / loanMonths;
    return (loanAmount * r * Math.pow(1 + r, loanMonths)) / (Math.pow(1 + r, loanMonths) - 1);
  }, [loanAmount, loanRate, loanMonths]);

  const calcs = [
    { id: 'savings' as CalcType, label: 'Savings', icon: PiggyBank },
    { id: 'compound' as CalcType, label: 'Compound Interest', icon: TrendingUp },
    { id: 'loan' as CalcType, label: 'Loan Repayment', icon: Landmark },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Calculator className="w-4 h-4 text-primary" /> Financial Calculators
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          {calcs.map(c => {
            const Icon = c.icon;
            return (
              <Button
                key={c.id}
                size="sm"
                variant={activeCalc === c.id ? 'default' : 'outline'}
                onClick={() => setActiveCalc(c.id)}
                className="text-xs"
              >
                <Icon className="w-3.5 h-3.5 mr-1" /> {c.label}
              </Button>
            );
          })}
        </div>

        {activeCalc === 'savings' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs">Monthly Savings: {formatCurrency(savingsMonthly)}</Label>
              <Slider value={[savingsMonthly]} onValueChange={([v]) => setSavingsMonthly(v)} min={1000} max={100000} step={1000} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Duration: {savingsMonths} months</Label>
              <Slider value={[savingsMonths]} onValueChange={([v]) => setSavingsMonths(v)} min={1} max={120} step={1} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Annual Interest Rate: {savingsRate}%</Label>
              <Slider value={[savingsRate]} onValueChange={([v]) => setSavingsRate(v)} min={0} max={20} step={0.5} />
            </div>
            <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 text-center">
              <p className="text-xs text-muted-foreground">Total Savings After {savingsMonths} Months</p>
              <p className="text-2xl font-bold font-mono text-primary">{formatCurrency(savingsResult)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Deposited: {formatCurrency(savingsMonthly * savingsMonths)} • Interest: {formatCurrency(savingsResult - savingsMonthly * savingsMonths)}
              </p>
            </div>
          </div>
        )}

        {activeCalc === 'compound' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs">Initial Investment: {formatCurrency(compPrincipal)}</Label>
              <Slider value={[compPrincipal]} onValueChange={([v]) => setCompPrincipal(v)} min={10000} max={5000000} step={10000} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Annual Return: {compRate}%</Label>
              <Slider value={[compRate]} onValueChange={([v]) => setCompRate(v)} min={1} max={30} step={0.5} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Years: {compYears}</Label>
              <Slider value={[compYears]} onValueChange={([v]) => setCompYears(v)} min={1} max={40} step={1} />
            </div>
            <div className="p-4 rounded-xl bg-[hsl(var(--income))]/5 border border-[hsl(var(--income))]/20 text-center">
              <p className="text-xs text-muted-foreground">Future Value After {compYears} Years</p>
              <p className="text-2xl font-bold font-mono text-[hsl(var(--income))]">{formatCurrency(compoundResult)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Growth: {formatCurrency(compoundResult - compPrincipal)} ({((compoundResult / compPrincipal - 1) * 100).toFixed(0)}%)
              </p>
            </div>
          </div>
        )}

        {activeCalc === 'loan' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs">Loan Amount: {formatCurrency(loanAmount)}</Label>
              <Slider value={[loanAmount]} onValueChange={([v]) => setLoanAmount(v)} min={10000} max={10000000} step={10000} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Annual Interest Rate: {loanRate}%</Label>
              <Slider value={[loanRate]} onValueChange={([v]) => setLoanRate(v)} min={1} max={30} step={0.5} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Repayment Period: {loanMonths} months</Label>
              <Slider value={[loanMonths]} onValueChange={([v]) => setLoanMonths(v)} min={1} max={360} step={1} />
            </div>
            <div className="p-4 rounded-xl bg-destructive/5 border border-destructive/20 text-center">
              <p className="text-xs text-muted-foreground">Monthly Payment</p>
              <p className="text-2xl font-bold font-mono text-destructive">{formatCurrency(loanResult)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Total: {formatCurrency(loanResult * loanMonths)} • Interest: {formatCurrency(loanResult * loanMonths - loanAmount)}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
