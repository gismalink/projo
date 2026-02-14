import { FormEvent, useMemo, useState } from 'react';
import { api, AssignmentItem, ProjectDetail, ProjectListItem, ProjectTimelineRow, VacationItem } from '../api/client';

type Role = {
  id: string;
  name: string;
  description?: string;
  level?: number;
  colorHex?: string | null;
  _count?: { employees: number };
};

type Employee = {
  id: string;
  fullName: string;
  email: string;
  status: string;
  grade?: string | null;
  role: { name: string };
};

type ActiveTab = 'timeline' | 'personnel' | 'roles';
type Lang = 'ru' | 'en';

type Toast = {
  id: number;
  message: string;
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const GRADE_OPTIONS = ['джу', 'джун+', 'мидл', 'мидл+', 'синьйор', 'синьйор+', 'лид', 'рук-отдела'];

const TEXT: Record<Lang, Record<string, string>> = {
  ru: {
    appTitle: 'Projo MVP',
    subtitle: 'Планирование проектов',
    login: 'Вход',
    email: 'Email',
    password: 'Пароль',
    signIn: 'Войти',
    tabTimeline: 'Таймлайн',
    tabPersonnel: 'Сотрудники',
    tabRoles: 'Роли',
    employeesList: 'Список сотрудников',
    createEmployeeTooltip: 'Создать работника',
    addVacationTooltip: 'Добавить отпуск',
    noVacations: 'Отпусков нет',
    utilization: 'Годовая загрузка',
    rolesList: 'Список ролей',
    roleMgmt: 'Управление ролями',
    roleColor: 'Цвет роли',
    saveColor: 'Сохранить цвет',
    createRole: 'Создать роль',
    createProject: 'Создать проект',
    assignEmployee: 'Назначить сотрудника',
    yearTimeline: 'Годовой таймлайн',
    prev: 'Назад',
    next: 'Вперёд',
    projectCard: 'Карточка проекта',
    noProjectsForYear: 'Нет проектов за выбранный год.',
    noAssignments: 'Нет назначений',
    saveAssignment: 'Сохранить назначение',
    addEmployee: 'Добавить сотрудника',
    close: 'Закрыть',
    fullName: 'ФИО',
    role: 'Роль',
    status: 'Статус',
    grade: 'Грейд',
    createWorker: 'Создать работника',
    addVacation: 'Добавить отпуск',
    start: 'Начало',
    end: 'Окончание',
    type: 'Тип',
    saveVacation: 'Сохранить отпуск',
    selectProjectPrompt: 'Выберите проект для деталей.',
    clearFilter: 'Сбросить фильтры',
  },
  en: {
    appTitle: 'Projo MVP',
    subtitle: 'Project planning workspace',
    login: 'Login',
    email: 'Email',
    password: 'Password',
    signIn: 'Sign in',
    tabTimeline: 'Timeline',
    tabPersonnel: 'Employees',
    tabRoles: 'Roles',
    employeesList: 'Employees List',
    createEmployeeTooltip: 'Create employee',
    addVacationTooltip: 'Add vacation',
    noVacations: 'No vacations',
    utilization: 'Year utilization',
    rolesList: 'Roles List',
    roleMgmt: 'Role management',
    roleColor: 'Role color',
    saveColor: 'Save color',
    createRole: 'Create role',
    createProject: 'Create project',
    assignEmployee: 'Assign employee',
    yearTimeline: 'Year timeline',
    prev: 'Prev',
    next: 'Next',
    projectCard: 'Project card',
    noProjectsForYear: 'No projects for selected year.',
    noAssignments: 'No assignments',
    saveAssignment: 'Save assignment',
    addEmployee: 'Add employee',
    close: 'Close',
    fullName: 'Full name',
    role: 'Role',
    status: 'Status',
    grade: 'Grade',
    createWorker: 'Create employee',
    addVacation: 'Add vacation',
    start: 'Start',
    end: 'End',
    type: 'Type',
    saveVacation: 'Save vacation',
    selectProjectPrompt: 'Select project row for details.',
    clearFilter: 'Clear filters',
  },
};

function dayOfYear(date: Date) {
  const start = new Date(Date.UTC(date.getUTCFullYear(), 0, 0));
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / 86400000);
}

function daysInYear(year: number) {
  return new Date(Date.UTC(year + 1, 0, 0)).getUTCDate() + 365 - 365;
}

function overlapDaysInYear(start: Date, end: Date, year: number) {
  const rangeStart = new Date(Date.UTC(year, 0, 1));
  const rangeEnd = new Date(Date.UTC(year, 11, 31));
  const effectiveStart = start > rangeStart ? start : rangeStart;
  const effectiveEnd = end < rangeEnd ? end : rangeEnd;
  if (effectiveEnd < effectiveStart) return 0;
  const ms = effectiveEnd.getTime() - effectiveStart.getTime();
  return Math.floor(ms / 86400000) + 1;
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

function roleColorOrDefault(colorHex?: string | null) {
  return colorHex && /^#[0-9A-Fa-f]{6}$/.test(colorHex) ? colorHex : '#6E7B8A';
}

function departmentByRole(roleName: string) {
  if (['BACKEND_DEVELOPER', 'UNITY_DEVELOPER', 'ARTIST_3D'].includes(roleName)) return 'Production';
  if (['UI_DESIGNER', 'UX_DESIGNER'].includes(roleName)) return 'Design';
  if (['QA_ENGINEER'].includes(roleName)) return 'QA';
  if (['ANALYST'].includes(roleName)) return 'Analytics';
  if (['PM', 'ADMIN', 'FINANCE', 'VIEWER'].includes(roleName)) return 'Management';
  return 'Other';
}

export function App() {
  const [lang, setLang] = useState<Lang>('ru');
  const t = TEXT[lang];

  const [email, setEmail] = useState('admin@projo.local');
  const [password, setPassword] = useState('admin12345');
  const [token, setToken] = useState<string | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [vacations, setVacations] = useState<VacationItem[]>([]);
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [timeline, setTimeline] = useState<ProjectTimelineRow[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedProjectDetail, setSelectedProjectDetail] = useState<ProjectDetail | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('timeline');
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedRoleFilters, setSelectedRoleFilters] = useState<string[]>([]);
  const [roleColorDrafts, setRoleColorDrafts] = useState<Record<string, string>>({});
  const [toasts, setToasts] = useState<Toast[]>([]);

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
  const [employeeGrade, setEmployeeGrade] = useState('мидл');

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

  const vacationsByEmployee = useMemo(() => {
    const map: Record<string, VacationItem[]> = {};
    for (const vacation of vacations) {
      if (!map[vacation.employeeId]) map[vacation.employeeId] = [];
      map[vacation.employeeId].push(vacation);
    }
    for (const employeeId of Object.keys(map)) {
      map[employeeId].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
    }
    return map;
  }, [vacations]);

  const roleByName = useMemo(() => {
    const map = new Map<string, Role>();
    for (const role of roles) map.set(role.name, role);
    return map;
  }, [roles]);

  const roleStats = useMemo(() => {
    const counts = new Map<string, number>();
    for (const employee of employees) {
      const roleNameValue = employee.role?.name ?? 'UNASSIGNED';
      counts.set(roleNameValue, (counts.get(roleNameValue) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([roleNameValue, count]) => ({
        roleName: roleNameValue,
        count,
        colorHex: roleColorOrDefault(roleByName.get(roleNameValue)?.colorHex),
      }))
      .sort((a, b) => b.count - a.count);
  }, [employees, roleByName]);

  const filteredEmployees = useMemo(() => {
    if (selectedRoleFilters.length === 0) return employees;
    const selected = new Set(selectedRoleFilters);
    return employees.filter((employee) => selected.has(employee.role?.name ?? 'UNASSIGNED'));
  }, [employees, selectedRoleFilters]);

  const departmentGroups = useMemo(() => {
    const map: Record<string, Employee[]> = {};
    for (const employee of filteredEmployees) {
      const dep = departmentByRole(employee.role?.name ?? '');
      if (!map[dep]) map[dep] = [];
      map[dep].push(employee);
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredEmployees]);

  const utilizationByEmployee = useMemo(() => {
    const map: Record<string, number> = {};
    const totalDays = daysInYear(selectedYear);

    for (const assignment of assignments) {
      const start = new Date(assignment.assignmentStartDate);
      const end = new Date(assignment.assignmentEndDate);
      const overlapDays = overlapDaysInYear(start, end, selectedYear);
      if (overlapDays <= 0) continue;

      const allocation = Number(assignment.allocationPercent);
      const weighted = (allocation * overlapDays) / totalDays;
      map[assignment.employeeId] = Number(((map[assignment.employeeId] ?? 0) + weighted).toFixed(1));
    }

    return map;
  }, [assignments, selectedYear]);

  function utilizationColor(value: number) {
    if (value > 110) return '#D64545';
    if (value >= 90 && value <= 105) return '#2EA44F';
    if (value < 90) return '#D9A441';
    return '#D9A441';
  }

  function pushToast(message: string) {
    const toast: Toast = { id: Date.now() + Math.floor(Math.random() * 1000), message };
    setToasts((prev) => [...prev, toast]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== toast.id));
    }, 4500);
  }

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
    const [rolesData, employeesData, vacationsData, assignmentsData, projectsData, timelineData] = await Promise.all([
      api.getRoles(authToken),
      api.getEmployees(authToken),
      api.getVacations(authToken),
      api.getAssignments(authToken),
      api.getProjects(authToken),
      api.getTimelineYear(year, authToken),
    ]);

    const nextRoles = rolesData as Role[];
    const nextEmployees = employeesData as Employee[];
    const nextVacations = vacationsData as VacationItem[];
    const nextAssignments = assignmentsData as AssignmentItem[];
    const nextProjects = projectsData as ProjectListItem[];

    setRoles(nextRoles);
    setEmployees(nextEmployees);
    setVacations(nextVacations);
    setAssignments(nextAssignments);
    setProjects(nextProjects);
    setTimeline(timelineData);

    setRoleColorDrafts((prev) => {
      const next = { ...prev };
      for (const role of nextRoles) {
        if (!next[role.id]) next[role.id] = roleColorOrDefault(role.colorHex);
      }
      return next;
    });

    if (!employeeRoleId && nextRoles[0]) setEmployeeRoleId(nextRoles[0].id);
    if (!vacationEmployeeId && nextEmployees[0]) setVacationEmployeeId(nextEmployees[0].id);
    if (!assignmentProjectId && nextProjects[0]) setAssignmentProjectId(nextProjects[0].id);
    if (!assignmentEmployeeId && nextEmployees[0]) setAssignmentEmployeeId(nextEmployees[0].id);

    const activeProjectId = preferredProjectId ?? selectedProjectId ?? nextProjects[0]?.id;
    if (activeProjectId) {
      await loadProjectDetail(authToken, activeProjectId, Boolean(selectedProjectId));
    } else {
      setSelectedProjectId('');
      setSelectedProjectDetail(null);
      setEditAssignmentId('');
    }
  }

  function toggleRoleFilter(roleNameValue: string) {
    setSelectedRoleFilters((prev) =>
      prev.includes(roleNameValue) ? prev.filter((name) => name !== roleNameValue) : [...prev, roleNameValue],
    );
  }

  async function handleLogin(event: FormEvent) {
    event.preventDefault();

    try {
      const result = await api.login(email, password);
      setToken(result.accessToken);
      await refreshData(result.accessToken, selectedYear);
    } catch (e) {
      pushToast(e instanceof Error ? e.message : 'Login failed');
    }
  }

  async function handleCreateRole(event: FormEvent) {
    event.preventDefault();
    if (!token) return;

    try {
      await api.createRole(
        {
          name: roleName,
          description: roleDescription,
          level: roleLevel,
          colorHex: '#6E7B8A',
        },
        token,
      );
      await refreshData(token, selectedYear);
      setRoleName((prev) => `${prev}-2`);
    } catch (e) {
      pushToast(e instanceof Error ? e.message : 'Failed to create role');
    }
  }

  async function handleUpdateRoleColor(role: Role) {
    if (!token) return;

    try {
      const colorHex = roleColorOrDefault(roleColorDrafts[role.id]);
      await api.updateRole(role.id, { colorHex }, token);
      await refreshData(token, selectedYear);
    } catch (e) {
      pushToast(e instanceof Error ? e.message : 'Failed to update role color');
    }
  }

  async function handleCreateEmployee(event: FormEvent) {
    event.preventDefault();
    if (!token || !employeeRoleId) return;

    try {
      await api.createEmployee(
        {
          fullName: employeeFullName,
          email: employeeEmail,
          roleId: employeeRoleId,
          status: employeeStatus,
          grade: employeeGrade,
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
      pushToast(e instanceof Error ? e.message : 'Failed to create employee');
    }
  }

  async function handleCreateVacation(event: FormEvent) {
    event.preventDefault();
    if (!token || !vacationEmployeeId) return;

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
      pushToast(e instanceof Error ? e.message : 'Failed to create vacation');
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
      pushToast(e instanceof Error ? e.message : 'Failed to create project');
    }
  }

  async function handleCreateAssignment(event: FormEvent) {
    event.preventDefault();
    if (!token || !assignmentProjectId || !assignmentEmployeeId) return;

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
      pushToast(e instanceof Error ? e.message : 'Failed to create assignment');
    }
  }

  async function handleSelectProject(projectId: string) {
    if (!token) return;

    try {
      await loadProjectDetail(token, projectId, false);
    } catch (e) {
      pushToast(e instanceof Error ? e.message : 'Failed to load project details');
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
      pushToast(e instanceof Error ? e.message : 'Failed to update assignment');
    }
  }

  async function handleYearChange(nextYear: number) {
    setSelectedYear(nextYear);
    if (!token) return;

    try {
      const timelineData = await api.getTimelineYear(nextYear, token);
      setTimeline(timelineData);
    } catch (e) {
      pushToast(e instanceof Error ? e.message : 'Failed to load timeline');
    }
  }

  return (
    <main className="container">
      <div className="section-header">
        <div>
          <h1>{t.appTitle}</h1>
          <p className="subtitle">{t.subtitle}</p>
        </div>
        <div className="lang-toggle">
          <button type="button" className={lang === 'ru' ? 'tab active' : 'tab'} onClick={() => setLang('ru')}>
            RU
          </button>
          <button type="button" className={lang === 'en' ? 'tab active' : 'tab'} onClick={() => setLang('en')}>
            EN
          </button>
        </div>
      </div>

      {!token ? (
        <form onSubmit={handleLogin} className="card">
          <h2>{t.login}</h2>
          <label>
            {t.email}
            <input value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label>
            {t.password}
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <button type="submit">{t.signIn}</button>
        </form>
      ) : (
        <>
          <div className="tabs">
            <button type="button" className={activeTab === 'timeline' ? 'tab active' : 'tab'} onClick={() => setActiveTab('timeline')}>
              {t.tabTimeline}
            </button>
            <button type="button" className={activeTab === 'personnel' ? 'tab active' : 'tab'} onClick={() => setActiveTab('personnel')}>
              {t.tabPersonnel}
            </button>
            <button type="button" className={activeTab === 'roles' ? 'tab active' : 'tab'} onClick={() => setActiveTab('roles')}>
              {t.tabRoles}
            </button>
          </div>

          {activeTab === 'personnel' ? (
            <section className="grid">
              <article className="card">
                <div className="section-header">
                  <h2>{t.employeesList}</h2>
                  <button
                    type="button"
                    title={t.createEmployeeTooltip}
                    aria-label={t.createEmployeeTooltip}
                    onClick={() => setIsEmployeeModalOpen(true)}
                  >
                    +
                  </button>
                </div>

                <div className="role-filter-panel">
                  {roleStats.map((tag) => {
                    const active = selectedRoleFilters.includes(tag.roleName);
                    return (
                      <button
                        type="button"
                        key={tag.roleName}
                        className={active ? 'role-tag active' : 'role-tag'}
                        style={{ borderColor: tag.colorHex, background: active ? `${tag.colorHex}22` : '#fff' }}
                        onClick={() => toggleRoleFilter(tag.roleName)}
                      >
                        <span className="dot" style={{ background: tag.colorHex }} />
                        {tag.roleName} ({tag.count})
                      </button>
                    );
                  })}
                  {selectedRoleFilters.length > 0 ? (
                    <button type="button" className="ghost-btn" onClick={() => setSelectedRoleFilters([])}>
                      {t.clearFilter}
                    </button>
                  ) : null}
                </div>

                {departmentGroups.map(([department, departmentEmployees]) => (
                  <section key={department}>
                    <h3>{department}</h3>
                    <div className="employee-cards">
                      {departmentEmployees.map((employee) => {
                        const employeeVacations = vacationsByEmployee[employee.id] ?? [];
                        const roleColor = roleColorOrDefault(roleByName.get(employee.role?.name ?? '')?.colorHex);
                        const util = utilizationByEmployee[employee.id] ?? 0;

                        return (
                          <article className="employee-card" key={employee.id}>
                            <div className="employee-card-header">
                              <strong>{employee.fullName}</strong>
                              <button
                                type="button"
                                className="ghost-btn"
                                title={t.addVacationTooltip}
                                aria-label={t.addVacationTooltip}
                                onClick={() => openVacationModal(employee)}
                              >
                                🗓
                              </button>
                            </div>
                            <span>
                              <span className="role-badge" style={{ background: `${roleColor}22`, color: roleColor }}>
                                {employee.role?.name ?? 'No role'}
                              </span>
                              {' • '}
                              {employee.grade ?? '-'}
                              {' • '}
                              {employee.status}
                            </span>
                            <span className="vacation-line">
                              {employeeVacations.length === 0
                                ? t.noVacations
                                : employeeVacations
                                    .map(
                                      (vacation) => `${isoToInputDate(vacation.startDate)} - ${isoToInputDate(vacation.endDate)}`,
                                    )
                                    .join(' | ')}
                            </span>
                            <div className="utilization-block">
                              <div className="utilization-label">
                                <span>{t.utilization}</span>
                                <strong>{util.toFixed(1)}%</strong>
                              </div>
                              <div className="utilization-bar-bg">
                                <div
                                  className="utilization-bar"
                                  style={{
                                    width: `${Math.min(util, 140)}%`,
                                    background: utilizationColor(util),
                                  }}
                                />
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </article>
            </section>
          ) : null}

          {activeTab === 'roles' ? (
            <section className="grid">
              <article className="card">
                <h2>{t.roleMgmt}</h2>
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
                    <input type="number" min={1} value={roleLevel} onChange={(e) => setRoleLevel(Number(e.target.value))} />
                  </label>
                  <button type="submit">{t.createRole}</button>
                </form>
              </article>

              <article className="card">
                <h2>{t.rolesList}</h2>
                <ul>
                  {roles.map((role) => (
                    <li key={role.id} className="role-row">
                      <div>
                        <strong>{role.name}</strong>
                        <span>
                          level {role.level ?? '-'} • {role._count?.employees ?? 0} employees
                        </span>
                      </div>
                      <div className="role-color-editor">
                        <input
                          type="color"
                          value={roleColorOrDefault(roleColorDrafts[role.id])}
                          onChange={(e) =>
                            setRoleColorDrafts((prev) => ({
                              ...prev,
                              [role.id]: e.target.value,
                            }))
                          }
                        />
                        <button type="button" className="ghost-btn" onClick={() => handleUpdateRoleColor(role)}>
                          {t.saveColor}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </article>
            </section>
          ) : null}

          {activeTab === 'timeline' ? (
            <section className="timeline-layout">
              <article className="card">
                <h2>{t.createProject}</h2>
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
                <form className="timeline-form" onSubmit={handleCreateAssignment}>
                  <label>
                    {t.role}
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
                    {t.tabPersonnel}
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
                    {t.start}
                    <input type="date" value={assignmentStartDate} onChange={(e) => setAssignmentStartDate(e.target.value)} />
                  </label>
                  <label>
                    {t.end}
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
                  <button type="submit">{t.assignEmployee}</button>
                </form>
              </article>

              <article className="card timeline-card">
                <div className="timeline-toolbar">
                  <h2>{t.yearTimeline}</h2>
                  <div className="year-switcher">
                    <button type="button" onClick={() => handleYearChange(selectedYear - 1)}>
                      {t.prev}
                    </button>
                    <strong>{selectedYear}</strong>
                    <button type="button" onClick={() => handleYearChange(selectedYear + 1)}>
                      {t.next}
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
                    <p className="muted">{t.noProjectsForYear}</p>
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
                          {selectedProjectDetail.status} · priority {selectedProjectDetail.priority}
                        </span>
                      </div>
                      <p className="muted">
                        {isoToInputDate(selectedProjectDetail.startDate)} to {isoToInputDate(selectedProjectDetail.endDate)}
                      </p>

                      <div className="assignment-list">
                        {selectedProjectDetail.assignments.length === 0 ? (
                          <p className="muted">{t.noAssignments}</p>
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
                            Allocation %
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
                    </>
                  )}
                </section>
              </article>
            </section>
          ) : null}

          {isEmployeeModalOpen ? (
            <div className="modal-backdrop">
              <div className="modal-card">
                <div className="section-header">
                  <h3>{t.addEmployee}</h3>
                  <button type="button" className="ghost-btn" onClick={() => setIsEmployeeModalOpen(false)}>
                    {t.close}
                  </button>
                </div>
                <form className="timeline-form" onSubmit={handleCreateEmployee}>
                  <label>
                    {t.fullName}
                    <input value={employeeFullName} onChange={(e) => setEmployeeFullName(e.target.value)} />
                  </label>
                  <label>
                    {t.email}
                    <input value={employeeEmail} onChange={(e) => setEmployeeEmail(e.target.value)} />
                  </label>
                  <label>
                    {t.role}
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
                    {t.grade}
                    <select value={employeeGrade} onChange={(e) => setEmployeeGrade(e.target.value)}>
                      {GRADE_OPTIONS.map((gradeOption) => (
                        <option key={gradeOption} value={gradeOption}>
                          {gradeOption}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {t.status}
                    <select value={employeeStatus} onChange={(e) => setEmployeeStatus(e.target.value)}>
                      <option value="active">active</option>
                      <option value="inactive">inactive</option>
                    </select>
                  </label>
                  <button type="submit">{t.createWorker}</button>
                </form>
              </div>
            </div>
          ) : null}

          {isVacationModalOpen ? (
            <div className="modal-backdrop">
              <div className="modal-card">
                <div className="section-header">
                  <h3>{t.addVacation}</h3>
                  <button type="button" className="ghost-btn" onClick={() => setIsVacationModalOpen(false)}>
                    {t.close}
                  </button>
                </div>
                <p className="muted">{vacationEmployeeName}</p>
                <form className="timeline-form" onSubmit={handleCreateVacation}>
                  <label>
                    {t.start}
                    <input type="date" value={vacationStartDate} onChange={(e) => setVacationStartDate(e.target.value)} />
                  </label>
                  <label>
                    {t.end}
                    <input type="date" value={vacationEndDate} onChange={(e) => setVacationEndDate(e.target.value)} />
                  </label>
                  <label>
                    {t.type}
                    <select value={vacationType} onChange={(e) => setVacationType(e.target.value)}>
                      <option value="vacation">vacation</option>
                      <option value="sick">sick</option>
                      <option value="day_off">day_off</option>
                    </select>
                  </label>
                  <button type="submit">{t.saveVacation}</button>
                </form>
              </div>
            </div>
          ) : null}

          <div className="toast-stack">
            {toasts.map((toast) => (
              <div key={toast.id} className="toast-item">
                {toast.message}
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
