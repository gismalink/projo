import { FormEvent } from 'react';
import { api } from '../../api/client';
import { DEFAULT_EMPLOYEE_STATUS, MONTHLY_HOURS } from '../../constants/app.constants';
import { Employee } from '../../pages/app-types';
import { STANDARD_DAY_HOURS, resolveErrorMessage } from '../app-helpers';
import { monthlyToHourly, parseSalaryInput } from '../salary.utils';
import { HandlerDeps } from './handler-deps';

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
    } catch (error) {
      pushToast(resolveErrorMessage(error, t.uiCreateRoleFailed, errorText));
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
    } catch (error) {
      pushToast(resolveErrorMessage(error, t.uiUpdateRoleColorFailed, errorText));
    }
  }

  async function handleCreateSkill(event: FormEvent) {
    event.preventDefault();
    if (!state.token) return;
    try {
      await api.createSkill({ name: state.skillName, description: state.skillDescription }, state.token);
      await refreshData(state.token, state.selectedYear);
      state.setSkillName((prev) => `${prev}-2`);
    } catch (error) {
      pushToast(resolveErrorMessage(error, t.uiCreateSkillFailed, errorText));
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
          await upsertEmployeeCostRate(state.editEmployeeId, salaryMonthly);
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
          await upsertEmployeeCostRate(createdEmployee.id, salaryMonthly);
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
    } catch (error) {
      pushToast(resolveErrorMessage(error, t.uiCreateEmployeeFailed, errorText));
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
        await upsertEmployeeCostRate(state.editEmployeeId, normalizedSalary as number);
      }

      state.setEmployeeFullName(payload.fullName);
      state.setEmployeeEmail(payload.email);
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
    try {
      await saveVacation({
        employeeId: state.editEmployeeId,
        startDate: payload.startDate,
        endDate: payload.endDate,
        type: payload.type,
      });
      await refreshData(state.token, state.selectedYear);
    } catch (error) {
      pushToast(resolveErrorMessage(error, t.uiCreateVacationFailed, errorText));
    }
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
    try {
      await saveVacation(
        {
          employeeId: state.editEmployeeId,
          startDate: payload.startDate,
          endDate: payload.endDate,
          type: payload.type,
        },
        vacationId,
      );
      await refreshData(state.token, state.selectedYear);
    } catch (error) {
      pushToast(resolveErrorMessage(error, t.uiCreateVacationFailed, errorText));
    }
  }

  async function handleDeleteVacationFromEmployeeModal(vacationId: string) {
    if (!state.token) return;
    try {
      await api.deleteVacation(vacationId, state.token);
      await refreshData(state.token, state.selectedYear);
    } catch (error) {
      pushToast(resolveErrorMessage(error, t.uiCreateVacationFailed, errorText));
    }
  }

  async function handleAssignVacationFromEmployeeModal() {
    if (!state.token || !state.editEmployeeId) return;
    try {
      await saveVacation({
        employeeId: state.editEmployeeId,
        startDate: state.vacationStartDate,
        endDate: state.vacationEndDate,
        type: state.vacationType,
      });
      await refreshData(state.token, state.selectedYear);
    } catch (error) {
      pushToast(resolveErrorMessage(error, t.uiCreateVacationFailed, errorText));
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
    } catch (error) {
      pushToast(resolveErrorMessage(error, t.uiCreateEmployeeFailed, errorText));
    }
  }

  async function handleCreateDepartment(name: string, colorHex?: string) {
    if (!state.token || !name.trim()) return;
    try {
      await api.createDepartment({ name: name.trim(), colorHex }, state.token);
      await refreshData(state.token, state.selectedYear);
    } catch (error) {
      pushToast(resolveErrorMessage(error, t.uiCreateDepartmentFailed, errorText));
    }
  }

  async function handleUpdateDepartment(departmentId: string, name: string, colorHex?: string) {
    if (!state.token || !name.trim()) return;
    try {
      await api.updateDepartment(departmentId, { name: name.trim(), colorHex }, state.token);
      await refreshData(state.token, state.selectedYear);
    } catch (error) {
      pushToast(resolveErrorMessage(error, t.uiUpdateDepartmentFailed, errorText));
    }
  }

  async function handleDeleteDepartment(departmentId: string) {
    if (!state.token) return;
    try {
      await api.deleteDepartment(departmentId, state.token);
      await refreshData(state.token, state.selectedYear);
    } catch (error) {
      pushToast(resolveErrorMessage(error, t.uiDeleteDepartmentFailed, errorText));
    }
  }

  async function handleCreateTeamTemplate(name: string, roleIds: string[]) {
    if (!state.token || !name.trim() || roleIds.length === 0) return;
    try {
      await api.createTeamTemplate(
        {
          name: name.trim(),
          roleIds,
        },
        state.token,
      );
      await refreshData(state.token, state.selectedYear);
    } catch (error) {
      pushToast(resolveErrorMessage(error, t.uiCreateTeamTemplateFailed, errorText));
    }
  }

  async function handleUpdateTeamTemplate(templateId: string, payload: { name?: string; roleIds?: string[] }) {
    if (!state.token) return;
    const trimmedName = payload.name?.trim();
    if (payload.name !== undefined && !trimmedName) return;
    if (payload.roleIds !== undefined && payload.roleIds.length === 0) return;

    try {
      await api.updateTeamTemplate(
        templateId,
        {
          ...(trimmedName !== undefined ? { name: trimmedName } : {}),
          ...(payload.roleIds !== undefined ? { roleIds: payload.roleIds } : {}),
        },
        state.token,
      );
      await refreshData(state.token, state.selectedYear);
    } catch (error) {
      pushToast(resolveErrorMessage(error, t.uiUpdateTeamTemplateFailed, errorText));
    }
  }

  async function handleDeleteTeamTemplate(templateId: string) {
    if (!state.token) return;
    try {
      await api.deleteTeamTemplate(templateId, state.token);
      await refreshData(state.token, state.selectedYear);
    } catch (error) {
      pushToast(resolveErrorMessage(error, t.uiDeleteTeamTemplateFailed, errorText));
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
    } catch (error) {
      pushToast(resolveErrorMessage(error, t.uiImportEmployeesFailed, errorText));
    }
  }

  async function handleCreateVacation(event: FormEvent) {
    event.preventDefault();
    if (!state.token || !state.vacationEmployeeId) return;
    try {
      await saveVacation({
        employeeId: state.vacationEmployeeId,
        startDate: state.vacationStartDate,
        endDate: state.vacationEndDate,
        type: state.vacationType,
      });
      await refreshData(state.token, state.selectedYear);
      state.setIsVacationModalOpen(false);
    } catch (error) {
      pushToast(resolveErrorMessage(error, t.uiCreateVacationFailed, errorText));
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
