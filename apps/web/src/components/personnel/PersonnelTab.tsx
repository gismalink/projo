import { useEffect, useState } from 'react';
import { Employee, Role } from '../../pages/app-types';
import { DepartmentItem, VacationItem } from '../../api/client';
import { Icon } from '../Icon';

type RoleStat = {
  roleName: string;
  roleShortName: string;
  count: number;
  colorHex: string;
};

type PersonnelTabProps = {
  t: Record<string, string>;
  departments: DepartmentItem[];
  departmentGroups: [string, Employee[]][];
  roleStats: RoleStat[];
  months: string[];
  selectedRoleFilters: string[];
  vacationsByEmployee: Record<string, VacationItem[]>;
  roleByName: Map<string, Role>;
  utilizationByEmployee: Record<string, number>;
  monthlyUtilizationByEmployee: Record<string, number[]>;
  toggleRoleFilter: (roleName: string) => void;
  clearRoleFilters: () => void;
  openEmployeeModal: (employee: Employee) => void;
  openEmployeeCreateModal: () => void;
  openEmployeeImportModal: () => void;
  roleColorOrDefault: (colorHex?: string | null) => string;
  utilizationColor: (value: number) => string;
};

export function PersonnelTab(props: PersonnelTabProps) {
  const {
    t,
    departments,
    departmentGroups,
    roleStats,
    months,
    selectedRoleFilters,
    vacationsByEmployee,
    roleByName,
    utilizationByEmployee,
    monthlyUtilizationByEmployee,
    toggleRoleFilter,
    clearRoleFilters,
    openEmployeeModal,
    openEmployeeCreateModal,
    openEmployeeImportModal,
    roleColorOrDefault,
    utilizationColor,
  } = props;

  const locale = t.prev === 'Назад' ? 'ru-RU' : 'en-US';
  const vacationDateFormatter = new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  const formatVacationDate = (value: string) => vacationDateFormatter.format(new Date(value));
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const departmentOptions = departmentGroups.map(([department]) => department);
  const totalEmployeesCount = departmentGroups.reduce((sum, [, employees]) => sum + employees.length, 0);
  const departmentColorByName = new Map<string, string>();
  for (const department of departments) {
    if (department.colorHex && /^#[0-9A-Fa-f]{6}$/.test(department.colorHex)) {
      departmentColorByName.set(department.name, department.colorHex);
    }
  }

  useEffect(() => {
    if (selectedDepartment === 'all') return;
    if (!departmentOptions.includes(selectedDepartment)) {
      setSelectedDepartment('all');
    }
  }, [departmentOptions, selectedDepartment]);

  const visibleDepartmentGroups =
    selectedDepartment === 'all'
      ? departmentGroups
      : departmentGroups.filter(([department]) => department === selectedDepartment);
  const hasActiveFilters = selectedRoleFilters.length > 0 || selectedDepartment !== 'all';
  const compactFilterLabel = (value: string) => (value.length > 10 ? `${value.slice(0, 8)}…` : value);

  const clearAllFilters = () => {
    clearRoleFilters();
    setSelectedDepartment('all');
  };

  return (
    <section className="grid">
      <article className="card">
        <div className="section-header">
          <h2>{t.employeesList} ({totalEmployeesCount})</h2>
          <div className="team-actions">
            <button
              type="button"
              className="create-role-icon-btn team-icon-btn"
              title={t.importEmployeesTooltip}
              aria-label={t.importEmployeesTooltip}
              onClick={openEmployeeImportModal}
            >
              <Icon name="upload" />
            </button>
            <button
              type="button"
              className="create-role-icon-btn team-icon-btn"
              title={t.createEmployeeTooltip}
              aria-label={t.createEmployeeTooltip}
              onClick={openEmployeeCreateModal}
            >
              <Icon name="plus" />
            </button>
          </div>
        </div>

        <div className="department-filter-row">
          <div className="role-filter-panel" role="group" aria-label={t.selectDepartment}>
            <button
              type="button"
              className={selectedDepartment === 'all' ? 'role-tag active' : 'role-tag'}
              onClick={() => setSelectedDepartment('all')}
              title={`${t.department}: ${t.clearFilter}`}
              aria-label={`${t.department}: ${t.clearFilter}`}
            >
              <Icon name="building" />
            </button>
            {departmentGroups.map(([department, departmentEmployees]) => (
              <button
                type="button"
                key={department}
                className={selectedDepartment === department ? 'role-tag active' : 'role-tag'}
                style={{
                  borderColor: departmentColorByName.get(department) ?? '#B6BDC6',
                  background: selectedDepartment === department ? (departmentColorByName.get(department) ?? '#B6BDC6') : '#fff',
                  color: selectedDepartment === department ? '#fff' : (departmentColorByName.get(department) ?? '#6E7B8A'),
                }}
                onClick={() => setSelectedDepartment(department)}
                title={`${department} (${departmentEmployees.length})`}
                aria-label={`${department} (${departmentEmployees.length})`}
              >
                {compactFilterLabel(department)} ({departmentEmployees.length})
              </button>
            ))}
          </div>
        </div>

        <div className="role-filter-panel">
          {roleStats.map((tag) => {
            const active = selectedRoleFilters.includes(tag.roleName);
            return (
              <button
                type="button"
                key={tag.roleName}
                className={active ? 'role-tag active' : 'role-tag'}
                style={{
                  borderColor: tag.colorHex,
                  background: active ? tag.colorHex : '#fff',
                  color: active ? '#fff' : tag.colorHex,
                }}
                onClick={() => toggleRoleFilter(tag.roleName)}
                title={`${tag.roleName} (${tag.count})`}
                aria-label={`${tag.roleName} (${tag.count})`}
              >
                <span className="dot" style={{ background: active ? '#fff' : tag.colorHex }} />
                {tag.roleShortName} ({tag.count})
              </button>
            );
          })}
          {hasActiveFilters ? (
            <button
              type="button"
              className="create-role-icon-btn team-icon-btn"
              title={t.clearFilter}
              aria-label={t.clearFilter}
              onClick={clearAllFilters}
            >
              <Icon name="refresh" />
            </button>
          ) : null}
        </div>

        {visibleDepartmentGroups.map(([department, departmentEmployees]) => (
          <section key={department}>
            <h3>{department}</h3>
            <div className="employee-cards">
              {departmentEmployees.map((employee) => {
                const employeeVacations = vacationsByEmployee[employee.id] ?? [];
                const roleColor = roleColorOrDefault(roleByName.get(employee.role?.name ?? '')?.colorHex);
                const util = utilizationByEmployee[employee.id] ?? 0;
                const monthlyUtilization = monthlyUtilizationByEmployee[employee.id] ?? Array.from({ length: 12 }, () => 0);

                return (
                  <article className="employee-card" key={employee.id}>
                    <div className="employee-card-header">
                      <strong>{employee.fullName}</strong>
                      <div className="employee-card-actions">
                        <button
                          type="button"
                          className="create-role-icon-btn team-icon-btn"
                          title={t.editProfileTooltip || 'Редактировать профиль'}
                          aria-label={t.editProfileTooltip || 'Редактировать профиль'}
                          onClick={() => openEmployeeModal(employee)}
                        >
                          <Icon name="edit" />
                        </button>
                      </div>
                    </div>
                    <span>
                      <span className="role-badge" style={{ background: `${roleColor}22`, color: roleColor }}>
                        {employee.role?.name ?? t.noRole}
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
                            .map((vacation) => `${formatVacationDate(vacation.startDate)} - ${formatVacationDate(vacation.endDate)}`)
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
                      <div className="employee-monthly-load" aria-label={t.monthlyLoadLabel}>
                        {monthlyUtilization.map((value, index) => (
                          <span
                            key={`${employee.id}-month-load-${index}`}
                            className="employee-monthly-load-bar"
                            style={{
                              height: `${Math.max(8, Math.min(100, value))}%`,
                              background: utilizationColor(value),
                            }}
                            title={`${months[index] ?? String(index + 1)}: ${value.toFixed(1)}%`}
                          />
                        ))}
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
  );
}
