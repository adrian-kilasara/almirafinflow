// Multi-currency conversion helpers (display-only — never mutates stored data)

export type Rate = {
  from_currency: string;
  to_currency: string;
  rate: number;
  effective_date?: string;
};

/**
 * Fallback rates anchored to USD (rough mid-2025 averages).
 * Used only when DB exchange_rates table has no entry — never overrides DB.
 */
const FALLBACK_USD_RATES: Record<string, number> = {
  USD: 1,
  KES: 129,
  TZS: 2580,
  UGX: 3720,
  RWF: 1380,
  EUR: 0.92,
  GBP: 0.79,
};

function fallbackRate(from: string, to: string): number {
  if (from === to) return 1;
  const f = FALLBACK_USD_RATES[from];
  const t = FALLBACK_USD_RATES[to];
  if (!f || !t) return 1;
  // amount_in_to = amount_in_from / from_per_usd * to_per_usd
  return t / f;
}

/**
 * Convert an amount from one currency to another.
 * Looks for direct, inverse, and via-USD bridge rates in the supplied list.
 * Falls back to anchored mid-rates if nothing matches.
 */
export function convertTo(
  amount: number,
  from: string,
  to: string,
  rates: Rate[] = []
): number {
  if (!amount || from === to) return amount;

  const direct = rates.find((r) => r.from_currency === from && r.to_currency === to);
  if (direct) return amount * Number(direct.rate);

  const inverse = rates.find((r) => r.from_currency === to && r.to_currency === from);
  if (inverse && Number(inverse.rate) !== 0) return amount / Number(inverse.rate);

  // Bridge via USD if both legs exist
  const fromToUsd = rates.find((r) => r.from_currency === from && r.to_currency === "USD");
  const usdToTarget = rates.find((r) => r.from_currency === "USD" && r.to_currency === to);
  if (fromToUsd && usdToTarget) {
    return amount * Number(fromToUsd.rate) * Number(usdToTarget.rate);
  }

  return amount * fallbackRate(from, to);
}

/**
 * Get the live FX rate (1 unit of `from` in `to`).
 */
export function getRate(from: string, to: string, rates: Rate[] = []): number {
  return convertTo(1, from, to, rates);
}

/**
 * Group amounts by currency for breakdown display.
 */
export function groupByCurrency<T extends { amount: number; currency: string }>(
  items: T[]
): Record<string, number> {
  return items.reduce<Record<string, number>>((acc, item) => {
    acc[item.currency] = (acc[item.currency] || 0) + Number(item.amount || 0);
    return acc;
  }, {});
}

/**
 * Sum a list of {amount, currency} items into a single target currency.
 */
export function sumInCurrency<T extends { amount: number; currency: string }>(
  items: T[],
  target: string,
  rates: Rate[] = []
): number {
  return items.reduce(
    (sum, item) => sum + convertTo(Number(item.amount || 0), item.currency, target, rates),
    0
  );
}
