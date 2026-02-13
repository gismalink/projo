import { FormEvent, useMemo, useState } from 'react';
import { api, ProjectDetail, ProjectListItem, ProjectTimelineRow } from '../api/client';

type Role = {
  id: string;
  name: string;
  description?: string;
  level?: number;
  _count?: { employees: number };
};

type Employee = {
  id: string;
  fullName: string;
  email: string;
  status: string;
  role: { name: string };
};

type ActiveTab = 'personnel' | 'roles' | 'timeline';

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

function isoToInputDate(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

export function App() {
  const [email, setEmail] = useState('admin@projo.local');
  const [password, setPassword] = useState('admin12345');
  const [token, setToken] = useState<string | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [timeline, setTimeline] = useState<ProjectTimelineRow[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedProjectDetail, setSelectedProjectDetail] = useState<ProjectDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('personnel');
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [isVacationModalOpen, setIsVacationModalOpen] = useState(false);
  const [vacationEmployeeName, setVacationEmployeeName] = useState('');

  const [roleName, setRoleName] = useState('Analyst');
  const [roleDescription, setRoleDescription] = useState('Business analyst role');
  const [roleLevel, setRoleLevel] = useState(3);

  const [employeeFullName, setEmployeeFullName] = useState('Jane Smith');
  const [employeeEmail, setEmployeeEmail] = useState('jane.smith@projo.local');
  const [employeeRoleId, setEmployeeRoleId] = useState('');
  const [employeeStatus, setEmployeeStatus] = useState('active');

  const [vacationEmployeeId, setVacationEmployeeId] = useState('');
  const [vacationStartDate, setVacationStartDate] = useState(`${new Date().getFullYear()}-07-01`);
  const [vacationEndDate, setVacationEndDate] = useState(`${new Date().getFullYear()}-07-14`);
  const [vacationType, setVacationType] = useState('vacation');

  const [projectCode, setProjectCode] = useState('PRJ-001');
  const [projectName, setProjectName] = useState('Pilot CRM Rollout');
  const [projectStartDate, setProjectStartDate] = useState(`${new Date().getFullYear()}-02-01`);
  const [projectEndDate, setProjectEndDate] = useState(`${new Date().getFullYear()}-06-30`);

  const [assignmentProjectId, setAssignmentProjectId] = useState('');
  const [assignmentEmployeeId, setAssignmentEmployeeId] = useState('');
  const [assignmentStartDate, setAssignmentStartDate] = useState(`${new Date().getFullYear()}-03-01`);
  const [assignmentEndDate, setAssignmentEndDate] = useState(`${new Date().getFullYear()}-04-30`);
  const [assignmentPercent, setAssignmentPercent] = useState(50);

  const [editAssignmentId, setEditAssignmentId] = useState('');
  const [editAssignmentStartDate, setEditAssignmentStartDate] = useState('');
  const [editAssignmentEndDate, setEditAssignmentEndDate] = useState('');
  const [editAssignmentPercent, setEditAssignmentPercent] = useState(0);

  const sortedTimeline = useMemo(
    () => [...timeline].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()),
    [timeline],
  );

  const selectedAssignment = useMemo(
    () => selectedProjectDetail?.assignments.find((assignment) => assignment.id === editAssignmentId) ?? null,
    [selectedProjectDetail, editAssignmentId],
  );

  function setAssignmentEditorFromDetail(detail: ProjectDetail, assignmentId?: string) {
    if (detail.assignments.length === 0) {
      setEditAssignmentId('');
      setEditAssignmentStartDate('');
      setEditAssignmentEndDate('');
      setEditAssignmentPercent(0);
      return;
    }

    const picked = detail.assignments.find((assignment) => assignment.id === assignmentId) ?? detail.assignments[0];
    setEditAssignmentId(picked.id);
    setEditAssignmentStartDate(isoToInputDate(picked.assignmentStartDate));
    setEditAssignmentEndDate(isoToInputDate(picked.assignmentEndDate));
    setEditAssignmentPercent(Number(picked.allocationPercent));
  }

  async function loadProjectDetail(authToken: string, projectId: string, preserveEditor = true) {
    const detail = await api.getProject(projectId, authToken);
    setSelectedProjectId(projectId);
    setSelectedProjectDetail(detail);

    if (preserveEditor) {
      setAssignmentEditorFromDetail(detail, editAssignmentId);
    } else {
      setAssignmentEditorFromDetail(detail);
    }
  }

  async function refreshData(authToken: string, year: number, preferredProjectId?: string) {
    const [rolesData, employeesData, projectsData, timelineData] = await Promise.all([
      api.getRoles(authToken),
      api.getEmployees(authToken),
      api.getProjects(authToken),
      api.getTimelineYear(year, authToken),
    ]);

    const nextRoles = rolesData as Role[];
    const nextEmployees = employeesData as Employee[];
    const nextProjects = projectsData as ProjectListItem[];

    setRoles(nextRoles);
    setEmployees(nextEmployees);
    setProjects(nextProjects);
    setTimeline(timelineData);

    if (!employeeRoleId && nextRoles[0]) {
      setEmployeeRoleId(nextRoles[0].id);
    }

    if (!vacationEmployeeId && nextEmployees[0]) {
      setVacationEmployeeId(nextEmployees[0].id);
    }

    if (!assignmentProjectId && nextProjects[0]) {
      setAssignmentProjectId(nextProjects[0].id);
    }

    if (!assignmentEmployeeId && nextEmployees[0]) {
      setAssignmentEmployeeId(nextEmployees[0].id);
    }

    const activeProjectId = preferredProjectId ?? selectedProjectId ?? nextProjects[0]?.id;
    if (activeProjectId) {
      await loadProjectDetail(authToken, activeProjectId, Boolean(selectedProjectId));
    } else {
      setSelectedProjectId('');
      setSelectedProjectDetail(null);
      setEditAssignmentId('');
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

  async function handleCreateRole(event: FormEvent) {
    event.preventDefault();
    if (!token) return;

    setError(null);
    try {
      await api.createRole(
        {
          name: roleName,
          description: roleDescription,
          level: roleLevel,
        },
        token,
      );
      await refreshData(token, selectedYear);
      setRoleName((prev) => `${prev}-2`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create role');
    }
  }

  async function handleCreateEmployee(event: FormEvent) {
    event.preventDefault();
    if (!token || !employeeRoleId) return;

    setError(null);
    try {
      await api.createEmployee(
        {
          fullName: employeeFullName,
          email: employeeEmail,
          roleId: employeeRoleId,
          status: employeeStatus,
          defaultCapacityHoursPerDay: 8,
        },
        token,
      );
      await refreshData(token, selectedYear);
      setIsEmployeeModalOpen(false);
      setEmployeeEmail((prev) => {
        const [name, domain] = prev.split('@');
        return `${name}.2@${domain ?? 'projo.local'}`;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create employee');
    }
  }

  async function handleCreateVacation(event: FormEvent) {
    event.preventDefault();
    if (!token || !vacationEmployeeId) return;

    setError(null);
    try {
      await api.createVacation(
        {
          employeeId: vacationEmployeeId,
          startDate: new Date(vacationStartDate).toISOString(),
          endDate: new Date(vacationEndDate).toISOString(),
          type: vacationType,
        },
        token,
      );
      await refreshData(token, selectedYear);
      setIsVacationModalOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create vacation');
    }
  }

  function openVacationModal(employee: Employee) {
    setVacationEmployeeId(employee.id);
    setVacationEmployeeName(employee.fullName);
    setIsVacationModalOpen(true);
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

      await refreshData(token, selectedYear, assignmentProjectId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create assignment');
    }
  }

  async function handleSelectProject(projectId: string) {
    if (!token) return;

    setError(null);
    try {
      await loadProjectDetail(token, projectId, false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load project details');
    }
  }

  function handleEditorAssignmentChange(assignmentId: string) {
    setEditAssignmentId(assignmentId);
    if (!selectedProjectDetail) return;

    const next = selectedProjectDetail.assignments.find((assignment) => assignment.id === assignmentId);
    if (!next) return;

    setEditAssignmentStartDate(isoToInputDate(next.assignmentStartDate));
    setEditAssignmentEndDate(isoToInputDate(next.assignmentEndDate));
    setEditAssignmentPercent(Number(next.allocationPercent));
  }

  async function handleUpdateAssignment(event: FormEvent) {
    event.preventDefault();
    if (!token || !editAssignmentId || !selectedProjectId) return;

    setError(null);
    try {
      await api.updateAssignment(
        editAssignmentId,
        {
          assignmentStartDate: new Date(editAssignmentStartDate).toISOString(),
          assignmentEndDate: new Date(editAssignmentEndDate).toISOString(),
          allocationPercent: editAssignmentPercent,
        },
        token,
      );

      await refreshData(token, selectedYear, selectedProjectId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update assignment');
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
              className={activeTab === 'personnel' ? 'tab active' : 'tab'}
              onClick={() => setActiveTab('personnel')}
            >
              Personnel
            </button>
            <button
              type="button"
              className={activeTab === 'roles' ? 'tab active' : 'tab'}
              onClick={() => setActiveTab('roles')}
            >
              Roles
            </button>
            <button
              type="button"
              className={activeTab === 'timeline' ? 'tab active' : 'tab'}
              onClick={() => setActiveTab('timeline')}
            >
              Timeline
            </button>
          </div>

          {activeTab === 'personnel' ? (
            <section className="grid">
              <article className="card">
                <div className="section-header">
                  <h2>Employees List</h2>
                  <button type="button" onClick={() => setIsEmployeeModalOpen(true)}>
                    Создать работника
                  </button>
                </div>
                <ul>
                  {employees.map((employee) => (
                    <li key={employee.id}>
                      <div>
                        <strong>{employee.fullName}</strong>
                        <span>
                          {employee.role?.name ?? 'No role'} • {employee.status}
                        </span>
                      </div>
                      <button type="button" className="ghost-btn" onClick={() => openVacationModal(employee)}>
                        Добавить отпуск
                      </button>
                    </li>
                  ))}
                </ul>
              </article>
            </section>
          ) : null}

          {activeTab === 'roles' ? (
            <section className="grid">
              <article className="card">
                <h2>Role Management</h2>
                <form className="timeline-form" onSubmit={handleCreateRole}>
                  <label>
                    Name
                    <input value={roleName} onChange={(e) => setRoleName(e.target.value)} />
                  </label>
                  <label>
                    Description
                    <input value={roleDescription} onChange={(e) => setRoleDescription(e.target.value)} />
                  </label>
                  <label>
                    Level
                    <input
                      type="number"
                      min={1}
                      value={roleLevel}
                      onChange={(e) => setRoleLevel(Number(e.target.value))}
                    />
                  </label>
                  <button type="submit">Create Role</button>
                </form>
              </article>

              <article className="card">
                <h2>Roles List</h2>
                <ul>
                  {roles.map((role) => (
                    <li key={role.id}>
                      <strong>{role.name}</strong>
                      <span>
                        level {role.level ?? '-'} • {role._count?.employees ?? 0} employees
                      </span>
                    </li>
                  ))}
                </ul>
              </article>
            </section>
          ) : null}

          {activeTab === 'timeline' ? (
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
                        <button
                          type="button"
                          className={row.id === selectedProjectId ? 'timeline-row selected' : 'timeline-row'}
                          key={row.id}
                          onClick={() => handleSelectProject(row.id)}
                        >
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
                        </button>
                      );
                    })
                  )}
                </div>

                <section className="project-card">
                  <h3>Project Card</h3>
                  {!selectedProjectDetail ? (
                    <p className="muted">Select a project row to view details.</p>
                  ) : (
                    <>
                      <div className="project-card-header">
                        <strong>
                          {selectedProjectDetail.code} · {selectedProjectDetail.name}
                        </strong>
                        <span>
                          {selectedProjectDetail.status} · priority {selectedProjectDetail.priority}
                        </span>
                      </div>
                      <p className="muted">
                        {isoToInputDate(selectedProjectDetail.startDate)} to {isoToInputDate(selectedProjectDetail.endDate)}
                      </p>

                      <div className="assignment-list">
                        {selectedProjectDetail.assignments.length === 0 ? (
                          <p className="muted">No assignments yet.</p>
                        ) : (
                          selectedProjectDetail.assignments.map((assignment) => (
                            <button
                              type="button"
                              key={assignment.id}
                              className={assignment.id === editAssignmentId ? 'assignment-item active' : 'assignment-item'}
                              onClick={() => handleEditorAssignmentChange(assignment.id)}
                            >
                              <strong>{assignment.employee.fullName}</strong>
                              <span>
                                {isoToInputDate(assignment.assignmentStartDate)} to{' '}
                                {isoToInputDate(assignment.assignmentEndDate)} · {Number(assignment.allocationPercent)}%
                              </span>
                            </button>
                          ))
                        )}
                      </div>

                      {selectedAssignment ? (
                        <form className="timeline-form" onSubmit={handleUpdateAssignment}>
                          <label>
                            Edit assignment
                            <select value={editAssignmentId} onChange={(e) => handleEditorAssignmentChange(e.target.value)}>
                              {selectedProjectDetail.assignments.map((assignment) => (
                                <option value={assignment.id} key={assignment.id}>
                                  {assignment.employee.fullName}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            Start
                            <input
                              type="date"
                              value={editAssignmentStartDate}
                              onChange={(e) => setEditAssignmentStartDate(e.target.value)}
                            />
                          </label>
                          <label>
                            End
                            <input
                              type="date"
                              value={editAssignmentEndDate}
                              onChange={(e) => setEditAssignmentEndDate(e.target.value)}
                            />
                          </label>
                          <label>
                            Allocation %
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={editAssignmentPercent}
                              onChange={(e) => setEditAssignmentPercent(Number(e.target.value))}
                            />
                          </label>
                          <button type="submit">Save Assignment</button>
                        </form>
                      ) : null}
                    </>
                  )}
                </section>
              </article>
            </section>
          ) : null}

          {error ? <p className="error global-error">{error}</p> : null}

          {isEmployeeModalOpen ? (
            <div className="modal-backdrop">
              <div className="modal-card">
                <div className="section-header">
                  <h3>Добавить работника</h3>
                  <button type="button" className="ghost-btn" onClick={() => setIsEmployeeModalOpen(false)}>
                    Закрыть
                  </button>
                </div>
                <form className="timeline-form" onSubmit={handleCreateEmployee}>
                  <label>
                    Full name
                    <input value={employeeFullName} onChange={(e) => setEmployeeFullName(e.target.value)} />
                  </label>
                  <label>
                    Email
                    <input value={employeeEmail} onChange={(e) => setEmployeeEmail(e.target.value)} />
                  </label>
                  <label>
                    Role
                    <select value={employeeRoleId} onChange={(e) => setEmployeeRoleId(e.target.value)}>
                      <option value="">Select role</option>
                      {roles.map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Status
                    <select value={employeeStatus} onChange={(e) => setEmployeeStatus(e.target.value)}>
                      <option value="active">active</option>
                      <option value="inactive">inactive</option>
                    </select>
                  </label>
                  <button type="submit">Создать работника</button>
                </form>
              </div>
            </div>
          ) : null}

          {isVacationModalOpen ? (
            <div className="modal-backdrop">
              <div className="modal-card">
                <div className="section-header">
                  <h3>Добавить отпуск</h3>
                  <button type="button" className="ghost-btn" onClick={() => setIsVacationModalOpen(false)}>
                    Закрыть
                  </button>
                </div>
                <p className="muted">{vacationEmployeeName}</p>
                <form className="timeline-form" onSubmit={handleCreateVacation}>
                  <label>
                    Start
                    <input type="date" value={vacationStartDate} onChange={(e) => setVacationStartDate(e.target.value)} />
                  </label>
                  <label>
                    End
                    <input type="date" value={vacationEndDate} onChange={(e) => setVacationEndDate(e.target.value)} />
                  </label>
                  <label>
                    Type
                    <select value={vacationType} onChange={(e) => setVacationType(e.target.value)}>
                      <option value="vacation">vacation</option>
                      <option value="sick">sick</option>
                      <option value="day_off">day_off</option>
                    </select>
                  </label>
                  <button type="submit">Сохранить отпуск</button>
                </form>
              </div>
            </div>
          ) : null}
        </>
      )}
    </main>
  );
}
