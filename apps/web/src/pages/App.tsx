import { FormEvent, useMemo, useState } from 'react';
import { api, ProjectListItem, ProjectTimelineRow } from '../api/client';

type Role = {
  id: string;
  name: string;
  description?: string;
  _count?: { employees: number };
};

type Employee = {
  id: string;
  fullName: string;
  email: string;
  status: string;
  role: { name: string };
};

type ActiveTab = 'directory' | 'timeline';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function dayOfYear(date: Date) {
  const start = new Date(Date.UTC(date.getUTCFullYear(), 0, 0));
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / 86400000);
}

function timelineStyle(row: ProjectTimelineRow) {
  const start = new Date(row.startDate);
  const end = new Date(row.endDate);
  const yearStart = new Date(Date.UTC(start.getUTCFullYear(), 0, 1));
  const yearEnd = new Date(Date.UTC(start.getUTCFullYear(), 11, 31));

  const effectiveStart = start < yearStart ? yearStart : start;
  const effectiveEnd = end > yearEnd ? yearEnd : end;

  const totalDays = dayOfYear(yearEnd);
  const startOffset = dayOfYear(effectiveStart) / totalDays;
  const endOffset = dayOfYear(effectiveEnd) / totalDays;

  return {
    left: `${(startOffset * 100).toFixed(2)}%`,
    width: `${Math.max((endOffset - startOffset) * 100, 1.2).toFixed(2)}%`,
  };
}

export function App() {
  const [email, setEmail] = useState('admin@projo.local');
  const [password, setPassword] = useState('admin12345');
  const [token, setToken] = useState<string | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [timeline, setTimeline] = useState<ProjectTimelineRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('directory');
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  const [projectCode, setProjectCode] = useState('PRJ-001');
  const [projectName, setProjectName] = useState('Pilot CRM Rollout');
  const [projectStartDate, setProjectStartDate] = useState(`${new Date().getFullYear()}-02-01`);
  const [projectEndDate, setProjectEndDate] = useState(`${new Date().getFullYear()}-06-30`);

  const [assignmentProjectId, setAssignmentProjectId] = useState('');
  const [assignmentEmployeeId, setAssignmentEmployeeId] = useState('');
  const [assignmentStartDate, setAssignmentStartDate] = useState(`${new Date().getFullYear()}-03-01`);
  const [assignmentEndDate, setAssignmentEndDate] = useState(`${new Date().getFullYear()}-04-30`);
  const [assignmentPercent, setAssignmentPercent] = useState(50);

  const sortedTimeline = useMemo(
    () => [...timeline].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()),
    [timeline],
  );

  async function refreshData(authToken: string, year: number) {
    const [rolesData, employeesData, projectsData, timelineData] = await Promise.all([
      api.getRoles(authToken),
      api.getEmployees(authToken),
      api.getProjects(authToken),
      api.getTimelineYear(year, authToken),
    ]);

    const nextEmployees = employeesData as Employee[];
    const nextProjects = projectsData as ProjectListItem[];

    setRoles(rolesData as Role[]);
    setEmployees(nextEmployees);
    setProjects(nextProjects);
    setTimeline(timelineData);

    if (!assignmentProjectId && nextProjects[0]) {
      setAssignmentProjectId(nextProjects[0].id);
    }

    if (!assignmentEmployeeId && nextEmployees[0]) {
      setAssignmentEmployeeId(nextEmployees[0].id);
    }
  }

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    setError(null);

    try {
      const result = await api.login(email, password);
      setToken(result.accessToken);
      await refreshData(result.accessToken, selectedYear);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    }
  }

  async function handleCreateProject(event: FormEvent) {
    event.preventDefault();
    if (!token) return;

    setError(null);
    try {
      await api.createProject(
        {
          code: projectCode,
          name: projectName,
          startDate: new Date(projectStartDate).toISOString(),
          endDate: new Date(projectEndDate).toISOString(),
          status: 'planned',
          priority: 2,
          links: [],
        },
        token,
      );

      await refreshData(token, selectedYear);
      setProjectCode((prev) => {
        const match = prev.match(/(\d+)$/);
        if (!match) return `${prev}-1`;
        const next = String(Number(match[1]) + 1).padStart(match[1].length, '0');
        return prev.replace(/\d+$/, next);
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create project');
    }
  }

  async function handleCreateAssignment(event: FormEvent) {
    event.preventDefault();
    if (!token || !assignmentProjectId || !assignmentEmployeeId) return;

    setError(null);
    try {
      await api.createAssignment(
        {
          projectId: assignmentProjectId,
          employeeId: assignmentEmployeeId,
          assignmentStartDate: new Date(assignmentStartDate).toISOString(),
          assignmentEndDate: new Date(assignmentEndDate).toISOString(),
          allocationPercent: assignmentPercent,
        },
        token,
      );

      await refreshData(token, selectedYear);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create assignment');
    }
  }

  async function handleYearChange(nextYear: number) {
    setSelectedYear(nextYear);
    if (!token) return;

    try {
      const timelineData = await api.getTimelineYear(nextYear, token);
      setTimeline(timelineData);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load timeline');
    }
  }

  return (
    <main className="container">
      <h1>Projo MVP</h1>
      <p className="subtitle">Project planning workspace</p>

      {!token ? (
        <form onSubmit={handleLogin} className="card">
          <h2>Login</h2>
          <label>
            Email
            <input value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label>
            Password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <button type="submit">Sign in</button>
          {error ? <p className="error">{error}</p> : null}
        </form>
      ) : (
        <>
          <div className="tabs">
            <button
              type="button"
              className={activeTab === 'directory' ? 'tab active' : 'tab'}
              onClick={() => setActiveTab('directory')}
            >
              Directory
            </button>
            <button
              type="button"
              className={activeTab === 'timeline' ? 'tab active' : 'tab'}
              onClick={() => setActiveTab('timeline')}
            >
              Timeline
            </button>
          </div>

          {activeTab === 'directory' ? (
            <section className="grid">
              <article className="card">
                <h2>Roles</h2>
                <ul>
                  {roles.map((role) => (
                    <li key={role.id}>
                      <strong>{role.name}</strong>
                      <span>{role._count?.employees ?? 0} employees</span>
                    </li>
                  ))}
                </ul>
              </article>

              <article className="card">
                <h2>Employees</h2>
                <ul>
                  {employees.map((employee) => (
                    <li key={employee.id}>
                      <strong>{employee.fullName}</strong>
                      <span>
                        {employee.role?.name ?? 'No role'} • {employee.status}
                      </span>
                    </li>
                  ))}
                </ul>
              </article>
            </section>
          ) : (
            <section className="timeline-layout">
              <article className="card">
                <h2>Quick Create Project</h2>
                <form className="timeline-form" onSubmit={handleCreateProject}>
                  <label>
                    Code
                    <input value={projectCode} onChange={(e) => setProjectCode(e.target.value)} />
                  </label>
                  <label>
                    Name
                    <input value={projectName} onChange={(e) => setProjectName(e.target.value)} />
                  </label>
                  <label>
                    Start
                    <input type="date" value={projectStartDate} onChange={(e) => setProjectStartDate(e.target.value)} />
                  </label>
                  <label>
                    End
                    <input type="date" value={projectEndDate} onChange={(e) => setProjectEndDate(e.target.value)} />
                  </label>
                  <button type="submit">Create</button>
                </form>

                <h2>Quick Assign Employee</h2>
                <form className="timeline-form" onSubmit={handleCreateAssignment}>
                  <label>
                    Project
                    <select value={assignmentProjectId} onChange={(e) => setAssignmentProjectId(e.target.value)}>
                      <option value="">Select project</option>
                      {projects.map((project) => (
                        <option value={project.id} key={project.id}>
                          {project.code} · {project.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Employee
                    <select value={assignmentEmployeeId} onChange={(e) => setAssignmentEmployeeId(e.target.value)}>
                      <option value="">Select employee</option>
                      {employees.map((employee) => (
                        <option value={employee.id} key={employee.id}>
                          {employee.fullName}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Start
                    <input
                      type="date"
                      value={assignmentStartDate}
                      onChange={(e) => setAssignmentStartDate(e.target.value)}
                    />
                  </label>
                  <label>
                    End
                    <input type="date" value={assignmentEndDate} onChange={(e) => setAssignmentEndDate(e.target.value)} />
                  </label>
                  <label>
                    Allocation %
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={assignmentPercent}
                      onChange={(e) => setAssignmentPercent(Number(e.target.value))}
                    />
                  </label>
                  <button type="submit">Assign</button>
                </form>
              </article>

              <article className="card timeline-card">
                <div className="timeline-toolbar">
                  <h2>Year Timeline</h2>
                  <div className="year-switcher">
                    <button type="button" onClick={() => handleYearChange(selectedYear - 1)}>
                      Prev
                    </button>
                    <strong>{selectedYear}</strong>
                    <button type="button" onClick={() => handleYearChange(selectedYear + 1)}>
                      Next
                    </button>
                  </div>
                </div>

                <div className="month-grid">
                  {MONTHS.map((month) => (
                    <span key={month}>{month}</span>
                  ))}
                </div>

                <div className="timeline-rows">
                  {sortedTimeline.length === 0 ? (
                    <p className="muted">No projects for selected year.</p>
                  ) : (
                    sortedTimeline.map((row) => {
                      const style = timelineStyle(row);
                      return (
                        <div className="timeline-row" key={row.id}>
                          <div className="timeline-meta">
                            <strong>
                              {row.code} · {row.name}
                            </strong>
                            <span>
                              {row.assignmentsCount} assignments · {row.totalPlannedHoursPerDay} h/day
                            </span>
                          </div>
                          <div className="track">
                            <div className="bar" style={style} title={`${row.startDate} - ${row.endDate}`}>
                              {row.status}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </article>
            </section>
          )}

          {error ? <p className="error global-error">{error}</p> : null}
        </>
      )}
    </main>
  );
}
