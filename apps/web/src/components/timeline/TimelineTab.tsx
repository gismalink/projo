import { DragEvent as ReactDragEvent, MouseEvent as ReactMouseEvent, useEffect, useMemo, useRef, useState } from 'react';
import { AssignmentItem, CalendarDayItem, CalendarHealthResponse, GradeItem, ProjectDetail, ProjectTimelineRow } from '../../api/client';
import { createAssignmentLoadPercentResolver, STANDARD_DAY_HOURS } from '../../hooks/app-helpers';
import { BenchColumn } from './BenchColumn';
import { CompanyLoadCard } from './CompanyLoadCard';
import { ProjectAssignmentsCard } from './ProjectAssignmentsCard';
import { ProjectTimelineItem } from './ProjectTimelineItem';
import { TimelineToolbar } from './TimelineToolbar';
import {
  ASSIGNMENT_DRAG_THRESHOLD_PX,
  ASSIGNMENT_EDGE_WIDTH_PX,
  ASSIGNMENT_MIN_WIDTH_PERCENT,
  MS_PER_DAY,
  TIMELINE_FALLBACK_COLOR_HEX,
} from './timeline.constants';
import { buildCalendarSegments, buildDayMarkers, diffDays, getTodayPosition, shiftDateByDays, toUtcDay } from './timeline-date.utils';
import { useTimelineProjectDrag } from './useTimelineProjectDrag';

const TIMELINE_DRAG_STEP_STORAGE_KEY = 'timeline.dragStepDays';
type TimelineTabProps = {
  t: Record<string, string>;
  locale: string;
  months: string[];
  canManageTimeline: boolean;
  selectedYear: number;
  assignments: AssignmentItem[];
  vacations: Array<{ employeeId: string; startDate: string; endDate: string }>;
  employees: Array<{
    id: string;
    fullName: string;
    grade?: string | null;
    role: { name: string; shortName?: string | null };
    department?: { name: string } | null;
  }>;
  roles: Array<{ name: string; shortName?: string | null; colorHex?: string | null }>;
  canSeedDemoWorkspace: boolean;
  onSeedDemoWorkspace: () => Promise<void>;
  teamTemplates: Array<{ id: string; name: string }>;
  grades: GradeItem[];
  sortedTimeline: ProjectTimelineRow[];
  calendarDays: CalendarDayItem[];
  calendarHealth: CalendarHealthResponse | null;
  expandedProjectIds: string[];
  projectDetails: Record<string, ProjectDetail>;
  onOpenProjectModal: () => void;
  onAutoSaveProjectMeta: (
    projectId: string,
    payload: { code: string; name: string; startDate: string; endDate: string; teamTemplateId?: string | null },
  ) => Promise<void>;
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
  onUpdateAssignmentCurve: (
    projectId: string,
    assignmentId: string,
    loadProfile: {
      mode: 'curve';
      points: Array<{ date: string; value: number }>;
    },
  ) => Promise<boolean>;
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
    locale,
    months,
    canManageTimeline,
    canSeedDemoWorkspace,
    onSeedDemoWorkspace,
    selectedYear,
    assignments,
    vacations,
    employees,
    roles,
    teamTemplates,
    grades,
    sortedTimeline,
    calendarDays,
    calendarHealth,
    expandedProjectIds,
    projectDetails,
    onOpenProjectModal,
    onAutoSaveProjectMeta,
    onOpenAssignmentModal,
    onSelectProject,
    onYearChange,
    onDeleteAssignment,
    onAdjustAssignmentPlan,
    onUpdateAssignmentCurve,
    onMoveProject,
    onAdjustProjectPlan,
    timelineStyle,
    isoToInputDate,
  } = props;

  const [dragStepDays, setDragStepDays] = useState<1 | 7 | 30>(() => {
    if (typeof window === 'undefined') return 7;
    const saved = Number(window.localStorage.getItem(TIMELINE_DRAG_STEP_STORAGE_KEY));
    return saved === 1 || saved === 7 || saved === 30 ? saved : 7;
  });
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
  const suppressAssignmentClickRef = useRef(false);
  const assignmentDragMovedRef = useRef(false);
  const projectTooltipCacheRef = useRef(new Map<string, { mode: 'move' | 'resize-start' | 'resize-end'; text: string }>());
  const assignmentTooltipCacheRef = useRef(
    new Map<string, { mode: 'move' | 'resize-start' | 'resize-end'; text: string }>(),
  );
  const [draggedBenchEmployeeId, setDraggedBenchEmployeeId] = useState<string | null>(null);
  const [hoverProjectDropId, setHoverProjectDropId] = useState<string | null>(null);
  const [selectedBenchEmployeeId, setSelectedBenchEmployeeId] = useState<string>('');
  const [selectedBenchDepartmentName, setSelectedBenchDepartmentName] = useState<string>('');
  const [hoveredBenchEmployeeId, setHoveredBenchEmployeeId] = useState<string>('');
  const filterBenchEmployeeId = selectedBenchEmployeeId;
  const filterBenchDepartmentName = filterBenchEmployeeId ? '' : selectedBenchDepartmentName;
  const highlightedBenchEmployeeId = hoveredBenchEmployeeId || selectedBenchEmployeeId;

  const expandedSet = new Set(expandedProjectIds);
  const yearStart = new Date(Date.UTC(selectedYear, 0, 1));
  const yearEnd = new Date(Date.UTC(selectedYear + 1, 0, 1));
  const totalDays = Math.max(1, Math.floor((yearEnd.getTime() - yearStart.getTime()) / MS_PER_DAY));
  const dayStep =
    dragStepDays === 30 ? `${(100 / 12).toFixed(8)}%` : `${((dragStepDays / totalDays) * 100).toFixed(5)}%`;
  const projectMonthBoundaryPercents = useMemo(() => {
    if (dragStepDays !== 30) return [] as number[];

    const boundaries: number[] = [];
    for (let monthIndex = 0; monthIndex <= 12; monthIndex += 1) {
      const monthStart = new Date(Date.UTC(selectedYear, monthIndex, 1));
      const offsetDays = Math.max(0, Math.min(totalDays, (monthStart.getTime() - yearStart.getTime()) / MS_PER_DAY));
      boundaries.push((offsetDays / totalDays) * 100);
    }
    return boundaries;
  }, [dragStepDays, selectedYear, totalDays, yearStart]);
  const dayMarkerStep = dragStepDays === 1 ? 7 : dragStepDays;
  const calendarDayByIso = useMemo(() => {
    const map = new Map<string, CalendarDayItem>();
    for (const day of calendarDays) {
      map.set(day.date, day);
    }
    return map;
  }, [calendarDays]);

  const dayKindLabel = (day: CalendarDayItem | undefined) => {
    if (!day) return t.dayTypeWorking;
    if (day.isHoliday) return day.holidayName ? `${t.dayTypeHoliday}: ${day.holidayName}` : t.dayTypeHoliday;
    if (day.isWeekend) return t.dayTypeWeekend;
    return t.dayTypeWorking;
  };

  const formatHealthDateTime = (value: string | null) => {
    if (!value) return t.calendarHealthMissing;
    try {
      return new Date(value).toLocaleString(locale);
    } catch {
      return value;
    }
  };

  const dayMarkers = buildDayMarkers({
    selectedYear,
    yearStart,
    totalDays,
    dayMarkerStep,
    calendarDayByIso,
    dayKindLabel,
  });

  const calendarSegments = useMemo(
    () =>
      buildCalendarSegments({
        yearStart,
        totalDays,
        calendarDayByIso,
      }),
    [calendarDayByIso, totalDays, yearStart],
  );

  const todayPosition = getTodayPosition(selectedYear);

  const companyLoad = useMemo(() => {
    const yearStart = new Date(Date.UTC(selectedYear, 0, 1));
    const yearEnd = new Date(Date.UTC(selectedYear + 1, 0, 1));
    const days = Math.max(1, Math.floor((yearEnd.getTime() - yearStart.getTime()) / MS_PER_DAY));
    const rawTotals = Array.from({ length: days }, () => 0);

    const isLoadBearingDay = (date: Date) => {
      const isoDate = date.toISOString().slice(0, 10);
      const calendarDay = calendarDayByIso.get(isoDate);
      if (calendarDay) return calendarDay.isWorkingDay;

      const day = date.getUTCDay();
      return day !== 0 && day !== 6;
    };

    for (const assignment of assignments) {
      const resolveLoadPercent = createAssignmentLoadPercentResolver(assignment);

      const start = new Date(assignment.assignmentStartDate);
      const end = new Date(assignment.assignmentEndDate);
      const effectiveStart = start < yearStart ? yearStart : start;
      const effectiveEnd = end >= yearEnd ? new Date(yearEnd.getTime() - MS_PER_DAY) : end;
      if (effectiveEnd < effectiveStart) continue;

      const startIndex = Math.max(0, Math.floor((effectiveStart.getTime() - yearStart.getTime()) / MS_PER_DAY));
      const endIndex = Math.min(days - 1, Math.floor((effectiveEnd.getTime() - yearStart.getTime()) / MS_PER_DAY));
      for (let i = startIndex; i <= endIndex; i += 1) {
        const currentDate = new Date(yearStart);
        currentDate.setUTCDate(currentDate.getUTCDate() + i);
        if (!isLoadBearingDay(currentDate)) continue;
        const loadPercent = resolveLoadPercent(currentDate);
        if (!Number.isFinite(loadPercent) || loadPercent <= 0) continue;
        rawTotals[i] += loadPercent;
      }
    }

    const employeeCapacity = Math.max(1, employees.length);
    const dailyUtilization = rawTotals.map((value) => value / employeeCapacity);

    const values: number[] = [];
    if (dragStepDays === 1) {
      values.push(...dailyUtilization);
    } else if (dragStepDays === 7) {
      const weekBuckets = new Map<string, { start: Date; sum: number; count: number }>();
      for (let dayIndex = 0; dayIndex < days; dayIndex += 1) {
        const currentDate = new Date(yearStart);
        currentDate.setUTCDate(currentDate.getUTCDate() + dayIndex);
        const weekStart = new Date(currentDate);
        const weekDay = weekStart.getUTCDay();
        const offsetToMonday = (weekDay + 6) % 7;
        weekStart.setUTCDate(weekStart.getUTCDate() - offsetToMonday);
        const key = weekStart.toISOString().slice(0, 10);
        const bucket = weekBuckets.get(key) ?? { start: weekStart, sum: 0, count: 0 };
        bucket.sum += dailyUtilization[dayIndex] ?? 0;
        bucket.count += 1;
        weekBuckets.set(key, bucket);
      }

      const sortedBuckets = Array.from(weekBuckets.values()).sort((a, b) => a.start.getTime() - b.start.getTime());
      for (const bucket of sortedBuckets) {
        values.push(bucket.count > 0 ? bucket.sum / bucket.count : 0);
      }
    } else {
      for (let monthIndex = 0; monthIndex < 12; monthIndex += 1) {
        const monthStart = new Date(Date.UTC(selectedYear, monthIndex, 1));
        const nextMonthStart = new Date(Date.UTC(selectedYear, monthIndex + 1, 1));
        const startIndex = Math.max(0, Math.floor((monthStart.getTime() - yearStart.getTime()) / MS_PER_DAY));
        const endIndex = Math.max(startIndex, Math.min(days, Math.floor((nextMonthStart.getTime() - yearStart.getTime()) / MS_PER_DAY)));
        const slice = dailyUtilization.slice(startIndex, endIndex);
        const avg = slice.length > 0 ? slice.reduce((sum, value) => sum + value, 0) / slice.length : 0;
        values.push(avg);
      }
    }

    const max = Math.max(1, ...values);
    return { values, max };
  }, [assignments, selectedYear, employees.length, dragStepDays, calendarDayByIso]);

  const companyLoadScaleMax = Math.max(100, Math.ceil(companyLoad.max / 25) * 25);
  const companyDayMarkers = dragStepDays === 30 ? [] : dayMarkers;

  const yearStartDay = new Date(Date.UTC(selectedYear, 0, 1));
  const yearEndDay = new Date(Date.UTC(selectedYear, 11, 31));

  const toApiDate = (value: Date) => toUtcDay(value).toISOString();
  const tooltipDateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        day: '2-digit',
        month: 'long',
      }),
    [locale],
  );
  const formatTooltipDate = (value: Date) => tooltipDateFormatter.format(toUtcDay(value));
  const formatTimelineDate = (value: string) => formatTooltipDate(new Date(value));
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
    const totalDays = Math.max(1, Math.floor((endInYear.getTime() - startInYear.getTime()) / MS_PER_DAY));
    const startOffset = Math.floor((effectiveStart.getTime() - startInYear.getTime()) / MS_PER_DAY) / totalDays;
    const endOffset = Math.floor((effectiveEnd.getTime() - startInYear.getTime()) / MS_PER_DAY) / totalDays;

    return {
      left: `${Math.max(0, startOffset * 100).toFixed(2)}%`,
      width: `${Math.max((endOffset - startOffset) * 100, ASSIGNMENT_MIN_WIDTH_PERCENT).toFixed(2)}%`,
    };
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
    const baseDate = assignmentDragState.mode === 'resize-end' ? assignmentDragState.endDate : assignmentDragState.startDate;
    const candidateDate = shiftDateByDays(baseDate, Math.round(rawDays));
    const snapToBoundary = (value: Date) => {
      const next = toUtcDay(value);
      const alignToPeriodEnd = assignmentDragState.mode === 'resize-end';
      if (dragStepDays === 1) return next;
      if (dragStepDays === 7) {
        const weekDay = next.getUTCDay();
        const offsetToMonday = (weekDay + 6) % 7;
        next.setUTCDate(next.getUTCDate() - offsetToMonday);
        if (alignToPeriodEnd) {
          next.setUTCDate(next.getUTCDate() + 6);
        }
        return next;
      }
      if (alignToPeriodEnd) {
        next.setUTCMonth(next.getUTCMonth() + 1, 0);
      } else {
        next.setUTCDate(1);
      }
      return next;
    };
    const shiftDays = diffDays(baseDate, snapToBoundary(candidateDate));
    if (Math.abs(deltaX) >= ASSIGNMENT_DRAG_THRESHOLD_PX) {
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
    const edgeWidth = ASSIGNMENT_EDGE_WIDTH_PX;
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
    if (consumeSuppressedToggleClick(event)) return;

    void onSelectProject(projectId);
  };

  const handleProjectRowDragOver = (event: ReactDragEvent<HTMLDivElement>, projectId: string) => {
    if (!canManageTimeline || !draggedBenchEmployeeId) return;

    const projectAssignments = assignmentsByProjectId.get(projectId) ?? [];
    const alreadyAssigned = projectAssignments.some((assignment) => assignment.employeeId === draggedBenchEmployeeId);
    if (alreadyAssigned) {
      setHoverProjectDropId((prev) => (prev === projectId ? null : prev));
      return;
    }

    event.preventDefault();
    setHoverProjectDropId(projectId);
  };

  const handleProjectRowDragLeave = (event: ReactDragEvent<HTMLDivElement>, projectId: string) => {
    const nextTarget = event.relatedTarget as Node | null;
    if (nextTarget && (event.currentTarget as HTMLElement).contains(nextTarget)) return;
    setHoverProjectDropId((prev) => (prev === projectId ? null : prev));
  };

  const handleProjectRowDrop = (event: ReactDragEvent<HTMLDivElement>, projectId: string) => {
    if (!canManageTimeline || !draggedBenchEmployeeId) return;

    const projectAssignments = assignmentsByProjectId.get(projectId) ?? [];
    const alreadyAssigned = projectAssignments.some((assignment) => assignment.employeeId === draggedBenchEmployeeId);
    if (alreadyAssigned) {
      setHoverProjectDropId(null);
      return;
    }

    event.preventDefault();
    setHoverProjectDropId(null);
    onOpenAssignmentModal(projectId, draggedBenchEmployeeId);
    setDraggedBenchEmployeeId(null);
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

  const roleLabelByName = useMemo(() => {
    const result = new Map<string, string>();
    for (const role of roles) {
      const shortName = role.shortName?.trim();
      result.set(role.name, shortName && shortName.length > 0 ? shortName : role.name);
    }
    return result;
  }, [roles]);

  const gradeColorByName = useMemo(() => {
    const result = new Map<string, string>();
    for (const grade of grades) {
      if (grade.colorHex && /^#[0-9A-Fa-f]{6}$/.test(grade.colorHex)) {
        result.set(grade.name, grade.colorHex);
      }
    }
    return result;
  }, [grades]);

  const employeeRoleColorById = useMemo(() => {
    const result = new Map<string, string>();
    for (const employee of employees) {
      result.set(employee.id, roleColorByName.get(employee.role.name) ?? TIMELINE_FALLBACK_COLOR_HEX);
    }
    return result;
  }, [employees, roleColorByName]);

  const employeeRoleLabelById = useMemo(() => {
    const result = new Map<string, string>();
    for (const employee of employees) {
      const shortName = employee.role.shortName?.trim();
      result.set(employee.id, shortName && shortName.length > 0 ? shortName : (roleLabelByName.get(employee.role.name) ?? employee.role.name));
    }
    return result;
  }, [employees, roleLabelByName]);

  const employeeDepartmentById = useMemo(() => {
    const result = new Map<string, string>();
    for (const employee of employees) {
      result.set(employee.id, employee.department?.name ?? t.unassignedDepartment);
    }
    return result;
  }, [employees, t.unassignedDepartment]);

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

  const visibleTimelineRows = useMemo(() => {
    if (!filterBenchEmployeeId && !filterBenchDepartmentName) return sortedTimeline;

    return sortedTimeline.filter((row) => {
      const detail = projectDetails[row.id];

      if (filterBenchEmployeeId) {
        // Prefer canonical membership/assignment data from project detail.
        if (detail) {
          const isMember = Array.isArray(detail.members) && detail.members.some((member) => member.employeeId === filterBenchEmployeeId);
          if (isMember) return true;
          return Array.isArray(detail.assignments) && detail.assignments.some((assignment) => assignment.employeeId === filterBenchEmployeeId);
        }

        // Fallback while details are loading.
        const projectAssignments = assignmentsByProjectId.get(row.id) ?? [];
        return projectAssignments.some((assignment) => assignment.employeeId === filterBenchEmployeeId);
      }

      const projectAssignments = assignmentsByProjectId.get(row.id) ?? [];
      return projectAssignments.some((assignment) => employeeDepartmentById.get(assignment.employeeId) === filterBenchDepartmentName);
    });
  }, [assignmentsByProjectId, employeeDepartmentById, filterBenchDepartmentName, filterBenchEmployeeId, projectDetails, sortedTimeline]);

  const filteredEmployeeIds = useMemo(() => {
    if (filterBenchEmployeeId) return [filterBenchEmployeeId];
    if (!filterBenchDepartmentName) return [] as string[];
    return employees
      .filter((employee) => (employee.department?.name ?? t.unassignedDepartment) === filterBenchDepartmentName)
      .map((employee) => employee.id);
  }, [employees, filterBenchDepartmentName, filterBenchEmployeeId, t.unassignedDepartment]);

  const forcedExpandedProjectIdSet = useMemo(() => {
    if (!highlightedBenchEmployeeId && !filterBenchDepartmentName) return new Set<string>();

    const allowedEmployeeIds = new Set(filteredEmployeeIds);
    const result = new Set<string>();

    for (const row of visibleTimelineRows) {
      const detail = projectDetails[row.id];
      const projectAssignments = assignmentsByProjectId.get(row.id) ?? [];

      if (highlightedBenchEmployeeId) {
        const matchesHighlight = detail
          ? (Array.isArray(detail.members) && detail.members.some((member) => member.employeeId === highlightedBenchEmployeeId)) ||
            (Array.isArray(detail.assignments) && detail.assignments.some((assignment) => assignment.employeeId === highlightedBenchEmployeeId))
          : projectAssignments.some((assignment) => assignment.employeeId === highlightedBenchEmployeeId);

        if (matchesHighlight) result.add(row.id);
        continue;
      }

      if (filterBenchDepartmentName) {
        const matchesDepartment = detail
          ? (Array.isArray(detail.members) && detail.members.some((member) => allowedEmployeeIds.has(member.employeeId))) ||
            (Array.isArray(detail.assignments) && detail.assignments.some((assignment) => allowedEmployeeIds.has(assignment.employeeId)))
          : projectAssignments.some((assignment) => allowedEmployeeIds.has(assignment.employeeId));

        if (matchesDepartment) result.add(row.id);
      }
    }

    return result;
  }, [assignmentsByProjectId, filterBenchDepartmentName, filteredEmployeeIds, highlightedBenchEmployeeId, projectDetails, visibleTimelineRows]);

  const projectFactByProjectId = useMemo(() => {
    const result = new Map<string, { style: { left: string; width: string }; startIso: string; endIso: string }>();

    for (const [projectId, projectAssignments] of assignmentsByProjectId.entries()) {
      if (projectAssignments.length === 0) continue;

      let minStart: Date | null = null;
      let maxEnd: Date | null = null;

      for (const assignment of projectAssignments) {
        const start = toUtcDay(new Date(assignment.assignmentStartDate));
        const end = toUtcDay(new Date(assignment.assignmentEndDate));
        if (!minStart || start < minStart) minStart = start;
        if (!maxEnd || end > maxEnd) maxEnd = end;
      }

      if (!minStart || !maxEnd) continue;

      const startIso = minStart.toISOString();
      const endIso = maxEnd.toISOString();
      result.set(projectId, {
        style: assignmentStyle(startIso, endIso),
        startIso,
        endIso,
      });
    }

    return result;
  }, [assignmentsByProjectId, assignmentStyle, toUtcDay]);

  const benchGroups = useMemo(() => {
    const annualUtilizationByEmployeeId = new Map<string, number>();
    for (const assignment of assignments) {
      const resolveLoadPercent = createAssignmentLoadPercentResolver(assignment);

      const start = toUtcDay(new Date(assignment.assignmentStartDate));
      const end = toUtcDay(new Date(assignment.assignmentEndDate));
      const effectiveStart = start < yearStart ? yearStart : start;
      const effectiveEnd = end > yearEndDay ? yearEndDay : end;
      if (effectiveEnd < effectiveStart) continue;

      let weightedUtilization = 0;
      const cursor = new Date(effectiveStart);
      while (cursor <= effectiveEnd) {
        weightedUtilization += resolveLoadPercent(cursor) / totalDays;
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
      annualUtilizationByEmployeeId.set(
        assignment.employeeId,
        (annualUtilizationByEmployeeId.get(assignment.employeeId) ?? 0) + weightedUtilization,
      );
    }

    const groups = new Map<
      string,
      Array<{
        id: string;
        fullName: string;
        grade?: string | null;
        gradeColorHex?: string;
        roleName: string;
        roleColorHex: string;
        annualLoadPercent: number;
      }>
    >();
    for (const employee of employees) {
      const annualUtilization = annualUtilizationByEmployeeId.get(employee.id) ?? 0;
      const departmentName = employee.department?.name ?? t.unassignedDepartment;
      const row = {
        id: employee.id,
        fullName: employee.fullName,
        grade: employee.grade,
        gradeColorHex: employee.grade ? (gradeColorByName.get(employee.grade) ?? TIMELINE_FALLBACK_COLOR_HEX) : undefined,
        roleName: employeeRoleLabelById.get(employee.id) ?? employee.role.name,
        roleColorHex: employeeRoleColorById.get(employee.id) ?? TIMELINE_FALLBACK_COLOR_HEX,
        annualLoadPercent: Math.max(0, Math.round(annualUtilization)),
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
  }, [
    assignments,
    gradeColorByName,
    employeeRoleColorById,
    employeeRoleLabelById,
    employees,
    t.unassignedDepartment,
    toUtcDay,
    totalDays,
    yearEndDay,
    yearStart,
  ]);

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

  const projectHourStatsById = useMemo(() => {
    const result = new Map<string, { actualHours: number; lostHours: number }>();

    const isWeekendByDate = (value: Date) => {
      const day = value.getUTCDay();
      return day === 0 || day === 6;
    };

    for (const [projectId, projectAssignments] of assignmentsByProjectId.entries()) {
      let actualHours = 0;
      let lostHours = 0;

      for (const assignment of projectAssignments) {
        const assignmentStart = toUtcDay(new Date(assignment.assignmentStartDate));
        const assignmentEnd = toUtcDay(new Date(assignment.assignmentEndDate));
        if (assignmentEnd < assignmentStart) continue;
        const resolveLoadPercent = createAssignmentLoadPercentResolver(assignment);

        const fixedDailyHours = assignment.plannedHoursPerDay !== null ? Number(assignment.plannedHoursPerDay) : null;
        if (fixedDailyHours !== null && (!Number.isFinite(fixedDailyHours) || fixedDailyHours <= 0)) continue;

        const vacations = vacationsByEmployeeId.get(assignment.employeeId) ?? [];
        const vacationRanges = vacations.map((vacation) => ({
          start: toUtcDay(new Date(vacation.startDate)),
          end: toUtcDay(new Date(vacation.endDate)),
        }));

        let assignmentActualHours = 0;
        let assignmentPlannedHours = 0;
        const cursor = new Date(assignmentStart);

        while (cursor <= assignmentEnd) {
          const isoDate = cursor.toISOString().slice(0, 10);
          const calendarDay = calendarDayByIso.get(isoDate);
          const isWorkingDay = calendarDay ? calendarDay.isWorkingDay : !isWeekendByDate(cursor);

          if (isWorkingDay) {
            const dailyHours =
              fixedDailyHours !== null ? fixedDailyHours : (STANDARD_DAY_HOURS * resolveLoadPercent(cursor)) / 100;
            if (!Number.isFinite(dailyHours) || dailyHours <= 0) {
              cursor.setUTCDate(cursor.getUTCDate() + 1);
              continue;
            }
            assignmentPlannedHours += dailyHours;
            const onVacation = vacationRanges.some((range) => cursor >= range.start && cursor <= range.end);
            if (!onVacation) {
              assignmentActualHours += dailyHours;
            }
          }

          cursor.setUTCDate(cursor.getUTCDate() + 1);
        }

        actualHours += assignmentActualHours;
        lostHours += Math.max(0, assignmentPlannedHours - assignmentActualHours);
      }

      result.set(projectId, {
        actualHours: Number(actualHours.toFixed(2)),
        lostHours: Number(lostHours.toFixed(2)),
      });
    }

    return result;
  }, [assignmentsByProjectId, calendarDayByIso, toUtcDay, vacationsByEmployeeId]);

  const projectErrorsById = useMemo(() => {
    const result = new Map<string, Array<{ key: string; message: string }>>();
    const priorityByKey: Record<string, number> = {
      'missing-rates': 0,
      'fact-range': 1,
      vacations: 2,
    };

    const hasOverlap = (startA: Date, endA: Date, startB: Date, endB: Date) => startA <= endB && endA >= startB;

    for (const row of sortedTimeline) {
      const issues: Array<{ key: string; message: string }> = [];
      const detail = projectDetails[row.id];

      if (detail) {
        const vacationOverlapEmployees = new Set<string>();

        for (const assignment of detail.assignments) {
          const assignmentStart = toUtcDay(new Date(assignment.assignmentStartDate));
          const assignmentEnd = toUtcDay(new Date(assignment.assignmentEndDate));
          const employeeVacations = vacationsByEmployeeId.get(assignment.employeeId) ?? [];

          for (const vacation of employeeVacations) {
            const vacationStart = toUtcDay(new Date(vacation.startDate));
            const vacationEnd = toUtcDay(new Date(vacation.endDate));
            if (hasOverlap(assignmentStart, assignmentEnd, vacationStart, vacationEnd)) {
              vacationOverlapEmployees.add(assignment.employeeId);
              break;
            }
          }
        }

        if (vacationOverlapEmployees.size > 0) {
          issues.push({
            key: 'vacations',
            message: `${t.timelineErrorVacations}: ${vacationOverlapEmployees.size}`,
          });
        }

        if (detail.costSummary && detail.costSummary.missingRateDays > 0) {
          issues.push({
            key: 'missing-rates',
            message: `${t.timelineErrorMissingRates}: ${detail.costSummary.missingRateDays} / ${Number(detail.costSummary.missingRateHours).toFixed(1)}`,
          });
        }
      }

      const projectFact = projectFactByProjectId.get(row.id);
      if (projectFact) {
        const plannedStart = toUtcDay(new Date(row.startDate));
        const plannedEnd = toUtcDay(new Date(row.endDate));
        const factStart = toUtcDay(new Date(projectFact.startIso));
        const factEnd = toUtcDay(new Date(projectFact.endIso));
        if (factStart < plannedStart || factEnd > plannedEnd) {
          issues.push({
            key: 'fact-range',
            message: `${t.timelineErrorFactRange}: ${factStart.toISOString().slice(0, 10)} → ${factEnd.toISOString().slice(0, 10)}`,
          });
        }
      }

      if (issues.length > 0) {
        issues.sort((left, right) => {
          const leftPriority = priorityByKey[left.key] ?? 99;
          const rightPriority = priorityByKey[right.key] ?? 99;
          if (leftPriority !== rightPriority) return leftPriority - rightPriority;
          return left.key.localeCompare(right.key);
        });
        result.set(row.id, issues);
      }
    }

    return result;
  }, [
    projectDetails,
    projectFactByProjectId,
    sortedTimeline,
    t.timelineErrorFactRange,
    t.timelineErrorMissingRates,
    t.timelineErrorMissingTemplateRoles,
    t.timelineErrorVacations,
    toUtcDay,
    vacationsByEmployeeId,
  ]);

  const {
    dragState,
    pendingPlanPreview,
    hoverDragMode,
    beginPlanDrag,
    resolveDragDates,
    handlePlanBarHover,
    clearPlanBarHover,
    consumeSuppressedToggleClick,
  } = useTimelineProjectDrag({
    totalDays,
    quantizationDays: dragStepDays,
    yearStartDay,
    yearEndDay,
    shiftDateByDays,
    diffDays,
    toApiDate,
    onAdjustProjectPlan,
  });

  useEffect(() => {
    window.localStorage.setItem(TIMELINE_DRAG_STEP_STORAGE_KEY, String(dragStepDays));
  }, [dragStepDays]);

  useEffect(() => {
    if (!dragState && !assignmentDragState) return;
    document.body.classList.add('timeline-no-select');
    return () => {
      document.body.classList.remove('timeline-no-select');
    };
  }, [dragState, assignmentDragState]);

  useEffect(() => {
    if (!selectedBenchEmployeeId) return;
    if (employees.some((employee) => employee.id === selectedBenchEmployeeId)) return;
    setSelectedBenchEmployeeId('');
  }, [employees, selectedBenchEmployeeId]);

  useEffect(() => {
    if (!hoveredBenchEmployeeId) return;
    if (employees.some((employee) => employee.id === hoveredBenchEmployeeId)) return;
    setHoveredBenchEmployeeId('');
  }, [employees, hoveredBenchEmployeeId]);

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
        <TimelineToolbar
          t={t}
          selectedYear={selectedYear}
          dragStepDays={dragStepDays}
          onOpenProjectModal={onOpenProjectModal}
          onYearChange={onYearChange}
          onDragStepDaysChange={setDragStepDays}
          canSeedDemoWorkspace={canSeedDemoWorkspace}
          onSeedDemoWorkspace={onSeedDemoWorkspace}
        />

        <div className="timeline-calendar-legend" aria-label={t.calendarLegendLabel}>
          <span className="timeline-calendar-legend-title">{t.calendarLegendLabel}</span>
          <span className="timeline-calendar-legend-item">
            <span className="timeline-calendar-swatch working" />
            {t.dayTypeWorking}
          </span>
          <span className="timeline-calendar-legend-item">
            <span className="timeline-calendar-swatch holiday" />
            {t.dayTypeHoliday}
          </span>
          <span className="timeline-calendar-legend-item">
            <span className="timeline-calendar-swatch weekend" />
            {t.dayTypeWeekend}
          </span>
          <span className="timeline-calendar-legend-item">
            <span className="timeline-calendar-swatch vacation" />
            {t.dayTypeVacation}
          </span>
          {calendarHealth ? (
            <span className="timeline-calendar-health">
              {t.calendarHealthLabel}: {calendarHealth.currentYear.freshness} · {t.calendarHealthLastSync}:{' '}
              {formatHealthDateTime(calendarHealth.currentYear.lastSuccessAt)}
            </span>
          ) : null}
        </div>

        <div className="timeline-board">
          <div className="timeline-main">
            <div className="timeline-rows">
              <div className="timeline-year-row">
                <CompanyLoadCard
                  t={t}
                  companyLoad={companyLoad}
                  companyLoadScaleMax={companyLoadScaleMax}
                  todayPosition={todayPosition}
                  dragStepDays={dragStepDays}
                  dayStep={dayStep}
                  dayMarkers={companyDayMarkers}
                  calendarSegments={calendarSegments}
                  months={months}
                  selectedYear={selectedYear}
                />
              </div>

              {visibleTimelineRows.length === 0 ? (
                <p className="muted">{t.noProjectsForYear}</p>
              ) : (
                visibleTimelineRows.map((row, rowIndex) => {
                  const projectAssignments = assignmentsByProjectId.get(row.id) ?? [];
                  const selectedEmployeeAssigned = highlightedBenchEmployeeId
                    ? projectAssignments.some((assignment) => assignment.employeeId === highlightedBenchEmployeeId)
                    : true;
                  const draggedEmployeeAssigned = draggedBenchEmployeeId
                    ? projectAssignments.some((assignment) => assignment.employeeId === draggedBenchEmployeeId)
                    : false;
                  const isDimmedBySelection =
                    !filterBenchEmployeeId && !filterBenchDepartmentName && Boolean(highlightedBenchEmployeeId) && !selectedEmployeeAssigned;
                  const isDimmedByDrag = Boolean(draggedBenchEmployeeId) && draggedEmployeeAssigned;
                  const isRowDimmed = draggedBenchEmployeeId ? isDimmedByDrag : isDimmedBySelection;

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
                  const isExpanded = expandedSet.has(row.id) || forcedExpandedProjectIdSet.has(row.id);
                  const detail = projectDetails[row.id];
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
                    <ProjectTimelineItem
                      key={row.id}
                      t={t}
                      row={row}
                      rowIndex={rowIndex}
                      rowCount={visibleTimelineRows.length}
                      isExpanded={isExpanded}
                      detail={detail}
                      isDimmed={isRowDimmed}
                      style={style}
                      dragStepDays={dragStepDays}
                      dayStep={dayStep}
                      calendarSegments={calendarSegments}
                      monthBoundaryPercents={projectMonthBoundaryPercents}
                      todayPosition={todayPosition}
                      projectFact={projectFactByProjectId.get(row.id) ?? null}
                      projectHourStats={projectHourStatsById.get(row.id)}
                      projectErrors={projectErrorsById.get(row.id)}
                      displayTooltipMode={displayTooltipMode}
                      tooltipMode={tooltipMode}
                      displayTooltipText={displayTooltipText}
                      formatTimelineDate={formatTimelineDate}
                      formatPlannedCost={formatPlannedCost}
                      teamTemplates={teamTemplates}
                      isDropTarget={hoverProjectDropId === row.id && !draggedEmployeeAssigned}
                      onRowDragOver={handleProjectRowDragOver}
                      onRowDragLeave={handleProjectRowDragLeave}
                      onRowDrop={handleProjectRowDrop}
                      onMoveProject={onMoveProject}
                      onToggleProject={handleToggleClick}
                      onAutoSaveProjectMeta={onAutoSaveProjectMeta}
                      onOpenAssignmentModal={onOpenAssignmentModal}
                      onPlanBarHover={handlePlanBarHover}
                      onClearPlanBarHover={clearPlanBarHover}
                      onBeginPlanDrag={beginPlanDrag}
                    >
                      {isExpanded && detail ? (
                        <ProjectAssignmentsCard
                          t={t}
                          detail={detail}
                          dayStep={dayStep}
                          calendarSegments={calendarSegments}
                          calendarDayByIso={calendarDayByIso}
                          todayPosition={todayPosition}
                          assignmentStyle={assignmentStyle}
                          employeeRoleColorById={employeeRoleColorById}
                          employeeRoleLabelById={employeeRoleLabelById}
                          employeeGradeColorByName={gradeColorByName}
                          onDeleteAssignment={onDeleteAssignment}
                          onUpdateAssignmentCurve={onUpdateAssignmentCurve}
                          assignmentDragState={assignmentDragState}
                          resolveAssignmentDragDates={resolveAssignmentDragDates}
                          pendingAssignmentPreview={pendingAssignmentPreview}
                          hoverAssignmentDragMode={hoverAssignmentDragMode}
                          toUtcDay={toUtcDay}
                          formatTooltipDate={formatTooltipDate}
                          assignmentTooltipCacheRef={assignmentTooltipCacheRef}
                          handleAssignmentBarHover={handleAssignmentBarHover}
                          clearAssignmentBarHover={clearAssignmentBarHover}
                          beginAssignmentDrag={beginAssignmentDrag}
                          vacationsByEmployeeId={vacationsByEmployeeId}
                          isoToInputDate={isoToInputDate}
                          highlightedEmployeeId={highlightedBenchEmployeeId || undefined}
                          filterEmployeeId={filterBenchEmployeeId || undefined}
                          filterEmployeeIds={filterBenchDepartmentName ? filteredEmployeeIds : undefined}
                        />
                      ) : null}
                    </ProjectTimelineItem>
                  );
                })
              )}
            </div>
          </div>

          <BenchColumn
            t={t}
            benchGroups={benchGroups}
            canDragMembers={canManageTimeline}
            selectedEmployeeId={selectedBenchEmployeeId}
            selectedDepartmentName={selectedBenchDepartmentName}
            hoveredEmployeeId={hoveredBenchEmployeeId}
            onToggleEmployeeFilter={(employeeId) => {
              setSelectedBenchEmployeeId((prev) => {
                const next = prev === employeeId ? '' : employeeId;
                if (next) {
                  setSelectedBenchDepartmentName('');
                }
                return next;
              });
            }}
            onToggleDepartmentFilter={(departmentName) => {
              setSelectedBenchDepartmentName((prev) => {
                const next = prev === departmentName ? '' : departmentName;
                if (next) {
                  setSelectedBenchEmployeeId('');
                }
                return next;
              });
            }}
            onHoverEmployee={setHoveredBenchEmployeeId}
            onMemberDragStart={setDraggedBenchEmployeeId}
            onMemberDragEnd={() => {
              setDraggedBenchEmployeeId(null);
              setHoverProjectDropId(null);
              setHoveredBenchEmployeeId('');
            }}
          />
        </div>
      </article>
    </section>
  );
}
