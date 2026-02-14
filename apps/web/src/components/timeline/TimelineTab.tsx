import { FormEvent, useMemo } from 'react';
import { AssignmentItem, ProjectDetail, ProjectTimelineRow } from '../../api/client';

type TimelineTabProps = {
  t: Record<string, string>;
  months: string[];
  selectedYear: number;
  assignments: AssignmentItem[];
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
    assignments,
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
            {todayPosition ? <span className="current-day-line" style={{ left: todayPosition }} /> : null}
            {companyDailyLoad.totals.map((value, index) => (
              <span
                key={`${selectedYear}-load-${index}`}
                className="company-load-bar"
                style={{ height: `${Math.max(2, (value / companyDailyLoad.max) * 100)}%` }}
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
                    <div className="timeline-submeta">
                      {row.status} · {t.priorityWord} {row.priority} · {isoToInputDate(row.startDate)} {t.fromTo}{' '}
                      {isoToInputDate(row.endDate)}
                    </div>
                    <div className="track">
                      <span className="track-day-grid" style={{ ['--day-step' as string]: dayStep }} />
                      {todayPosition ? <span className="current-day-line" style={{ left: todayPosition }} /> : null}
                      <div className="bar" style={style} title={`${row.startDate} - ${row.endDate}`}>
                        {row.status}
                      </div>
                    </div>
                  </button>

                  {isExpanded && detail ? (
                    <section className="project-card">
                      <div className="project-card-tools">
                        <button type="button" onClick={() => onOpenAssignmentModal(detail.id)}>
                          {t.assignEmployee}
                        </button>
                      </div>

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
