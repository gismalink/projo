import { FormEvent } from 'react';
import { api, ProjectDetail } from '../api/client';
import { Employee, Role, Toast } from '../pages/app-types';
import { isoToInputDate, resolveErrorMessage, roleColorOrDefault } from './app-helpers';
import { AppState } from './useAppState';

type Params = {
  state: AppState;
  t: Record<string, string>;
  errorText: Record<string, string>;
};

export function useAppHandlers({ state, t, errorText }: Params) {
  function getNextProjectCode() {
    const suffixes = state.projects
      .map((project) => {
        const match = project.code.match(/^PRJ-(\d+)$/i);
        return match ? Number(match[1]) : null;
      })
      .filter((value): value is number => value !== null && Number.isFinite(value));

    const maxValue = suffixes.length > 0 ? Math.max(...suffixes) : 0;
    const nextValue = maxValue + 1;
    return `PRJ-${String(nextValue).padStart(3, '0')}`;
  }

  function openProjectModal() {
    state.setProjectCode(getNextProjectCode());
    state.setIsProjectModalOpen(true);
  }

  function openProjectDatesModal(projectId: string) {
    const detail = state.projectDetails[projectId];
    if (!detail) return;
    state.setEditProjectId(projectId);
    state.setEditProjectStartDate(isoToInputDate(detail.startDate));
    state.setEditProjectEndDate(isoToInputDate(detail.endDate));
    state.setIsProjectDatesModalOpen(true);
  }

  function pushToast(message: string) {
    const toast: Toast = { id: Date.now() + Math.floor(Math.random() * 1000), message };
    state.setToasts((prev) => [...prev, toast]);
    setTimeout(() => {
      state.setToasts((prev) => prev.filter((item) => item.id !== toast.id));
    }, 4500);
  }

  function setAssignmentEditorFromDetail(detail: ProjectDetail, assignmentId?: string) {
    if (detail.assignments.length === 0) {
      state.setEditAssignmentId('');
      state.setEditAssignmentStartDate('');
      state.setEditAssignmentEndDate('');
      state.setEditAssignmentPercent(0);
      return;
    }

    const picked = assignmentId ? detail.assignments.find((assignment) => assignment.id === assignmentId) : null;
    if (!picked) {
      state.setEditAssignmentId('');
      state.setEditAssignmentStartDate('');
      state.setEditAssignmentEndDate('');
      state.setEditAssignmentPercent(0);
      return;
    }

    state.setEditAssignmentId(picked.id);
    state.setEditAssignmentStartDate(isoToInputDate(picked.assignmentStartDate));
    state.setEditAssignmentEndDate(isoToInputDate(picked.assignmentEndDate));
    state.setEditAssignmentPercent(Number(picked.allocationPercent));
  }

  async function loadProjectDetail(authToken: string, projectId: string, preserveEditor = true) {
    const detail = await api.getProject(projectId, authToken);
    state.setProjectDetails((prev) => ({
      ...prev,
      [projectId]: detail,
    }));
    state.setExpandedProjectIds((prev) => (prev.includes(projectId) ? prev : [...prev, projectId]));
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
    state.setTimelineOrder((prev) => {
      const ids = timelineData.map((row) => row.id);
      const kept = prev.filter((id) => ids.includes(id));
      const appended = ids.filter((id) => !kept.includes(id));
      return [...kept, ...appended];
    });

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

    const knownProjectIds = new Set(nextProjects.map((project) => project.id));
    const expandedIds = state.expandedProjectIds.filter((id) => knownProjectIds.has(id));
    const idsToLoad = preferredProjectId
      ? Array.from(new Set([...expandedIds, preferredProjectId]))
      : expandedIds;

    if (idsToLoad.length === 0) {
      state.setExpandedProjectIds([]);
      state.setProjectDetails({});
      state.setSelectedProjectId('');
      state.setSelectedProjectDetail(null);
      state.setEditAssignmentId('');
      return;
    }

    const details = await Promise.all(idsToLoad.map((id) => api.getProject(id, authToken)));
    const detailsMap: Record<string, ProjectDetail> = {};
    for (const detail of details) detailsMap[detail.id] = detail;

    state.setExpandedProjectIds(idsToLoad);
    state.setProjectDetails(detailsMap);

    const nextActive = preferredProjectId ?? (state.selectedProjectId && detailsMap[state.selectedProjectId] ? state.selectedProjectId : idsToLoad[0]);
    const nextDetail = detailsMap[nextActive] ?? null;
    state.setSelectedProjectId(nextActive);
    state.setSelectedProjectDetail(nextDetail);
    if (nextDetail) {
      setAssignmentEditorFromDetail(nextDetail, state.editAssignmentId || undefined);
    } else {
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

  async function handleCreateDepartment(name: string) {
    if (!state.token || !name.trim()) return;
    try {
      await api.createDepartment({ name: name.trim() }, state.token);
      await refreshData(state.token, state.selectedYear);
    } catch (e) {
      pushToast(resolveErrorMessage(e, t.uiCreateDepartmentFailed, errorText));
    }
  }

  async function handleUpdateDepartment(departmentId: string, name: string) {
    if (!state.token || !name.trim()) return;
    try {
      await api.updateDepartment(departmentId, { name: name.trim() }, state.token);
      await refreshData(state.token, state.selectedYear);
    } catch (e) {
      pushToast(resolveErrorMessage(e, t.uiUpdateDepartmentFailed, errorText));
    }
  }

  async function handleDeleteDepartment(departmentId: string) {
    if (!state.token) return;
    try {
      await api.deleteDepartment(departmentId, state.token);
      await refreshData(state.token, state.selectedYear);
    } catch (e) {
      pushToast(resolveErrorMessage(e, t.uiDeleteDepartmentFailed, errorText));
    }
  }

  async function handleImportEmployeesCsv(event: FormEvent) {
    event.preventDefault();
    if (!state.token || !state.employeeCsv.trim()) return;
    try {
      const result = await api.importEmployeesCsv({ csv: state.employeeCsv }, state.token);
      await refreshData(state.token, state.selectedYear);
      state.setIsEmployeeImportModalOpen(false);
      pushToast(`CSV: +${result.created} / ~${result.updated} / !${result.errors.length}`);
      if (result.errors.length > 0) {
        pushToast(result.errors.slice(0, 2).join(' | '));
      }
    } catch (e) {
      pushToast(resolveErrorMessage(e, t.uiImportEmployeesFailed, errorText));
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
      state.setIsProjectModalOpen(false);
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
      state.setIsAssignmentModalOpen(false);
    } catch (e) {
      pushToast(resolveErrorMessage(e, t.uiCreateAssignmentFailed, errorText));
    }
  }

  async function handleUpdateProjectDates(event: FormEvent) {
    event.preventDefault();
    if (!state.token || !state.editProjectId) return;

    try {
      await api.updateProject(
        state.editProjectId,
        {
          startDate: new Date(state.editProjectStartDate).toISOString(),
          endDate: new Date(state.editProjectEndDate).toISOString(),
        },
        state.token,
      );
      await refreshData(state.token, state.selectedYear, state.editProjectId);
      state.setIsProjectDatesModalOpen(false);
    } catch (e) {
      pushToast(resolveErrorMessage(e, t.uiCreateProjectFailed, errorText));
    }
  }

  async function handleSelectProject(projectId: string) {
    if (!state.token) return;

    if (state.expandedProjectIds.includes(projectId)) {
      const nextExpanded = state.expandedProjectIds.filter((id) => id !== projectId);
      state.setExpandedProjectIds(nextExpanded);
      state.setProjectDetails((prev) => {
        const next = { ...prev };
        delete next[projectId];
        return next;
      });

      if (state.selectedProjectId === projectId) {
        const fallbackProjectId = nextExpanded[0] ?? '';
        state.setSelectedProjectId(fallbackProjectId);
        state.setSelectedProjectDetail(fallbackProjectId ? state.projectDetails[fallbackProjectId] ?? null : null);
        if (!fallbackProjectId) state.setEditAssignmentId('');
      }
      return;
    }

    try {
      await loadProjectDetail(state.token, projectId, false);
    } catch (e) {
      pushToast(resolveErrorMessage(e, t.uiLoadProjectDetailsFailed, errorText));
    }
  }

  function handleEditorAssignmentChange(projectId: string, assignmentId: string) {
    if (state.selectedProjectId === projectId && state.editAssignmentId === assignmentId) {
      state.setEditAssignmentId('');
      state.setEditAssignmentStartDate('');
      state.setEditAssignmentEndDate('');
      state.setEditAssignmentPercent(0);
      return;
    }

    const detail = state.projectDetails[projectId];
    if (!detail) return;

    state.setSelectedProjectId(projectId);
    state.setSelectedProjectDetail(detail);
    state.setEditAssignmentId(assignmentId);
    const next = detail.assignments.find((assignment) => assignment.id === assignmentId);
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

  async function handleDeleteAssignment(projectId: string, assignmentId: string) {
    if (!state.token) return;
    try {
      await api.deleteAssignment(assignmentId, state.token);
      await refreshData(state.token, state.selectedYear, projectId);
    } catch (e) {
      pushToast(resolveErrorMessage(e, t.uiUpdateAssignmentFailed, errorText));
    }
  }

  async function handleAdjustAssignmentPlan(
    projectId: string,
    assignmentId: string,
    nextStartIso: string,
    nextEndIso: string,
  ) {
    if (!state.token) return;
    try {
      await api.updateAssignment(
        assignmentId,
        {
          assignmentStartDate: nextStartIso,
          assignmentEndDate: nextEndIso,
        },
        state.token,
      );
      await refreshData(state.token, state.selectedYear, projectId);
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
      state.setTimelineOrder((prev) => {
        const ids = timelineData.map((row) => row.id);
        const kept = prev.filter((id) => ids.includes(id));
        const appended = ids.filter((id) => !kept.includes(id));
        return [...kept, ...appended];
      });
    } catch (e) {
      pushToast(resolveErrorMessage(e, t.uiLoadTimelineFailed, errorText));
    }
  }

  function handleMoveProject(projectId: string, direction: 'up' | 'down') {
    const ids = state.timeline.map((row) => row.id);
    state.setTimelineOrder((prev) => {
      const base = prev.length === ids.length && ids.every((id) => prev.includes(id)) ? [...prev] : [...ids];
      const index = base.indexOf(projectId);
      if (index < 0) return base;
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= base.length) return base;
      const next = [...base];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function shiftIsoDateByDays(value: string, days: number) {
    const date = new Date(value);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString();
  }

  async function handleAdjustProjectPlan(
    projectId: string,
    nextStartIso: string,
    nextEndIso: string,
    shiftDays: number,
    mode: 'move' | 'resize-start' | 'resize-end',
  ) {
    if (!state.token) return;

    try {
      await api.updateProject(
        projectId,
        {
          startDate: nextStartIso,
          endDate: nextEndIso,
        },
        state.token,
      );

      if (mode !== 'resize-end' && shiftDays !== 0) {
        const projectAssignments = state.assignments.filter((assignment) => assignment.projectId === projectId);
        await Promise.all(
          projectAssignments.map((assignment) =>
            api.updateAssignment(
              assignment.id,
              {
                assignmentStartDate: shiftIsoDateByDays(assignment.assignmentStartDate, shiftDays),
                assignmentEndDate: shiftIsoDateByDays(assignment.assignmentEndDate, shiftDays),
              },
              state.token as string,
            ),
          ),
        );
      }

      await refreshData(state.token, state.selectedYear);
    } catch (e) {
      pushToast(resolveErrorMessage(e, t.uiCreateProjectFailed, errorText));
    }
  }

  return {
    toggleRoleFilter,
    openProjectModal,
    openProjectDatesModal,
    openVacationModal,
    handleLogin,
    handleCreateRole,
    handleCreateSkill,
    handleUpdateRoleColor,
    handleCreateEmployee,
    handleCreateDepartment,
    handleUpdateDepartment,
    handleDeleteDepartment,
    handleImportEmployeesCsv,
    handleCreateVacation,
    handleCreateProject,
    handleCreateAssignment,
    handleUpdateProjectDates,
    handleSelectProject,
    handleYearChange,
    handleEditorAssignmentChange,
    handleUpdateAssignment,
    handleDeleteAssignment,
    handleAdjustAssignmentPlan,
    handleAdjustProjectPlan,
    handleMoveProject,
  };
}
