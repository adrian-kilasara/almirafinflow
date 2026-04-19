import { CurrencyCode, CURRENCY_SYMBOLS } from '@/types/finance';

// Global currency for system-wide formatting
let globalCurrency: CurrencyCode = 'KES';

export function setGlobalCurrency(currency: CurrencyCode): void {
  globalCurrency = currency;
}

export function getGlobalCurrency(): CurrencyCode {
  return globalCurrency;
}

export function formatCurrency(amount: number, currency?: CurrencyCode): string {
  const useCurrency = currency || globalCurrency;
  const symbol = CURRENCY_SYMBOLS[useCurrency];
  const formattedNumber = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount));
  
  return `${amount < 0 ? '-' : ''}${symbol} ${formattedNumber}`;
}

export function formatCompactNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toFixed(0);
}

// Global date format setting
let globalDateFormat: string = 'DD/MM/YYYY';

export function setGlobalDateFormat(format: string): void {
  globalDateFormat = format;
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const d = date.getDate().toString().padStart(2, '0');
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const y = date.getFullYear();
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  switch (globalDateFormat) {
    case 'MM/DD/YYYY': return `${monthNames[date.getMonth()]} ${d}, ${y}`;
    case 'YYYY-MM-DD': return `${y}-${m}-${d}`;
    default: return `${d} ${monthNames[date.getMonth()]} ${y}`;
  }
}

export function formatRelativeDate(dateString: string): string {
  // tz-aware: compare against user's calendar day, not browser/UTC.
  const tzToday = todayInTz();
  const tzDateKey = dateKeyInTz(new Date(dateString));
  const diffDays = diffDaysKeys(tzToday, tzDateKey);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays > 0 && diffDays < 7) return `${diffDays} days ago`;
  if (diffDays > 0 && diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return formatDate(dateString);
}

export function getPercentage(current: number, target: number): number {
  if (target === 0) return 0;
  return Math.min(Math.round((current / target) * 100), 100);
}

export function getMonthName(monthIndex: number): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return months[monthIndex];
}

import { monthRangeInTz, weekRangeInTz, todayInTz, dateKeyInTz, diffDaysKeys } from '@/lib/datetime';

export function getCurrentMonthRange(): { start: string; end: string } {
  return monthRangeInTz();
}

export function getCurrentWeekRange(): { start: string; end: string } {
  return weekRangeInTz();
}
