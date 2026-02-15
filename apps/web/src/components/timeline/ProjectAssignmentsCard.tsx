import { MouseEvent as ReactMouseEvent, MutableRefObject, useMemo } from 'react';
import { ProjectDetail } from '../../api/client';
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
  todayPosition: string | null;
  assignmentStyle: (startDate: string, endDate: string) => { left: string; width: string };
  employeeRoleColorById: Map<string, string>;
  onDeleteAssignment: (projectId: string, assignmentId: string) => Promise<void>;
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
};

export function ProjectAssignmentsCard(props: ProjectAssignmentsCardProps) {
  const {
    t,
    detail,
    dayStep,
    calendarSegments,
    todayPosition,
    assignmentStyle,
    employeeRoleColorById,
    onDeleteAssignment,
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
  } = props;

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

  return (
    <section className="project-card">
      <div className="assignment-list">
        {sortedAssignments.length === 0 ? (
          <p className="muted">{t.noAssignments}</p>
        ) : (
          sortedAssignments.map((assignment) => (
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
  );
}