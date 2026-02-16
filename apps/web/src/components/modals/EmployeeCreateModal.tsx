import { FormEvent } from 'react';
import { DepartmentItem } from '../../api/client';
import { Role } from '../../pages/app-types';
import { EmployeeProfileFields } from './EmployeeProfileFields';

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
          <EmployeeProfileFields
            t={t}
            roles={roles}
            departments={departments}
            gradeOptions={gradeOptions}
            fullName={employeeFullName}
            email={employeeEmail}
            roleId={employeeRoleId}
            departmentId={employeeDepartmentId}
            grade={employeeGrade}
            status={employeeStatus}
            salary={employeeSalary}
            setFullName={setEmployeeFullName}
            setEmail={setEmployeeEmail}
            setRoleId={setEmployeeRoleId}
            setDepartmentId={setEmployeeDepartmentId}
            setGrade={setEmployeeGrade}
            setStatus={setEmployeeStatus}
            setSalary={setEmployeeSalary}
          />
          <button type="submit">{t.createWorker}</button>
        </form>
      </div>
    </div>
  );
}
