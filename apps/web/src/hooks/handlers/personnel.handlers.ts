import { FormEvent } from 'react';
import { api } from '../../api/client';
import { DEFAULT_EMPLOYEE_STATUS, MONTHLY_HOURS } from '../../constants/app.constants';
import { Employee } from '../../pages/app-types';
import { STANDARD_DAY_HOURS, resolveErrorMessage } from '../app-helpers';
import { monthlyToHourly, parseSalaryInput } from '../salary.utils';
import { HandlerDeps } from './handler-deps';
import { runWithErrorToast, runWithErrorToastVoid } from './handler-utils';

export function createPersonnelHandlers({ state, t, errorText, pushToast, refreshData }: HandlerDeps) {
  const VACATION_OVERLAP_MESSAGE = t.uiVacationOverlap;

  async function upsertEmployeeCostRate(employeeId: string, salaryMonthly: number) {
    const amountPerHour = monthlyToHourly(salaryMonthly, MONTHLY_HOURS);
    const existingRateId = state.employeeActiveRateIdByEmployeeId[employeeId];
    if (existingRateId) {
      await api.updateCostRate(
        existingRateId,
        {
          amountPerHour,
          currency: 'USD',
        },
        state.token as string,
      );
      return;
    }

    await api.createCostRate(
      {
        employeeId,
        amountPerHour,
        currency: 'USD',
        validFrom: new Date().toISOString(),
      },
      state.token as string,
    );
  }

  async function saveVacation(payload: { employeeId: string; startDate: string; endDate: string; type: string }, vacationId?: string) {
    const body = {
      employeeId: payload.employeeId,
      startDate: new Date(payload.startDate).toISOString(),
      endDate: new Date(payload.endDate).toISOString(),
      type: payload.type,
    };

    if (vacationId) {
      await api.updateVacation(
        vacationId,
        {
          startDate: body.startDate,
          endDate: body.endDate,
          type: body.type,
        },
        state.token as string,
      );
      return;
    }

    await api.createVacation(body, state.token as string);
  }

  function toggleRoleFilter(roleNameValue: string) {
    state.setSelectedRoleFilters((prev) =>
      prev.includes(roleNameValue) ? prev.filter((name) => name !== roleNameValue) : [...prev, roleNameValue],
    );
  }

  async function handleCreateRole(event: FormEvent) {
    event.preventDefault();
    if (!state.token) return;

    const created = await runWithErrorToastVoid({
      operation: async () => {
        await api.createRole(
          {
            name: state.roleName,
            shortName: state.roleShortName || undefined,
            description: state.roleDescription,
            colorHex: '#6E7B8A',
          },
          state.token as string,
        );
        await refreshData(state.token as string, state.selectedYear);
      },
      fallbackMessage: t.uiCreateRoleFailed,
      errorText,
      pushToast,
    });

    if (created) {
      state.setRoleName((prev) => `${prev}-2`);
      state.setRoleShortName('');
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
    await runWithErrorToast({
      operation: async () => {
        await api.updateRole(roleId, payload, state.token as string);
        await refreshData(state.token as string, state.selectedYear);
      },
      fallbackMessage: t.uiUpdateRoleColorFailed,
      errorText,
      pushToast,
    });
  }

  async function handleDeleteRole(roleId: string) {
    if (!state.token) return;
    await runWithErrorToast({
      operation: async () => {
        await api.deleteRole(roleId, state.token as string);
        await refreshData(state.token as string, state.selectedYear);
      },
      fallbackMessage: t.uiDeleteRoleFailed,
      errorText,
      pushToast,
    });
  }

  async function handleCreateDefaultRoles() {
    if (!state.token) return;
    await runWithErrorToast({
      operation: async () => {
        await api.createDefaultRoles(state.token as string);
        await refreshData(state.token as string, state.selectedYear);
      },
      fallbackMessage: t.uiCreateDefaultRolesFailed,
      errorText,
      pushToast,
    });
  }

  async function handleCreateDefaultDepartments() {
    if (!state.token) return;
    await runWithErrorToast({
      operation: async () => {
        await api.createDefaultDepartments(state.token as string);
        await refreshData(state.token as string, state.selectedYear);
      },
      fallbackMessage: t.uiCreateDefaultDepartmentsFailed,
      errorText,
      pushToast,
    });
  }

  async function handleCreateDefaultTeamTemplates() {
    if (!state.token) return;
    await runWithErrorToast({
      operation: async () => {
        await api.createDefaultTeamTemplates(state.token as string);
        await refreshData(state.token as string, state.selectedYear);
      },
      fallbackMessage: t.uiCreateDefaultTeamTemplatesFailed,
      errorText,
      pushToast,
    });
  }

  async function handleSeedDemoWorkspace() {
    if (!state.token) return;
    const ok = await runWithErrorToastVoid({
      operation: async () => {
        await api.seedDemoWorkspace(state.token as string);
        await refreshData(state.token as string, state.selectedYear);
      },
      fallbackMessage: t.uiSeedDemoWorkspaceFailed,
      errorText,
      pushToast,
    });
    if (ok) {
      pushToast(t.uiSeedDemoWorkspaceSuccess);
    }
  }

  async function handleCreateSkill(event: FormEvent) {
    event.preventDefault();
    if (!state.token) return;
    const created = await runWithErrorToastVoid({
      operation: async () => {
        await api.createSkill({ name: state.skillName, description: state.skillDescription }, state.token as string);
        await refreshData(state.token as string, state.selectedYear);
      },
      fallbackMessage: t.uiCreateSkillFailed,
      errorText,
      pushToast,
    });

    if (created) {
      state.setSkillName((prev) => `${prev}-2`);
    }
  }

  async function handleCreateEmployee(event: FormEvent) {
    event.preventDefault();
    if (!state.token || !state.employeeRoleId) return;

    const salaryMonthly = parseSalaryInput(state.employeeSalary);
    const normalizedEmail = state.employeeEmail.trim().toLowerCase();
    const emailPayload = normalizedEmail || null;
    const isEditMode = Boolean(state.editEmployeeId);
    let savedEmployeeId = state.editEmployeeId;

    try {
      if (isEditMode && state.editEmployeeId) {
        await api.updateEmployee(
          state.editEmployeeId,
          {
            fullName: state.employeeFullName,
            email: emailPayload,
            roleId: state.employeeRoleId,
            departmentId: state.employeeDepartmentId || undefined,
            status: state.employeeStatus,
            grade: state.employeeGrade,
          },
          state.token,
        );
      } else {
        const createdEmployee = (await api.createEmployee(
          {
            fullName: state.employeeFullName,
            email: emailPayload,
            roleId: state.employeeRoleId,
            departmentId: state.employeeDepartmentId || undefined,
            status: state.employeeStatus,
            grade: state.employeeGrade,
            defaultCapacityHoursPerDay: STANDARD_DAY_HOURS,
          },
          state.token,
        )) as { id: string };

        savedEmployeeId = createdEmployee?.id ?? '';
      }

      if (salaryMonthly !== null && savedEmployeeId) {
        try {
          await upsertEmployeeCostRate(savedEmployeeId, salaryMonthly);
        } catch (error) {
          pushToast(resolveErrorMessage(error, t.uiCreateEmployeeFailed, errorText));
        }
      }

      if (isEditMode) {
        state.setIsEmployeeModalOpen(false);
      } else {
        state.setIsEmployeeCreateModalOpen(false);
        state.setEmployeeEmail('');
      }
      state.setEditEmployeeId('');
      state.setEmployeeSalary('');

      try {
        await refreshData(state.token, state.selectedYear);
      } catch (error) {
        pushToast(resolveErrorMessage(error, t.uiLoadTimelineFailed, errorText));
      }
    } catch (error) {
      pushToast(resolveErrorMessage(error, t.uiCreateEmployeeFailed, errorText));
    }
  }

  async function handleAutoSaveEmployeeProfile(payload: {
    fullName: string;
    email?: string | null;
    roleId: string;
    departmentId?: string;
    grade?: string;
    status?: string;
    salaryMonthly?: number;
  }) {
    if (!state.token || !state.editEmployeeId || !payload.roleId) return;
    try {
      const normalizedEmail = payload.email?.trim().toLowerCase() ?? '';
      await api.updateEmployee(
        state.editEmployeeId,
        {
          fullName: payload.fullName,
          email: normalizedEmail || null,
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
        await upsertEmployeeCostRate(state.editEmployeeId, normalizedSalary as number);
      }

      state.setEmployeeFullName(payload.fullName);
      state.setEmployeeEmail(normalizedEmail);
      state.setEmployeeRoleId(payload.roleId);
      state.setEmployeeDepartmentId(payload.departmentId ?? '');
      state.setEmployeeGrade(payload.grade ?? '');
      state.setEmployeeStatus(payload.status ?? DEFAULT_EMPLOYEE_STATUS);
      await refreshData(state.token, state.selectedYear);
    } catch (error) {
      pushToast(resolveErrorMessage(error, t.uiCreateEmployeeFailed, errorText));
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
      pushToast(VACATION_OVERLAP_MESSAGE);
      return;
    }
    await runWithErrorToast({
      operation: async () => {
        await saveVacation({
          employeeId: state.editEmployeeId as string,
          startDate: payload.startDate,
          endDate: payload.endDate,
          type: payload.type,
        });
        await refreshData(state.token as string, state.selectedYear);
      },
      fallbackMessage: t.uiCreateVacationFailed,
      errorText,
      pushToast,
    });
  }

  async function handleUpdateVacationFromEmployeeModal(
    vacationId: string,
    payload: { startDate: string; endDate: string; type: string },
  ) {
    if (!state.token || !state.editEmployeeId) return;
    if (hasVacationOverlap(state.editEmployeeId, payload.startDate, payload.endDate, vacationId)) {
      pushToast(VACATION_OVERLAP_MESSAGE);
      return;
    }
    await runWithErrorToast({
      operation: async () => {
        await saveVacation(
          {
            employeeId: state.editEmployeeId as string,
            startDate: payload.startDate,
            endDate: payload.endDate,
            type: payload.type,
          },
          vacationId,
        );
        await refreshData(state.token as string, state.selectedYear);
      },
      fallbackMessage: t.uiCreateVacationFailed,
      errorText,
      pushToast,
    });
  }

  async function handleDeleteVacationFromEmployeeModal(vacationId: string) {
    if (!state.token) return;
    await runWithErrorToast({
      operation: async () => {
        await api.deleteVacation(vacationId, state.token as string);
        await refreshData(state.token as string, state.selectedYear);
      },
      fallbackMessage: t.uiCreateVacationFailed,
      errorText,
      pushToast,
    });
  }

  async function handleAssignVacationFromEmployeeModal() {
    if (!state.token || !state.editEmployeeId) return;
    await runWithErrorToast({
      operation: async () => {
        await saveVacation({
          employeeId: state.editEmployeeId as string,
          startDate: state.vacationStartDate,
          endDate: state.vacationEndDate,
          type: state.vacationType,
        });
        await refreshData(state.token as string, state.selectedYear);
      },
      fallbackMessage: t.uiCreateVacationFailed,
      errorText,
      pushToast,
    });
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

    const updated = await runWithErrorToastVoid({
      operation: async () => {
        await api.updateEmployee(
          state.editEmployeeId as string,
          {
            departmentId: state.editEmployeeDepartmentId,
          },
          state.token as string,
        );
        await refreshData(state.token as string, state.selectedYear);
      },
      fallbackMessage: t.uiCreateEmployeeFailed,
      errorText,
      pushToast,
    });

    if (updated) {
      state.setIsEmployeeDepartmentModalOpen(false);
    }
  }

  async function handleCreateDepartment(name: string, colorHex?: string) {
    if (!state.token || !name.trim()) return;
    await runWithErrorToast({
      operation: async () => {
        await api.createDepartment({ name: name.trim(), colorHex }, state.token as string);
        await refreshData(state.token as string, state.selectedYear);
      },
      fallbackMessage: t.uiCreateDepartmentFailed,
      errorText,
      pushToast,
    });
  }

  async function handleUpdateDepartment(departmentId: string, name: string, colorHex?: string) {
    if (!state.token || !name.trim()) return;
    await runWithErrorToast({
      operation: async () => {
        await api.updateDepartment(departmentId, { name: name.trim(), colorHex }, state.token as string);
        await refreshData(state.token as string, state.selectedYear);
      },
      fallbackMessage: t.uiUpdateDepartmentFailed,
      errorText,
      pushToast,
    });
  }

  async function handleDeleteDepartment(departmentId: string) {
    if (!state.token) return;
    await runWithErrorToast({
      operation: async () => {
        await api.deleteDepartment(departmentId, state.token as string);
        await refreshData(state.token as string, state.selectedYear);
      },
      fallbackMessage: t.uiDeleteDepartmentFailed,
      errorText,
      pushToast,
    });
  }

  async function handleCreateTeamTemplate(name: string, roleIds: string[]) {
    if (!state.token || !name.trim() || roleIds.length === 0) return;
    await runWithErrorToast({
      operation: async () => {
        await api.createTeamTemplate(
          {
            name: name.trim(),
            roleIds,
          },
          state.token as string,
        );
        await refreshData(state.token as string, state.selectedYear);
      },
      fallbackMessage: t.uiCreateTeamTemplateFailed,
      errorText,
      pushToast,
    });
  }

  async function handleUpdateTeamTemplate(templateId: string, payload: { name?: string; roleIds?: string[] }) {
    if (!state.token) return;
    const trimmedName = payload.name?.trim();
    if (payload.name !== undefined && !trimmedName) return;
    if (payload.roleIds !== undefined && payload.roleIds.length === 0) return;

    await runWithErrorToast({
      operation: async () => {
        await api.updateTeamTemplate(
          templateId,
          {
            ...(trimmedName !== undefined ? { name: trimmedName } : {}),
            ...(payload.roleIds !== undefined ? { roleIds: payload.roleIds } : {}),
          },
          state.token as string,
        );
        await refreshData(state.token as string, state.selectedYear);
      },
      fallbackMessage: t.uiUpdateTeamTemplateFailed,
      errorText,
      pushToast,
    });
  }

  async function handleDeleteTeamTemplate(templateId: string) {
    if (!state.token) return;
    await runWithErrorToast({
      operation: async () => {
        await api.deleteTeamTemplate(templateId, state.token as string);
        await refreshData(state.token as string, state.selectedYear);
      },
      fallbackMessage: t.uiDeleteTeamTemplateFailed,
      errorText,
      pushToast,
    });
  }

  async function handleImportEmployeesCsv(event: FormEvent) {
    event.preventDefault();
    if (!state.token || !state.employeeCsv.trim()) return;
    const result = await runWithErrorToast({
      operation: async () => {
        const response = await api.importEmployeesCsv({ csv: state.employeeCsv }, state.token as string);
        await refreshData(state.token as string, state.selectedYear);
        return response;
      },
      fallbackMessage: t.uiImportEmployeesFailed,
      errorText,
      pushToast,
    });

    if (result) {
      state.setIsEmployeeImportModalOpen(false);
      pushToast(`CSV: +${result.created} / ~${result.updated} / !${result.errors.length}`);
      if (result.errors.length > 0) {
        pushToast(result.errors.slice(0, 2).join(' | '));
      }
    }
  }

  async function handleCreateVacation(event: FormEvent) {
    event.preventDefault();
    if (!state.token || !state.vacationEmployeeId) return;
    const created = await runWithErrorToastVoid({
      operation: async () => {
        await saveVacation({
          employeeId: state.vacationEmployeeId as string,
          startDate: state.vacationStartDate,
          endDate: state.vacationEndDate,
          type: state.vacationType,
        });
        await refreshData(state.token as string, state.selectedYear);
      },
      fallbackMessage: t.uiCreateVacationFailed,
      errorText,
      pushToast,
    });

    if (created) {
      state.setIsVacationModalOpen(false);
    }
  }

  function openVacationModal(employee: Employee) {
    state.setVacationEmployeeId(employee.id);
    state.setVacationEmployeeName(employee.fullName);
    state.setIsVacationModalOpen(true);
  }

  return {
    toggleRoleFilter,
    handleCreateRole,
    handleUpdateRole,
    handleDeleteRole,
    handleCreateDefaultRoles,
    handleCreateDefaultDepartments,
    handleCreateDefaultTeamTemplates,
    handleSeedDemoWorkspace,
    handleCreateSkill,
    handleCreateEmployee,
    handleAutoSaveEmployeeProfile,
    handleCreateVacationFromEmployeeModal,
    handleUpdateVacationFromEmployeeModal,
    handleDeleteVacationFromEmployeeModal,
    handleAssignVacationFromEmployeeModal,
    openEmployeeDepartmentModal,
    handleUpdateEmployeeDepartment,
    handleCreateDepartment,
    handleUpdateDepartment,
    handleDeleteDepartment,
    handleCreateTeamTemplate,
    handleUpdateTeamTemplate,
    handleDeleteTeamTemplate,
    handleImportEmployeesCsv,
    handleCreateVacation,
    openVacationModal,
  };
}
