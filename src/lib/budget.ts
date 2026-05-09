// Centralized budget period helpers — single source of truth for date math.

export type BudgetPeriod = "weekly" | "monthly" | "quarterly" | "yearly" | "custom";

export interface PeriodRange {
  start: Date;
  end: Date;
}

/**
 * Returns the [start, end) date range for a budget period anchored on `start_date`.
 * For recurring periods (weekly/monthly/quarterly/yearly), advances to the period
 * containing `today`.
 */
export function getPeriodRange(
  period: BudgetPeriod,
  startDateIso: string,
  today: Date = new Date()
): PeriodRange {
  const anchor = new Date(startDateIso + "T00:00:00");
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  if (period === "custom") {
    return { start: anchor, end: t };
  }

  if (period === "weekly") {
    const diffDays = Math.floor((t.getTime() - anchor.getTime()) / 86400000);
    const periods = Math.floor(diffDays / 7);
    const start = new Date(anchor);
    start.setDate(start.getDate() + periods * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return { start, end };
  }

  if (period === "monthly") {
    const start = new Date(t.getFullYear(), t.getMonth(), anchor.getDate());
    if (start > t) start.setMonth(start.getMonth() - 1);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    return { start, end };
  }

  if (period === "quarterly") {
    const monthsSince =
      (t.getFullYear() - anchor.getFullYear()) * 12 + (t.getMonth() - anchor.getMonth());
    const periods = Math.floor(monthsSince / 3);
    const start = new Date(anchor);
    start.setMonth(start.getMonth() + periods * 3);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 3);
    return { start, end };
  }

  // yearly
  const start = new Date(t.getFullYear(), anchor.getMonth(), anchor.getDate());
  if (start > t) start.setFullYear(start.getFullYear() - 1);
  const end = new Date(start);
  end.setFullYear(end.getFullYear() + 1);
  return { start, end };
}

export function isInPeriod(dateIso: string, range: PeriodRange): boolean {
  const d = new Date(dateIso + "T00:00:00");
  return d >= range.start && d < range.end;
}
