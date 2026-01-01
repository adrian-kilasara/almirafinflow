import { Button } from '@/components/ui/button';
import { 
  Plus, Download, TrendingUp, TrendingDown, 
  ArrowLeftRight, PiggyBank, Wallet
} from 'lucide-react';

interface QuickActionsProps {
  onAddIncome: () => void;
  onAddExpense: () => void;
  onAddTransfer: () => void;
  onAddSavings: () => void;
  onExport: () => void;
}

export default function QuickActions({
  onAddIncome,
  onAddExpense,
  onAddTransfer,
  onAddSavings,
  onExport,
}: QuickActionsProps) {
  const actions = [
    { 
      label: 'Add Income', 
      icon: TrendingUp, 
      onClick: onAddIncome,
      color: 'text-income',
      bgColor: 'bg-income/10 hover:bg-income/20',
    },
    { 
      label: 'Add Expense', 
      icon: TrendingDown, 
      onClick: onAddExpense,
      color: 'text-expense',
      bgColor: 'bg-expense/10 hover:bg-expense/20',
    },
    { 
      label: 'Transfer', 
      icon: ArrowLeftRight, 
      onClick: onAddTransfer,
      color: 'text-primary',
      bgColor: 'bg-primary/10 hover:bg-primary/20',
    },
    { 
      label: 'Add Savings', 
      icon: PiggyBank, 
      onClick: onAddSavings,
      color: 'text-warning',
      bgColor: 'bg-warning/10 hover:bg-warning/20',
    },
    { 
      label: 'Export', 
      icon: Download, 
      onClick: onExport,
      color: 'text-muted-foreground',
      bgColor: 'bg-muted/50 hover:bg-muted',
    },
  ];

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
      {actions.map((action, index) => {
        const Icon = action.icon;
        return (
          <button
            key={index}
            onClick={action.onClick}
            className={`flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap transition-all ${action.bgColor}`}
          >
            <Icon className={`w-4 h-4 ${action.color}`} />
            <span className="text-sm font-medium">{action.label}</span>
          </button>
        );
      })}
    </div>
  );
}
