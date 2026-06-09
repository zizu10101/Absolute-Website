/**
 * Convert Eastern time date to UTC range for Supabase queries
 * The store operates in Eastern time (EDT UTC-4 or EST UTC-5)
 * When user selects "June 9" in report, they mean June 9 Eastern
 * June 9 Eastern midnight = June 9 04:00 UTC
 * June 9 Eastern 11:59 PM = June 10 03:59 UTC
 */
export const getEasternDayRange = (dateStr: string) => {
  // Auto-detect EDT vs EST based on current timezone offset
  const offset = new Date().getTimezoneOffset(); // 240 for EDT, 300 for EST
  const tzOffset = offset === 240 ? '-04:00' : '-05:00';

  // Create dates with Eastern timezone offset
  const startEastern = new Date(`${dateStr}T00:00:00${tzOffset}`);
  const endEastern = new Date(`${dateStr}T23:59:59${tzOffset}`);

  return {
    start: startEastern.toISOString(),
    end: endEastern.toISOString(),
  };
};

/**
 * Convert Eastern date range to UTC for Supabase queries
 * Used for date-range reports (e.g., Sales Report with custom dates)
 */
export const getEasternRangeUTC = (fromDateStr: string, toDateStr: string) => {
  const offset = new Date().getTimezoneOffset(); // 240 for EDT, 300 for EST
  const tzOffset = offset === 240 ? '-04:00' : '-05:00';

  const startEastern = new Date(`${fromDateStr}T00:00:00${tzOffset}`);
  const endEastern = new Date(`${toDateStr}T23:59:59${tzOffset}`);

  return {
    start: startEastern.toISOString(),
    end: endEastern.toISOString(),
  };
};
