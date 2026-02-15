import { ApiError, ProjectTimelineRow } from '../api/client';

const parsedStandardDayHours = Number(import.meta.env.VITE_STANDARD_DAY_HOURS ?? 8);
export const STANDARD_DAY_HOURS = Number.isFinite(parsedStandardDayHours) && parsedStandardDayHours > 0
  ? parsedStandardDayHours
  : 8;

function dayOfYear(date: Date) {
  const start = new Date(Date.UTC(date.getUTCFullYear(), 0, 0));
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / 86400000);
}

export function daysInYear(year: number) {
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year + 1, 0, 1));
  return Math.floor((end.getTime() - start.getTime()) / 86400000);
}

export function overlapDaysInYear(start: Date, end: Date, year: number) {
  const rangeStart = new Date(Date.UTC(year, 0, 1));
  const rangeEnd = new Date(Date.UTC(year, 11, 31));
  const effectiveStart = start > rangeStart ? start : rangeStart;
  const effectiveEnd = end < rangeEnd ? end : rangeEnd;
  if (effectiveEnd < effectiveStart) return 0;
  const ms = effectiveEnd.getTime() - effectiveStart.getTime();
  return Math.floor(ms / 86400000) + 1;
}

export function timelineStyle(row: ProjectTimelineRow) {
  const start = new Date(row.startDate);
  const end = new Date(row.endDate);
  const yearStart = new Date(Date.UTC(start.getUTCFullYear(), 0, 1));
  const yearEnd = new Date(Date.UTC(start.getUTCFullYear(), 11, 31));

  const effectiveStart = start < yearStart ? yearStart : start;
  const effectiveEnd = end > yearEnd ? yearEnd : end;
  const totalDays = dayOfYear(yearEnd);
  const startOffset = dayOfYear(effectiveStart) / totalDays;
  const endOffset = dayOfYear(effectiveEnd) / totalDays;

  return {
    left: `${(startOffset * 100).toFixed(2)}%`,
    width: `${Math.max((endOffset - startOffset) * 100, 1.2).toFixed(2)}%`,
  };
}

export function isoToInputDate(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

export function roleColorOrDefault(colorHex?: string | null) {
  return colorHex && /^#[0-9A-Fa-f]{6}$/.test(colorHex) ? colorHex : '#6E7B8A';
}

export function utilizationColor(value: number) {
  if (value > 110) return '#D64545';
  if (value >= 90 && value <= 105) return '#2EA44F';
  return '#D9A441';
}

export function resolveErrorMessage(error: unknown, fallback: string, errorText: Record<string, string>) {
  if (error instanceof ApiError) {
    return errorText[error.code] ?? error.message ?? fallback;
  }
  if (error instanceof Error) {
    return errorText[error.message] ?? error.message ?? fallback;
  }
  return fallback;
}
