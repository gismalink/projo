import { useEffect, useState } from 'react';
import { DepartmentItem } from '../../api/client';

type DepartmentsModalProps = {
  t: Record<string, string>;
  isOpen: boolean;
  departments: DepartmentItem[];
  onClose: () => void;
  onCreate: (name: string) => Promise<void>;
  onUpdate: (departmentId: string, name: string) => Promise<void>;
  onDelete: (departmentId: string) => Promise<void>;
};

export function DepartmentsModal(props: DepartmentsModalProps) {
  const { t, isOpen, departments, onClose, onCreate, onUpdate, onDelete } = props;
  const [newDepartmentName, setNewDepartmentName] = useState('');
  const [draftNames, setDraftNames] = useState<Record<string, string>>({});

  useEffect(() => {
    setDraftNames(Object.fromEntries(departments.map((department) => [department.id, department.name])));
  }, [departments]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div className="section-header">
          <h3>{t.departmentsList}</h3>
          <button type="button" className="ghost-btn" onClick={onClose}>
            {t.close}
          </button>
        </div>

        <div className="department-manage-row">
          <input
            value={newDepartmentName}
            placeholder={t.department}
            onChange={(event) => setNewDepartmentName(event.target.value)}
          />
          <button
            type="button"
            onClick={() => {
              const nextName = newDepartmentName.trim();
              if (!nextName) return;
              void onCreate(nextName);
              setNewDepartmentName('');
            }}
            title={t.addDepartment}
            aria-label={t.addDepartment}
          >
            +
          </button>
        </div>

        <div className="department-manage-list">
          {departments.map((department) => {
            const draftName = draftNames[department.id] ?? department.name;
            return (
              <div className="department-manage-row" key={department.id}>
                <input
                  value={draftName}
                  onChange={(event) =>
                    setDraftNames((prev) => ({
                      ...prev,
                      [department.id]: event.target.value,
                    }))
                  }
                />
                <button
                  type="button"
                  className="ghost-btn"
                  title={t.save}
                  aria-label={t.save}
                  onClick={() => {
                    const nextName = draftName.trim();
                    if (!nextName || nextName === department.name) return;
                    void onUpdate(department.id, nextName);
                  }}
                >
                  ✓
                </button>
                <button
                  type="button"
                  className="ghost-btn"
                  title={t.deleteDepartment}
                  aria-label={t.deleteDepartment}
                  onClick={() => {
                    if (!window.confirm(t.confirmDeleteDepartment)) return;
                    void onDelete(department.id);
                  }}
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
