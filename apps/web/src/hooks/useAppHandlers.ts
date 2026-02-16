import { FormEvent } from 'react';
import { api, ProjectDetail } from '../api/client';
import { Employee, Toast } from '../pages/app-types';
import { STANDARD_DAY_HOURS, isoToInputDate, resolveErrorMessage, roleColorOrDefault } from './app-helpers';
import { AppState } from './useAppState';

const MONTHLY_HOURS = 168;

function parseSalaryInput(value: string): number | null {
  const normalized = value.replace(',', '.').trim();
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed);
}

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
    const [rolesData, skillsData, departmentsData, employeesData, vacationsData, assignmentsData, projectsData, timelineData, costRatesData] =
      await Promise.all([
        api.getRoles(authToken),
        api.getSkills(authToken),
        api.getDepartments(authToken),
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
      state.setCurrentUserRole(result.user.role);
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
        {
          name: state.roleName,
          shortName: state.roleShortName || undefined,
          description: state.roleDescription,
          level: state.roleLevel,
          colorHex: '#6E7B8A',
        },
        state.token,
      );
      await refreshData(state.token, state.selectedYear);
      state.setRoleName((prev) => `${prev}-2`);
      state.setRoleShortName('');
    } catch (e) {
      pushToast(resolveErrorMessage(e, t.uiCreateRoleFailed, errorText));
    }
  }

  async function handleUpdateRole(
    roleId: string,
    payload: {
      name?: string;
      shortName?: string;
      description?: string;
      level?: number;
      colorHex?: string;
    },
  ) {
    if (!state.token) return;
    try {
      await api.updateRole(roleId, payload, state.token);
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

    const salaryMonthly = parseSalaryInput(state.employeeSalary);

    try {
      if (state.editEmployeeId) {
        await api.updateEmployee(
          state.editEmployeeId,
          {
            fullName: state.employeeFullName,
            email: state.employeeEmail,
            roleId: state.employeeRoleId,
            departmentId: state.employeeDepartmentId || undefined,
            status: state.employeeStatus,
            grade: state.employeeGrade,
          },
          state.token,
        );

        if (salaryMonthly !== null) {
          const amountPerHour = Number((salaryMonthly / MONTHLY_HOURS).toFixed(2));
          const existingRateId = state.employeeActiveRateIdByEmployeeId[state.editEmployeeId];
          if (existingRateId) {
            await api.updateCostRate(
              existingRateId,
              {
                amountPerHour,
                currency: 'USD',
              },
              state.token,
            );
          } else {
            await api.createCostRate(
              {
                employeeId: state.editEmployeeId,
                amountPerHour,
                currency: 'USD',
                validFrom: new Date().toISOString(),
              },
              state.token,
            );
          }
        }
      } else {
        const createdEmployee = (await api.createEmployee(
          {
            fullName: state.employeeFullName,
            email: state.employeeEmail,
            roleId: state.employeeRoleId,
            departmentId: state.employeeDepartmentId || undefined,
            status: state.employeeStatus,
            grade: state.employeeGrade,
            defaultCapacityHoursPerDay: STANDARD_DAY_HOURS,
          },
          state.token,
        )) as { id: string };

        if (salaryMonthly !== null && createdEmployee?.id) {
          await api.createCostRate(
            {
              employeeId: createdEmployee.id,
              amountPerHour: Number((salaryMonthly / MONTHLY_HOURS).toFixed(2)),
              currency: 'USD',
              validFrom: new Date().toISOString(),
            },
            state.token,
          );
        }
      }
      await refreshData(state.token, state.selectedYear);
      if (state.editEmployeeId) {
        state.setIsEmployeeModalOpen(false);
      } else {
        state.setIsEmployeeCreateModalOpen(false);
        state.setEmployeeEmail((prev) => {
          const [name, domain] = prev.split('@');
          return `${name}.2@${domain ?? 'projo.local'}`;
        });
      }
      state.setEditEmployeeId('');
      state.setEmployeeSalary('');
    } catch (e) {
      pushToast(resolveErrorMessage(e, t.uiCreateEmployeeFailed, errorText));
    }
  }

  async function handleAutoSaveEmployeeProfile(payload: {
    fullName: string;
    email: string;
    roleId: string;
    departmentId?: string;
    grade?: string;
    status?: string;
    salaryMonthly?: number;
  }) {
    if (!state.token || !state.editEmployeeId || !payload.roleId) return;
    try {
      await api.updateEmployee(
        state.editEmployeeId,
        {
          fullName: payload.fullName,
          email: payload.email,
          roleId: payload.roleId,
          departmentId: payload.departmentId,
          grade: payload.grade,
          status: payload.status,
        },
        state.token,
      );

      const currentSalary = state.employeeSalaryById[state.editEmployeeId];
      const normalizedSalary =
        payload.salaryMonthly !== undefined && Number.isFinite(payload.salaryMonthly)
          ? Math.round(payload.salaryMonthly)
          : undefined;
      const shouldUpdateSalary =
        payload.salaryMonthly !== undefined &&
        Number.isFinite(payload.salaryMonthly) &&
        payload.salaryMonthly > 0 &&
        normalizedSalary !== undefined &&
        (currentSalary === undefined || Math.abs(currentSalary - normalizedSalary) >= 1);

      if (shouldUpdateSalary) {
        const amountPerHour = Number(((normalizedSalary as number) / MONTHLY_HOURS).toFixed(2));
        const existingRateId = state.employeeActiveRateIdByEmployeeId[state.editEmployeeId];
        if (existingRateId) {
          await api.updateCostRate(
            existingRateId,
            {
              amountPerHour,
              currency: 'USD',
            },
            state.token,
          );
        } else {
          await api.createCostRate(
            {
              employeeId: state.editEmployeeId,
              amountPerHour,
              currency: 'USD',
              validFrom: new Date().toISOString(),
            },
            state.token,
          );
        }
      }

      state.setEmployeeFullName(payload.fullName);
      state.setEmployeeEmail(payload.email);
      state.setEmployeeRoleId(payload.roleId);
      state.setEmployeeDepartmentId(payload.departmentId ?? '');
      state.setEmployeeGrade(payload.grade ?? '');
      state.setEmployeeStatus(payload.status ?? 'active');
      await refreshData(state.token, state.selectedYear);
    } catch (e) {
      pushToast(resolveErrorMessage(e, t.uiCreateEmployeeFailed, errorText));
    }
  }

  function hasVacationOverlap(employeeId: string, startDate: string, endDate: string, excludeId?: string) {
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return true;
    return state.vacations.some((vacation) => {
      if (vacation.employeeId !== employeeId) return false;
      if (excludeId && vacation.id === excludeId) return false;
      const vacStart = new Date(vacation.startDate).getTime();
      const vacEnd = new Date(vacation.endDate).getTime();
      return start <= vacEnd && end >= vacStart;
    });
  }

  async function handleCreateVacationFromEmployeeModal(payload: { startDate: string; endDate: string; type: string }) {
    if (!state.token || !state.editEmployeeId) return;
    if (hasVacationOverlap(state.editEmployeeId, payload.startDate, payload.endDate)) {
      pushToast('Отпуска не должны пересекаться');
      return;
    }
    try {
      await api.createVacation(
        {
          employeeId: state.editEmployeeId,
          startDate: new Date(payload.startDate).toISOString(),
          endDate: new Date(payload.endDate).toISOString(),
          type: payload.type,
        },
        state.token,
      );
      await refreshData(state.token, state.selectedYear);
    } catch (e) {
      pushToast(resolveErrorMessage(e, t.uiCreateVacationFailed, errorText));
    }
  }

  async function handleUpdateVacationFromEmployeeModal(
    vacationId: string,
    payload: { startDate: string; endDate: string; type: string },
  ) {
    if (!state.token || !state.editEmployeeId) return;
    if (hasVacationOverlap(state.editEmployeeId, payload.startDate, payload.endDate, vacationId)) {
      pushToast('Отпуска не должны пересекаться');
      return;
    }
    try {
      await api.updateVacation(
        vacationId,
        {
          startDate: new Date(payload.startDate).toISOString(),
          endDate: new Date(payload.endDate).toISOString(),
          type: payload.type,
        },
        state.token,
      );
      await refreshData(state.token, state.selectedYear);
    } catch (e) {
      pushToast(resolveErrorMessage(e, t.uiCreateVacationFailed, errorText));
    }
  }

  async function handleDeleteVacationFromEmployeeModal(vacationId: string) {
    if (!state.token) return;
    try {
      await api.deleteVacation(vacationId, state.token);
      await refreshData(state.token, state.selectedYear);
    } catch (e) {
      pushToast(resolveErrorMessage(e, t.uiCreateVacationFailed, errorText));
    }
  }

  async function handleAssignVacationFromEmployeeModal() {
    if (!state.token || !state.editEmployeeId) return;
    try {
      await api.createVacation(
        {
          employeeId: state.editEmployeeId,
          startDate: new Date(state.vacationStartDate).toISOString(),
          endDate: new Date(state.vacationEndDate).toISOString(),
          type: state.vacationType,
        },
        state.token,
      );
      await refreshData(state.token, state.selectedYear);
    } catch (e) {
      pushToast(resolveErrorMessage(e, t.uiCreateVacationFailed, errorText));
    }
  }

  function openEmployeeDepartmentModal(employee: Employee) {
    state.setEditEmployeeId(employee.id);
    state.setEditEmployeeName(employee.fullName);
    state.setEditEmployeeRoleName(employee.role?.name ?? t.noRole);
    state.setEditEmployeeDepartmentId(employee.department?.id ?? '');
    state.setIsEmployeeDepartmentModalOpen(true);
  }

  async function handleUpdateEmployeeDepartment(event: FormEvent) {
    event.preventDefault();
    if (!state.token || !state.editEmployeeId || !state.editEmployeeDepartmentId) return;

    try {
      await api.updateEmployee(
        state.editEmployeeId,
        {
          departmentId: state.editEmployeeDepartmentId,
        },
        state.token,
      );
      await refreshData(state.token, state.selectedYear);
      state.setIsEmployeeDepartmentModalOpen(false);
    } catch (e) {
      pushToast(resolveErrorMessage(e, t.uiCreateEmployeeFailed, errorText));
    }
  }

  async function handleCreateDepartment(name: string, colorHex?: string) {
    if (!state.token || !name.trim()) return;
    try {
      await api.createDepartment({ name: name.trim(), colorHex }, state.token);
      await refreshData(state.token, state.selectedYear);
    } catch (e) {
      pushToast(resolveErrorMessage(e, t.uiCreateDepartmentFailed, errorText));
    }
  }

  async function handleUpdateDepartment(departmentId: string, name: string, colorHex?: string) {
    if (!state.token || !name.trim()) return;
    try {
      await api.updateDepartment(departmentId, { name: name.trim(), colorHex }, state.token);
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

  async function handleAutoSaveProjectMeta(
    projectId: string,
    payload: { code: string; name: string; startDate: string; endDate: string },
  ) {
    if (!state.token) return;

    try {
      await api.updateProject(
        projectId,
        {
          code: payload.code,
          name: payload.name,
          startDate: payload.startDate,
          endDate: payload.endDate,
        },
        state.token,
      );
      await refreshData(state.token, state.selectedYear, projectId);
    } catch (e) {
      pushToast(resolveErrorMessage(e, t.uiCreateProjectFailed, errorText));
    }
  }

  async function handleSelectProject(projectId: string) {
    if (!state.token) return;

    if (state.expandedProjectIds.includes(projectId)) {
      const nextExpanded = state.expandedProjectIds.filter((id) => id !== projectId);
      state.setExpandedProjectIds(nextExpanded);

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

      const [calendarYearResult, calendarHealthResult] = await Promise.allSettled([
        api.getCalendarYear(nextYear, state.token),
        api.getCalendarHealth(state.token),
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

      await refreshData(state.token, state.selectedYear, projectId);
    } catch (e) {
      pushToast(resolveErrorMessage(e, t.uiCreateProjectFailed, errorText));
    }
  }

  return {
    toggleRoleFilter,
    openProjectModal,
    openProjectDatesModal,
    openVacationModal,
    openEmployeeDepartmentModal,
    handleLogin,
    handleCreateRole,
    handleCreateSkill,
    handleUpdateRole,
    handleCreateEmployee,
    handleUpdateEmployeeDepartment,
    handleCreateDepartment,
    handleUpdateDepartment,
    handleDeleteDepartment,
    handleImportEmployeesCsv,
    handleCreateVacation,
    handleAssignVacationFromEmployeeModal,
    handleAutoSaveEmployeeProfile,
    handleCreateVacationFromEmployeeModal,
    handleUpdateVacationFromEmployeeModal,
    handleDeleteVacationFromEmployeeModal,
    handleCreateProject,
    handleCreateAssignment,
    handleUpdateProjectDates,
    handleAutoSaveProjectMeta,
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
