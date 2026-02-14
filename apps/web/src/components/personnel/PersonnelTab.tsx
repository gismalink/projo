import { Employee, Role } from '../../pages/app-types';
import { VacationItem } from '../../api/client';

type RoleStat = {
  roleName: string;
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
  openVacationModal: (employee: Employee) => void;
  openEmployeeModal: () => void;
  roleColorOrDefault: (colorHex?: string | null) => string;
  utilizationColor: (value: number) => string;
  isoToInputDate: (value: string) => string;
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
    openVacationModal,
    openEmployeeModal,
    roleColorOrDefault,
    utilizationColor,
    isoToInputDate,
  } = props;

  return (
    <section className="grid">
      <article className="card">
        <div className="section-header">
          <h2>{t.employeesList}</h2>
          <button type="button" title={t.createEmployeeTooltip} aria-label={t.createEmployeeTooltip} onClick={openEmployeeModal}>
            +
          </button>
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
              >
                <span className="dot" style={{ background: tag.colorHex }} />
                {tag.roleName} ({tag.count})
              </button>
            );
          })}
          {selectedRoleFilters.length > 0 ? (
            <button type="button" className="ghost-btn" onClick={clearRoleFilters}>
              {t.clearFilter}
            </button>
          ) : null}
        </div>

        {departmentGroups.map(([department, departmentEmployees]) => (
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
                            .map((vacation) => `${isoToInputDate(vacation.startDate)} - ${isoToInputDate(vacation.endDate)}`)
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
