import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/format';
import { 
  ChevronLeft, ChevronRight, Calendar, 
  TrendingUp, TrendingDown, ArrowLeftRight 
} from 'lucide-react';
import { 
  format, startOfMonth, endOfMonth, eachDayOfInterval, 
  isSameMonth, isSameDay, addMonths, subMonths, parseISO, isToday 
} from 'date-fns';
import type { Transaction } from '@/types/finance';

interface TransactionCalendarProps {
  transactions: Transaction[];
  onDayClick?: (date: Date, transactions: Transaction[]) => void;
}

export default function TransactionCalendar({ transactions, onDayClick }: TransactionCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Group transactions by date
  const transactionsByDate = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    
    transactions.forEach(t => {
      const dateKey = t.date.split('T')[0];
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(t);
    });
    
    return map;
  }, [transactions]);

  // Calculate daily totals
  const getDayData = (date: Date) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    const dayTransactions = transactionsByDate.get(dateKey) || [];
    
    const income = dayTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const expense = dayTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount), 0);
    
    return { transactions: dayTransactions, income, expense, net: income - expense };
  };

  // Selected day transactions
  const selectedDayData = selectedDate ? getDayData(selectedDate) : null;

  // Month totals
  const monthTotals = useMemo(() => {
    let income = 0;
    let expense = 0;
    
    transactions.forEach(t => {
      const date = parseISO(t.date);
      if (isSameMonth(date, currentMonth)) {
        if (t.type === 'income') income += Number(t.amount);
        else if (t.type === 'expense') expense += Number(t.amount);
      }
    });
    
    return { income, expense, net: income - expense };
  }, [transactions, currentMonth]);

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Calculate start padding for first day of month
  const startPadding = monthStart.getDay();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Transaction Calendar
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="font-medium min-w-[140px] text-center">
              {format(currentMonth, 'MMMM yyyy')}
            </span>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Month Summary */}
        <div className="grid grid-cols-3 gap-3 p-3 rounded-lg bg-muted/30">
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Income</p>
            <p className="font-semibold text-income">{formatCurrency(monthTotals.income)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Expenses</p>
            <p className="font-semibold text-expense">{formatCurrency(monthTotals.expense)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Net</p>
            <p className={`font-semibold ${monthTotals.net >= 0 ? 'text-income' : 'text-expense'}`}>
              {monthTotals.net >= 0 ? '+' : ''}{formatCurrency(monthTotals.net)}
            </p>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1">
          {/* Week day headers */}
          {weekDays.map(day => (
            <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
              {day}
            </div>
          ))}
          
          {/* Empty cells for padding */}
          {Array.from({ length: startPadding }).map((_, i) => (
            <div key={`pad-${i}`} className="aspect-square" />
          ))}
          
          {/* Day cells */}
          {days.map(day => {
            const dayData = getDayData(day);
            const hasTransactions = dayData.transactions.length > 0;
            const isSelected = selectedDate && isSameDay(day, selectedDate);
            const today = isToday(day);
            
            return (
              <button
                key={day.toISOString()}
                onClick={() => {
                  setSelectedDate(day);
                  if (onDayClick) onDayClick(day, dayData.transactions);
                }}
                className={`aspect-square p-1 rounded-lg flex flex-col items-center justify-center transition-all text-sm ${
                  isSelected
                    ? 'bg-primary text-primary-foreground'
                    : today
                    ? 'bg-primary/20 border border-primary'
                    : hasTransactions
                    ? 'bg-muted/50 hover:bg-muted'
                    : 'hover:bg-muted/30'
                }`}
              >
                <span className="font-medium">{format(day, 'd')}</span>
                {hasTransactions && !isSelected && (
                  <div className="flex gap-0.5 mt-0.5">
                    {dayData.income > 0 && (
                      <div className="w-1.5 h-1.5 rounded-full bg-income" />
                    )}
                    {dayData.expense > 0 && (
                      <div className="w-1.5 h-1.5 rounded-full bg-expense" />
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Selected Day Details */}
        {selectedDate && selectedDayData && (
          <div className="p-4 rounded-lg bg-muted/30 space-y-3">
            <h4 className="font-medium">{format(selectedDate, 'EEEE, MMMM d, yyyy')}</h4>
            
            {selectedDayData.transactions.length > 0 ? (
              <div className="space-y-2">
                {selectedDayData.transactions.map(t => (
                  <div 
                    key={t.id} 
                    className="flex items-center justify-between p-2 rounded bg-background/50"
                  >
                    <div className="flex items-center gap-2">
                      {t.type === 'income' ? (
                        <TrendingUp className="w-4 h-4 text-income" />
                      ) : t.type === 'expense' ? (
                        <TrendingDown className="w-4 h-4 text-expense" />
                      ) : (
                        <ArrowLeftRight className="w-4 h-4 text-primary" />
                      )}
                      <span className="text-sm">{t.description || t.type}</span>
                    </div>
                    <span className={`font-mono text-sm ${
                      t.type === 'income' ? 'text-income' : 'text-expense'
                    }`}>
                      {t.type === 'income' ? '+' : '-'}{formatCurrency(Number(t.amount), t.currency)}
                    </span>
                  </div>
                ))}
                
                <div className="flex justify-between pt-2 border-t border-border text-sm">
                  <span className="text-muted-foreground">Day Net:</span>
                  <span className={`font-semibold ${
                    selectedDayData.net >= 0 ? 'text-income' : 'text-expense'
                  }`}>
                    {selectedDayData.net >= 0 ? '+' : ''}{formatCurrency(selectedDayData.net)}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No transactions on this day</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
