type AssignmentLoadPoint = {
  dateMs: number;
  value: number;
};

export function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

export function startOfUtcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

export function createAssignmentLoadPercentResolver(assignment: {
  allocationPercent: unknown;
  loadProfile?: unknown;
}): (date: Date) => number {
  const fallback = clampPercent(Number(assignment.allocationPercent));
  const profile = assignment.loadProfile;
  if (!profile || typeof profile !== 'object') {
    return () => fallback;
  }

  const candidate = profile as { mode?: unknown; points?: unknown };
  if (candidate.mode !== 'curve' || !Array.isArray(candidate.points) || candidate.points.length < 2) {
    return () => fallback;
  }

  const points = candidate.points
    .map((point) => {
      if (!point || typeof point !== 'object') return null;
      const typedPoint = point as { date?: unknown; value?: unknown };
      if (typeof typedPoint.date !== 'string') return null;
      const date = new Date(typedPoint.date);
      const value = Number(typedPoint.value);
      if (Number.isNaN(date.getTime()) || !Number.isFinite(value)) return null;
      return {
        dateMs: startOfUtcDay(date).getTime(),
        value: clampPercent(value),
      } satisfies AssignmentLoadPoint;
    })
    .filter((point): point is AssignmentLoadPoint => Boolean(point))
    .sort((left, right) => left.dateMs - right.dateMs);

  if (points.length < 2) {
    return () => fallback;
  }

  return (date: Date) => {
    const dateMs = startOfUtcDay(date).getTime();
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

export function getAverageAssignmentLoadPercent(assignment: {
  assignmentStartDate: Date;
  assignmentEndDate: Date;
  allocationPercent: unknown;
  loadProfile?: unknown;
}): number {
  const start = startOfUtcDay(assignment.assignmentStartDate);
  const end = startOfUtcDay(assignment.assignmentEndDate);
  if (end < start) return 0;

  const resolveLoadPercent = createAssignmentLoadPercentResolver(assignment);
  let sum = 0;
  let days = 0;
  const cursor = new Date(start);
  while (cursor <= end) {
    sum += resolveLoadPercent(cursor);
    days += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return days > 0 ? sum / days : 0;
}