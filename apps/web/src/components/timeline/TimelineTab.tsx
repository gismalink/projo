import { FormEvent, MouseEvent as ReactMouseEvent, useEffect, useMemo, useRef, useState } from 'react';
import { AssignmentItem, ProjectDetail, ProjectTimelineRow } from '../../api/client';

type TimelineTabProps = {
  t: Record<string, string>;
  months: string[];
  selectedYear: number;
  assignments: AssignmentItem[];
  vacations: Array<{ employeeId: string; startDate: string; endDate: string }>;
  employees: Array<{ id: string; role: { name: string } }>;
  roles: Array<{ name: string; colorHex?: string | null }>;
  sortedTimeline: ProjectTimelineRow[];
  expandedProjectIds: string[];
  projectDetails: Record<string, ProjectDetail>;
  selectedProjectId: string;
  selectedAssignmentId: string;
  editAssignmentStartDate: string;
  editAssignmentEndDate: string;
  editAssignmentPercent: number;
  onOpenProjectModal: () => void;
  onOpenProjectDatesModal: (projectId: string) => void;
  onOpenAssignmentModal: (projectId: string) => void;
  onSelectProject: (projectId: string) => Promise<void>;
  onUpdateAssignment: (event: FormEvent) => Promise<void>;
  onYearChange: (nextYear: number) => Promise<void>;
  onEditorAssignmentChange: (projectId: string, assignmentId: string) => void;
  setEditAssignmentStartDate: (value: string) => void;
  setEditAssignmentEndDate: (value: string) => void;
  setEditAssignmentPercent: (value: number) => void;
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
    selectedProjectId,
    selectedAssignmentId,
    editAssignmentStartDate,
    editAssignmentEndDate,
    editAssignmentPercent,
    onOpenProjectModal,
    onOpenProjectDatesModal,
    onOpenAssignmentModal,
    onSelectProject,
    onUpdateAssignment,
    onYearChange,
    onEditorAssignmentChange,
    setEditAssignmentStartDate,
    setEditAssignmentEndDate,
    setEditAssignmentPercent,
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
  const suppressToggleClickRef = useRef(false);
  const dragMovedRef = useRef(false);

  useEffect(() => {
    if (!dragState) return;
    document.body.classList.add('timeline-no-select');
    return () => {
      document.body.classList.remove('timeline-no-select');
    };
  }, [dragState]);

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
  const kpiDateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
    [],
  );
  const formatKpiDate = (value: string) => kpiDateFormatter.format(new Date(value));

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
    setHoverDragMode({ projectId: row.id, mode });
  };

  const clearPlanBarHover = (row: ProjectTimelineRow) => {
    if (dragState) return;
    setHoverDragMode((prev) => (prev && prev.projectId === row.id ? null : prev));
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
              return (
                <div key={row.id} className="timeline-project-item">
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
                            {formatKpiDate(row.startDate)} - {formatKpiDate(row.endDate)}
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
                        {tooltipMode ? (
                          <span
                            className={
                              tooltipMode === 'resize-start'
                                ? 'project-plan-tooltip edge-left'
                                : tooltipMode === 'resize-end'
                                  ? 'project-plan-tooltip edge-right'
                                  : 'project-plan-tooltip center'
                            }
                          >
                            {tooltipText}
                          </span>
                        ) : null}
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
                            <button
                              type="button"
                              key={assignment.id}
                              className={
                                assignment.id === selectedAssignmentId && selectedProjectId === detail.id
                                  ? 'assignment-item active'
                                  : 'assignment-item'
                              }
                              onClick={() => onEditorAssignmentChange(detail.id, assignment.id)}
                            >
                              <div className="assignment-item-header">
                                <strong>{assignment.employee.fullName}</strong>
                                <span>
                                  {isoToInputDate(assignment.assignmentStartDate)} {t.fromTo}{' '}
                                  {isoToInputDate(assignment.assignmentEndDate)} · {Number(assignment.allocationPercent)}%
                                </span>
                              </div>
                              <div className="assignment-track">
                                <span className="track-day-grid" style={{ ['--day-step' as string]: dayStep }} />
                                {todayPosition ? <span className="current-day-line" style={{ left: todayPosition }} /> : null}
                                {(vacationsByEmployeeId.get(assignment.employeeId) ?? []).map((vacation, index) => (
                                  <span
                                    key={`${assignment.id}-vacation-${index}`}
                                    className="assignment-vacation-bar"
                                    style={assignmentStyle(vacation.startDate, vacation.endDate)}
                                    title={`${isoToInputDate(vacation.startDate)} ${t.fromTo} ${isoToInputDate(vacation.endDate)}`}
                                  />
                                ))}
                                <span className="assignment-bar" style={assignmentStyle(assignment.assignmentStartDate, assignment.assignmentEndDate)} />
                              </div>
                            </button>
                          ))
                        )}
                      </div>

                      {selectedProjectId === detail.id && selectedAssignmentId ? (
                        (() => {
                          const selectedAssignment = detail.assignments.find((assignment) => assignment.id === selectedAssignmentId);
                          if (!selectedAssignment) return null;

                          return (
                            <form className="timeline-form" onSubmit={onUpdateAssignment}>
                              <label>{t.editAssignment}: {selectedAssignment.employee.fullName}</label>
                              <div className="assignment-edit-row">
                                <label>
                                  {t.start}
                                  <input
                                    type="date"
                                    value={editAssignmentStartDate}
                                    onChange={(e) => setEditAssignmentStartDate(e.target.value)}
                                  />
                                </label>
                                <label>
                                  {t.end}
                                  <input
                                    type="date"
                                    value={editAssignmentEndDate}
                                    onChange={(e) => setEditAssignmentEndDate(e.target.value)}
                                  />
                                </label>
                                <label>
                                  {t.allocationPercent}
                                  <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    value={editAssignmentPercent}
                                    onChange={(e) => setEditAssignmentPercent(Number(e.target.value))}
                                  />
                                </label>
                                <button
                                  type="submit"
                                  className="icon-save-btn"
                                  title={t.saveAssignment}
                                  aria-label={t.saveAssignment}
                                >
                                  ✓
                                </button>
                              </div>
                            </form>
                          );
                        })()
                      ) : null}
                    </section>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </article>
    </section>
  );
}
