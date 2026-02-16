import { CalendarDayItem } from '../../api/client';
import { MS_PER_DAY } from './timeline.constants';

export function toUtcDay(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

export function shiftDateByDays(value: Date, days: number) {
  const next = toUtcDay(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function diffDays(from: Date, to: Date) {
  const diff = toUtcDay(to).getTime() - toUtcDay(from).getTime();
  return Math.round(diff / MS_PER_DAY);
}

export function buildDayMarkers(params: {
  selectedYear: number;
  yearStart: Date;
  totalDays: number;
  dayMarkerStep: number;
  calendarDayByIso: Map<string, CalendarDayItem>;
  dayKindLabel: (day: CalendarDayItem | undefined) => string;
}) {
  const { selectedYear, yearStart, totalDays, dayMarkerStep, calendarDayByIso, dayKindLabel } = params;
  const dayMarkers: Array<{ key: string; left: string; label: string; title: string }> = [];

  for (let dayOffset = 0; dayOffset < totalDays; dayOffset += dayMarkerStep) {
    const date = new Date(yearStart);
    date.setUTCDate(date.getUTCDate() + dayOffset);
    const isoDate = date.toISOString().slice(0, 10);
    const dayInfo = calendarDayByIso.get(isoDate);
    dayMarkers.push({
      key: `${selectedYear}-${dayOffset}`,
      left: `${((dayOffset / totalDays) * 100).toFixed(2)}%`,
      label: String(date.getUTCDate()),
      title: `${isoDate} · ${dayKindLabel(dayInfo)}`,
    });
  }

  return dayMarkers;
}

export function buildCalendarSegments(params: {
  yearStart: Date;
  totalDays: number;
  calendarDayByIso: Map<string, CalendarDayItem>;
}) {
  const { yearStart, totalDays, calendarDayByIso } = params;
  const segments: Array<{ key: string; left: string; width: string; kind: 'weekend' | 'holiday' }> = [];
  const widthPercent = 100 / totalDays;
  let lastSegmentEndDayOffset = -2;

  for (let dayOffset = 0; dayOffset < totalDays; dayOffset += 1) {
    const date = new Date(yearStart);
    date.setUTCDate(date.getUTCDate() + dayOffset);
    const isoDate = date.toISOString().slice(0, 10);
    const dayInfo = calendarDayByIso.get(isoDate);
    if (!dayInfo) {
      lastSegmentEndDayOffset = -2;
      continue;
    }
    const kind: 'weekend' | 'holiday' | null = dayInfo.isHoliday ? 'holiday' : dayInfo.isWeekend ? 'weekend' : null;
    if (!kind) {
      lastSegmentEndDayOffset = -2;
      continue;
    }

    const leftPercent = (dayOffset / totalDays) * 100;
    const prev = segments[segments.length - 1];
    if (!prev || prev.kind !== kind || lastSegmentEndDayOffset !== dayOffset - 1) {
      segments.push({
        key: `${isoDate}-${kind}`,
        left: `${leftPercent.toFixed(6)}%`,
        width: `${widthPercent.toFixed(6)}%`,
        kind,
      });
      lastSegmentEndDayOffset = dayOffset;
      continue;
    }

    const prevWidth = Number(prev.width.replace('%', ''));
    prev.width = `${(prevWidth + widthPercent).toFixed(6)}%`;
    lastSegmentEndDayOffset = dayOffset;
  }

  return segments;
}

export function getTodayPosition(selectedYear: number, now = new Date()) {
  if (now.getFullYear() !== selectedYear) {
    return null;
  }

  const start = new Date(Date.UTC(selectedYear, 0, 1));
  const end = new Date(Date.UTC(selectedYear, 11, 31));
  const total = end.getTime() - start.getTime();
  const current = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const fromStart = current.getTime() - start.getTime();
  return `${Math.max(0, Math.min(100, (fromStart / total) * 100)).toFixed(2)}%`;
}
