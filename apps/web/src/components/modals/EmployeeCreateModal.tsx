import { FormEvent } from 'react';
import { DepartmentItem } from '../../api/client';
import { Role } from '../../pages/app-types';

type EmployeeCreateModalProps = {
  t: Record<string, string>;
  roles: Role[];
  departments: DepartmentItem[];
  isOpen: boolean;
  employeeFullName: string;
  employeeEmail: string;
  employeeRoleId: string;
  employeeDepartmentId: string;
  employeeGrade: string;
  employeeStatus: string;
  employeeSalary: string;
  gradeOptions: string[];
  onClose: () => void;
  onSubmit: (event: FormEvent) => Promise<void>;
  setEmployeeFullName: (value: string) => void;
  setEmployeeEmail: (value: string) => void;
  setEmployeeRoleId: (value: string) => void;
  setEmployeeDepartmentId: (value: string) => void;
  setEmployeeGrade: (value: string) => void;
  setEmployeeStatus: (value: string) => void;
  setEmployeeSalary: (value: string) => void;
};

export function EmployeeCreateModal(props: EmployeeCreateModalProps) {
  const {
    t,
    roles,
    departments,
    isOpen,
    employeeFullName,
    employeeEmail,
    employeeRoleId,
    employeeDepartmentId,
    employeeGrade,
    employeeStatus,
    employeeSalary,
    gradeOptions,
    onClose,
    onSubmit,
    setEmployeeFullName,
    setEmployeeEmail,
    setEmployeeRoleId,
    setEmployeeDepartmentId,
    setEmployeeGrade,
    setEmployeeStatus,
    setEmployeeSalary,
  } = props;

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div className="section-header">
          <h3>{t.addEmployee}</h3>
          <button type="button" className="ghost-btn" onClick={onClose}>
            {t.close}
          </button>
        </div>
        <form className="timeline-form" onSubmit={onSubmit}>
          <label>
            {t.fullName}
            <input value={employeeFullName} onChange={(e) => setEmployeeFullName(e.target.value)} />
          </label>
          <label>
            {t.email}
            <input value={employeeEmail} onChange={(e) => setEmployeeEmail(e.target.value)} />
          </label>
          <label>
            {t.role}
            <select value={employeeRoleId} onChange={(e) => setEmployeeRoleId(e.target.value)}>
              <option value="">{t.selectRole}</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t.department}
            <select value={employeeDepartmentId} onChange={(e) => setEmployeeDepartmentId(e.target.value)}>
              <option value="">{t.selectDepartment}</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t.grade}
            <select value={employeeGrade} onChange={(e) => setEmployeeGrade(e.target.value)}>
              <option value="">—</option>
              {gradeOptions.map((gradeOption) => (
                <option key={gradeOption} value={gradeOption}>
                  {gradeOption}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t.status}
            <select value={employeeStatus} onChange={(e) => setEmployeeStatus(e.target.value)}>
              <option value="active">{t.statusActive}</option>
              <option value="inactive">{t.statusInactive}</option>
            </select>
          </label>
          <label>
            {t.salaryPerMonth}
            <input
              type="number"
              min={0}
              step="1"
              value={employeeSalary}
              onChange={(e) => setEmployeeSalary(e.target.value)}
              onBlur={(e) => {
                const normalized = e.target.value.replace(',', '.').trim();
                if (!normalized) return;
                const parsed = Number(normalized);
                if (!Number.isFinite(parsed) || parsed <= 0) return;
                setEmployeeSalary(String(Math.round(parsed)));
              }}
            />
          </label>
          <button type="submit">{t.createWorker}</button>
        </form>
      </div>
    </div>
  );
}
