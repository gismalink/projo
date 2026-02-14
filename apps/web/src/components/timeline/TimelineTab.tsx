import { FormEvent } from 'react';
import { ProjectDetail, ProjectListItem, ProjectTimelineRow } from '../../api/client';
import { Employee } from '../../pages/app-types';

type TimelineTabProps = {
  t: Record<string, string>;
  months: string[];
  selectedYear: number;
  sortedTimeline: ProjectTimelineRow[];
  selectedProjectId: string;
  selectedProjectDetail: ProjectDetail | null;
  selectedAssignmentId: string;
  projects: ProjectListItem[];
  employees: Employee[];
  projectCode: string;
  projectName: string;
  projectStartDate: string;
  projectEndDate: string;
  assignmentProjectId: string;
  assignmentEmployeeId: string;
  assignmentStartDate: string;
  assignmentEndDate: string;
  assignmentPercent: number;
  editAssignmentStartDate: string;
  editAssignmentEndDate: string;
  editAssignmentPercent: number;
  onCreateProject: (event: FormEvent) => Promise<void>;
  onCreateAssignment: (event: FormEvent) => Promise<void>;
  onSelectProject: (projectId: string) => Promise<void>;
  onUpdateAssignment: (event: FormEvent) => Promise<void>;
  onYearChange: (nextYear: number) => Promise<void>;
  onEditorAssignmentChange: (assignmentId: string) => void;
  setProjectCode: (value: string) => void;
  setProjectName: (value: string) => void;
  setProjectStartDate: (value: string) => void;
  setProjectEndDate: (value: string) => void;
  setAssignmentProjectId: (value: string) => void;
  setAssignmentEmployeeId: (value: string) => void;
  setAssignmentStartDate: (value: string) => void;
  setAssignmentEndDate: (value: string) => void;
  setAssignmentPercent: (value: number) => void;
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
    selectedProjectId,
    selectedProjectDetail,
    selectedAssignmentId,
    projects,
    employees,
    projectCode,
    projectName,
    projectStartDate,
    projectEndDate,
    assignmentProjectId,
    assignmentEmployeeId,
    assignmentStartDate,
    assignmentEndDate,
    assignmentPercent,
    editAssignmentStartDate,
    editAssignmentEndDate,
    editAssignmentPercent,
    onCreateProject,
    onCreateAssignment,
    onSelectProject,
    onUpdateAssignment,
    onYearChange,
    onEditorAssignmentChange,
    setProjectCode,
    setProjectName,
    setProjectStartDate,
    setProjectEndDate,
    setAssignmentProjectId,
    setAssignmentEmployeeId,
    setAssignmentStartDate,
    setAssignmentEndDate,
    setAssignmentPercent,
    setEditAssignmentStartDate,
    setEditAssignmentEndDate,
    setEditAssignmentPercent,
    timelineStyle,
    isoToInputDate,
  } = props;

  return (
    <section className="timeline-layout">
      <article className="card">
        <h2>{t.createProject}</h2>
        <form className="timeline-form" onSubmit={onCreateProject}>
          <label>
            {t.code}
            <input value={projectCode} onChange={(e) => setProjectCode(e.target.value)} />
          </label>
          <label>
            {t.name}
            <input value={projectName} onChange={(e) => setProjectName(e.target.value)} />
          </label>
          <label>
            {t.start}
            <input type="date" value={projectStartDate} onChange={(e) => setProjectStartDate(e.target.value)} />
          </label>
          <label>
            {t.end}
            <input type="date" value={projectEndDate} onChange={(e) => setProjectEndDate(e.target.value)} />
          </label>
          <button type="submit">{t.createProject}</button>
        </form>

        <h2>{t.assignEmployee}</h2>
        <form className="timeline-form" onSubmit={onCreateAssignment}>
          <label>
            {t.role}
            <select value={assignmentProjectId} onChange={(e) => setAssignmentProjectId(e.target.value)}>
              <option value="">{t.selectProject}</option>
              {projects.map((project) => (
                <option value={project.id} key={project.id}>
                  {project.code} · {project.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t.tabPersonnel}
            <select value={assignmentEmployeeId} onChange={(e) => setAssignmentEmployeeId(e.target.value)}>
              <option value="">{t.selectEmployee}</option>
              {employees.map((employee) => (
                <option value={employee.id} key={employee.id}>
                  {employee.fullName}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t.start}
            <input type="date" value={assignmentStartDate} onChange={(e) => setAssignmentStartDate(e.target.value)} />
          </label>
          <label>
            {t.end}
            <input type="date" value={assignmentEndDate} onChange={(e) => setAssignmentEndDate(e.target.value)} />
          </label>
          <label>
            {t.allocationPercent}
            <input type="number" min={0} max={100} value={assignmentPercent} onChange={(e) => setAssignmentPercent(Number(e.target.value))} />
          </label>
          <button type="submit">{t.assignEmployee}</button>
        </form>
      </article>

      <article className="card timeline-card">
        <div className="timeline-toolbar">
          <h2>{t.yearTimeline}</h2>
          <div className="year-switcher">
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
              return (
                <button
                  type="button"
                  className={row.id === selectedProjectId ? 'timeline-row selected' : 'timeline-row'}
                  key={row.id}
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
                    <div className="bar" style={style} title={`${row.startDate} - ${row.endDate}`}>
                      {row.status}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <section className="project-card">
          <h3>{t.projectCard}</h3>
          {!selectedProjectDetail ? (
            <p className="muted">{t.selectProjectPrompt}</p>
          ) : (
            <>
              <div className="project-card-header">
                <strong>
                  {selectedProjectDetail.code} · {selectedProjectDetail.name}
                </strong>
                <span>
                  {selectedProjectDetail.status} · {t.priorityWord} {selectedProjectDetail.priority}
                </span>
              </div>
              <p className="muted">
                {isoToInputDate(selectedProjectDetail.startDate)} {t.fromTo} {isoToInputDate(selectedProjectDetail.endDate)}
              </p>

              <div className="assignment-list">
                {selectedProjectDetail.assignments.length === 0 ? (
                  <p className="muted">{t.noAssignments}</p>
                ) : (
                  selectedProjectDetail.assignments.map((assignment) => (
                    <button
                      type="button"
                      key={assignment.id}
                      className={assignment.id === selectedAssignmentId ? 'assignment-item active' : 'assignment-item'}
                      onClick={() => onEditorAssignmentChange(assignment.id)}
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

              {selectedAssignmentId ? (
                <form className="timeline-form" onSubmit={onUpdateAssignment}>
                  <label>
                    {t.editAssignment}
                    <select value={selectedAssignmentId} onChange={(e) => onEditorAssignmentChange(e.target.value)}>
                      {selectedProjectDetail.assignments.map((assignment) => (
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
                    <input type="number" min={0} max={100} value={editAssignmentPercent} onChange={(e) => setEditAssignmentPercent(Number(e.target.value))} />
                  </label>
                  <button type="submit">{t.saveAssignment}</button>
                </form>
              ) : null}
            </>
          )}
        </section>
      </article>
    </section>
  );
}
