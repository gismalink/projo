import { useMemo } from 'react';
import { AppState } from './useAppState';
import { daysInYear, overlapDaysInYear, roleColorOrDefault } from './app-helpers';

export function useAppDerivedData(state: AppState, t: Record<string, string>) {
  const sortedTimeline = useMemo(
    () => [...state.timeline].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()),
    [state.timeline],
  );

  const vacationsByEmployee = useMemo(() => {
    const map: Record<string, typeof state.vacations> = {};
    for (const vacation of state.vacations) {
      if (!map[vacation.employeeId]) map[vacation.employeeId] = [];
      map[vacation.employeeId].push(vacation);
    }
    for (const employeeId of Object.keys(map)) {
      map[employeeId].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
    }
    return map;
  }, [state.vacations]);

  const roleByName = useMemo(() => {
    const map = new Map<string, (typeof state.roles)[number]>();
    for (const role of state.roles) map.set(role.name, role);
    return map;
  }, [state.roles]);

  const roleStats = useMemo(() => {
    const counts = new Map<string, number>();
    for (const employee of state.employees) {
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
  }, [state.employees, roleByName, t.noRole]);

  const filteredEmployees = useMemo(() => {
    if (state.selectedRoleFilters.length === 0) return state.employees;
    const selected = new Set(state.selectedRoleFilters);
    return state.employees.filter((employee) => selected.has(employee.role?.name ?? t.noRole));
  }, [state.employees, state.selectedRoleFilters, t.noRole]);

  const departmentGroups = useMemo(() => {
    const map: Record<string, typeof filteredEmployees> = {};
    for (const employee of filteredEmployees) {
      const dep = employee.department?.name ?? t.unassignedDepartment;
      if (!map[dep]) map[dep] = [];
      map[dep].push(employee);
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredEmployees, t.unassignedDepartment]);

  const utilizationByEmployee = useMemo(() => {
    const map: Record<string, number> = {};
    const totalDays = daysInYear(state.selectedYear);

    for (const assignment of state.assignments) {
      const start = new Date(assignment.assignmentStartDate);
      const end = new Date(assignment.assignmentEndDate);
      const overlapDays = overlapDaysInYear(start, end, state.selectedYear);
      if (overlapDays <= 0) continue;

      const allocation = Number(assignment.allocationPercent);
      const weighted = (allocation * overlapDays) / totalDays;
      map[assignment.employeeId] = Number(((map[assignment.employeeId] ?? 0) + weighted).toFixed(1));
    }

    return map;
  }, [state.assignments, state.selectedYear]);

  return {
    sortedTimeline,
    vacationsByEmployee,
    roleByName,
    roleStats,
    departmentGroups,
    utilizationByEmployee,
  };
}
