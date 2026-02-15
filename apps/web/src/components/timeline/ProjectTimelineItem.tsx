import { DragEvent as ReactDragEvent, MouseEvent as ReactMouseEvent, ReactNode } from 'react';
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
  onOpenProjectDatesModal: (projectId: string) => void;
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
    onOpenProjectDatesModal,
    onOpenAssignmentModal,
    onPlanBarHover,
    onClearPlanBarHover,
    onBeginPlanDrag,
    children,
  } = props;

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
              <span>{row.assignmentsCount} {t.assignmentsWord}</span>
              <span>
                {detail?.costSummary
                  ? `${Number(detail.costSummary.totalPlannedHours).toFixed(2)} ${t.hoursWord}`
                  : `— ${t.hoursWord}`}
              </span>
              <span>{t.factHoursShort}: {(projectHourStats?.actualHours ?? 0).toFixed(1)}</span>
              <span>{t.lostHoursShort}: {(projectHourStats?.lostHours ?? 0).toFixed(1)}</span>
              <span>
                {detail?.costSummary
                  ? formatPlannedCost(Number(detail.costSummary.totalPlannedCost), detail.costSummary.currency)
                  : '—'}
              </span>
              <span>
                {formatTimelineDate(row.startDate)} {t.fromTo} {formatTimelineDate(row.endDate)}
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
              <Icon name="calendar" />
            </button>
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