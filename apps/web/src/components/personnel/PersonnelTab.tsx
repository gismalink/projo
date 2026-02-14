import { useEffect, useState } from 'react';
import { Employee, Role } from '../../pages/app-types';
import { VacationItem } from '../../api/client';

type RoleStat = {
  roleName: string;
  roleShortName: string;
  count: number;
  colorHex: string;
};

type PersonnelTabProps = {
  t: Record<string, string>;
  departmentGroups: [string, Employee[]][];
  roleStats: RoleStat[];
  selectedRoleFilters: string[];
  vacationsByEmployee: Record<string, VacationItem[]>;
  roleByName: Map<string, Role>;
  utilizationByEmployee: Record<string, number>;
  toggleRoleFilter: (roleName: string) => void;
  clearRoleFilters: () => void;
  openDepartmentsModal: () => void;
  openVacationModal: (employee: Employee) => void;
  openEmployeeModal: () => void;
  openEmployeeImportModal: () => void;
  roleColorOrDefault: (colorHex?: string | null) => string;
  utilizationColor: (value: number) => string;
};

export function PersonnelTab(props: PersonnelTabProps) {
  const {
    t,
    departmentGroups,
    roleStats,
    selectedRoleFilters,
    vacationsByEmployee,
    roleByName,
    utilizationByEmployee,
    toggleRoleFilter,
    clearRoleFilters,
    openDepartmentsModal,
    openVacationModal,
    openEmployeeModal,
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
          <h2>{t.employeesList}</h2>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button type="button" title={t.departmentsList} aria-label={t.departmentsList} onClick={openDepartmentsModal}>
              🏢
            </button>
            <button type="button" title={t.importEmployeesTooltip} aria-label={t.importEmployeesTooltip} onClick={openEmployeeImportModal}>
              ⬆
            </button>
            <button type="button" title={t.createEmployeeTooltip} aria-label={t.createEmployeeTooltip} onClick={openEmployeeModal}>
              +
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
              🏢
            </button>
            {departmentGroups.map(([department, departmentEmployees]) => (
              <button
                type="button"
                key={department}
                className={selectedDepartment === department ? 'role-tag active' : 'role-tag'}
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
                style={{ borderColor: tag.colorHex, background: active ? `${tag.colorHex}22` : '#fff' }}
                onClick={() => toggleRoleFilter(tag.roleName)}
                title={`${tag.roleName} (${tag.count})`}
                aria-label={`${tag.roleName} (${tag.count})`}
              >
                <span className="dot" style={{ background: tag.colorHex }} />
                {tag.roleShortName} ({tag.count})
              </button>
            );
          })}
          {hasActiveFilters ? (
            <button
              type="button"
              className="filter-clear-icon-btn"
              title={t.clearFilter}
              aria-label={t.clearFilter}
              onClick={clearAllFilters}
            >
              ⟲
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

                return (
                  <article className="employee-card" key={employee.id}>
                    <div className="employee-card-header">
                      <strong>{employee.fullName}</strong>
                      <button
                        type="button"
                        className="ghost-btn"
                        title={t.addVacationTooltip}
                        aria-label={t.addVacationTooltip}
                        onClick={() => openVacationModal(employee)}
                      >
                        🗓
                      </button>
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
