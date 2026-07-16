// Month-filter parsing shared by every route that accepts monthFrom/monthTo.
//
// Boundaries are computed in UTC (timestamps are stored in UTC) so results are
// identical regardless of the server's local timezone. Values that are not a
// real "YYYY-MM" month, or whose year falls outside a sane window (partial
// keyboard input like "0002-12" from <input type="month">), are treated as
// "no filter" instead of silently producing an empty result set.

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;
const MIN_YEAR = 2000;
const MAX_YEAR = 2100;

function parseMonth(value: string | null | undefined): { year: number; month: number } | null {
  if (!value) return null;
  const m = MONTH_RE.exec(value);
  if (!m) return null;
  const year = Number(m[1]);
  if (year < MIN_YEAR || year > MAX_YEAR) return null;
  return { year, month: Number(m[2]) };
}

export function monthStartUtc(value: string | null | undefined): Date | null {
  const p = parseMonth(value);
  return p ? new Date(Date.UTC(p.year, p.month - 1, 1)) : null;
}

/** Last millisecond of the month, in UTC. */
export function monthEndUtc(value: string | null | undefined): Date | null {
  const p = parseMonth(value);
  return p ? new Date(Date.UTC(p.year, p.month, 1) - 1) : null;
}

export interface MonthRange {
  gte?: Date;
  lte?: Date;
}

/**
 * Resolve monthFrom/monthTo into a UTC date range. Returns null when neither
 * bound is usable. Reversed bounds are swapped rather than yielding an
 * always-empty range.
 */
export function monthRangeUtc(
  monthFrom: string | null | undefined,
  monthTo: string | null | undefined
): MonthRange | null {
  let gte = monthStartUtc(monthFrom);
  let lte = monthEndUtc(monthTo);
  if (gte && lte && gte > lte) {
    [gte, lte] = [monthStartUtc(monthTo), monthEndUtc(monthFrom)];
  }
  if (!gte && !lte) return null;
  return { ...(gte && { gte }), ...(lte && { lte }) };
}
