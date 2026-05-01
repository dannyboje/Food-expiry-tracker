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

// Two-digit year: 00–49 → 2000–2049, 50–99 → 1950–1999.
// Food expiry dates are always present or future so this is safe.
function expandYear(y: number): number {
  if (y >= 100) return y;
  return y < 50 ? 2000 + y : 1900 + y;
}

function isValidMonth(m: number): boolean {
  return m >= 1 && m <= 12;
}

function isValidDay(d: number): boolean {
  return d >= 1 && d <= 31;
}

function isPlausibleYear(y: number): boolean {
  const now = new Date().getFullYear();
  return y >= now - 1 && y <= now + 20;
}

// Fix common OCR character substitutions within runs that contain ONLY digit-like
// characters. This avoids corrupting month names like "october" or "july".
// E.g. "2O26" → "2026", "O1" → "01", "l5" → "15".
function fixOcrDigits(text: string): string {
  return text.replace(/\b[0-9OoIl]+\b/g, (m) =>
    m.replace(/[Oo]/g, '0').replace(/[Il]/g, '1'),
  );
}

// Normalise a variety of separator styles:
//   "01 / 2026"  →  "01/2026"
//   "01 . 2026"  →  "01.2026"
// Note: we leave spaces elsewhere untouched so "Jan 26" is unaffected.
function collapseSeparatorSpaces(text: string): string {
  return text.replace(/\s*([\/\.])\s*/g, '$1');
}

function normalise(raw: string): string {
  return collapseSeparatorSpaces(
    fixOcrDigits(
      raw
        .replace(/[–—]/g, '-')   // unicode dashes → hyphen
        .toLowerCase(),
    ),
  );
}

// Returns YYYY-MM-DD string or null if no recognisable date found.
export function parseExpiryDateFromText(raw: string): string | null {
  const text = normalise(raw);

  // Separator class used in numeric patterns: /, ., - or a single space.
  // Written as a literal alternation inside each regex for clarity.

  // 1. DD/MM/YYYY  (4-digit year, any separator)
  const dmY = text.match(/\b(\d{1,2})[\/\.\- ](\d{1,2})[\/\.\- ](\d{4})\b/);
  if (dmY) {
    const d = +dmY[1], m = +dmY[2], y = +dmY[3];
    if (isValidDay(d) && isValidMonth(m)) return toISO(y, m, d);
  }

  // 2. DD/MM/YY  (2-digit year)
  const dmYY = text.match(/\b(\d{1,2})[\/\.\- ](\d{1,2})[\/\.\- ](\d{2})\b/);
  if (dmYY) {
    const d = +dmYY[1], m = +dmYY[2], y = expandYear(+dmYY[3]);
    if (isValidDay(d) && isValidMonth(m) && isPlausibleYear(y)) return toISO(y, m, d);
  }

  // 3. MM/YYYY or MM-YYYY → day 1
  const mY = text.match(/\b(\d{1,2})[\/\.\-](\d{4})\b/);
  if (mY) {
    const m = +mY[1], y = +mY[2];
    if (isValidMonth(m)) return toISO(y, m, 1);
  }

  // 4. MM/YY or MM-YY → day 1
  const mYY = text.match(/\b(\d{1,2})[\/\.\-](\d{2})\b/);
  if (mYY) {
    const m = +mYY[1], y = expandYear(+mYY[2]);
    if (isValidMonth(m) && isPlausibleYear(y)) return toISO(y, m, 1);
  }

  // 5. DD MMM YYYY  e.g. "15 Jun 2026"
  const dMY = text.match(/\b(\d{1,2})\s+([a-z]+)\s+(\d{4})\b/);
  if (dMY) {
    const d = +dMY[1], month = MONTH_NAMES[dMY[2]], y = +dMY[3];
    if (month && isValidDay(d)) return toISO(y, month, d);
  }

  // 6. DD MMM YY  e.g. "15 Jun 26"
  const dMYY = text.match(/\b(\d{1,2})\s+([a-z]+)\s+(\d{2})\b/);
  if (dMYY) {
    const d = +dMYY[1], month = MONTH_NAMES[dMYY[2]], y = expandYear(+dMYY[3]);
    if (month && isValidDay(d) && isPlausibleYear(y)) return toISO(y, month, d);
  }

  // 7. MMM YYYY  e.g. "Jun 2026" → day 1
  const MY = text.match(/\b([a-z]+)\s+(\d{4})\b/);
  if (MY) {
    const month = MONTH_NAMES[MY[1]], y = +MY[2];
    if (month) return toISO(y, month, 1);
  }

  // 8. MMM YY  e.g. "Jun 26" → day 1
  const MYY = text.match(/\b([a-z]+)\s+(\d{2})\b/);
  if (MYY) {
    const month = MONTH_NAMES[MYY[1]], y = expandYear(+MYY[2]);
    if (month && isPlausibleYear(y)) return toISO(y, month, 1);
  }

  // 9. YYYY-MM-DD (ISO)
  const iso = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) {
    const y = +iso[1], m = +iso[2], d = +iso[3];
    if (isValidMonth(m) && isValidDay(d)) return toISO(y, m, d);
  }

  // 10. YYYY/MM or YYYY-MM → day 1
  const YM = text.match(/\b(\d{4})[\/\-](\d{2})\b/);
  if (YM) {
    const y = +YM[1], m = +YM[2];
    if (isValidMonth(m)) return toISO(y, m, 1);
  }

  // 11. MM YYYY space/newline-separated  e.g. "08 2026" or "08\n2026" → day 1
  const mSpaceY = text.match(/\b(\d{1,2})[\s]+(\d{4})\b/);
  if (mSpaceY) {
    const m = +mSpaceY[1], y = +mSpaceY[2];
    if (isValidMonth(m)) return toISO(y, m, 1);
  }

  // 12. MM YY space/newline-separated  e.g. "08 26" or "08\n26" → day 1
  const mSpaceYY = text.match(/\b(\d{1,2})[\s]+(\d{2})\b/);
  if (mSpaceYY) {
    const m = +mSpaceYY[1], y = expandYear(+mSpaceYY[2]);
    if (isValidMonth(m) && isPlausibleYear(y)) return toISO(y, m, 1);
  }

  return null;
}
