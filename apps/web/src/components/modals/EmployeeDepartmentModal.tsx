import { FormEvent } from 'react';
import { DepartmentItem } from '../../api/client';

type EmployeeDepartmentModalProps = {
  t: Record<string, string>;
  isOpen: boolean;
  employeeName: string;
  employeeRoleName: string;
  departments: DepartmentItem[];
  employeeDepartmentId: string;
  onClose: () => void;
  onSubmit: (event: FormEvent) => Promise<void>;
  setEmployeeDepartmentId: (value: string) => void;
};

export function EmployeeDepartmentModal(props: EmployeeDepartmentModalProps) {
  const {
    t,
    isOpen,
    employeeName,
    employeeRoleName,
    departments,
    employeeDepartmentId,
    onClose,
    onSubmit,
    setEmployeeDepartmentId,
  } = props;

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div className="section-header">
          <h3>{employeeName}</h3>
          <button type="button" className="ghost-btn" onClick={onClose}>
            {t.close}
          </button>
        </div>
        <form className="timeline-form" onSubmit={onSubmit}>
          <label>
            {t.role}
            <input value={employeeRoleName} readOnly />
          </label>
          <label>
            {t.department}
            <select value={employeeDepartmentId} onChange={(event) => setEmployeeDepartmentId(event.target.value)}>
              <option value="">{t.selectDepartment}</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </label>
          <button type="submit">{t.save}</button>
        </form>
      </div>
    </div>
  );
}
