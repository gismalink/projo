import { DragEvent as ReactDragEvent, MouseEvent as ReactMouseEvent, ReactNode, useEffect, useRef, useState } from 'react';
import { ProjectDetail, ProjectTimelineRow } from '../../api/client';
import { Icon } from '../Icon';

type ProjectTimelineItemProps = {
  t: Record<string, string>;
  row: ProjectTimelineRow;
  rowIndex: number;
  rowCount: number;
  isExpanded: boolean;
  detail?: ProjectDetail;
  style: { left: string; width: string };
  dragStepDays: 1 | 7 | 30;
  dayStep: string;
  calendarSegments: Array<{ key: string; left: string; width: string; kind: 'weekend' | 'holiday' }>;
  monthBoundaryPercents: number[];
  todayPosition: string | null;
  projectFact: { style: { left: string; width: string }; startIso: string; endIso: string } | null;
  projectHourStats?: { actualHours: number; lostHours: number };
  projectErrors?: Array<{ key: string; message: string }>;
  displayTooltipMode: 'move' | 'resize-start' | 'resize-end';
  tooltipMode: 'move' | 'resize-start' | 'resize-end' | null;
  displayTooltipText: string;
  formatTimelineDate: (value: string) => string;
  formatPlannedCost: (amount: number, currency: string) => string;
  isDropTarget: boolean;
  onRowDragOver: (event: ReactDragEvent<HTMLDivElement>, rowId: string) => void;
  onRowDragLeave: (event: ReactDragEvent<HTMLDivElement>, rowId: string) => void;
  onRowDrop: (event: ReactDragEvent<HTMLDivElement>, rowId: string) => void;
  onMoveProject: (projectId: string, direction: 'up' | 'down') => void;
  onToggleProject: (event: ReactMouseEvent, projectId: string) => void;
  onAutoSaveProjectMeta: (
    projectId: string,
    payload: { code: string; name: string; startDate: string; endDate: string },
  ) => Promise<void>;
  onOpenAssignmentModal: (projectId: string, employeeId?: string) => void;
  onPlanBarHover: (event: ReactMouseEvent<HTMLElement>, row: ProjectTimelineRow) => void;
  onClearPlanBarHover: (row: ProjectTimelineRow) => void;
  onBeginPlanDrag: (
    event: ReactMouseEvent,
    row: ProjectTimelineRow,
    mode: 'move' | 'resize-start' | 'resize-end',
  ) => void;
  children?: ReactNode;
};

export function ProjectTimelineItem(props: ProjectTimelineItemProps) {
  const {
    t,
    row,
    rowIndex,
    rowCount,
    isExpanded,
    detail,
    style,
    dragStepDays,
    dayStep,
    calendarSegments,
    monthBoundaryPercents,
    todayPosition,
    projectFact,
    projectHourStats,
    projectErrors,
    displayTooltipMode,
    tooltipMode,
    displayTooltipText,
    formatTimelineDate,
    formatPlannedCost,
    isDropTarget,
    onRowDragOver,
    onRowDragLeave,
    onRowDrop,
    onMoveProject,
    onToggleProject,
    onAutoSaveProjectMeta,
    onOpenAssignmentModal,
    onPlanBarHover,
    onClearPlanBarHover,
    onBeginPlanDrag,
    children,
  } = props;

  const [isProjectEditOpen, setIsProjectEditOpen] = useState(false);
  const [draftCode, setDraftCode] = useState(row.code);
  const [draftName, setDraftName] = useState(row.name);
  const [draftStartDate, setDraftStartDate] = useState(row.startDate.slice(0, 10));
  const [draftEndDate, setDraftEndDate] = useState(row.endDate.slice(0, 10));
  const editPopoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setDraftCode(row.code);
    setDraftName(row.name);
    setDraftStartDate(row.startDate.slice(0, 10));
    setDraftEndDate(row.endDate.slice(0, 10));
  }, [row.code, row.endDate, row.name, row.startDate]);

  useEffect(() => {
    if (!isProjectEditOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      const root = editPopoverRef.current;
      if (!root) return;
      if (root.contains(event.target as Node)) return;
      setIsProjectEditOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [isProjectEditOpen]);

  useEffect(() => {
    if (!isProjectEditOpen) return;

    const nextCode = draftCode.trim();
    const nextName = draftName.trim();
    if (!nextCode || !nextName || !draftStartDate || !draftEndDate) return;

    if (new Date(draftStartDate) > new Date(draftEndDate)) return;

    const baselineCode = row.code.trim();
    const baselineName = row.name.trim();
    const baselineStart = row.startDate.slice(0, 10);
    const baselineEnd = row.endDate.slice(0, 10);
    const unchanged =
      nextCode === baselineCode &&
      nextName === baselineName &&
      draftStartDate === baselineStart &&
      draftEndDate === baselineEnd;

    if (unchanged) return;

    const timer = window.setTimeout(() => {
      void onAutoSaveProjectMeta(row.id, {
        code: nextCode,
        name: nextName,
        startDate: new Date(draftStartDate).toISOString(),
        endDate: new Date(draftEndDate).toISOString(),
      });
    }, 420);

    return () => window.clearTimeout(timer);
  }, [draftCode, draftEndDate, draftName, draftStartDate, isProjectEditOpen, onAutoSaveProjectMeta, row.code, row.endDate, row.id, row.name, row.startDate]);

  return (
    <div
      className={isDropTarget ? 'timeline-project-item drop-target' : 'timeline-project-item'}
      onDragOver={(event) => onRowDragOver(event, row.id)}
      onDragLeave={(event) => onRowDragLeave(event, row.id)}
      onDrop={(event) => onRowDrop(event, row.id)}
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
                aria-label={t.moveProjectUp}
                title={t.moveUp}
              >
                <Icon name="arrow-up" />
              </button>
              <button
                type="button"
                className="timeline-row-toggle"
                onClick={() => onMoveProject(row.id, 'down')}
                disabled={rowIndex === rowCount - 1}
                aria-label={t.moveProjectDown}
                title={t.moveDown}
              >
                <Icon name="arrow-down" />
              </button>
              <button
                type="button"
                className={isExpanded ? 'timeline-row-toggle active' : 'timeline-row-toggle'}
                onClick={(event) => onToggleProject(event, row.id)}
                aria-label={isExpanded ? t.collapseProjectRow : t.expandProjectRow}
                title={isExpanded ? t.collapse : t.expand}
              >
                <Icon name={isExpanded ? 'chevron-up' : 'chevron-down'} />
              </button>
            </div>
            <strong>
              {row.code} · {row.name}
            </strong>
            <div className="timeline-kpi-row">
              <span className="timeline-kpi-item" title={`${row.assignmentsCount} ${t.assignmentsWord}`}>
                <Icon name="users" size={13} />
                <span>{row.assignmentsCount}</span>
              </span>
              <span
                className="timeline-kpi-item"
                title={detail?.costSummary ? `${t.plannedHoursLabel}: ${Number(detail.costSummary.totalPlannedHours).toFixed(1)} ${t.hoursWord}` : t.plannedHoursLabel}
              >
                <Icon name="clock" size={13} />
                <span>{detail?.costSummary ? Number(detail.costSummary.totalPlannedHours).toFixed(1) : '—'}</span>
              </span>
              <span className="timeline-kpi-item" title={`${t.factHoursShort}: ${(projectHourStats?.actualHours ?? 0).toFixed(1)} ${t.hoursWord}`}>
                <Icon name="check" size={13} />
                <span>{(projectHourStats?.actualHours ?? 0).toFixed(1)}</span>
              </span>
              <span className="timeline-kpi-item" title={`${t.lostHoursShort}: ${(projectHourStats?.lostHours ?? 0).toFixed(1)} ${t.hoursWord}`}>
                <Icon name="x" size={13} />
                <span>{(projectHourStats?.lostHours ?? 0).toFixed(1)}</span>
              </span>
              <span
                className="timeline-kpi-item"
                title={detail?.costSummary ? `${t.plannedCostLabel}: ${formatPlannedCost(Number(detail.costSummary.totalPlannedCost), detail.costSummary.currency)}` : t.plannedCostLabel}
              >
                <Icon name="coins" size={13} />
                <span>{detail?.costSummary ? formatPlannedCost(Number(detail.costSummary.totalPlannedCost), detail.costSummary.currency) : '—'}</span>
              </span>
              <span
                className="timeline-kpi-item"
                title={detail?.costSummary ? `${t.factCostLabel}: ${formatPlannedCost(Number(detail.costSummary.totalActualCost), detail.costSummary.currency)}` : t.factCostLabel}
              >
                <Icon name="check" size={13} />
                <span>{detail?.costSummary ? formatPlannedCost(Number(detail.costSummary.totalActualCost), detail.costSummary.currency) : '—'}</span>
              </span>
              <span
                className="timeline-kpi-item"
                title={detail?.costSummary ? `${t.lostCostLabel}: ${formatPlannedCost(Number(detail.costSummary.totalLostCost), detail.costSummary.currency)}` : t.lostCostLabel}
              >
                <Icon name="alert" size={13} />
                <span>{detail?.costSummary ? formatPlannedCost(Number(detail.costSummary.totalLostCost), detail.costSummary.currency) : '—'}</span>
              </span>
              <span
                className="timeline-kpi-item"
                title={detail?.costSummary ? `${t.missingRateDaysLabel}: ${detail.costSummary.missingRateDays}` : t.missingRateDaysLabel}
              >
                <Icon name="calendar" size={13} />
                <span>{detail?.costSummary ? detail.costSummary.missingRateDays : 0}</span>
              </span>
              <span
                className="timeline-kpi-item"
                title={detail?.costSummary ? `${t.missingRateHoursLabel}: ${Number(detail.costSummary.missingRateHours).toFixed(1)} ${t.hoursWord}` : t.missingRateHoursLabel}
              >
                <Icon name="clock" size={13} />
                <span>{detail?.costSummary ? Number(detail.costSummary.missingRateHours).toFixed(1) : '0.0'}</span>
              </span>
              <span className="timeline-kpi-item" title={`${formatTimelineDate(row.startDate)} ${t.fromTo} ${formatTimelineDate(row.endDate)}`}>
                <Icon name="calendar" size={13} />
                <span>{formatTimelineDate(row.startDate)}–{formatTimelineDate(row.endDate)}</span>
              </span>
            </div>
            {projectErrors && projectErrors.length > 0 ? (
              <div className="timeline-error-row" aria-label={t.timelineErrorsLabel}>
                <span className="timeline-error-title">{t.timelineErrorsLabel}</span>
                <div className="timeline-error-list">
                  {projectErrors.map((item) => (
                    <span key={item.key} className="timeline-error-chip" title={item.message} aria-label={item.message}>
                      <Icon name="alert" size={12} />
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
          <div className="timeline-meta-actions" ref={editPopoverRef}>
            <button
              type="button"
              className="timeline-meta-icon-btn"
              onClick={() => setIsProjectEditOpen((prev) => !prev)}
              title={t.editProjectDates}
              aria-label={t.editProjectDates}
            >
              <Icon name="edit" />
            </button>
            {isProjectEditOpen ? (
              <div className="project-edit-popover">
                <div className="project-edit-row">
                  <input aria-label={t.code} value={draftCode} onChange={(event) => setDraftCode(event.target.value)} />
                  <input aria-label={t.name} value={draftName} onChange={(event) => setDraftName(event.target.value)} />
                  <input aria-label={t.start} type="date" value={draftStartDate} onChange={(event) => setDraftStartDate(event.target.value)} />
                  <input aria-label={t.end} type="date" value={draftEndDate} onChange={(event) => setDraftEndDate(event.target.value)} />
                </div>
              </div>
            ) : null}
            <button
              type="button"
              className="timeline-meta-icon-btn"
              onClick={() => onOpenAssignmentModal(row.id)}
              title={t.assignEmployee}
              aria-label={t.assignEmployee}
            >
              <Icon name="user-plus" />
            </button>
          </div>
        </div>
        <div className={`track project-track step-${dragStepDays}`}>
          {calendarSegments.map((segment) => (
            <span
              key={`${row.id}-project-segment-${segment.key}`}
              className={`calendar-day-segment ${segment.kind === 'holiday' ? 'holiday' : 'weekend'}`}
              style={{ left: segment.left, width: segment.width }}
            />
          ))}
          <span className="track-day-grid" style={{ ['--day-step' as string]: dayStep }} />
          {projectFact ? (
            <span
              className="project-fact-bar"
              style={projectFact.style}
              title={`${t.factLabel}: ${formatTimelineDate(projectFact.startIso)} ${t.fromTo} ${formatTimelineDate(projectFact.endIso)}`}
            />
          ) : null}
          {dragStepDays === 30 ? (
            <span className="project-month-grid" aria-hidden>
              {monthBoundaryPercents.map((leftPercent, index) => (
                <span
                  key={`${row.id}-month-boundary-${index}`}
                  className="project-month-grid-line"
                  style={{ left: `${leftPercent.toFixed(6)}%` }}
                />
              ))}
            </span>
          ) : null}
          {todayPosition ? <span className="current-day-line" style={{ left: todayPosition }} /> : null}
          <div
            className="bar project-plan-bar"
            style={style}
            onMouseMove={(event) => onPlanBarHover(event, row)}
            onMouseLeave={() => onClearPlanBarHover(row)}
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
              onMouseDown={(event) => onBeginPlanDrag(event, row, 'resize-start')}
            />
            <span
              className="project-plan-handle center"
              onMouseDown={(event) => onBeginPlanDrag(event, row, 'move')}
            />
            <span
              className="project-plan-handle right"
              onMouseDown={(event) => onBeginPlanDrag(event, row, 'resize-end')}
            />
          </div>
        </div>
      </div>

      {children}
    </div>
  );
}