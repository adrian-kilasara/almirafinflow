/**
 * Timezone-aware date helpers — single source of truth for "today",
 * "this week", "this month" anchored to the user's configured timezone
 * (settings.timezone), NOT browser local time and NOT UTC.
 *
 * Backed by Intl.DateTimeFormat (no extra deps).
 */

let globalTimezone: string = 'Africa/Dar_es_Salaam';

export function setGlobalTimezone(tz: string): void {
  if (tz && typeof tz === 'string') globalTimezone = tz;
}

export function getGlobalTimezone(): string {
  return globalTimezone;
}

/**
 * Returns the user's tz current calendar parts (Y, M, D, h, m, s) as numbers.
 */
function tzParts(date: Date = new Date(), tz: string = globalTimezone) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(date).reduce<Record<string, string>>((acc, p) => {
    if (p.type !== 'literal') acc[p.type] = p.value;
    return acc;
  }, {});
  return {
    year: Number(parts.year),
    month: Number(parts.month), // 1-12
    day: Number(parts.day),
    hour: Number(parts.hour === '24' ? '0' : parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

/** 'YYYY-MM-DD' in user's tz */
export function todayInTz(tz: string = globalTimezone): string {
  const p = tzParts(new Date(), tz);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/** 'YYYY-MM-DD' for any Date in user's tz */
export function dateKeyInTz(date: Date, tz: string = globalTimezone): string {
  const p = tzParts(date, tz);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/** Yesterday 'YYYY-MM-DD' in user's tz */
export function yesterdayInTz(tz: string = globalTimezone): string {
  const t = todayInTz(tz);
  const d = new Date(`${t}T12:00:00Z`); // noon UTC = same day everywhere
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Add N days to a 'YYYY-MM-DD' date and return 'YYYY-MM-DD' */
export function addDaysToKey(key: string, days: number): string {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Returns true if two Dates fall on the same day in user's tz */
export function isSameDayInTz(a: Date, b: Date, tz: string = globalTimezone): boolean {
  return dateKeyInTz(a, tz) === dateKeyInTz(b, tz);
}

/** Day-difference in user's tz between two date keys (a - b) */
export function diffDaysKeys(a: string, b: string): number {
  const da = new Date(`${a}T12:00:00Z`).getTime();
  const db = new Date(`${b}T12:00:00Z`).getTime();
  return Math.round((da - db) / 86400000);
}

/** {start, end} 'YYYY-MM-DD' for current month in user's tz */
export function monthRangeInTz(tz: string = globalTimezone): { start: string; end: string } {
  const p = tzParts(new Date(), tz);
  const start = `${p.year}-${String(p.month).padStart(2, '0')}-01`;
  // last day = day 0 of next month
  const lastDay = new Date(Date.UTC(p.year, p.month, 0)).getUTCDate();
  const end = `${p.year}-${String(p.month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
}

/** {start, end} 'YYYY-MM-DD' for current week (Sun→Sat) in user's tz */
export function weekRangeInTz(tz: string = globalTimezone): { start: string; end: string } {
  const today = todayInTz(tz);
  const todayDate = new Date(`${today}T12:00:00Z`);
  const dow = todayDate.getUTCDay(); // 0=Sun
  const start = new Date(todayDate);
  start.setUTCDate(start.getUTCDate() - dow);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

/** Returns formatted time + date string in user's tz, e.g. "14:32 — 17 Apr 2026" */
export function nowDisplayInTz(tz: string = globalTimezone): string {
  const p = tzParts(new Date(), tz);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const time = `${String(p.hour).padStart(2,'0')}:${String(p.minute).padStart(2,'0')}`;
  return `${time} — ${p.day} ${months[p.month - 1]} ${p.year}`;
}

/** Get the ISO instant representing "start of day" for a given date key in tz.
 *  Useful for filtering created_at >= startOfDayUtc(today). */
export function startOfDayUtcForTzKey(key: string, tz: string = globalTimezone): string {
  // We approximate: take the key at 00:00 in tz, convert back to UTC.
  // Build a Date assuming the local date+time, then offset by tz difference.
  const [y, m, d] = key.split('-').map(Number);
  // Probe Date at noon UTC then read what tz says — compute offset.
  const probe = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const probeParts = tzParts(probe, tz);
  // Difference between probe's UTC hour (12) and tz hour gives offset
  const tzOffsetHours = probeParts.hour - 12 + (probeParts.day !== d ? (probeParts.day < d ? -24 : 24) : 0);
  // start of day in tz expressed as UTC = (date 00:00) - tzOffset
  const startUtc = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
  startUtc.setUTCHours(startUtc.getUTCHours() - tzOffsetHours);
  return startUtc.toISOString();
}
