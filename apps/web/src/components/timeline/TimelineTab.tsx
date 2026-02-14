import { MouseEvent as ReactMouseEvent, useEffect, useMemo, useRef, useState } from 'react';
import { AssignmentItem, ProjectDetail, ProjectTimelineRow } from '../../api/client';

type TimelineTabProps = {
  t: Record<string, string>;
  months: string[];
  selectedYear: number;
  assignments: AssignmentItem[];
  vacations: Array<{ employeeId: string; startDate: string; endDate: string }>;
  employees: Array<{ id: string; fullName: string; role: { name: string; shortName?: string | null }; department?: { name: string } | null }>;
  roles: Array<{ name: string; colorHex?: string | null }>;
  sortedTimeline: ProjectTimelineRow[];
  expandedProjectIds: string[];
  projectDetails: Record<string, ProjectDetail>;
  onOpenProjectModal: () => void;
  onOpenProjectDatesModal: (projectId: string) => void;
  onOpenAssignmentModal: (projectId: string, employeeId?: string) => void;
  onSelectProject: (projectId: string) => Promise<void>;
  onYearChange: (nextYear: number) => Promise<void>;
  onDeleteAssignment: (projectId: string, assignmentId: string) => Promise<void>;
  onAdjustAssignmentPlan: (
    projectId: string,
    assignmentId: string,
    nextStartIso: string,
    nextEndIso: string,
  ) => Promise<void>;
  onMoveProject: (projectId: string, direction: 'up' | 'down') => void;
  onAdjustProjectPlan: (
    projectId: string,
    nextStartIso: string,
    nextEndIso: string,
    shiftDays: number,
    mode: 'move' | 'resize-start' | 'resize-end',
  ) => Promise<void>;
  timelineStyle: (row: ProjectTimelineRow) => { left: string; width: string };
  isoToInputDate: (value: string) => string;
};

export function TimelineTab(props: TimelineTabProps) {
  const {
    t,
    months,
    selectedYear,
    assignments,
    vacations,
    employees,
    roles,
    sortedTimeline,
    expandedProjectIds,
    projectDetails,
    onOpenProjectModal,
    onOpenProjectDatesModal,
    onOpenAssignmentModal,
    onSelectProject,
    onYearChange,
    onDeleteAssignment,
    onAdjustAssignmentPlan,
    onMoveProject,
    onAdjustProjectPlan,
    timelineStyle,
    isoToInputDate,
  } = props;

  const [dragState, setDragState] = useState<{
    projectId: string;
    mode: 'move' | 'resize-start' | 'resize-end';
    startDate: Date;
    endDate: Date;
    startX: number;
    trackWidth: number;
    shiftDays: number;
  } | null>(null);
  const [pendingPlanPreview, setPendingPlanPreview] = useState<{
    projectId: string;
    mode: 'move' | 'resize-start' | 'resize-end';
    nextStart: Date;
    nextEnd: Date;
    shiftDays: number;
  } | null>(null);
  const [hoverDragMode, setHoverDragMode] = useState<{
    projectId: string;
    mode: 'move' | 'resize-start' | 'resize-end';
  } | null>(null);
  const [assignmentDragState, setAssignmentDragState] = useState<{
    projectId: string;
    assignmentId: string;
    mode: 'move' | 'resize-start' | 'resize-end';
    startDate: Date;
    endDate: Date;
    startX: number;
    trackWidth: number;
    shiftDays: number;
  } | null>(null);
  const [hoverAssignmentDragMode, setHoverAssignmentDragMode] = useState<{
    projectId: string;
    assignmentId: string;
    mode: 'move' | 'resize-start' | 'resize-end';
  } | null>(null);
  const [pendingAssignmentPreview, setPendingAssignmentPreview] = useState<{
    projectId: string;
    assignmentId: string;
    mode: 'move' | 'resize-start' | 'resize-end';
    nextStart: Date;
    nextEnd: Date;
  } | null>(null);
  const suppressToggleClickRef = useRef(false);
  const dragMovedRef = useRef(false);
  const suppressAssignmentClickRef = useRef(false);
  const assignmentDragMovedRef = useRef(false);
  const projectTooltipCacheRef = useRef(new Map<string, { mode: 'move' | 'resize-start' | 'resize-end'; text: string }>());
  const assignmentTooltipCacheRef = useRef(
    new Map<string, { mode: 'move' | 'resize-start' | 'resize-end'; text: string }>(),
  );
  const [draggedBenchEmployeeId, setDraggedBenchEmployeeId] = useState<string | null>(null);
  const [hoverProjectDropId, setHoverProjectDropId] = useState<string | null>(null);

  useEffect(() => {
    if (!dragState && !assignmentDragState) return;
    document.body.classList.add('timeline-no-select');
    return () => {
      document.body.classList.remove('timeline-no-select');
    };
  }, [dragState, assignmentDragState]);

  const expandedSet = new Set(expandedProjectIds);
  const yearStart = new Date(Date.UTC(selectedYear, 0, 1));
  const yearEnd = new Date(Date.UTC(selectedYear + 1, 0, 1));
  const totalDays = Math.max(1, Math.floor((yearEnd.getTime() - yearStart.getTime()) / 86400000));
  const dayStep = `${(100 / totalDays).toFixed(5)}%`;
  const dayMarkers = [];
  for (let dayOffset = 0; dayOffset < totalDays; dayOffset += 7) {
    const date = new Date(yearStart);
    date.setUTCDate(date.getUTCDate() + dayOffset);
    dayMarkers.push({
      key: `${selectedYear}-${dayOffset}`,
      left: `${((dayOffset / totalDays) * 100).toFixed(2)}%`,
      label: String(date.getUTCDate()),
    });
  }

  const now = new Date();
  const isCurrentYear = now.getFullYear() === selectedYear;
  const todayPosition = isCurrentYear
    ? (() => {
        const start = new Date(Date.UTC(selectedYear, 0, 1));
        const end = new Date(Date.UTC(selectedYear, 11, 31));
        const total = end.getTime() - start.getTime();
        const current = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
        const fromStart = current.getTime() - start.getTime();
        return `${Math.max(0, Math.min(100, (fromStart / total) * 100)).toFixed(2)}%`;
      })()
    : null;

  const companyDailyLoad = useMemo(() => {
    const yearStart = new Date(Date.UTC(selectedYear, 0, 1));
    const yearEnd = new Date(Date.UTC(selectedYear + 1, 0, 1));
    const days = Math.max(1, Math.floor((yearEnd.getTime() - yearStart.getTime()) / 86400000));
    const totals = Array.from({ length: days }, () => 0);

    for (const assignment of assignments) {
      const allocation = Number(assignment.allocationPercent);
      if (!Number.isFinite(allocation) || allocation <= 0) continue;

      const start = new Date(assignment.assignmentStartDate);
      const end = new Date(assignment.assignmentEndDate);
      const effectiveStart = start < yearStart ? yearStart : start;
      const effectiveEnd = end >= yearEnd ? new Date(yearEnd.getTime() - 86400000) : end;
      if (effectiveEnd < effectiveStart) continue;

      const startIndex = Math.max(0, Math.floor((effectiveStart.getTime() - yearStart.getTime()) / 86400000));
      const endIndex = Math.min(days - 1, Math.floor((effectiveEnd.getTime() - yearStart.getTime()) / 86400000));
      for (let i = startIndex; i <= endIndex; i += 1) {
        totals[i] += allocation;
      }
    }

    const max = Math.max(1, ...totals);
    return { totals, max };
  }, [assignments, selectedYear]);

  const companyLoadScaleMax = Math.max(100, Math.ceil(companyDailyLoad.max / 25) * 25);

  const toUtcDay = (value: Date) => new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  const yearStartDay = new Date(Date.UTC(selectedYear, 0, 1));
  const yearEndDay = new Date(Date.UTC(selectedYear, 11, 31));

  const shiftDateByDays = (value: Date, days: number) => {
    const next = toUtcDay(value);
    next.setUTCDate(next.getUTCDate() + days);
    return next;
  };

  const diffDays = (from: Date, to: Date) => {
    const diff = toUtcDay(to).getTime() - toUtcDay(from).getTime();
    return Math.round(diff / 86400000);
  };

  const toApiDate = (value: Date) => toUtcDay(value).toISOString();
  const locale = t.prev === 'Назад' ? 'ru-RU' : 'en-US';
  const tooltipDateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      }),
    [locale],
  );
  const formatTooltipDate = (value: Date) => tooltipDateFormatter.format(toUtcDay(value));
  const formatPlannedCost = (amount: number, currency: string) => {
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount);
    } catch {
      return `${amount.toFixed(2)} ${currency}`;
    }
  };
  const assignmentStyle = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const startInYear = new Date(Date.UTC(selectedYear, 0, 1));
    const endInYear = new Date(Date.UTC(selectedYear, 11, 31));
    const effectiveStart = start < startInYear ? startInYear : start;
    const effectiveEnd = end > endInYear ? endInYear : end;
    const totalDays = Math.max(1, Math.floor((endInYear.getTime() - startInYear.getTime()) / 86400000));
    const startOffset = Math.floor((effectiveStart.getTime() - startInYear.getTime()) / 86400000) / totalDays;
    const endOffset = Math.floor((effectiveEnd.getTime() - startInYear.getTime()) / 86400000) / totalDays;

    return {
      left: `${Math.max(0, startOffset * 100).toFixed(2)}%`,
      width: `${Math.max((endOffset - startOffset) * 100, 1.2).toFixed(2)}%`,
    };
  };

  const beginPlanDrag = (
    event: ReactMouseEvent,
    row: ProjectTimelineRow,
    mode: 'move' | 'resize-start' | 'resize-end',
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const track = (event.currentTarget as HTMLElement).closest('.track') as HTMLElement | null;
    if (!track) return;
    dragMovedRef.current = false;

    setDragState({
      projectId: row.id,
      mode,
      startDate: new Date(row.startDate),
      endDate: new Date(row.endDate),
      startX: event.clientX,
      trackWidth: Math.max(1, track.getBoundingClientRect().width),
      shiftDays: 0,
    });
  };

  const resolveDragDates = (state: NonNullable<typeof dragState>) => {
    let nextStart = toUtcDay(state.startDate);
    let nextEnd = toUtcDay(state.endDate);
    if (state.mode === 'move') {
      const minShift = diffDays(state.startDate, yearStartDay);
      const maxShift = diffDays(state.endDate, yearEndDay);
      const boundedShift = Math.min(maxShift, Math.max(minShift, state.shiftDays));
      nextStart = shiftDateByDays(state.startDate, boundedShift);
      nextEnd = shiftDateByDays(state.endDate, boundedShift);
    } else if (state.mode === 'resize-start') {
      const candidateStart = shiftDateByDays(state.startDate, state.shiftDays);
      const clampedStart = candidateStart < yearStartDay ? yearStartDay : candidateStart;
      nextStart = clampedStart <= nextEnd ? clampedStart : nextEnd;
    } else {
      const candidateEnd = shiftDateByDays(state.endDate, state.shiftDays);
      const clampedEnd = candidateEnd > yearEndDay ? yearEndDay : candidateEnd;
      nextEnd = clampedEnd >= nextStart ? clampedEnd : nextStart;
    }
    return { nextStart, nextEnd };
  };

  const onPlanDragMove = (event: MouseEvent) => {
    if (!dragState) return;
    event.preventDefault();
    const deltaX = event.clientX - dragState.startX;
    const rawDays = (deltaX / dragState.trackWidth) * totalDays;
    const shiftDays = Math.round(rawDays);
    if (Math.abs(deltaX) >= 2) {
      dragMovedRef.current = true;
    }
    if (shiftDays !== dragState.shiftDays) {
      setDragState({ ...dragState, shiftDays });
    }
  };

  const endPlanDrag = async (event?: MouseEvent) => {
    if (!dragState) return;
    event?.preventDefault();

    const current = dragState;
    setDragState(null);
    setHoverDragMode(null);
    suppressToggleClickRef.current = dragMovedRef.current;
    if (current.shiftDays === 0) return;

    const { nextStart, nextEnd } = resolveDragDates(current);
    const effectiveShiftDays = diffDays(current.startDate, nextStart);
    setPendingPlanPreview({
      projectId: current.projectId,
      mode: current.mode,
      nextStart,
      nextEnd,
      shiftDays: current.mode === 'resize-end' ? 0 : effectiveShiftDays,
    });

    try {
      await onAdjustProjectPlan(
        current.projectId,
        toApiDate(nextStart),
        toApiDate(nextEnd),
        current.mode === 'resize-end' ? 0 : effectiveShiftDays,
        current.mode,
      );
    } finally {
      setPendingPlanPreview((prev) => (prev && prev.projectId === current.projectId ? null : prev));
    }
  };

  const handlePlanBarHover = (event: ReactMouseEvent<HTMLElement>, row: ProjectTimelineRow) => {
    if (dragState) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const edgeWidth = 10;
    let mode: 'move' | 'resize-start' | 'resize-end' = 'move';
    if (x <= edgeWidth) {
      mode = 'resize-start';
    } else if (x >= rect.width - edgeWidth) {
      mode = 'resize-end';
    }
    if (!hoverDragMode || hoverDragMode.projectId !== row.id || hoverDragMode.mode !== mode) {
      setHoverDragMode({ projectId: row.id, mode });
    }
  };

  const clearPlanBarHover = (row: ProjectTimelineRow) => {
    if (dragState) return;
    setHoverDragMode((prev) => (prev && prev.projectId === row.id ? null : prev));
  };

  const beginAssignmentDrag = (
    event: ReactMouseEvent,
    projectId: string,
    assignmentId: string,
    startIso: string,
    endIso: string,
    mode: 'move' | 'resize-start' | 'resize-end',
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const track = (event.currentTarget as HTMLElement).closest('.assignment-track') as HTMLElement | null;
    if (!track) return;
    assignmentDragMovedRef.current = false;
    setAssignmentDragState({
      projectId,
      assignmentId,
      mode,
      startDate: new Date(startIso),
      endDate: new Date(endIso),
      startX: event.clientX,
      trackWidth: Math.max(1, track.getBoundingClientRect().width),
      shiftDays: 0,
    });
  };

  const resolveAssignmentDragDates = (state: NonNullable<typeof assignmentDragState>) => {
    let nextStart = toUtcDay(state.startDate);
    let nextEnd = toUtcDay(state.endDate);
    if (state.mode === 'move') {
      const minShift = diffDays(state.startDate, yearStartDay);
      const maxShift = diffDays(state.endDate, yearEndDay);
      const boundedShift = Math.min(maxShift, Math.max(minShift, state.shiftDays));
      nextStart = shiftDateByDays(state.startDate, boundedShift);
      nextEnd = shiftDateByDays(state.endDate, boundedShift);
    } else if (state.mode === 'resize-start') {
      const candidateStart = shiftDateByDays(state.startDate, state.shiftDays);
      const clampedStart = candidateStart < yearStartDay ? yearStartDay : candidateStart;
      nextStart = clampedStart <= nextEnd ? clampedStart : nextEnd;
    } else {
      const candidateEnd = shiftDateByDays(state.endDate, state.shiftDays);
      const clampedEnd = candidateEnd > yearEndDay ? yearEndDay : candidateEnd;
      nextEnd = clampedEnd >= nextStart ? clampedEnd : nextStart;
    }
    return { nextStart, nextEnd };
  };

  const onAssignmentDragMove = (event: MouseEvent) => {
    if (!assignmentDragState) return;
    event.preventDefault();
    const deltaX = event.clientX - assignmentDragState.startX;
    const rawDays = (deltaX / assignmentDragState.trackWidth) * totalDays;
    const shiftDays = Math.round(rawDays);
    if (Math.abs(deltaX) >= 2) {
      assignmentDragMovedRef.current = true;
    }
    if (shiftDays !== assignmentDragState.shiftDays) {
      setAssignmentDragState({ ...assignmentDragState, shiftDays });
    }
  };

  const endAssignmentDrag = async (event?: MouseEvent) => {
    if (!assignmentDragState) return;
    event?.preventDefault();

    const current = assignmentDragState;
    setAssignmentDragState(null);
    suppressAssignmentClickRef.current = assignmentDragMovedRef.current;
    if (current.shiftDays === 0) return;

    const { nextStart, nextEnd } = resolveAssignmentDragDates(current);
    setPendingAssignmentPreview({
      projectId: current.projectId,
      assignmentId: current.assignmentId,
      mode: current.mode,
      nextStart,
      nextEnd,
    });

    try {
      await onAdjustAssignmentPlan(current.projectId, current.assignmentId, toApiDate(nextStart), toApiDate(nextEnd));
    } finally {
      setPendingAssignmentPreview((prev) =>
        prev && prev.assignmentId === current.assignmentId && prev.projectId === current.projectId ? null : prev,
      );
    }
  };

  const handleAssignmentBarHover = (
    event: ReactMouseEvent<HTMLElement>,
    projectId: string,
    assignmentId: string,
  ) => {
    if (assignmentDragState) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const edgeWidth = 8;
    let mode: 'move' | 'resize-start' | 'resize-end' = 'move';
    if (x <= edgeWidth) {
      mode = 'resize-start';
    } else if (x >= rect.width - edgeWidth) {
      mode = 'resize-end';
    }
    if (
      !hoverAssignmentDragMode ||
      hoverAssignmentDragMode.projectId !== projectId ||
      hoverAssignmentDragMode.assignmentId !== assignmentId ||
      hoverAssignmentDragMode.mode !== mode
    ) {
      setHoverAssignmentDragMode({ projectId, assignmentId, mode });
    }
  };

  const clearAssignmentBarHover = (projectId: string, assignmentId: string) => {
    if (assignmentDragState) return;
    setHoverAssignmentDragMode((prev) =>
      prev && prev.projectId === projectId && prev.assignmentId === assignmentId ? null : prev,
    );
  };

  const handleToggleClick = (event: ReactMouseEvent, projectId: string) => {
    if (suppressToggleClickRef.current) {
      event.preventDefault();
      event.stopPropagation();
      suppressToggleClickRef.current = false;
      return;
    }

    void onSelectProject(projectId);
  };

  const roleColorByName = useMemo(() => {
    const result = new Map<string, string>();
    for (const role of roles) {
      if (role.colorHex && /^#[0-9A-Fa-f]{6}$/.test(role.colorHex)) {
        result.set(role.name, role.colorHex);
      }
    }
    return result;
  }, [roles]);

  const employeeRoleColorById = useMemo(() => {
    const result = new Map<string, string>();
    for (const employee of employees) {
      result.set(employee.id, roleColorByName.get(employee.role.name) ?? '#6E7B8A');
    }
    return result;
  }, [employees, roleColorByName]);

  const assignmentsByProjectId = useMemo(() => {
    const result = new Map<string, AssignmentItem[]>();
    for (const assignment of assignments) {
      const projectAssignments = result.get(assignment.projectId);
      if (projectAssignments) {
        projectAssignments.push(assignment);
      } else {
        result.set(assignment.projectId, [assignment]);
      }
    }
    return result;
  }, [assignments]);

  const benchGroups = useMemo(() => {
    const annualUtilizationByEmployeeId = new Map<string, number>();
    for (const assignment of assignments) {
      const allocation = Number(assignment.allocationPercent);
      if (!Number.isFinite(allocation) || allocation <= 0) continue;

      const start = toUtcDay(new Date(assignment.assignmentStartDate));
      const end = toUtcDay(new Date(assignment.assignmentEndDate));
      const effectiveStart = start < yearStart ? yearStart : start;
      const effectiveEnd = end > yearEndDay ? yearEndDay : end;
      if (effectiveEnd < effectiveStart) continue;

      const overlapDays = Math.floor((effectiveEnd.getTime() - effectiveStart.getTime()) / 86400000) + 1;
      const weightedUtilization = (allocation * overlapDays) / totalDays;
      annualUtilizationByEmployeeId.set(
        assignment.employeeId,
        (annualUtilizationByEmployeeId.get(assignment.employeeId) ?? 0) + weightedUtilization,
      );
    }

    const groups = new Map<string, Array<{ id: string; fullName: string; roleName: string }>>();
    for (const employee of employees) {
      const annualUtilization = annualUtilizationByEmployeeId.get(employee.id) ?? 0;
      if (annualUtilization >= 100) continue;
      const departmentName = employee.department?.name ?? t.unassignedDepartment;
      const row = {
        id: employee.id,
        fullName: employee.fullName,
        roleName: employee.role.shortName?.trim() ? employee.role.shortName : employee.role.name,
      };
      const items = groups.get(departmentName);
      if (items) {
        items.push(row);
      } else {
        groups.set(departmentName, [row]);
      }
    }

    return Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([departmentName, members]) => ({
        departmentName,
        members: members.sort((a, b) => a.fullName.localeCompare(b.fullName)),
      }));
  }, [assignments, employees, t.unassignedDepartment, toUtcDay, totalDays, yearEndDay, yearStart]);

  const vacationsByEmployeeId = useMemo(() => {
    const result = new Map<string, Array<{ startDate: string; endDate: string }>>();
    for (const vacation of vacations) {
      const employeeVacations = result.get(vacation.employeeId);
      if (employeeVacations) {
        employeeVacations.push({ startDate: vacation.startDate, endDate: vacation.endDate });
      } else {
        result.set(vacation.employeeId, [{ startDate: vacation.startDate, endDate: vacation.endDate }]);
      }
    }
    return result;
  }, [vacations]);

  useEffect(() => {
    if (!dragState) return;

    const handleWindowMouseMove = (event: MouseEvent) => {
      onPlanDragMove(event);
    };

    const handleWindowMouseUp = (event: MouseEvent) => {
      void endPlanDrag(event);
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [dragState]);

  useEffect(() => {
    if (!assignmentDragState) return;

    const handleWindowMouseMove = (event: MouseEvent) => {
      onAssignmentDragMove(event);
    };

    const handleWindowMouseUp = (event: MouseEvent) => {
      void endAssignmentDrag(event);
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [assignmentDragState]);

  return (
    <section className="timeline-layout">
      <article className="card timeline-card">
        <div className="timeline-toolbar">
          <h2>{t.yearTimeline}</h2>
          <div className="year-switcher">
            <button type="button" onClick={onOpenProjectModal}>
              {t.createProject}
            </button>
            <button type="button" onClick={() => onYearChange(selectedYear - 1)}>
              {t.prev}
            </button>
            <strong>{selectedYear}</strong>
            <button type="button" onClick={() => onYearChange(selectedYear + 1)}>
              {t.next}
            </button>
          </div>
        </div>

        <section className="company-load-card">
          <div className="section-header">
            <h3>{t.companyLoad}</h3>
            <span className="muted">max {companyDailyLoad.max.toFixed(0)}%</span>
          </div>
          <div className="company-load-chart">
            <span className="company-load-grid-line company-load-grid-line-limit" style={{ bottom: `${(100 / companyLoadScaleMax) * 100}%` }} />
            {todayPosition ? <span className="current-day-line" style={{ left: todayPosition }} /> : null}
            {companyDailyLoad.totals.map((value, index) => (
              <span
                key={`${selectedYear}-load-${index}`}
                className={value > 100 ? 'company-load-bar overloaded' : 'company-load-bar'}
                style={{ height: `${Math.max(2, (value / companyLoadScaleMax) * 100)}%` }}
                title={`Day ${index + 1}: ${value.toFixed(1)}%`}
              />
            ))}
          </div>
          <div className="day-grid" style={{ ['--day-step' as string]: dayStep }}>
            {todayPosition ? <span className="current-day-line" style={{ left: todayPosition }} /> : null}
            {dayMarkers.map((marker) => (
              <span key={marker.key} className="day-marker" style={{ left: marker.left }}>
                {marker.label}
              </span>
            ))}
          </div>
          <div className="month-grid">
            {todayPosition ? <span className="current-day-line" style={{ left: todayPosition }} /> : null}
            {months.map((month) => (
              <span key={month}>{month}</span>
            ))}
          </div>
        </section>

        <div className="timeline-board">
          <div className="timeline-main">
            <div className="timeline-rows">
              {sortedTimeline.length === 0 ? (
                <p className="muted">{t.noProjectsForYear}</p>
              ) : (
                sortedTimeline.map((row, rowIndex) => {
              const dragPreview = dragState && dragState.projectId === row.id ? resolveDragDates(dragState) : null;
              const pendingPreview = pendingPlanPreview && pendingPlanPreview.projectId === row.id ? pendingPlanPreview : null;
              const style =
                dragPreview
                  ? timelineStyle({
                      ...row,
                      startDate: dragPreview.nextStart.toISOString(),
                      endDate: dragPreview.nextEnd.toISOString(),
                    })
                  : pendingPreview
                    ? timelineStyle({
                        ...row,
                        startDate: pendingPreview.nextStart.toISOString(),
                        endDate: pendingPreview.nextEnd.toISOString(),
                      })
                  : timelineStyle(row);
              const isExpanded = expandedSet.has(row.id);
              const detail = projectDetails[row.id];
              const projectAssignments = assignmentsByProjectId.get(row.id) ?? [];
              const assignmentShiftDays =
                dragState && dragState.projectId === row.id && dragState.mode !== 'resize-end' && dragPreview
                  ? diffDays(dragState.startDate, dragPreview.nextStart)
                  : pendingPreview && pendingPreview.mode !== 'resize-end'
                    ? pendingPreview.shiftDays
                  : 0;
              const tooltipMode =
                dragState && dragState.projectId === row.id
                  ? dragState.mode
                  : hoverDragMode && hoverDragMode.projectId === row.id
                    ? hoverDragMode.mode
                    : null;
              const tooltipStart = dragPreview?.nextStart ?? toUtcDay(new Date(row.startDate));
              const tooltipEnd = dragPreview?.nextEnd ?? toUtcDay(new Date(row.endDate));
              const tooltipText =
                tooltipMode === 'resize-start'
                  ? formatTooltipDate(tooltipStart)
                  : tooltipMode === 'resize-end'
                    ? formatTooltipDate(tooltipEnd)
                    : tooltipMode === 'move'
                      ? `${formatTooltipDate(tooltipStart)} - ${formatTooltipDate(tooltipEnd)}`
                      : '';
              if (tooltipMode) {
                projectTooltipCacheRef.current.set(row.id, { mode: tooltipMode, text: tooltipText });
              }
              const cachedProjectTooltip = projectTooltipCacheRef.current.get(row.id);
              const displayTooltipMode = tooltipMode ?? cachedProjectTooltip?.mode ?? 'move';
              const displayTooltipText = tooltipMode ? tooltipText : (cachedProjectTooltip?.text ?? '');
                  return (
                    <div
                      key={row.id}
                      className={hoverProjectDropId === row.id ? 'timeline-project-item drop-target' : 'timeline-project-item'}
                      onDragOver={(event) => {
                        if (!draggedBenchEmployeeId) return;
                        event.preventDefault();
                        setHoverProjectDropId(row.id);
                      }}
                      onDragLeave={(event) => {
                        const nextTarget = event.relatedTarget as Node | null;
                        if (nextTarget && (event.currentTarget as HTMLElement).contains(nextTarget)) return;
                        setHoverProjectDropId((prev) => (prev === row.id ? null : prev));
                      }}
                      onDrop={(event) => {
                        if (!draggedBenchEmployeeId) return;
                        event.preventDefault();
                        setHoverProjectDropId(null);
                        onOpenAssignmentModal(row.id, draggedBenchEmployeeId);
                        setDraggedBenchEmployeeId(null);
                      }}
                    >
                  <div className={isExpanded ? 'timeline-row selected' : 'timeline-row'}>
                    <div className="timeline-meta">
                      <div className="timeline-meta-main">
                        <div className="timeline-meta-controls">
                          <button
                            type="button"
                            className="timeline-row-toggle"
                            onClick={() => onMoveProject(row.id, 'up')}
                            disabled={rowIndex === 0}
                            aria-label="Move project up"
                            title="Move up"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            className="timeline-row-toggle"
                            onClick={() => onMoveProject(row.id, 'down')}
                            disabled={rowIndex === sortedTimeline.length - 1}
                            aria-label="Move project down"
                            title="Move down"
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            className={isExpanded ? 'timeline-row-toggle active' : 'timeline-row-toggle'}
                            onClick={(event) => handleToggleClick(event, row.id)}
                            aria-label={isExpanded ? 'Collapse project row' : 'Expand project row'}
                            title={isExpanded ? 'Collapse' : 'Expand'}
                          >
                            {isExpanded ? '▴' : '▾'}
                          </button>
                        </div>
                        <strong>
                          {row.code} · {row.name}
                        </strong>
                        <div className="timeline-kpi-row">
                          <span>{row.assignmentsCount} employers</span>
                          <span>{detail?.costSummary ? `${Number(detail.costSummary.totalPlannedHours).toFixed(2)} hours` : '— hours'}</span>
                          <span>
                            {detail?.costSummary
                              ? formatPlannedCost(Number(detail.costSummary.totalPlannedCost), detail.costSummary.currency)
                              : '—'}
                          </span>
                          <span>
                            {isoToInputDate(row.startDate)} {t.fromTo} {isoToInputDate(row.endDate)}
                          </span>
                        </div>
                      </div>
                      <div className="timeline-meta-actions">
                        <button
                          type="button"
                          className="timeline-meta-icon-btn"
                          onClick={() => onOpenProjectDatesModal(row.id)}
                          title={t.editProjectDates}
                          aria-label={t.editProjectDates}
                        >
                          📅
                        </button>
                        <button
                          type="button"
                          className="timeline-meta-icon-btn"
                          onClick={() => onOpenAssignmentModal(row.id)}
                          title={t.assignEmployee}
                          aria-label={t.assignEmployee}
                        >
                          👤+
                        </button>
                      </div>
                    </div>
                    <div className="track project-track">
                      <span className="track-day-grid" style={{ ['--day-step' as string]: dayStep }} />
                      {todayPosition ? <span className="current-day-line" style={{ left: todayPosition }} /> : null}
                      <div
                        className="bar project-plan-bar"
                        style={style}
                        onMouseMove={(event) => handlePlanBarHover(event, row)}
                        onMouseLeave={() => clearPlanBarHover(row)}
                      >
                        <span
                          className={
                            displayTooltipMode === 'resize-start'
                              ? `project-plan-tooltip edge-left${tooltipMode ? ' visible' : ''}`
                              : displayTooltipMode === 'resize-end'
                                ? `project-plan-tooltip edge-right${tooltipMode ? ' visible' : ''}`
                                : displayTooltipMode === 'move'
                                  ? `project-plan-tooltip center${tooltipMode ? ' visible' : ''}`
                                  : 'project-plan-tooltip center'
                          }
                          aria-hidden={tooltipMode ? undefined : true}
                        >
                          {displayTooltipText}
                        </span>
                        <span
                          className="project-plan-handle left"
                          onMouseDown={(event) => beginPlanDrag(event, row, 'resize-start')}
                        />
                        <span
                          className="project-plan-handle center"
                          onMouseDown={(event) => beginPlanDrag(event, row, 'move')}
                        />
                        <span
                          className="project-plan-handle right"
                          onMouseDown={(event) => beginPlanDrag(event, row, 'resize-end')}
                        />
                      </div>
                      {projectAssignments.map((assignment, index) => {
                        const allocation = Number(assignment.allocationPercent);
                        const clampedAllocation = Number.isFinite(allocation) ? Math.max(0, Math.min(100, allocation)) : 0;
                        const thickness = Math.max(1, Math.round(clampedAllocation / 10));
                        const maxTop = 26 - thickness;
                        const top = maxTop > 0 ? (index * 3) % maxTop : 0;

                        return (
                          <span
                            key={assignment.id}
                            className="project-assignee-bar"
                            style={{
                              ...assignmentStyle(
                                shiftDateByDays(new Date(assignment.assignmentStartDate), assignmentShiftDays).toISOString(),
                                shiftDateByDays(new Date(assignment.assignmentEndDate), assignmentShiftDays).toISOString(),
                              ),
                              backgroundColor: employeeRoleColorById.get(assignment.employeeId) ?? '#6E7B8A',
                              height: `${thickness}px`,
                              top: `${top}px`,
                            }}
                          />
                        );
                      })}
                    </div>
                  </div>

                  {isExpanded && detail ? (
                    <section className="project-card">
                      <div className="assignment-list">
                        {detail.assignments.length === 0 ? (
                          <p className="muted">{t.noAssignments}</p>
                        ) : (
                          detail.assignments.map((assignment) => (
                            <div
                              key={assignment.id}
                              className="assignment-item"
                            >
                              <div className="assignment-item-header">
                                <strong>{assignment.employee.fullName}</strong>
                                <span>{Number(assignment.allocationPercent)}%</span>
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
                                  ✕
                                </span>
                              </div>
                              <div className="assignment-track">
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
                                      className="assignment-bar"
                                      style={{
                                        ...assignmentStyle(startIso, endIso),
                                        background: employeeRoleColorById.get(assignment.employeeId) ?? '#6E7B8A',
                                      }}
                                      onMouseMove={(event) => handleAssignmentBarHover(event, detail.id, assignment.id)}
                                      onMouseLeave={() => clearAssignmentBarHover(detail.id, assignment.id)}
                                    >
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
                                {(vacationsByEmployeeId.get(assignment.employeeId) ?? []).map((vacation, index) => (
                                  <span
                                    key={`${assignment.id}-vacation-${index}`}
                                    className="assignment-vacation-bar"
                                    style={assignmentStyle(vacation.startDate, vacation.endDate)}
                                    title={`${isoToInputDate(vacation.startDate)} ${t.fromTo} ${isoToInputDate(vacation.endDate)}`}
                                  />
                                ))}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </section>
                  ) : null}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <aside className="bench-column">
            <div className="bench-header">{t.bench}</div>
            {benchGroups.length === 0 ? (
              <p className="muted">—</p>
            ) : (
              benchGroups.map((group) => (
                <section key={group.departmentName} className="bench-group">
                  <h4>{group.departmentName}</h4>
                  <div className="bench-members">
                    {group.members.map((member) => (
                      <button
                        type="button"
                        key={member.id}
                        className="bench-member"
                        draggable
                        title={`${member.fullName} · ${member.roleName}`}
                        onDragStart={() => setDraggedBenchEmployeeId(member.id)}
                        onDragEnd={() => {
                          setDraggedBenchEmployeeId(null);
                          setHoverProjectDropId(null);
                        }}
                      >
                        <strong>{member.fullName}</strong>
                        <span>{member.roleName}</span>
                      </button>
                    ))}
                  </div>
                </section>
              ))
            )}
          </aside>
        </div>
      </article>
    </section>
  );
}
