import { FormEvent } from 'react';
import { api } from '../api/client';
import { Employee, Role, Toast } from '../pages/app-types';
import { isoToInputDate, resolveErrorMessage, roleColorOrDefault } from './app-helpers';
import { AppState } from './useAppState';

type Params = {
  state: AppState;
  t: Record<string, string>;
  errorText: Record<string, string>;
};

export function useAppHandlers({ state, t, errorText }: Params) {
  function pushToast(message: string) {
    const toast: Toast = { id: Date.now() + Math.floor(Math.random() * 1000), message };
    state.setToasts((prev) => [...prev, toast]);
    setTimeout(() => {
      state.setToasts((prev) => prev.filter((item) => item.id !== toast.id));
    }, 4500);
  }

  function setAssignmentEditorFromDetail(detail: NonNullable<typeof state.selectedProjectDetail>, assignmentId?: string) {
    if (detail.assignments.length === 0) {
      state.setEditAssignmentId('');
      state.setEditAssignmentStartDate('');
      state.setEditAssignmentEndDate('');
      state.setEditAssignmentPercent(0);
      return;
    }

    const picked = detail.assignments.find((assignment) => assignment.id === assignmentId) ?? detail.assignments[0];
    state.setEditAssignmentId(picked.id);
    state.setEditAssignmentStartDate(isoToInputDate(picked.assignmentStartDate));
    state.setEditAssignmentEndDate(isoToInputDate(picked.assignmentEndDate));
    state.setEditAssignmentPercent(Number(picked.allocationPercent));
  }

  async function loadProjectDetail(authToken: string, projectId: string, preserveEditor = true) {
    const detail = await api.getProject(projectId, authToken);
    state.setSelectedProjectId(projectId);
    state.setSelectedProjectDetail(detail);

    if (preserveEditor) {
      setAssignmentEditorFromDetail(detail, state.editAssignmentId);
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

    const nextRoles = rolesData as typeof state.roles;
    const nextSkills = skillsData as typeof state.skills;
    const nextDepartments = departmentsData as typeof state.departments;
    const nextEmployees = employeesData as typeof state.employees;
    const nextVacations = vacationsData as typeof state.vacations;
    const nextAssignments = assignmentsData as typeof state.assignments;
    const nextProjects = projectsData as typeof state.projects;

    state.setRoles(nextRoles);
    state.setSkills(nextSkills);
    state.setDepartments(nextDepartments);
    state.setEmployees(nextEmployees);
    state.setVacations(nextVacations);
    state.setAssignments(nextAssignments);
    state.setProjects(nextProjects);
    state.setTimeline(timelineData);

    state.setRoleColorDrafts((prev) => {
      const next = { ...prev };
      for (const role of nextRoles) {
        if (!next[role.id]) next[role.id] = roleColorOrDefault(role.colorHex);
      }
      return next;
    });

    if (!state.employeeRoleId && nextRoles[0]) state.setEmployeeRoleId(nextRoles[0].id);
    if (!state.employeeDepartmentId && nextDepartments[0]) state.setEmployeeDepartmentId(nextDepartments[0].id);
    if (!state.vacationEmployeeId && nextEmployees[0]) state.setVacationEmployeeId(nextEmployees[0].id);
    if (!state.assignmentProjectId && nextProjects[0]) state.setAssignmentProjectId(nextProjects[0].id);
    if (!state.assignmentEmployeeId && nextEmployees[0]) state.setAssignmentEmployeeId(nextEmployees[0].id);

    const activeProjectId = preferredProjectId ?? state.selectedProjectId ?? nextProjects[0]?.id;
    if (activeProjectId) {
      await loadProjectDetail(authToken, activeProjectId, Boolean(state.selectedProjectId));
    } else {
      state.setSelectedProjectId('');
      state.setSelectedProjectDetail(null);
      state.setEditAssignmentId('');
    }
  }

  function toggleRoleFilter(roleNameValue: string) {
    state.setSelectedRoleFilters((prev) =>
      prev.includes(roleNameValue) ? prev.filter((name) => name !== roleNameValue) : [...prev, roleNameValue],
    );
  }

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    try {
      const result = await api.login(state.email, state.password);
      state.setToken(result.accessToken);
      await refreshData(result.accessToken, state.selectedYear);
    } catch (e) {
      pushToast(resolveErrorMessage(e, t.uiLoginFailed, errorText));
    }
  }

  async function handleCreateRole(event: FormEvent) {
    event.preventDefault();
    if (!state.token) return;

    try {
      await api.createRole(
        { name: state.roleName, description: state.roleDescription, level: state.roleLevel, colorHex: '#6E7B8A' },
        state.token,
      );
      await refreshData(state.token, state.selectedYear);
      state.setRoleName((prev) => `${prev}-2`);
    } catch (e) {
      pushToast(resolveErrorMessage(e, t.uiCreateRoleFailed, errorText));
    }
  }

  async function handleUpdateRoleColor(role: Role) {
    if (!state.token) return;
    try {
      const colorHex = roleColorOrDefault(state.roleColorDrafts[role.id]);
      await api.updateRole(role.id, { colorHex }, state.token);
      await refreshData(state.token, state.selectedYear);
    } catch (e) {
      pushToast(resolveErrorMessage(e, t.uiUpdateRoleColorFailed, errorText));
    }
  }

  async function handleCreateSkill(event: FormEvent) {
    event.preventDefault();
    if (!state.token) return;
    try {
      await api.createSkill({ name: state.skillName, description: state.skillDescription }, state.token);
      await refreshData(state.token, state.selectedYear);
      state.setSkillName((prev) => `${prev}-2`);
    } catch (e) {
      pushToast(resolveErrorMessage(e, t.uiCreateSkillFailed, errorText));
    }
  }

  async function handleCreateEmployee(event: FormEvent) {
    event.preventDefault();
    if (!state.token || !state.employeeRoleId) return;
    try {
      await api.createEmployee(
        {
          fullName: state.employeeFullName,
          email: state.employeeEmail,
          roleId: state.employeeRoleId,
          departmentId: state.employeeDepartmentId || undefined,
          status: state.employeeStatus,
          grade: state.employeeGrade,
          defaultCapacityHoursPerDay: 8,
        },
        state.token,
      );
      await refreshData(state.token, state.selectedYear);
      state.setIsEmployeeModalOpen(false);
      state.setEmployeeEmail((prev) => {
        const [name, domain] = prev.split('@');
        return `${name}.2@${domain ?? 'projo.local'}`;
      });
    } catch (e) {
      pushToast(resolveErrorMessage(e, t.uiCreateEmployeeFailed, errorText));
    }
  }

  async function handleCreateVacation(event: FormEvent) {
    event.preventDefault();
    if (!state.token || !state.vacationEmployeeId) return;
    try {
      await api.createVacation(
        {
          employeeId: state.vacationEmployeeId,
          startDate: new Date(state.vacationStartDate).toISOString(),
          endDate: new Date(state.vacationEndDate).toISOString(),
          type: state.vacationType,
        },
        state.token,
      );
      await refreshData(state.token, state.selectedYear);
      state.setIsVacationModalOpen(false);
    } catch (e) {
      pushToast(resolveErrorMessage(e, t.uiCreateVacationFailed, errorText));
    }
  }

  function openVacationModal(employee: Employee) {
    state.setVacationEmployeeId(employee.id);
    state.setVacationEmployeeName(employee.fullName);
    state.setIsVacationModalOpen(true);
  }

  async function handleCreateProject(event: FormEvent) {
    event.preventDefault();
    if (!state.token) return;
    try {
      await api.createProject(
        {
          code: state.projectCode,
          name: state.projectName,
          startDate: new Date(state.projectStartDate).toISOString(),
          endDate: new Date(state.projectEndDate).toISOString(),
          status: 'planned',
          priority: 2,
          links: [],
        },
        state.token,
      );

      await refreshData(state.token, state.selectedYear);
      state.setProjectCode((prev) => {
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
    if (!state.token || !state.assignmentProjectId || !state.assignmentEmployeeId) return;
    try {
      await api.createAssignment(
        {
          projectId: state.assignmentProjectId,
          employeeId: state.assignmentEmployeeId,
          assignmentStartDate: new Date(state.assignmentStartDate).toISOString(),
          assignmentEndDate: new Date(state.assignmentEndDate).toISOString(),
          allocationPercent: state.assignmentPercent,
        },
        state.token,
      );
      await refreshData(state.token, state.selectedYear, state.assignmentProjectId);
    } catch (e) {
      pushToast(resolveErrorMessage(e, t.uiCreateAssignmentFailed, errorText));
    }
  }

  async function handleSelectProject(projectId: string) {
    if (!state.token) return;
    try {
      await loadProjectDetail(state.token, projectId, false);
    } catch (e) {
      pushToast(resolveErrorMessage(e, t.uiLoadProjectDetailsFailed, errorText));
    }
  }

  function handleEditorAssignmentChange(assignmentId: string) {
    state.setEditAssignmentId(assignmentId);
    if (!state.selectedProjectDetail) return;
    const next = state.selectedProjectDetail.assignments.find((assignment) => assignment.id === assignmentId);
    if (!next) return;
    state.setEditAssignmentStartDate(isoToInputDate(next.assignmentStartDate));
    state.setEditAssignmentEndDate(isoToInputDate(next.assignmentEndDate));
    state.setEditAssignmentPercent(Number(next.allocationPercent));
  }

  async function handleUpdateAssignment(event: FormEvent) {
    event.preventDefault();
    if (!state.token || !state.editAssignmentId || !state.selectedProjectId) return;
    try {
      await api.updateAssignment(
        state.editAssignmentId,
        {
          assignmentStartDate: new Date(state.editAssignmentStartDate).toISOString(),
          assignmentEndDate: new Date(state.editAssignmentEndDate).toISOString(),
          allocationPercent: state.editAssignmentPercent,
        },
        state.token,
      );
      await refreshData(state.token, state.selectedYear, state.selectedProjectId);
    } catch (e) {
      pushToast(resolveErrorMessage(e, t.uiUpdateAssignmentFailed, errorText));
    }
  }

  async function handleYearChange(nextYear: number) {
    state.setSelectedYear(nextYear);
    if (!state.token) return;
    try {
      const timelineData = await api.getTimelineYear(nextYear, state.token);
      state.setTimeline(timelineData);
    } catch (e) {
      pushToast(resolveErrorMessage(e, t.uiLoadTimelineFailed, errorText));
    }
  }

  return {
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
