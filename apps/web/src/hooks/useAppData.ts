import { FormEvent, useMemo, useState } from 'react';
import {
  api,
  ApiError,
  AssignmentItem,
  DepartmentItem,
  ProjectDetail,
  ProjectListItem,
  ProjectTimelineRow,
  SkillItem,
  VacationItem,
} from '../api/client';
import { ActiveTab, Employee, Role, Toast } from '../pages/app-types';

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

export function timelineStyle(row: ProjectTimelineRow) {
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

export function isoToInputDate(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

export function roleColorOrDefault(colorHex?: string | null) {
  return colorHex && /^#[0-9A-Fa-f]{6}$/.test(colorHex) ? colorHex : '#6E7B8A';
}

export function utilizationColor(value: number) {
  if (value > 110) return '#D64545';
  if (value >= 90 && value <= 105) return '#2EA44F';
  return '#D9A441';
}

type UseAppDataParams = {
  t: Record<string, string>;
  errorText: Record<string, string>;
};

function resolveErrorMessage(
  error: unknown,
  fallback: string,
  errorText: Record<string, string>,
) {
  if (error instanceof ApiError) {
    return errorText[error.code] ?? error.message ?? fallback;
  }
  if (error instanceof Error) {
    return errorText[error.message] ?? error.message ?? fallback;
  }
  return fallback;
}

export function useAppData({ t, errorText }: UseAppDataParams) {
  const [email, setEmail] = useState('admin@projo.local');
  const [password, setPassword] = useState('admin12345');
  const [token, setToken] = useState<string | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
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
  const [skillName, setSkillName] = useState('TypeScript');
  const [skillDescription, setSkillDescription] = useState('Frontend and backend development');

  const [employeeFullName, setEmployeeFullName] = useState('Jane Smith');
  const [employeeEmail, setEmployeeEmail] = useState('jane.smith@projo.local');
  const [employeeRoleId, setEmployeeRoleId] = useState('');
  const [employeeDepartmentId, setEmployeeDepartmentId] = useState('');
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
      const roleNameValue = employee.role?.name ?? t.noRole;
      counts.set(roleNameValue, (counts.get(roleNameValue) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([roleNameValue, count]) => ({
        roleName: roleNameValue,
        count,
        colorHex: roleColorOrDefault(roleByName.get(roleNameValue)?.colorHex),
      }))
      .sort((a, b) => b.count - a.count);
  }, [employees, roleByName, t.noRole]);

  const filteredEmployees = useMemo(() => {
    if (selectedRoleFilters.length === 0) return employees;
    const selected = new Set(selectedRoleFilters);
    return employees.filter((employee) => selected.has(employee.role?.name ?? t.noRole));
  }, [employees, selectedRoleFilters, t.noRole]);

  const departmentGroups = useMemo(() => {
    const map: Record<string, Employee[]> = {};
    for (const employee of filteredEmployees) {
      const dep = employee.department?.name ?? t.unassignedDepartment;
      if (!map[dep]) map[dep] = [];
      map[dep].push(employee);
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredEmployees, t.unassignedDepartment]);

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
    const [rolesData, skillsData, departmentsData, employeesData, vacationsData, assignmentsData, projectsData, timelineData] =
      await Promise.all([
        api.getRoles(authToken),
        api.getSkills(authToken),
        api.getDepartments(authToken),
        api.getEmployees(authToken),
        api.getVacations(authToken),
        api.getAssignments(authToken),
        api.getProjects(authToken),
        api.getTimelineYear(year, authToken),
      ]);

    const nextRoles = rolesData as Role[];
    const nextSkills = skillsData as SkillItem[];
    const nextDepartments = departmentsData as DepartmentItem[];
    const nextEmployees = employeesData as Employee[];
    const nextVacations = vacationsData as VacationItem[];
    const nextAssignments = assignmentsData as AssignmentItem[];
    const nextProjects = projectsData as ProjectListItem[];

    setRoles(nextRoles);
    setSkills(nextSkills);
    setDepartments(nextDepartments);
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
    if (!employeeDepartmentId && nextDepartments[0]) setEmployeeDepartmentId(nextDepartments[0].id);
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
      pushToast(resolveErrorMessage(e, t.uiLoginFailed, errorText));
    }
  }

  async function handleCreateRole(event: FormEvent) {
    event.preventDefault();
    if (!token) return;

    try {
      await api.createRole(
        { name: roleName, description: roleDescription, level: roleLevel, colorHex: '#6E7B8A' },
        token,
      );
      await refreshData(token, selectedYear);
      setRoleName((prev) => `${prev}-2`);
    } catch (e) {
      pushToast(resolveErrorMessage(e, t.uiCreateRoleFailed, errorText));
    }
  }

  async function handleUpdateRoleColor(role: Role) {
    if (!token) return;
    try {
      const colorHex = roleColorOrDefault(roleColorDrafts[role.id]);
      await api.updateRole(role.id, { colorHex }, token);
      await refreshData(token, selectedYear);
    } catch (e) {
      pushToast(resolveErrorMessage(e, t.uiUpdateRoleColorFailed, errorText));
    }
  }

  async function handleCreateSkill(event: FormEvent) {
    event.preventDefault();
    if (!token) return;
    try {
      await api.createSkill({ name: skillName, description: skillDescription }, token);
      await refreshData(token, selectedYear);
      setSkillName((prev) => `${prev}-2`);
    } catch (e) {
      pushToast(resolveErrorMessage(e, t.uiCreateSkillFailed, errorText));
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
          departmentId: employeeDepartmentId || undefined,
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
      pushToast(resolveErrorMessage(e, t.uiCreateEmployeeFailed, errorText));
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
      pushToast(resolveErrorMessage(e, t.uiCreateVacationFailed, errorText));
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
      pushToast(resolveErrorMessage(e, t.uiCreateProjectFailed, errorText));
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
      pushToast(resolveErrorMessage(e, t.uiCreateAssignmentFailed, errorText));
    }
  }

  async function handleSelectProject(projectId: string) {
    if (!token) return;
    try {
      await loadProjectDetail(token, projectId, false);
    } catch (e) {
      pushToast(resolveErrorMessage(e, t.uiLoadProjectDetailsFailed, errorText));
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
      pushToast(resolveErrorMessage(e, t.uiUpdateAssignmentFailed, errorText));
    }
  }

  async function handleYearChange(nextYear: number) {
    setSelectedYear(nextYear);
    if (!token) return;
    try {
      const timelineData = await api.getTimelineYear(nextYear, token);
      setTimeline(timelineData);
    } catch (e) {
      pushToast(resolveErrorMessage(e, t.uiLoadTimelineFailed, errorText));
    }
  }

  return {
    email,
    password,
    token,
    roles,
    skills,
    departments,
    employees,
    projects,
    activeTab,
    selectedYear,
    selectedProjectId,
    selectedProjectDetail,
    roleStats,
    selectedRoleFilters,
    vacationsByEmployee,
    roleByName,
    utilizationByEmployee,
    sortedTimeline,
    roleName,
    roleDescription,
    roleLevel,
    skillName,
    skillDescription,
    roleColorDrafts,
    projectCode,
    projectName,
    projectStartDate,
    projectEndDate,
    assignmentProjectId,
    assignmentEmployeeId,
    assignmentStartDate,
    assignmentEndDate,
    assignmentPercent,
    editAssignmentId,
    editAssignmentStartDate,
    editAssignmentEndDate,
    editAssignmentPercent,
    isEmployeeModalOpen,
    employeeFullName,
    employeeEmail,
    employeeRoleId,
    employeeDepartmentId,
    employeeGrade,
    employeeStatus,
    isVacationModalOpen,
    vacationEmployeeName,
    vacationStartDate,
    vacationEndDate,
    vacationType,
    toasts,
    setEmail,
    setPassword,
    setActiveTab,
    setSelectedRoleFilters,
    setRoleName,
    setRoleDescription,
    setRoleLevel,
    setSkillName,
    setSkillDescription,
    setRoleColorDrafts,
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
    setIsEmployeeModalOpen,
    setEmployeeFullName,
    setEmployeeEmail,
    setEmployeeRoleId,
    setEmployeeDepartmentId,
    setEmployeeGrade,
    setEmployeeStatus,
    setIsVacationModalOpen,
    setVacationStartDate,
    setVacationEndDate,
    setVacationType,
    toggleRoleFilter,
    openVacationModal,
    handleLogin,
    handleCreateRole,
    handleCreateSkill,
    handleUpdateRoleColor,
    handleCreateEmployee,
    handleCreateVacation,
    handleCreateProject,
    handleCreateAssignment,
    handleSelectProject,
    handleYearChange,
    handleEditorAssignmentChange,
    handleUpdateAssignment,
  };
}
