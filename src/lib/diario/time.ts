const CALENDAR_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const brtDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = CALENDAR_DATE.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;

  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const monthLength = month === 2 && leapYear ? 29 : DAYS_IN_MONTH[month - 1];
  return day <= monthLength;
}

export function parseCalendarDate(value: unknown, field = 'date'): string {
  if (!isCalendarDate(value)) {
    throw new Error(`${field} must be a valid YYYY-MM-DD calendar date`);
  }
  return value;
}

export function currentDateBrt(now: Date = new Date()): string {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
    throw new Error('currentDateBrt requires a valid Date instant');
  }

  const parts = brtDateFormatter.formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function isoWeekKey(date: string): string {
  parseCalendarDate(date);
  const [year, month, day] = date.split('-').map(Number);
  const utcDate = new Date(0);
  utcDate.setUTCFullYear(year, month - 1, day);
  utcDate.setUTCHours(0, 0, 0, 0);

  const weekday = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - weekday);

  const isoYear = utcDate.getUTCFullYear();
  const yearStart = new Date(0);
  yearStart.setUTCFullYear(isoYear, 0, 1);
  yearStart.setUTCHours(0, 0, 0, 0);
  const week = Math.ceil(((utcDate.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);

  return `${isoYear}-W${String(week).padStart(2, '0')}`;
}
