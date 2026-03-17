import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { formatCurrency } from '@/lib/format';
import {
  Plus, TrendingUp, TrendingDown, BarChart3, PieChart, Trash2, Edit,
  MoreHorizontal, Briefcase, Bitcoin, Building2, Landmark, Gem, DollarSign
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PieChart as RPieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface Investment {
  id: string;
  user_id: string;
  name: string;
  type: string;
  symbol: string | null;
  quantity: number;
  purchase_price: number;
  current_price: number;
  currency: string;
  purchase_date: string | null;
  platform: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const INVESTMENT_TYPES = [
  { value: 'stocks', label: 'Stocks', icon: TrendingUp, emoji: '📈', color: 'hsl(var(--primary))' },
  { value: 'crypto', label: 'Crypto', icon: Bitcoin, emoji: '₿', color: 'hsl(var(--warning))' },
  { value: 'bonds', label: 'Bonds', icon: Landmark, emoji: '🏛️', color: 'hsl(var(--income))' },
  { value: 'real_estate', label: 'Real Estate', icon: Building2, emoji: '🏠', color: 'hsl(var(--chart-3))' },
  { value: 'mutual_funds', label: 'Mutual Funds', icon: PieChart, emoji: '📊', color: 'hsl(var(--chart-4))' },
  { value: 'sacco', label: 'SACCO', icon: Briefcase, emoji: '🤝', color: 'hsl(var(--chart-5))' },
  { value: 'commodities', label: 'Commodities', icon: Gem, emoji: '💎', color: 'hsl(var(--expense))' },
  { value: 'other', label: 'Other', icon: DollarSign, emoji: '💰', color: 'hsl(var(--muted-foreground))' },
];

const stagger = {
  container: { hidden: {}, show: { transition: { staggerChildren: 0.05 } } },
  item: {
    hidden: { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] } },
  },
};

interface InvestmentTrackerProps {
  accounts?: import('@/types/finance').Account[];
  onPortfolioChange?: () => void;
}

export default function InvestmentTracker({ accounts = [], onPortfolioChange }: InvestmentTrackerProps) {
  const { user } = useAuth();
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingInv, setEditingInv] = useState<Investment | null>(null);

  // Form
  const [name, setName] = useState('');
  const [type, setType] = useState('stocks');
  const [symbol, setSymbol] = useState('');
  const [quantity, setQuantity] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [currentPrice, setCurrentPrice] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [platform, setPlatform] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (user) fetchInvestments(); }, [user]);

  const fetchInvestments = async () => {
    const { data } = await supabase
      .from('investments')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setInvestments(data as Investment[]);
    setLoading(false);
  };

  const resetForm = () => {
    setName(''); setType('stocks'); setSymbol(''); setQuantity('');
    setPurchasePrice(''); setCurrentPrice(''); setPurchaseDate(''); setPlatform('');
    setEditingInv(null);
  };

  const openEdit = (inv: Investment) => {
    setEditingInv(inv);
    setName(inv.name); setType(inv.type); setSymbol(inv.symbol || '');
    setQuantity(String(inv.quantity)); setPurchasePrice(String(inv.purchase_price));
    setCurrentPrice(String(inv.current_price)); setPurchaseDate(inv.purchase_date || '');
    setPlatform(inv.platform || '');
    setFormOpen(true);
  };

  const handleSubmit = async () => {
    if (!user || !name.trim() || !quantity || !purchasePrice) return;
    setSaving(true);
    try {
      const payload = {
        user_id: user.id,
        name: name.trim(),
        type,
        symbol: symbol.trim().toUpperCase() || null,
        quantity: parseFloat(quantity),
        purchase_price: parseFloat(purchasePrice),
        current_price: parseFloat(currentPrice || purchasePrice),
        purchase_date: purchaseDate || null,
        platform: platform.trim() || null,
      };
      if (editingInv) {
        await supabase.from('investments').update(payload).eq('id', editingInv.id);
        toast.success('Investment updated');
      } else {
        await supabase.from('investments').insert(payload);
        toast.success('Investment added');
      }
      resetForm(); setFormOpen(false); fetchInvestments();
      onPortfolioChange?.();
    } catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  };

  const deleteInvestment = async (id: string) => {
    await supabase.from('investments').delete().eq('id', id);
    setInvestments(prev => prev.filter(i => i.id !== id));
    toast.success('Investment removed');
    onPortfolioChange?.();
  };

  // Portfolio stats
  const portfolio = useMemo(() => {
    const active = investments.filter(i => i.is_active);
    const totalInvested = active.reduce((s, i) => s + Number(i.quantity) * Number(i.purchase_price), 0);
    const totalValue = active.reduce((s, i) => s + Number(i.quantity) * Number(i.current_price), 0);
    const totalReturn = totalValue - totalInvested;
    const returnPct = totalInvested > 0 ? (totalReturn / totalInvested) * 100 : 0;

    // Allocation by type
    const allocation = INVESTMENT_TYPES.map(t => {
      const typeInvs = active.filter(i => i.type === t.value);
      const value = typeInvs.reduce((s, i) => s + Number(i.quantity) * Number(i.current_price), 0);
      return { name: t.label, value, color: t.color, emoji: t.emoji };
    }).filter(a => a.value > 0);

    return { totalInvested, totalValue, totalReturn, returnPct, allocation, count: active.length };
  }, [investments]);

  const getTypeInfo = (t: string) => INVESTMENT_TYPES.find(x => x.value === t) || INVESTMENT_TYPES[INVESTMENT_TYPES.length - 1];

  return (
    <div className="space-y-5">
      {/* Portfolio Summary */}
      {portfolio.count > 0 && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="overflow-hidden relative border-primary/10">
            <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-primary/5 blur-3xl pointer-events-none" />
            <CardContent className="p-5 sm:p-6 relative">
              <div className="flex flex-col md:flex-row md:items-center gap-6">
                {/* Value + Return */}
                <div className="flex-1">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-1">Portfolio Value</p>
                  <motion.p
                    className="text-3xl sm:text-4xl font-extrabold font-mono"
                    initial={{ scale: 0.9 }} animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200 }}
                  >
                    {formatCurrency(portfolio.totalValue)}
                  </motion.p>
                  <div className="flex items-center gap-4 mt-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-muted-foreground">Invested</span>
                      <span className="text-[11px] font-mono font-semibold">{formatCurrency(portfolio.totalInvested)}</span>
                    </div>
                    <div className={`flex items-center gap-1 ${portfolio.totalReturn >= 0 ? 'text-income' : 'text-expense'}`}>
                      {portfolio.totalReturn >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      <span className="text-[11px] font-mono font-bold">
                        {portfolio.totalReturn >= 0 ? '+' : ''}{formatCurrency(portfolio.totalReturn)} ({portfolio.returnPct.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Allocation Pie */}
                {portfolio.allocation.length > 1 && (
                  <div className="w-32 h-32 shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <RPieChart>
                        <Pie data={portfolio.allocation} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={30} outerRadius={55} paddingAngle={2}>
                          {portfolio.allocation.map((a, i) => (
                            <Cell key={i} fill={a.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: number) => formatCurrency(value)}
                          contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px', fontSize: '11px' }}
                        />
                      </RPieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Allocation legend */}
              <div className="flex flex-wrap gap-2 mt-4">
                {portfolio.allocation.map((a, i) => (
                  <div key={i} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/30 text-[10px]">
                    <span>{a.emoji}</span>
                    <span className="text-muted-foreground">{a.name}</span>
                    <span className="font-mono font-semibold">{((a.value / portfolio.totalValue) * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>

              {/* Linked Investment Accounts */}
              {accounts.filter(a => a.type === 'investment' && a.is_active).length > 0 && (
                <div className="mt-4 pt-3 border-t border-border/30">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-2">Linked Investment Accounts</p>
                  <div className="flex flex-wrap gap-2">
                    {accounts.filter(a => a.type === 'investment' && a.is_active).map(a => (
                      <div key={a.id} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-primary/5 border border-primary/10 text-[10px]">
                        <Briefcase className="w-3 h-3 text-primary" />
                        <span className="font-medium">{a.name}</span>
                        <span className="font-mono text-muted-foreground">{formatCurrency(Number(a.balance), a.currency)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
          </Card>
        </motion.div>
      )}

      {/* Header + Add */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{investments.length} investments tracked</p>
        <Dialog open={formOpen} onOpenChange={(o) => { setFormOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm" className="rounded-xl gap-1.5 h-8 text-xs">
              <Plus className="w-3.5 h-3.5" /> Add Investment
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[440px]">
            <DialogHeader>
              <DialogTitle>{editingInv ? 'Edit Investment' : 'Add Investment'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label className="text-xs">Name</Label>
                  <Input value={name} onChange={e => setName(e.target.value)} placeholder="Apple Inc., Bitcoin, etc." className="rounded-xl mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Type</Label>
                  <Select value={type} onValueChange={setType}>
                    <SelectTrigger className="rounded-xl mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {INVESTMENT_TYPES.map(t => (
                        <SelectItem key={t.value} value={t.value}>{t.emoji} {t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Symbol / Ticker</Label>
                  <Input value={symbol} onChange={e => setSymbol(e.target.value)} placeholder="AAPL, BTC" className="rounded-xl mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Quantity / Units</Label>
                  <Input type="number" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="10" className="rounded-xl mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Purchase Price (per unit)</Label>
                  <Input type="number" value={purchasePrice} onChange={e => setPurchasePrice(e.target.value)} placeholder="0.00" className="rounded-xl mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Current Price (per unit)</Label>
                  <Input type="number" value={currentPrice} onChange={e => setCurrentPrice(e.target.value)} placeholder="0.00" className="rounded-xl mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Purchase Date</Label>
                  <Input type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} className="rounded-xl mt-1" />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Platform</Label>
                  <Input value={platform} onChange={e => setPlatform(e.target.value)} placeholder="Robinhood, Binance, etc." className="rounded-xl mt-1" />
                </div>
              </div>
              <Button onClick={handleSubmit} disabled={saving || !name.trim() || !quantity} className="w-full rounded-xl">
                {saving ? 'Saving...' : editingInv ? 'Update' : 'Add Investment'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Investment List */}
      <motion.div variants={stagger.container} initial="hidden" animate="show" className="space-y-2">
        <AnimatePresence mode="popLayout">
          {investments.length > 0 ? investments.map((inv) => {
            const typeInfo = getTypeInfo(inv.type);
            const invested = Number(inv.quantity) * Number(inv.purchase_price);
            const currentVal = Number(inv.quantity) * Number(inv.current_price);
            const returnAmt = currentVal - invested;
            const returnPct = invested > 0 ? (returnAmt / invested) * 100 : 0;
            const isPositive = returnAmt >= 0;

            return (
              <motion.div key={inv.id} variants={stagger.item} layout exit={{ opacity: 0, x: -20 }} className="group">
                <Card className="border-border/30 hover:border-border/60 transition-all">
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-muted/40 flex items-center justify-center text-lg shrink-0">
                        {typeInfo.emoji}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm truncate">{inv.name}</p>
                          {inv.symbol && <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 rounded-full font-mono">{inv.symbol}</Badge>}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-muted-foreground capitalize">{typeInfo.label}</span>
                          <span className="text-[10px] text-muted-foreground">· {Number(inv.quantity)} units</span>
                          {inv.platform && <span className="text-[10px] text-muted-foreground">· {inv.platform}</span>}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-mono font-bold text-sm">{formatCurrency(currentVal)}</p>
                        <div className={`flex items-center justify-end gap-0.5 ${isPositive ? 'text-income' : 'text-expense'}`}>
                          {isPositive ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                          <span className="text-[10px] font-mono font-semibold">
                            {isPositive ? '+' : ''}{returnPct.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="w-7 h-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            <MoreHorizontal className="w-3.5 h-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl">
                          <DropdownMenuItem onClick={() => openEdit(inv)} className="gap-2 text-xs cursor-pointer">
                            <Edit className="w-3.5 h-3.5" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => deleteInvestment(inv.id)} className="gap-2 text-xs text-destructive cursor-pointer">
                            <Trash2 className="w-3.5 h-3.5" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          }) : (
            <motion.div variants={stagger.item} className="text-center py-12">
              <BarChart3 className="w-10 h-10 mx-auto mb-3 text-muted-foreground/20" />
              <p className="text-muted-foreground text-sm">No investments tracked yet</p>
              <p className="text-[10px] text-muted-foreground mt-1">Add your stocks, crypto, bonds, and more</p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
