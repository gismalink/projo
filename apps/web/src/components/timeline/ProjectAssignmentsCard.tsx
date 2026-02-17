import { MouseEvent as ReactMouseEvent, MutableRefObject, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDayItem, ProjectDetail } from '../../api/client';
import { STANDARD_DAY_HOURS } from '../../hooks/app-helpers';
import { Icon } from '../Icon';

type AssignmentDragState = {
  projectId: string;
  assignmentId: string;
  mode: 'move' | 'resize-start' | 'resize-end';
  startDate: Date;
  endDate: Date;
  startX: number;
  trackWidth: number;
  shiftDays: number;
};

type PendingAssignmentPreview = {
  projectId: string;
  assignmentId: string;
  mode: 'move' | 'resize-start' | 'resize-end';
  nextStart: Date;
  nextEnd: Date;
};

type HoverAssignmentDragMode = {
  projectId: string;
  assignmentId: string;
  mode: 'move' | 'resize-start' | 'resize-end';
};

type ProjectAssignmentsCardProps = {
  t: Record<string, string>;
  detail: ProjectDetail;
  dayStep: string;
  calendarSegments: Array<{ key: string; left: string; width: string; kind: 'weekend' | 'holiday' }>;
  calendarDayByIso: Map<string, CalendarDayItem>;
  todayPosition: string | null;
  assignmentStyle: (startDate: string, endDate: string) => { left: string; width: string };
  employeeRoleColorById: Map<string, string>;
  employeeRoleLabelById: Map<string, string>;
  employeeGradeColorByName: Map<string, string>;
  onDeleteAssignment: (projectId: string, assignmentId: string) => Promise<void>;
  onUpdateAssignmentCurve: (
    projectId: string,
    assignmentId: string,
    loadProfile: {
      mode: 'curve';
      points: Array<{ date: string; value: number }>;
    },
  ) => Promise<void>;
  assignmentDragState: AssignmentDragState | null;
  resolveAssignmentDragDates: (state: AssignmentDragState) => { nextStart: Date; nextEnd: Date };
  pendingAssignmentPreview: PendingAssignmentPreview | null;
  hoverAssignmentDragMode: HoverAssignmentDragMode | null;
  toUtcDay: (value: Date) => Date;
  formatTooltipDate: (value: Date) => string;
  assignmentTooltipCacheRef: MutableRefObject<
    Map<string, { mode: 'move' | 'resize-start' | 'resize-end'; text: string }>
  >;
  handleAssignmentBarHover: (
    event: ReactMouseEvent<HTMLElement>,
    projectId: string,
    assignmentId: string,
  ) => void;
  clearAssignmentBarHover: (projectId: string, assignmentId: string) => void;
  beginAssignmentDrag: (
    event: ReactMouseEvent,
    projectId: string,
    assignmentId: string,
    startIso: string,
    endIso: string,
    mode: 'move' | 'resize-start' | 'resize-end',
  ) => void;
  vacationsByEmployeeId: Map<string, Array<{ startDate: string; endDate: string }>>;
  isoToInputDate: (value: string) => string;
  highlightedEmployeeId?: string;
};

type CurvePoint = {
  xRatio: number;
  value: number;
};

export function ProjectAssignmentsCard(props: ProjectAssignmentsCardProps) {
  const {
    t,
    detail,
    dayStep,
    calendarSegments,
    calendarDayByIso,
    todayPosition,
    assignmentStyle,
    employeeRoleColorById,
    employeeRoleLabelById,
    employeeGradeColorByName,
    onDeleteAssignment,
    onUpdateAssignmentCurve,
    assignmentDragState,
    resolveAssignmentDragDates,
    pendingAssignmentPreview,
    hoverAssignmentDragMode,
    toUtcDay,
    formatTooltipDate,
    assignmentTooltipCacheRef,
    handleAssignmentBarHover,
    clearAssignmentBarHover,
    beginAssignmentDrag,
    vacationsByEmployeeId,
    isoToInputDate,
    highlightedEmployeeId,
  } = props;

  const [curveDraftByAssignmentId, setCurveDraftByAssignmentId] = useState<Record<string, CurvePoint[]>>({});
  const [barSizeByAssignmentId, setBarSizeByAssignmentId] = useState<Record<string, { width: number; height: number }>>({});
  const barNodeByAssignmentIdRef = useRef<Record<string, HTMLSpanElement | null>>({});
  const barRefHandlerByAssignmentIdRef = useRef<Record<string, (node: HTMLSpanElement | null) => void>>({});
  const barResizeObserverRef = useRef<ResizeObserver | null>(null);
  const dragStateRef = useRef<{
    projectId: string;
    assignmentId: string;
    pointIndex: number;
    rect: DOMRect;
    sourceStartIso: string;
    sourceEndIso: string;
  } | null>(null);
  const isUnmountedRef = useRef(false);

  const sortedAssignments = useMemo(
    () =>
      [...detail.assignments].sort((left, right) => {
        const startDelta = new Date(left.assignmentStartDate).getTime() - new Date(right.assignmentStartDate).getTime();
        if (startDelta !== 0) return startDelta;
        const nameDelta = left.employee.fullName.localeCompare(right.employee.fullName);
        if (nameDelta !== 0) return nameDelta;
        return left.id.localeCompare(right.id);
      }),
    [detail.assignments],
  );

  const toUtcDayTimestamp = (value: string) => {
    const parsed = new Date(value);
    return Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate());
  };

  const clampPercent = (value: number) => Math.max(0, Math.min(100, value));

  const DEFAULT_CURVE_POINT_COUNT = 4;

  const buildDefaultCurvePoints = (allocationPercent: number): CurvePoint[] => {
    const clamped = clampPercent(Number(allocationPercent));
    const step = 1 / (DEFAULT_CURVE_POINT_COUNT - 1);
    return Array.from({ length: DEFAULT_CURVE_POINT_COUNT }, (_, index) => ({
      xRatio: step * index,
      value: clamped,
    }));
  };

  const getSourceCurvePoints = (
    assignment: ProjectDetail['assignments'][number],
    sourceStartIso: string,
    sourceEndIso: string,
  ): CurvePoint[] => {
    const sourceStartMs = toUtcDayTimestamp(sourceStartIso);
    const sourceEndMs = toUtcDayTimestamp(sourceEndIso);
    const sourceSpanMs = sourceEndMs - sourceStartMs;

    const fromProfile =
      assignment.loadProfile?.mode === 'curve' && Array.isArray(assignment.loadProfile.points)
        ? assignment.loadProfile.points
            .map((point) => ({
              xRatio: sourceSpanMs <= 0 ? 0 : (toUtcDayTimestamp(point.date) - sourceStartMs) / sourceSpanMs,
              value: clampPercent(Number(point.value)),
            }))
            .filter((point) => Number.isFinite(point.xRatio) && Number.isFinite(point.value))
        : [];

    if (fromProfile.length >= 2) {
      return fromProfile.map((point) => ({
        xRatio: Math.max(0, Math.min(1, point.xRatio)),
        value: clampPercent(point.value),
      }));
    }

    return buildDefaultCurvePoints(Number(assignment.allocationPercent));
  };

  const convertCurvePointsToLoadProfile = (
    points: CurvePoint[],
    sourceStartIso: string,
    sourceEndIso: string,
  ): { mode: 'curve'; points: Array<{ date: string; value: number }> } => {
    const sourceStartMs = toUtcDayTimestamp(sourceStartIso);
    const sourceEndMs = toUtcDayTimestamp(sourceEndIso);
    const spanMs = Math.max(1, sourceEndMs - sourceStartMs);
    const maxDayShift = Math.floor(spanMs / (24 * 60 * 60 * 1000));

    const withDates = points.map((point, index) => {
      if (index === 0) {
        return { date: new Date(sourceStartMs).toISOString(), value: clampPercent(point.value), index };
      }
      if (index === points.length - 1) {
        return { date: new Date(sourceEndMs).toISOString(), value: clampPercent(point.value), index };
      }

      const dayOffset = Math.max(1, Math.min(maxDayShift - 1, Math.round(point.xRatio * maxDayShift)));
      return {
        date: new Date(sourceStartMs + dayOffset * 24 * 60 * 60 * 1000).toISOString(),
        value: clampPercent(point.value),
        index,
      };
    });

    for (let index = 1; index < withDates.length - 1; index += 1) {
      const previousMs = new Date(withDates[index - 1].date).getTime();
      const currentMs = new Date(withDates[index].date).getTime();
      if (currentMs <= previousMs) {
        withDates[index].date = new Date(previousMs + 24 * 60 * 60 * 1000).toISOString();
      }
    }
    for (let index = withDates.length - 2; index >= 1; index -= 1) {
      const nextMs = new Date(withDates[index + 1].date).getTime();
      const currentMs = new Date(withDates[index].date).getTime();
      if (currentMs >= nextMs) {
        withDates[index].date = new Date(nextMs - 24 * 60 * 60 * 1000).toISOString();
      }
    }

    return {
      mode: 'curve',
      points: withDates.map((point) => ({ date: point.date, value: Number(point.value.toFixed(2)) })),
    };
  };

  const buildAssignmentCurveGeometry = (params: {
    widthPx: number;
    heightPx: number;
    points: CurvePoint[];
  }) => {
    const { widthPx, heightPx, points } = params;

    const mappedPoints = points.map((point) => {
        const ratio = Math.max(0, Math.min(1, point.xRatio));
        const x = ratio * widthPx;
        const y = ((100 - clampPercent(point.value)) / 100) * heightPx;
        return {
          x,
          y,
        };
      });

    if (mappedPoints.length === 0) {
      return {
        linePath: '',
        areaPath: '',
      };
    }
    if (mappedPoints.length === 1) {
      const single = mappedPoints[0];
      const singlePath = `M ${single.x.toFixed(3)} ${single.y.toFixed(3)}`;
      return {
        linePath: singlePath,
        areaPath: `${singlePath} L ${single.x.toFixed(3)} ${heightPx.toFixed(3)} Z`,
      };
    }

    let linePath = `M ${mappedPoints[0].x.toFixed(3)} ${mappedPoints[0].y.toFixed(3)}`;
    for (let index = 1; index < mappedPoints.length - 1; index += 1) {
      const current = mappedPoints[index];
      const next = mappedPoints[index + 1];
      const midX = (current.x + next.x) / 2;
      const midY = (current.y + next.y) / 2;
      linePath += ` Q ${current.x.toFixed(3)} ${current.y.toFixed(3)} ${midX.toFixed(3)} ${midY.toFixed(3)}`;
    }
    const penultimate = mappedPoints[mappedPoints.length - 2];
    const last = mappedPoints[mappedPoints.length - 1];
    linePath += ` Q ${penultimate.x.toFixed(3)} ${penultimate.y.toFixed(3)} ${last.x.toFixed(3)} ${last.y.toFixed(3)}`;

    const first = mappedPoints[0];
    const areaPath = `${linePath} L ${last.x.toFixed(3)} ${heightPx.toFixed(3)} L ${first.x.toFixed(3)} ${heightPx.toFixed(3)} Z`;

    return {
      linePath,
      areaPath,
    };
  };

  useEffect(() => {
    return () => {
      isUnmountedRef.current = true;
      barResizeObserverRef.current?.disconnect();
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver((entries) => {
      setBarSizeByAssignmentId((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const entry of entries) {
          const target = entry.target as HTMLElement;
          const assignmentId = target.dataset.assignmentId;
          if (!assignmentId) continue;
          const width = Math.max(1, Math.round(entry.contentRect.width));
          const height = Math.max(1, Math.round(entry.contentRect.height));
          const current = next[assignmentId];
          if (!current || current.width !== width || current.height !== height) {
            next[assignmentId] = { width, height };
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    });

    barResizeObserverRef.current = observer;
    for (const node of Object.values(barNodeByAssignmentIdRef.current)) {
      if (node) observer.observe(node);
    }

    return () => {
      observer.disconnect();
      if (barResizeObserverRef.current === observer) {
        barResizeObserverRef.current = null;
      }
    };
  }, []);

  const bindAssignmentBarNode = (assignmentId: string) => {
    if (!barRefHandlerByAssignmentIdRef.current[assignmentId]) {
      barRefHandlerByAssignmentIdRef.current[assignmentId] = (node: HTMLSpanElement | null) => {
        const previousNode = barNodeByAssignmentIdRef.current[assignmentId];
        if (previousNode && previousNode !== node) {
          barResizeObserverRef.current?.unobserve(previousNode);
        }

        if (node) {
          barNodeByAssignmentIdRef.current[assignmentId] = node;
          barResizeObserverRef.current?.observe(node);
          return;
        }

        delete barNodeByAssignmentIdRef.current[assignmentId];
      };
    }

    return barRefHandlerByAssignmentIdRef.current[assignmentId];
  };

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const drag = dragStateRef.current;
      if (!drag) return;
      const ratioX = (event.clientX - drag.rect.left) / Math.max(1, drag.rect.width);
      const ratioY = (event.clientY - drag.rect.top) / Math.max(1, drag.rect.height);
      const nextValue = clampPercent((1 - ratioY) * 100);

      setCurveDraftByAssignmentId((prev) => {
        const current = prev[drag.assignmentId];
        if (!current || !current[drag.pointIndex]) return prev;
        const next = [...current];
        const nextXRatio =
          drag.pointIndex === 0
            ? 0
            : drag.pointIndex === current.length - 1
              ? 1
              : Math.max(
                  next[drag.pointIndex - 1].xRatio + 0.01,
                  Math.min(next[drag.pointIndex + 1].xRatio - 0.01, Math.max(0, Math.min(1, ratioX))),
                );
        next[drag.pointIndex] = {
          xRatio: nextXRatio,
          value: nextValue,
        };
        return {
          ...prev,
          [drag.assignmentId]: next,
        };
      });
    };

    const handleMouseUp = () => {
      const drag = dragStateRef.current;
      if (!drag) return;
      const draft = curveDraftByAssignmentId[drag.assignmentId];
      dragStateRef.current = null;
      if (!draft || draft.length < 2 || isUnmountedRef.current) return;
      const payload = convertCurvePointsToLoadProfile(draft, drag.sourceStartIso, drag.sourceEndIso);
      void onUpdateAssignmentCurve(drag.projectId, drag.assignmentId, payload);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [curveDraftByAssignmentId, onUpdateAssignmentCurve]);

  const actualHoursByAssignmentId = useMemo(() => {
    const result = new Map<string, { actualHours: number; lostHours: number }>();

    const toUtcDay = (value: Date) => new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
    const formatIso = (value: Date) => toUtcDay(value).toISOString().slice(0, 10);
    const isWeekendByDate = (value: Date) => {
      const day = value.getUTCDay();
      return day === 0 || day === 6;
    };

    for (const assignment of sortedAssignments) {
      const assignmentStart = toUtcDay(new Date(assignment.assignmentStartDate));
      const assignmentEnd = toUtcDay(new Date(assignment.assignmentEndDate));
      if (assignmentEnd < assignmentStart) {
        result.set(assignment.id, { actualHours: 0, lostHours: 0 });
        continue;
      }

      const dailyHours =
        assignment.plannedHoursPerDay !== null
          ? Number(assignment.plannedHoursPerDay)
          : (STANDARD_DAY_HOURS * Number(assignment.allocationPercent)) / 100;

      if (!Number.isFinite(dailyHours) || dailyHours <= 0) {
        result.set(assignment.id, { actualHours: 0, lostHours: 0 });
        continue;
      }

      const vacations = vacationsByEmployeeId.get(assignment.employeeId) ?? [];
      const vacationRanges = vacations.map((vacation) => ({
        start: toUtcDay(new Date(vacation.startDate)),
        end: toUtcDay(new Date(vacation.endDate)),
      }));

      let totalHours = 0;
      let plannedHours = 0;
      const cursor = new Date(assignmentStart);
      while (cursor <= assignmentEnd) {
        const isoDate = formatIso(cursor);
        const calendarDay = calendarDayByIso.get(isoDate);
        const isWorkingDay = calendarDay ? calendarDay.isWorkingDay : !isWeekendByDate(cursor);

        if (isWorkingDay) {
          plannedHours += dailyHours;
          const onVacation = vacationRanges.some((range) => cursor >= range.start && cursor <= range.end);
          if (!onVacation) {
            totalHours += dailyHours;
          }
        }

        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }

      result.set(assignment.id, {
        actualHours: Number(totalHours.toFixed(2)),
        lostHours: Number(Math.max(0, plannedHours - totalHours).toFixed(2)),
      });
    }

    return result;
  }, [calendarDayByIso, sortedAssignments, vacationsByEmployeeId]);

  return (
    <section className="project-card">
      <div className="assignment-list">
        {sortedAssignments.length === 0 ? (
          <p className="muted">{t.noAssignments}</p>
        ) : (
          sortedAssignments.map((assignment) => (
            <div
              key={assignment.id}
              className={
                highlightedEmployeeId
                  ? assignment.employeeId === highlightedEmployeeId
                    ? 'assignment-item highlighted'
                    : 'assignment-item muted'
                  : 'assignment-item'
              }
            >
              <div className="assignment-item-header">
                <div className="assignment-employee-name">
                  <span
                    className="timeline-role-chip"
                    style={{ background: employeeRoleColorById.get(assignment.employeeId) ?? '#6E7B8A' }}
                  >
                    {employeeRoleLabelById.get(assignment.employeeId) ?? assignment.employee.role.name}
                  </span>
                  {assignment.employee.grade ? (
                    <span
                      className="timeline-role-chip"
                      style={{ background: employeeGradeColorByName.get(assignment.employee.grade) ?? '#6E7B8A' }}
                    >
                      {assignment.employee.grade}
                    </span>
                  ) : null}
                  <strong>{assignment.employee.fullName}</strong>
                </div>

                <div className="assignment-kpi-row">
                  <span className="assignment-kpi-item">
                    <Icon name="users" size={12} />
                    <span className="assignment-kpi-value">{Number(assignment.allocationPercent)}%</span>
                    <span className="timeline-inline-tooltip" role="tooltip">{t.allocationPercent}</span>
                  </span>
                  <span className="assignment-kpi-item">
                    <Icon name="check" size={12} />
                    <span className="assignment-kpi-value">{(actualHoursByAssignmentId.get(assignment.id)?.actualHours ?? 0).toFixed(1)}</span>
                    <span className="timeline-inline-tooltip" role="tooltip">{t.factHoursShort}</span>
                  </span>
                  <span className="assignment-kpi-item">
                    <Icon name="x" size={12} />
                    <span className="assignment-kpi-value">{(actualHoursByAssignmentId.get(assignment.id)?.lostHours ?? 0).toFixed(1)}</span>
                    <span className="timeline-inline-tooltip" role="tooltip">{t.lostHoursShort}</span>
                  </span>
                </div>

                <span
                  role="button"
                  tabIndex={0}
                  className="assignment-remove-btn"
                  title={t.removeAssignment}
                  aria-label={t.removeAssignment}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (!window.confirm(t.confirmRemoveAssignment)) return;
                    void onDeleteAssignment(detail.id, assignment.id);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      event.stopPropagation();
                      if (!window.confirm(t.confirmRemoveAssignment)) return;
                      void onDeleteAssignment(detail.id, assignment.id);
                    }
                  }}
                >
                    <Icon name="x" />
                </span>
              </div>
              <div className="assignment-track">
                {calendarSegments.map((segment) => (
                  <span
                    key={`${assignment.id}-segment-${segment.key}`}
                    className={`calendar-day-segment ${segment.kind === 'holiday' ? 'holiday' : 'weekend'}`}
                    style={{ left: segment.left, width: segment.width }}
                  />
                ))}
                <span className="track-day-grid" style={{ ['--day-step' as string]: dayStep }} />
                {todayPosition ? <span className="current-day-line" style={{ left: todayPosition }} /> : null}
                {(() => {
                  const dragPreview =
                    assignmentDragState && assignmentDragState.assignmentId === assignment.id
                      ? resolveAssignmentDragDates(assignmentDragState)
                      : null;
                  const pendingPreview =
                    pendingAssignmentPreview && pendingAssignmentPreview.assignmentId === assignment.id
                      ? pendingAssignmentPreview
                      : null;
                  const startIso = dragPreview
                    ? dragPreview.nextStart.toISOString()
                    : pendingPreview
                      ? pendingPreview.nextStart.toISOString()
                      : assignment.assignmentStartDate;
                  const endIso = dragPreview
                    ? dragPreview.nextEnd.toISOString()
                    : pendingPreview
                      ? pendingPreview.nextEnd.toISOString()
                      : assignment.assignmentEndDate;
                  const sourceCurvePoints =
                    curveDraftByAssignmentId[assignment.id] ??
                    getSourceCurvePoints(assignment, assignment.assignmentStartDate, assignment.assignmentEndDate);
                  const roleColor = employeeRoleColorById.get(assignment.employeeId) ?? '#6E7B8A';
                  const barSize = barSizeByAssignmentId[assignment.id] ?? { width: 100, height: 24 };
                  const curveGeometry = buildAssignmentCurveGeometry({
                    widthPx: barSize.width,
                    heightPx: barSize.height,
                    points: sourceCurvePoints,
                  });
                  const assignmentTooltipMode =
                    assignmentDragState && assignmentDragState.assignmentId === assignment.id
                      ? assignmentDragState.mode
                      : hoverAssignmentDragMode &&
                          hoverAssignmentDragMode.projectId === detail.id &&
                          hoverAssignmentDragMode.assignmentId === assignment.id
                        ? hoverAssignmentDragMode.mode
                        : null;
                  const assignmentTooltipStart = dragPreview?.nextStart ?? toUtcDay(new Date(assignment.assignmentStartDate));
                  const assignmentTooltipEnd = dragPreview?.nextEnd ?? toUtcDay(new Date(assignment.assignmentEndDate));
                  const assignmentTooltipText =
                    assignmentTooltipMode === 'resize-start'
                      ? formatTooltipDate(assignmentTooltipStart)
                      : assignmentTooltipMode === 'resize-end'
                        ? formatTooltipDate(assignmentTooltipEnd)
                        : assignmentTooltipMode === 'move'
                          ? `${formatTooltipDate(assignmentTooltipStart)} - ${formatTooltipDate(assignmentTooltipEnd)}`
                          : '';
                  const assignmentTooltipKey = `${detail.id}:${assignment.id}`;
                  if (assignmentTooltipMode) {
                    assignmentTooltipCacheRef.current.set(assignmentTooltipKey, {
                      mode: assignmentTooltipMode,
                      text: assignmentTooltipText,
                    });
                  }
                  const cachedAssignmentTooltip = assignmentTooltipCacheRef.current.get(assignmentTooltipKey);
                  const displayAssignmentTooltipMode =
                    assignmentTooltipMode ?? cachedAssignmentTooltip?.mode ?? 'move';
                  const displayAssignmentTooltipText = assignmentTooltipMode
                    ? assignmentTooltipText
                    : (cachedAssignmentTooltip?.text ?? '');

                  return (
                    <span
                      ref={bindAssignmentBarNode(assignment.id)}
                      data-assignment-id={assignment.id}
                      className="assignment-bar"
                      style={{
                        ...assignmentStyle(startIso, endIso),
                      }}
                      onMouseMove={(event) => handleAssignmentBarHover(event, detail.id, assignment.id)}
                      onMouseLeave={() => clearAssignmentBarHover(detail.id, assignment.id)}
                    >
                      <svg
                        className="assignment-curve"
                        viewBox={`0 0 ${barSize.width} ${barSize.height}`}
                        preserveAspectRatio="xMinYMin meet"
                        aria-hidden
                        style={{ color: roleColor }}
                      >
                        <path className="assignment-curve-area" d={curveGeometry.areaPath} />
                        <path className="assignment-curve-line" d={curveGeometry.linePath} />
                        {sourceCurvePoints.map((point, pointIndex) => (
                          <circle
                            key={`${assignment.id}-curve-point-${pointIndex}`}
                            className="assignment-curve-point"
                            cx={(Math.max(0, Math.min(1, point.xRatio)) * barSize.width).toFixed(3)}
                            cy={(((100 - clampPercent(point.value)) / 100) * barSize.height).toFixed(3)}
                            r="4"
                            onMouseDown={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              const rect = (event.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                              dragStateRef.current = {
                                projectId: detail.id,
                                assignmentId: assignment.id,
                                pointIndex,
                                rect,
                                sourceStartIso: assignment.assignmentStartDate,
                                sourceEndIso: assignment.assignmentEndDate,
                              };
                              if (!curveDraftByAssignmentId[assignment.id]) {
                                setCurveDraftByAssignmentId((prev) => ({
                                  ...prev,
                                  [assignment.id]: sourceCurvePoints,
                                }));
                              }
                            }}
                          />
                        ))}
                      </svg>
                      <span
                        className={
                          displayAssignmentTooltipMode === 'resize-start'
                            ? `project-plan-tooltip edge-left${assignmentTooltipMode ? ' visible' : ''}`
                            : displayAssignmentTooltipMode === 'resize-end'
                              ? `project-plan-tooltip edge-right${assignmentTooltipMode ? ' visible' : ''}`
                              : displayAssignmentTooltipMode === 'move'
                                ? `project-plan-tooltip center${assignmentTooltipMode ? ' visible' : ''}`
                                : 'project-plan-tooltip center'
                        }
                        aria-hidden={assignmentTooltipMode ? undefined : true}
                      >
                        {displayAssignmentTooltipText}
                      </span>
                      <span
                        className="assignment-plan-handle left"
                        onMouseDown={(event) =>
                          beginAssignmentDrag(
                            event,
                            detail.id,
                            assignment.id,
                            assignment.assignmentStartDate,
                            assignment.assignmentEndDate,
                            'resize-start',
                          )
                        }
                      />
                      <span
                        className="assignment-plan-handle center"
                        onMouseDown={(event) =>
                          beginAssignmentDrag(
                            event,
                            detail.id,
                            assignment.id,
                            assignment.assignmentStartDate,
                            assignment.assignmentEndDate,
                            'move',
                          )
                        }
                      />
                      <span
                        className="assignment-plan-handle right"
                        onMouseDown={(event) =>
                          beginAssignmentDrag(
                            event,
                            detail.id,
                            assignment.id,
                            assignment.assignmentStartDate,
                            assignment.assignmentEndDate,
                            'resize-end',
                          )
                        }
                      />
                    </span>
                  );
                })()}
              </div>
              <div className="assignment-vacation-track">
                <span className="track-day-grid" style={{ ['--day-step' as string]: dayStep }} />
                {(vacationsByEmployeeId.get(assignment.employeeId) ?? []).map((vacation, index) => (
                  <span
                    key={`${assignment.id}-vacation-${index}`}
                    className="timeline-inline-tooltip-anchor assignment-vacation-tooltip-anchor"
                    style={assignmentStyle(vacation.startDate, vacation.endDate)}
                  >
                    <span className="assignment-vacation-bar" style={{ left: '0', width: '100%' }} />
                    <span className="timeline-inline-tooltip" role="tooltip">
                      {isoToInputDate(vacation.startDate)} {t.fromTo} {isoToInputDate(vacation.endDate)}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}