import { FormEvent } from 'react';
import { ProjectDetail, ProjectTimelineRow } from '../../api/client';

type TimelineTabProps = {
  t: Record<string, string>;
  months: string[];
  selectedYear: number;
  sortedTimeline: ProjectTimelineRow[];
  expandedProjectIds: string[];
  projectDetails: Record<string, ProjectDetail>;
  selectedProjectId: string;
  selectedAssignmentId: string;
  editAssignmentStartDate: string;
  editAssignmentEndDate: string;
  editAssignmentPercent: number;
  onOpenProjectModal: () => void;
  onOpenAssignmentModal: (projectId: string) => void;
  onSelectProject: (projectId: string) => Promise<void>;
  onUpdateAssignment: (event: FormEvent) => Promise<void>;
  onYearChange: (nextYear: number) => Promise<void>;
  onEditorAssignmentChange: (projectId: string, assignmentId: string) => void;
  setEditAssignmentStartDate: (value: string) => void;
  setEditAssignmentEndDate: (value: string) => void;
  setEditAssignmentPercent: (value: number) => void;
  timelineStyle: (row: ProjectTimelineRow) => { left: string; width: string };
  isoToInputDate: (value: string) => string;
};

export function TimelineTab(props: TimelineTabProps) {
  const {
    t,
    months,
    selectedYear,
    sortedTimeline,
    expandedProjectIds,
    projectDetails,
    selectedProjectId,
    selectedAssignmentId,
    editAssignmentStartDate,
    editAssignmentEndDate,
    editAssignmentPercent,
    onOpenProjectModal,
    onOpenAssignmentModal,
    onSelectProject,
    onUpdateAssignment,
    onYearChange,
    onEditorAssignmentChange,
    setEditAssignmentStartDate,
    setEditAssignmentEndDate,
    setEditAssignmentPercent,
    timelineStyle,
    isoToInputDate,
  } = props;

  const expandedSet = new Set(expandedProjectIds);
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

        <div className="month-grid">
          {todayPosition ? <span className="current-day-line" style={{ left: todayPosition }} /> : null}
          {months.map((month) => (
            <span key={month}>{month}</span>
          ))}
        </div>

        <div className="timeline-rows">
          {sortedTimeline.length === 0 ? (
            <p className="muted">{t.noProjectsForYear}</p>
          ) : (
            sortedTimeline.map((row) => {
              const style = timelineStyle(row);
              const isExpanded = expandedSet.has(row.id);
              const detail = projectDetails[row.id];
              return (
                <div key={row.id} className="timeline-project-item">
                  <button
                    type="button"
                    className={isExpanded ? 'timeline-row selected' : 'timeline-row'}
                    onClick={() => onSelectProject(row.id)}
                  >
                    <div className="timeline-meta">
                      <strong>
                        {row.code} · {row.name}
                      </strong>
                      <span>
                        {row.assignmentsCount} {t.assignmentsWord} · {row.totalPlannedHoursPerDay} h/day
                      </span>
                    </div>
                    <div className="track">
                      {todayPosition ? <span className="current-day-line" style={{ left: todayPosition }} /> : null}
                      <div className="bar" style={style} title={`${row.startDate} - ${row.endDate}`}>
                        {row.status}
                      </div>
                    </div>
                  </button>

                  {isExpanded && detail ? (
                    <section className="project-card">
                      <div className="section-header">
                        <h3>{detail.code} · {detail.name}</h3>
                        <button type="button" onClick={() => onOpenAssignmentModal(detail.id)}>
                          {t.assignEmployee}
                        </button>
                      </div>

                      <div className="project-card-header">
                        <span>
                          {detail.status} · {t.priorityWord} {detail.priority}
                        </span>
                        <span>
                          {isoToInputDate(detail.startDate)} {t.fromTo} {isoToInputDate(detail.endDate)}
                        </span>
                      </div>

                      <div className="assignment-list">
                        {detail.assignments.length === 0 ? (
                          <p className="muted">{t.noAssignments}</p>
                        ) : (
                          detail.assignments.map((assignment) => (
                            <button
                              type="button"
                              key={assignment.id}
                              className={assignment.id === selectedAssignmentId && selectedProjectId === detail.id ? 'assignment-item active' : 'assignment-item'}
                              onClick={() => onEditorAssignmentChange(detail.id, assignment.id)}
                            >
                              <strong>{assignment.employee.fullName}</strong>
                              <span>
                                {isoToInputDate(assignment.assignmentStartDate)} {t.fromTo} {isoToInputDate(assignment.assignmentEndDate)} ·{' '}
                                {Number(assignment.allocationPercent)}%
                              </span>
                            </button>
                          ))
                        )}
                      </div>

                      {selectedProjectId === detail.id && selectedAssignmentId ? (
                        <form className="timeline-form" onSubmit={onUpdateAssignment}>
                          <label>
                            {t.editAssignment}
                            <select value={selectedAssignmentId} onChange={(e) => onEditorAssignmentChange(detail.id, e.target.value)}>
                              {detail.assignments.map((assignment) => (
                                <option value={assignment.id} key={assignment.id}>
                                  {assignment.employee.fullName}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            {t.start}
                            <input type="date" value={editAssignmentStartDate} onChange={(e) => setEditAssignmentStartDate(e.target.value)} />
                          </label>
                          <label>
                            {t.end}
                            <input type="date" value={editAssignmentEndDate} onChange={(e) => setEditAssignmentEndDate(e.target.value)} />
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
                          <button type="submit">{t.saveAssignment}</button>
                        </form>
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
