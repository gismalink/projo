import { DragEvent as ReactDragEvent, MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import { AssignmentItem, ProjectDetail, ProjectTimelineRow } from '../../api/client';

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
  monthBoundaryPercents: number[];
  todayPosition: string | null;
  projectAssignments: AssignmentItem[];
  assignmentShiftDays: number;
  assignmentStyle: (startDate: string, endDate: string) => { left: string; width: string };
  shiftDateByDays: (value: Date, days: number) => Date;
  employeeRoleColorById: Map<string, string>;
  displayTooltipMode: 'move' | 'resize-start' | 'resize-end';
  tooltipMode: 'move' | 'resize-start' | 'resize-end' | null;
  displayTooltipText: string;
  isoToInputDate: (value: string) => string;
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
    monthBoundaryPercents,
    todayPosition,
    projectAssignments,
    assignmentShiftDays,
    assignmentStyle,
    shiftDateByDays,
    employeeRoleColorById,
    displayTooltipMode,
    tooltipMode,
    displayTooltipText,
    isoToInputDate,
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
                aria-label="Move project up"
                title="Move up"
              >
                ↑
              </button>
              <button
                type="button"
                className="timeline-row-toggle"
                onClick={() => onMoveProject(row.id, 'down')}
                disabled={rowIndex === rowCount - 1}
                aria-label="Move project down"
                title="Move down"
              >
                ↓
              </button>
              <button
                type="button"
                className={isExpanded ? 'timeline-row-toggle active' : 'timeline-row-toggle'}
                onClick={(event) => onToggleProject(event, row.id)}
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
        <div className={`track project-track step-${dragStepDays}`}>
          <span className="track-day-grid" style={{ ['--day-step' as string]: dayStep }} />
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

      {children}
    </div>
  );
}