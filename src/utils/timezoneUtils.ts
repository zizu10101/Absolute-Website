/**
 * The store operates in Eastern time (EDT UTC-4 or EST UTC-5, America/Toronto).
 * Every helper here is based on the IANA timezone database via Intl, NOT on the
 * host machine's own configured timezone - `new Date().getTimezoneOffset()` only
 * reflects Eastern time if the machine running the code happens to be set to
 * Eastern, which is not guaranteed (e.g. a server/build environment set to UTC).
 * That mismatch was the root cause of reports showing the wrong calendar day.
 */
const STORE_TIMEZONE = 'America/Toronto';

// Minutes Eastern time is behind UTC at the given instant (240 for EDT, 300 for EST).
// Works by formatting the same instant as a wall-clock string in both zones and
// diffing the two - the host machine's own timezone cancels out of the subtraction.
const getEasternOffsetMinutes = (at: Date): number => {
  const utcStr = at.toLocaleString('en-US', { timeZone: 'UTC', hour12: false });
  const easternStr = at.toLocaleString('en-US', { timeZone: STORE_TIMEZONE, hour12: false });
  return (new Date(utcStr).getTime() - new Date(easternStr).getTime()) / 60000;
};

const offsetMinutesToString = (minutes: number): string => {
  const sign = minutes > 0 ? '-' : '+';
  const abs = Math.abs(minutes);
  const hh = Math.floor(abs / 60).toString().padStart(2, '0');
  const mm = Math.round(abs % 60).toString().padStart(2, '0');
  return `${sign}${hh}:${mm}`;
};

// The Eastern UTC offset in effect for a given Y-M-D Eastern calendar date
// (uses local noon as the reference instant to avoid DST-transition-day edge cases).
const getEasternOffsetForDate = (dateStr: string): string =>
  offsetMinutesToString(getEasternOffsetMinutes(new Date(`${dateStr}T12:00:00Z`)));

/** Today's date as seen in Eastern time, as a YYYY-MM-DD string. */
export const getTodayEastern = (): string =>
  new Date().toLocaleDateString('en-CA', { timeZone: STORE_TIMEZONE });

/** Shifts a YYYY-MM-DD Eastern calendar date by a number of days (can be negative). */
export const shiftEasternDate = (dateStr: string, deltaDays: number): string => {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().split('T')[0];
};

/** Shifts a YYYY-MM-DD Eastern calendar date by a number of months (can be negative). */
export const shiftEasternMonths = (dateStr: string, deltaMonths: number): string => {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + deltaMonths);
  return d.toISOString().split('T')[0];
};

/**
 * Convert a single Eastern calendar date to a UTC range for Supabase queries.
 * When user selects "Aug 1" in a report, they mean Aug 1 in Eastern time.
 */
export const getEasternDayRange = (dateStr: string) => {
  const tzOffset = getEasternOffsetForDate(dateStr);
  const startEastern = new Date(`${dateStr}T00:00:00${tzOffset}`);
  const endEastern = new Date(`${dateStr}T23:59:59.999${tzOffset}`);

  return {
    start: startEastern.toISOString(),
    end: endEastern.toISOString(),
  };
};

/**
 * Convert an Eastern date range to UTC for Supabase queries.
 * Used for date-range reports (e.g. Sales Report with custom dates).
 */
export const getEasternRangeUTC = (fromDateStr: string, toDateStr: string) => {
  const fromOffset = getEasternOffsetForDate(fromDateStr);
  const toOffset = getEasternOffsetForDate(toDateStr);

  const startEastern = new Date(`${fromDateStr}T00:00:00${fromOffset}`);
  const endEastern = new Date(`${toDateStr}T23:59:59.999${toOffset}`);

  return {
    start: startEastern.toISOString(),
    end: endEastern.toISOString(),
  };
};

/** Formats a stored UTC timestamp as its Eastern calendar date (YYYY-MM-DD) - for bucketing/display. */
export const formatEasternDate = (isoString: string): string =>
  new Date(isoString).toLocaleDateString('en-CA', { timeZone: STORE_TIMEZONE });

/** Formats a stored UTC timestamp as an Eastern date + time string for display, e.g. "08/01/2026, 2:30 PM". */
export const formatEasternDateTime = (isoString: string): string =>
  new Date(isoString).toLocaleString('en-US', {
    timeZone: STORE_TIMEZONE,
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

/** Formats a stored UTC timestamp as an Eastern time-of-day string, e.g. "2:30 PM". */
export const formatEasternTime = (isoString: string): string =>
  new Date(isoString).toLocaleTimeString('en-US', {
    timeZone: STORE_TIMEZONE,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
