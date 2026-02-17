import { ApiError, ProjectTimelineRow } from '../api/client';
import { DEFAULT_FALLBACK_COLOR_HEX, MIN_TIMELINE_BAR_WIDTH_PERCENT, MS_PER_DAY } from '../constants/app.constants';

const parsedStandardDayHours = Number(import.meta.env.VITE_STANDARD_DAY_HOURS ?? 8);
export const STANDARD_DAY_HOURS = Number.isFinite(parsedStandardDayHours) && parsedStandardDayHours > 0
  ? parsedStandardDayHours
  : 8;

type AssignmentLoadProfilePoint = {
  date: string;
  value: number;
};

type AssignmentLoadProfile = {
  mode: 'flat' | 'curve';
  points?: AssignmentLoadProfilePoint[];
};

type AssignmentLoadLike = {
  assignmentStartDate: string;
  assignmentEndDate: string;
  allocationPercent: string | number;
  loadProfile?: AssignmentLoadProfile | null;
};

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

function toUtcDayStart(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function toUtcDayMs(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  return toUtcDayStart(date).getTime();
}

export function createAssignmentLoadPercentResolver(assignment: AssignmentLoadLike) {
  const fallback = clampPercent(Number(assignment.allocationPercent));
  const profile = assignment.loadProfile;

  if (!profile || profile.mode !== 'curve' || !Array.isArray(profile.points) || profile.points.length < 2) {
    return () => fallback;
  }

  const points = profile.points
    .map((point) => ({
      dateMs: toUtcDayMs(point.date),
      value: clampPercent(Number(point.value)),
    }))
    .filter((point) => Number.isFinite(point.dateMs) && Number.isFinite(point.value))
    .sort((left, right) => left.dateMs - right.dateMs);

  if (points.length < 2) {
    return () => fallback;
  }

  return (date: Date) => {
    const dateMs = toUtcDayMs(date);
    if (dateMs <= points[0].dateMs) return points[0].value;
    if (dateMs >= points[points.length - 1].dateMs) return points[points.length - 1].value;

    for (let index = 0; index < points.length - 1; index += 1) {
      const start = points[index];
      const end = points[index + 1];
      if (dateMs < start.dateMs || dateMs > end.dateMs) continue;
      const span = end.dateMs - start.dateMs;
      if (span <= 0) return start.value;
      const ratio = (dateMs - start.dateMs) / span;
      return start.value + (end.value - start.value) * ratio;
    }

    return fallback;
  };
}

function dayOfYear(date: Date) {
  const start = new Date(Date.UTC(date.getUTCFullYear(), 0, 0));
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / MS_PER_DAY);
}

export function daysInYear(year: number) {
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year + 1, 0, 1));
  return Math.floor((end.getTime() - start.getTime()) / MS_PER_DAY);
}

export function overlapDaysInYear(start: Date, end: Date, year: number) {
  const rangeStart = new Date(Date.UTC(year, 0, 1));
  const rangeEnd = new Date(Date.UTC(year, 11, 31));
  const effectiveStart = start > rangeStart ? start : rangeStart;
  const effectiveEnd = end < rangeEnd ? end : rangeEnd;
  if (effectiveEnd < effectiveStart) return 0;
  const ms = effectiveEnd.getTime() - effectiveStart.getTime();
  return Math.floor(ms / MS_PER_DAY) + 1;
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
    width: `${Math.max((endOffset - startOffset) * 100, MIN_TIMELINE_BAR_WIDTH_PERCENT).toFixed(2)}%`,
  };
}

export function isoToInputDate(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

export function roleColorOrDefault(colorHex?: string | null) {
  return colorHex && /^#[0-9A-Fa-f]{6}$/.test(colorHex) ? colorHex : DEFAULT_FALLBACK_COLOR_HEX;
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
