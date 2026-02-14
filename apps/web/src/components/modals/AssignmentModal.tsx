import { FormEvent } from 'react';
import { ProjectListItem } from '../../api/client';
import { Employee } from '../../pages/app-types';

type AssignmentModalProps = {
  t: Record<string, string>;
  isOpen: boolean;
  projects: ProjectListItem[];
  employees: Employee[];
  assignmentProjectId: string;
  assignmentEmployeeId: string;
  assignmentStartDate: string;
  assignmentEndDate: string;
  assignmentPercent: number;
  onClose: () => void;
  onSubmit: (event: FormEvent) => Promise<void>;
  setAssignmentProjectId: (value: string) => void;
  setAssignmentEmployeeId: (value: string) => void;
  setAssignmentStartDate: (value: string) => void;
  setAssignmentEndDate: (value: string) => void;
  setAssignmentPercent: (value: number) => void;
};

export function AssignmentModal(props: AssignmentModalProps) {
  const {
    t,
    isOpen,
    projects,
    employees,
    assignmentProjectId,
    assignmentEmployeeId,
    assignmentStartDate,
    assignmentEndDate,
    assignmentPercent,
    onClose,
    onSubmit,
    setAssignmentProjectId,
    setAssignmentEmployeeId,
    setAssignmentStartDate,
    setAssignmentEndDate,
    setAssignmentPercent,
  } = props;

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div className="section-header">
          <h3>{t.assignEmployee}</h3>
          <button type="button" className="ghost-btn" onClick={onClose}>
            {t.close}
          </button>
        </div>
        <form className="timeline-form" onSubmit={onSubmit}>
          <label>
            {t.role}
            <select value={assignmentProjectId} onChange={(e) => setAssignmentProjectId(e.target.value)}>
              <option value="">{t.selectProject}</option>
              {projects.map((project) => (
                <option value={project.id} key={project.id}>
                  {project.code} · {project.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t.tabPersonnel}
            <select value={assignmentEmployeeId} onChange={(e) => setAssignmentEmployeeId(e.target.value)}>
              <option value="">{t.selectEmployee}</option>
              {employees.map((employee) => (
                <option value={employee.id} key={employee.id}>
                  {employee.fullName}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t.start}
            <input type="date" value={assignmentStartDate} onChange={(e) => setAssignmentStartDate(e.target.value)} />
          </label>
          <label>
            {t.end}
            <input type="date" value={assignmentEndDate} onChange={(e) => setAssignmentEndDate(e.target.value)} />
          </label>
          <label>
            {t.allocationPercent}
            <input
              type="number"
              min={0}
              max={100}
              value={assignmentPercent}
              onChange={(e) => setAssignmentPercent(Number(e.target.value))}
            />
          </label>
          <button type="submit">{t.assignEmployee}</button>
        </form>
      </div>
    </div>
  );
}
