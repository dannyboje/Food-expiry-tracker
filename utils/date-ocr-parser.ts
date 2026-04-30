const MONTH_NAMES: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  january: 1, february: 2, march: 3, april: 4, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function toISO(year: number, month: number, day = 1): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

// Returns YYYY-MM-DD string or null if no recognisable date found
export function parseExpiryDateFromText(text: string): string | null {
  const normalised = text.toLowerCase().replace(/[–—]/g, '-');

  // DD/MM/YYYY or MM/DD/YYYY — treat as DD/MM/YYYY (most common on food packaging)
  const slashFull = normalised.match(/\b(\d{1,2})[\/\.](\d{1,2})[\/\.](\d{4})\b/);
  if (slashFull) {
    const day = parseInt(slashFull[1], 10);
    const month = parseInt(slashFull[2], 10);
    const year = parseInt(slashFull[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return toISO(year, month, day);
    }
  }

  // MM/YYYY or MM.YYYY
  const slashMonthYear = normalised.match(/\b(\d{1,2})[\/\.](\d{4})\b/);
  if (slashMonthYear) {
    const month = parseInt(slashMonthYear[1], 10);
    const year = parseInt(slashMonthYear[2], 10);
    if (month >= 1 && month <= 12) {
      // Use last day of the month as the expiry date
      const lastDay = new Date(year, month, 0).getDate();
      return toISO(year, month, lastDay);
    }
  }

  // DD MMM YYYY  e.g. "15 Jun 2026"
  const dayMonthYear = normalised.match(/\b(\d{1,2})\s+([a-z]+)\s+(\d{4})\b/);
  if (dayMonthYear) {
    const day = parseInt(dayMonthYear[1], 10);
    const month = MONTH_NAMES[dayMonthYear[2]];
    const year = parseInt(dayMonthYear[3], 10);
    if (month && day >= 1 && day <= 31) {
      return toISO(year, month, day);
    }
  }

  // MMM YYYY  e.g. "Jun 2026"
  const monthYear = normalised.match(/\b([a-z]+)\s+(\d{4})\b/);
  if (monthYear) {
    const month = MONTH_NAMES[monthYear[1]];
    const year = parseInt(monthYear[2], 10);
    if (month) {
      const lastDay = new Date(year, month, 0).getDate();
      return toISO(year, month, lastDay);
    }
  }

  // YYYY-MM-DD (ISO)
  const iso = normalised.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) {
    return `${iso[1]}-${iso[2]}-${iso[3]}`;
  }

  // YYYY/MM
  const isoShort = normalised.match(/\b(\d{4})[\/\-](\d{2})\b/);
  if (isoShort) {
    const year = parseInt(isoShort[1], 10);
    const month = parseInt(isoShort[2], 10);
    if (month >= 1 && month <= 12) {
      const lastDay = new Date(year, month, 0).getDate();
      return toISO(year, month, lastDay);
    }
  }

  return null;
}
