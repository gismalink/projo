import { api, ProjectDetail } from '../api/client';
import { MONTHLY_HOURS, TOAST_AUTO_DISMISS_MS, TOAST_ID_RANDOM_RANGE } from '../constants/app.constants';
import { Toast } from '../pages/app-types';
import { roleColorOrDefault } from './app-helpers';
import { createAssignmentsHandlers } from './handlers/assignments.handlers';
import { createAuthHandlers } from './handlers/auth.handlers';
import { createPersonnelHandlers } from './handlers/personnel.handlers';
import { createProjectsHandlers } from './handlers/projects.handlers';
import { createTimelineHandlers } from './handlers/timeline.handlers';
import { AppState } from './useAppState';

type Params = {
  state: AppState;
  t: Record<string, string>;
  errorText: Record<string, string>;
};

export function useAppHandlers({ state, t, errorText }: Params) {
  function pushToast(message: string) {
    const toast: Toast = { id: Date.now() + Math.floor(Math.random() * TOAST_ID_RANDOM_RANGE), message };
    state.setToasts((prev) => [...prev, toast]);
    setTimeout(() => {
      state.setToasts((prev) => prev.filter((item) => item.id !== toast.id));
    }, TOAST_AUTO_DISMISS_MS);
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
    state.setEditAssignmentStartDate(new Date(picked.assignmentStartDate).toISOString().slice(0, 10));
    state.setEditAssignmentEndDate(new Date(picked.assignmentEndDate).toISOString().slice(0, 10));
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

  async function refreshTimelineYearData(authToken: string, year: number, timelineDataArg?: typeof state.timeline) {
    const timelineData = timelineDataArg ?? (await api.getTimelineYear(year, authToken));
    state.setTimeline(timelineData);

    const [calendarYearResult, calendarHealthResult] = await Promise.allSettled([
      api.getCalendarYear(year, authToken),
      api.getCalendarHealth(authToken),
    ]);
    if (calendarYearResult.status === 'fulfilled') {
      state.setCalendarDays(calendarYearResult.value.days);
    } else {
      state.setCalendarDays([]);
    }
    if (calendarHealthResult.status === 'fulfilled') {
      state.setCalendarHealth(calendarHealthResult.value);
    } else {
      state.setCalendarHealth(null);
    }

    state.setTimelineOrder((prev) => {
      const ids = timelineData.map((row) => row.id);
      const kept = prev.filter((id) => ids.includes(id));
      const appended = ids.filter((id) => !kept.includes(id));
      return [...kept, ...appended];
    });
  }

  async function refreshData(authToken: string, year: number, preferredProjectId?: string) {
    const [rolesData, skillsData, departmentsData, teamTemplatesData, employeesData, vacationsData, assignmentsData, projectsData, timelineData, costRatesData] =
      await Promise.all([
        api.getRoles(authToken),
        api.getSkills(authToken),
        api.getDepartments(authToken),
        api.getTeamTemplates(authToken),
        api.getEmployees(authToken),
        api.getVacations(authToken),
        api.getAssignments(authToken),
        api.getProjects(authToken),
        api.getTimelineYear(year, authToken),
        api.getCostRates(authToken),
      ]);

    const nextRoles = rolesData as typeof state.roles;
    const nextSkills = skillsData as typeof state.skills;
    const nextDepartments = departmentsData as typeof state.departments;
    const nextTeamTemplates = teamTemplatesData as typeof state.teamTemplates;
    const nextEmployees = employeesData as typeof state.employees;
    const nextVacations = vacationsData as typeof state.vacations;
    const nextAssignments = assignmentsData as typeof state.assignments;
    const nextProjects = projectsData as typeof state.projects;

    state.setRoles(nextRoles);
    state.setSkills(nextSkills);
    state.setDepartments(nextDepartments);
    state.setTeamTemplates(nextTeamTemplates);
    state.setEmployees(nextEmployees);
    state.setVacations(nextVacations);
    state.setAssignments(nextAssignments);
    state.setProjects(nextProjects);
    await refreshTimelineYearData(authToken, year, timelineData);

    const now = new Date();
    const employeeSalaryById: Record<string, number> = {};
    const employeeActiveRateIdByEmployeeId: Record<string, string> = {};
    const activePersonalRates = costRatesData
      .filter((rate) => Boolean(rate.employeeId))
      .filter((rate) => {
        const validFrom = new Date(rate.validFrom);
        const validTo = rate.validTo ? new Date(rate.validTo) : null;
        return validFrom <= now && (!validTo || validTo >= now);
      })
      .sort((left, right) => new Date(right.validFrom).getTime() - new Date(left.validFrom).getTime());

    for (const rate of activePersonalRates) {
      const employeeId = rate.employeeId;
      if (!employeeId) continue;
      if (employeeSalaryById[employeeId] !== undefined) continue;
      const hourly = Number(rate.amountPerHour);
      if (!Number.isFinite(hourly) || hourly <= 0) continue;
      employeeSalaryById[employeeId] = Math.round(hourly * MONTHLY_HOURS);
      employeeActiveRateIdByEmployeeId[employeeId] = rate.id;
    }

    state.setEmployeeSalaryById(employeeSalaryById);
    state.setEmployeeActiveRateIdByEmployeeId(employeeActiveRateIdByEmployeeId);

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
    const timelineProjectIds = timelineData.map((row) => row.id).filter((id) => knownProjectIds.has(id));
    const expandedIds = state.expandedProjectIds.filter((id) => knownProjectIds.has(id));
    const shouldLoadPreferred =
      Boolean(preferredProjectId) &&
      Boolean(
        (preferredProjectId && expandedIds.includes(preferredProjectId)) ||
          (preferredProjectId && state.projectDetails[preferredProjectId]) ||
          preferredProjectId === state.selectedProjectId,
      );
    const expandedAndPreferredIds = shouldLoadPreferred && preferredProjectId
      ? Array.from(new Set([...expandedIds, preferredProjectId]))
      : expandedIds;
    const kpiIdsToLoad = timelineProjectIds.filter((id) => !state.projectDetails[id]);
    const idsToLoad = Array.from(new Set([...expandedAndPreferredIds, ...kpiIdsToLoad]));

    if (idsToLoad.length === 0) {
      state.setExpandedProjectIds(expandedIds);
      state.setSelectedProjectId('');
      state.setSelectedProjectDetail(null);
      state.setEditAssignmentId('');
      return;
    }

    const details = await Promise.all(idsToLoad.map((id) => api.getProject(id, authToken)));
    const detailsMap: Record<string, ProjectDetail> = {};
    for (const detail of details) detailsMap[detail.id] = detail;

    state.setExpandedProjectIds(expandedIds);
    state.setProjectDetails((prev) => {
      const retained: Record<string, ProjectDetail> = {};
      for (const [projectId, detail] of Object.entries(prev)) {
        if (knownProjectIds.has(projectId)) {
          retained[projectId] = detail;
        }
      }
      return {
        ...retained,
        ...detailsMap,
      };
    });

    const preferredActive =
      preferredProjectId && (detailsMap[preferredProjectId] || state.projectDetails[preferredProjectId])
        ? preferredProjectId
        : undefined;
    const nextActive =
      preferredActive ??
      (state.selectedProjectId && (detailsMap[state.selectedProjectId] || state.projectDetails[state.selectedProjectId])
        ? state.selectedProjectId
        : expandedAndPreferredIds[0] ?? '');
    const nextDetail = nextActive ? (detailsMap[nextActive] ?? state.projectDetails[nextActive] ?? null) : null;
    state.setSelectedProjectId(nextActive);
    state.setSelectedProjectDetail(nextDetail);
    if (nextDetail) {
      setAssignmentEditorFromDetail(nextDetail, state.editAssignmentId || undefined);
    } else {
      state.setEditAssignmentId('');
    }
  }

  const deps = {
    state,
    t,
    errorText,
    pushToast,
    refreshData,
    refreshTimelineYearData: (authToken: string, year: number) => refreshTimelineYearData(authToken, year),
    loadProjectDetail,
    setAssignmentEditorFromDetail,
  };

  return {
    pushToast,
    ...createAuthHandlers(deps),
    ...createPersonnelHandlers(deps),
    ...createProjectsHandlers(deps),
    ...createAssignmentsHandlers(deps),
    ...createTimelineHandlers(deps),
  };
}
