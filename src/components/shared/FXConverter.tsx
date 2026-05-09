import { useMemo } from "react";
import { ArrowRight, RefreshCw } from "lucide-react";
import { useExchangeRates } from "@/hooks/useExchangeRates";
import { convertTo } from "@/lib/currency";

interface Props {
  amount: number;
  fromCurrency: string;
  toCurrency: string;
  /** Override the auto-computed rate (user-editable). */
  rate?: number;
  onRateChange?: (rate: number) => void;
}

/**
 * Inline FX converter shown when paying across currencies.
 * Displays live mid-rate, allows manual override, and computes the converted amount.
 * Stores nothing — caller is responsible for persisting the rate + original amount.
 */
export function FXConverter({ amount, fromCurrency, toCurrency, rate, onRateChange }: Props) {
  const { rates } = useExchangeRates();
  const liveRate = useMemo(
    () => convertTo(1, fromCurrency, toCurrency, rates),
    [fromCurrency, toCurrency, rates]
  );
  const effective = rate ?? liveRate;
  const converted = amount * effective;

  if (fromCurrency === toCurrency) return null;

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-2 text-sm">
      <div className="flex items-center gap-2 text-muted-foreground">
        <RefreshCw className="h-3.5 w-3.5" />
        <span>Currency conversion</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="font-medium">
          {amount.toLocaleString()} {fromCurrency}
        </span>
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
        <span className="font-semibold text-primary">
          {converted.toLocaleString(undefined, { maximumFractionDigits: 2 })} {toCurrency}
        </span>
      </div>
      <div className="flex items-center gap-2 text-xs">
        <label className="text-muted-foreground">Rate</label>
        <input
          type="number"
          step="0.0001"
          value={Number(effective.toFixed(6))}
          onChange={(e) => onRateChange?.(Number(e.target.value) || liveRate)}
          className="w-28 px-2 py-1 rounded bg-background border border-border text-right"
        />
        <span className="text-muted-foreground">
          (1 {fromCurrency} = ? {toCurrency})
        </span>
      </div>
    </div>
  );
}
