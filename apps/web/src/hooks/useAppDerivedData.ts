import { useMemo } from 'react';
import { AppState } from './useAppState';
import { daysInYear, overlapDaysInYear, roleColorOrDefault } from './app-helpers';

export function useAppDerivedData(state: AppState, t: Record<string, string>) {
  const sortedTimeline = useMemo(() => {
    const byId = new Map(state.timeline.map((row) => [row.id, row]));
    const ordered = state.timelineOrder.map((id) => byId.get(id)).filter((row): row is (typeof state.timeline)[number] => Boolean(row));
    const missing = state.timeline.filter((row) => !state.timelineOrder.includes(row.id));
    return [...ordered, ...missing];
  }, [state.timeline, state.timelineOrder]);

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
        roleShortName: roleByName.get(roleNameValue)?.shortName ?? roleNameValue,
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

  const monthlyUtilizationByEmployee = useMemo(() => {
    const totalsByEmployee: Record<string, number[]> = {};
    const year = state.selectedYear;

    const monthRanges = Array.from({ length: 12 }, (_, monthIndex) => {
      const start = new Date(Date.UTC(year, monthIndex, 1));
      const end = new Date(Date.UTC(year, monthIndex + 1, 0));
      const days = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
      return { start, end, days };
    });

    for (const assignment of state.assignments) {
      const allocation = Number(assignment.allocationPercent);
      if (!Number.isFinite(allocation) || allocation <= 0) continue;

      const start = new Date(assignment.assignmentStartDate);
      const end = new Date(assignment.assignmentEndDate);
      if (!totalsByEmployee[assignment.employeeId]) {
        totalsByEmployee[assignment.employeeId] = Array.from({ length: 12 }, () => 0);
      }

      for (let monthIndex = 0; monthIndex < 12; monthIndex += 1) {
        const month = monthRanges[monthIndex];
        const overlapStart = start > month.start ? start : month.start;
        const overlapEnd = end < month.end ? end : month.end;
        if (overlapEnd < overlapStart) continue;

        const overlapDays = Math.floor((overlapEnd.getTime() - overlapStart.getTime()) / 86400000) + 1;
        const weighted = (allocation * overlapDays) / month.days;
        totalsByEmployee[assignment.employeeId][monthIndex] += weighted;
      }
    }

    const normalized: Record<string, number[]> = {};
    for (const [employeeId, monthlyTotals] of Object.entries(totalsByEmployee)) {
      normalized[employeeId] = monthlyTotals.map((value) => Number(value.toFixed(1)));
    }

    return normalized;
  }, [state.assignments, state.selectedYear]);

  return {
    sortedTimeline,
    vacationsByEmployee,
    roleByName,
    roleStats,
    departmentGroups,
    utilizationByEmployee,
    monthlyUtilizationByEmployee,
  };
}
