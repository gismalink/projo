import { DepartmentItem } from '../../api/client';
import { Role } from '../../pages/app-types';

type EmployeeProfileFieldsProps = {
  t: Record<string, string>;
  roles: Role[];
  departments: DepartmentItem[];
  gradeOptions: string[];
  fullName: string;
  email: string;
  roleId: string;
  departmentId: string;
  grade: string;
  status: string;
  salary: string;
  compactMeta?: boolean;
  setFullName: (value: string) => void;
  setEmail: (value: string) => void;
  setRoleId: (value: string) => void;
  setDepartmentId: (value: string) => void;
  setGrade: (value: string) => void;
  setStatus: (value: string) => void;
  setSalary: (value: string) => void;
};

export function EmployeeProfileFields({
  t,
  roles,
  departments,
  gradeOptions,
  fullName,
  email,
  roleId,
  departmentId,
  grade,
  status,
  salary,
  compactMeta = false,
  setFullName,
  setEmail,
  setRoleId,
  setDepartmentId,
  setGrade,
  setStatus,
  setSalary,
}: EmployeeProfileFieldsProps) {
  const departmentField = (
    <label>
      {t.department}
      <select value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}>
        <option value="">{t.selectDepartment}</option>
        {departments.map((department) => (
          <option key={department.id} value={department.id}>
            {department.name}
          </option>
        ))}
      </select>
    </label>
  );

  const roleField = (
    <label>
      {t.role}
      <select value={roleId} onChange={(event) => setRoleId(event.target.value)}>
        <option value="">{t.selectRole}</option>
        {roles.map((role) => (
          <option key={role.id} value={role.id}>
            {role.name}
          </option>
        ))}
      </select>
    </label>
  );

  const gradeField = (
    <label>
      {t.grade}
      <select value={grade} onChange={(event) => setGrade(event.target.value)}>
        <option value="">—</option>
        {gradeOptions.map((gradeOption) => (
          <option key={gradeOption} value={gradeOption}>
            {gradeOption}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <>
      <label>
        {t.fullName}
        <input value={fullName} onChange={(event) => setFullName(event.target.value)} />
      </label>
      <label>
        {t.email}
        <input value={email} onChange={(event) => setEmail(event.target.value)} />
      </label>

      {compactMeta ? (
        <div className="employee-meta-compact">
          {departmentField}
          {roleField}
          {gradeField}
        </div>
      ) : (
        <>
          {roleField}
          {departmentField}
          {gradeField}
        </>
      )}

      <label>
        {t.status}
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
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
          value={salary}
          onChange={(event) => setSalary(event.target.value)}
          onBlur={(event) => {
            const normalized = event.target.value.replace(',', '.').trim();
            if (!normalized) return;
            const parsed = Number(normalized);
            if (!Number.isFinite(parsed) || parsed <= 0) return;
            setSalary(String(Math.round(parsed)));
          }}
        />
      </label>
    </>
  );
}
