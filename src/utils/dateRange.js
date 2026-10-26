/**
 * Date range helpers in Asia/Karachi timezone.
 * Uses Intl for offset-aware boundaries without external deps.
 */

const DEFAULT_TZ = 'Asia/Karachi';

/**
 * Get YYYY-MM-DD parts for a Date in a given timezone.
 */
const getTzParts = (date = new Date(), timeZone = DEFAULT_TZ) => {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    weekday: 'short',
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(date).map((p) => [p.type, p.value])
  );
  return {
    year: parseInt(parts.year, 10),
    month: parseInt(parts.month, 10),
    day: parseInt(parts.day, 10),
    hour: parseInt(parts.hour, 10),
    minute: parseInt(parts.minute, 10),
    second: parseInt(parts.second, 10),
    weekday: parts.weekday,
  };
};

/**
 * Approximate UTC Date for local midnight in Asia/Karachi.
 * Karachi is UTC+5 year-round (no DST).
 */
const karachiOffsetMs = 5 * 60 * 60 * 1000;

const localMidnightUtc = (year, month, day) => {
  // month is 1-based
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0) - karachiOffsetMs);
};

const startOfDayKarachi = (date = new Date()) => {
  const p = getTzParts(date);
  return localMidnightUtc(p.year, p.month, p.day);
};

const endOfDayKarachi = (date = new Date()) => {
  const start = startOfDayKarachi(date);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
};

const WEEKDAY_INDEX = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/**
 * Resolve preset or custom range to { from, to }.
 * @param {string} preset
 * @param {string|Date} [from]
 * @param {string|Date} [to]
 */
const resolveDateRange = (preset, from, to, timeZone = DEFAULT_TZ) => {
  const now = new Date();
  const parts = getTzParts(now, timeZone);

  switch (preset) {
    case 'today': {
      const start = localMidnightUtc(parts.year, parts.month, parts.day);
      return { from: start, to: endOfDayKarachi(now) };
    }
    case 'this_week': {
      // Week starts Monday
      const wd = WEEKDAY_INDEX[parts.weekday] ?? 1;
      const daysFromMonday = wd === 0 ? 6 : wd - 1;
      const monday = localMidnightUtc(parts.year, parts.month, parts.day);
      monday.setUTCDate(monday.getUTCDate() - daysFromMonday);
      return { from: monday, to: endOfDayKarachi(now) };
    }
    case 'this_month': {
      const start = localMidnightUtc(parts.year, parts.month, 1);
      return { from: start, to: endOfDayKarachi(now) };
    }
    case 'last_month': {
      const firstThisMonth = localMidnightUtc(parts.year, parts.month, 1);
      const lastMonthEnd = new Date(firstThisMonth.getTime() - 1);
      const lp = getTzParts(lastMonthEnd, timeZone);
      const start = localMidnightUtc(lp.year, lp.month, 1);
      return { from: start, to: lastMonthEnd };
    }
    case 'this_year': {
      const start = localMidnightUtc(parts.year, 1, 1);
      return { from: start, to: endOfDayKarachi(now) };
    }
    case 'custom':
    default: {
      if (!from || !to) return { from: null, to: null };
      const fromDate = startOfDayKarachi(new Date(from));
      const toDate = endOfDayKarachi(new Date(to));
      return { from: fromDate, to: toDate };
    }
  }
};

module.exports = {
  DEFAULT_TZ,
  getTzParts,
  startOfDayKarachi,
  endOfDayKarachi,
  resolveDateRange,
};
