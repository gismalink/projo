import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../Icon';
import { Role } from '../../pages/app-types';
import { DepartmentItem } from '../../api/client';
import { CustomColorPicker, normalizeHex } from './CustomColorPicker';

type UpdateRolePayload = {
  name?: string;
  shortName?: string;
  description?: string;
  level?: number;
  colorHex?: string;
};

type RolesTabProps = {
  t: Record<string, string>;
  roles: Role[];
  departments: DepartmentItem[];
  gradeOptions: string[];
  roleName: string;
  roleShortName: string;
  roleDescription: string;
  roleLevel: number;
  onCreateRole: (event: FormEvent) => Promise<void>;
  onUpdateRole: (roleId: string, payload: UpdateRolePayload) => Promise<void>;
  setRoleName: (value: string) => void;
  setRoleShortName: (value: string) => void;
  setRoleDescription: (value: string) => void;
  setRoleLevel: (value: number) => void;
  roleColorOrDefault: (colorHex?: string | null) => string;
  onCreateDepartment: (name: string, colorHex: string) => Promise<void>;
  onUpdateDepartment: (departmentId: string, name: string, colorHex: string) => Promise<void>;
  onDeleteDepartment: (departmentId: string) => Promise<void>;
  onAddGrade: (grade: string) => void;
  onRenameGrade: (prevGrade: string, nextGrade: string) => void;
  onDeleteGrade: (grade: string) => void;
};

type RoleDraft = {
  name: string;
  shortName: string;
  description: string;
  level: number;
  colorHex: string;
};

export function RolesTab(props: RolesTabProps) {
  const {
    t,
    roles,
    departments,
    gradeOptions,
    roleName,
    roleShortName,
    roleDescription,
    roleLevel,
    onCreateRole,
    onUpdateRole,
    setRoleName,
    setRoleShortName,
    setRoleDescription,
    setRoleLevel,
    roleColorOrDefault,
    onCreateDepartment,
    onUpdateDepartment,
    onDeleteDepartment,
    onAddGrade,
    onRenameGrade,
    onDeleteGrade,
  } = props;

  const [isCreateRoleOpen, setIsCreateRoleOpen] = useState(false);
  const [roleDrafts, setRoleDrafts] = useState<Record<string, RoleDraft>>({});
  const [newDepartmentName, setNewDepartmentName] = useState('');
  const [newDepartmentColor, setNewDepartmentColor] = useState('#7A8A9A');
  const [departmentDrafts, setDepartmentDrafts] = useState<Record<string, { name: string; colorHex: string }>>({});
  const [newGradeName, setNewGradeName] = useState('');
  const [gradeDrafts, setGradeDrafts] = useState<Record<string, string>>({});
  const saveTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const roleById = useMemo(() => {
    const map = new Map<string, Role>();
    for (const role of roles) map.set(role.id, role);
    return map;
  }, [roles]);

  useEffect(() => {
    setRoleDrafts((prev) => {
      const next: Record<string, RoleDraft> = {};
      for (const role of roles) {
        const current = prev[role.id];
        next[role.id] = {
          name: current?.name ?? role.name,
          shortName: current?.shortName ?? (role.shortName ?? ''),
          description: current?.description ?? role.description,
          level: current?.level ?? role.level,
          colorHex: current?.colorHex ?? roleColorOrDefault(role.colorHex),
        };
      }
      return next;
    });
  }, [roles, roleColorOrDefault]);

  useEffect(() => {
    setDepartmentDrafts(
      Object.fromEntries(
        departments.map((department) => [
          department.id,
          {
            name: department.name,
            colorHex: roleColorOrDefault(department.colorHex),
          },
        ]),
      ),
    );
  }, [departments, roleColorOrDefault]);

  useEffect(() => {
    setGradeDrafts(Object.fromEntries(gradeOptions.map((grade) => [grade, grade])));
  }, [gradeOptions]);

  useEffect(() => {
    return () => {
      for (const timer of Object.values(saveTimersRef.current)) {
        clearTimeout(timer);
      }
    };
  }, []);

  const scheduleRoleAutosave = (roleId: string, draft: RoleDraft) => {
    const existing = saveTimersRef.current[roleId];
    if (existing) clearTimeout(existing);

    saveTimersRef.current[roleId] = setTimeout(() => {
      const role = roleById.get(roleId);
      if (!role) return;

      const normalizedShortName = draft.shortName.trim();
      const normalizedColorHex = normalizeHex(draft.colorHex);
      const payload: UpdateRolePayload = {
        name: draft.name,
        shortName: normalizedShortName,
        description: draft.description,
        level: draft.level,
      };
      if (normalizedColorHex) {
        payload.colorHex = normalizedColorHex;
      }

      const unchanged =
        role.name === payload.name &&
        (role.shortName ?? '') === payload.shortName &&
        role.description === payload.description &&
        role.level === payload.level &&
        roleColorOrDefault(role.colorHex) === (payload.colorHex ?? roleColorOrDefault(role.colorHex));

      if (unchanged) return;
      void onUpdateRole(roleId, payload);
    }, 420);
  };

  const updateRoleDraft = (roleId: string, patch: Partial<RoleDraft>) => {
    setRoleDrafts((prev) => {
      const current = prev[roleId] ?? {
        name: '',
        shortName: '',
        description: '',
        level: 1,
        colorHex: roleColorOrDefault(),
      };
      const next = { ...current, ...patch };
      scheduleRoleAutosave(roleId, next);
      return {
        ...prev,
        [roleId]: next,
      };
    });
  };

  const handleCreateRoleSubmit = async (event: FormEvent) => {
    await onCreateRole(event);
    setIsCreateRoleOpen(false);
  };

  const nextDepartmentName = newDepartmentName.trim();
  const nextGradeName = newGradeName.trim();

  return (
    <section className="grid">
      <article className="card">
        <div className="section-header roles-list-header">
          <h2>{t.rolesList}</h2>
          <button
            type="button"
            className="create-role-icon-btn"
            onClick={() => setIsCreateRoleOpen(true)}
            title={t.createRole}
            aria-label={t.createRole}
          >
            <Icon name="plus" />
          </button>
        </div>
        <div className="role-table-head" aria-hidden="true">
          <span>{t.name}</span>
          <span>{t.shortName}</span>
          <span>{t.description}</span>
          <span>{t.level}</span>
          <span>{t.color}</span>
        </div>
        <ul className="roles-list">
          {roles.map((role) => (
            <li key={role.id} className="role-row">
              <div className="role-fields">
                <input
                  aria-label={t.name}
                  value={roleDrafts[role.id]?.name ?? role.name}
                  onChange={(event) => updateRoleDraft(role.id, { name: event.target.value })}
                />
                <input
                  aria-label={t.shortName}
                  value={roleDrafts[role.id]?.shortName ?? (role.shortName ?? '')}
                  onChange={(event) => updateRoleDraft(role.id, { shortName: event.target.value })}
                />
                <input
                  aria-label={t.description}
                  value={roleDrafts[role.id]?.description ?? role.description}
                  onChange={(event) => updateRoleDraft(role.id, { description: event.target.value })}
                />
                <input
                  aria-label={t.level}
                  className="role-level-input"
                  type="number"
                  min={1}
                  value={roleDrafts[role.id]?.level ?? role.level}
                  onChange={(event) => {
                    const nextLevel = Number(event.target.value);
                    updateRoleDraft(role.id, { level: Number.isFinite(nextLevel) && nextLevel > 0 ? nextLevel : 1 });
                  }}
                />
              </div>
              <div className="role-color-editor">
                {(() => {
                  const draftColor = roleDrafts[role.id]?.colorHex ?? roleColorOrDefault(role.colorHex);
                  return (
                    <CustomColorPicker
                      value={draftColor}
                      label={t.color}
                      copyLabel={t.copyHex}
                      fallbackHex={roleColorOrDefault(role.colorHex)}
                      onChange={(nextHex) => updateRoleDraft(role.id, { colorHex: nextHex })}
                    />
                  );
                })()}
              </div>
            </li>
          ))}
        </ul>

        <hr className="separator" />

        <div className="settings-columns">
          <section className="settings-column">
            <div className="section-header roles-list-header">
              <h3>{t.departmentsList}</h3>
            </div>
            <div className="department-manage-row create department-manage-row-color">
              <input
                className="department-manage-input"
                value={newDepartmentName}
                placeholder={t.department}
                onChange={(event) => setNewDepartmentName(event.target.value)}
              />
              <div className="role-color-editor">
                <CustomColorPicker
                  value={newDepartmentColor}
                  label={t.color}
                  copyLabel={t.copyHex}
                  fallbackHex="#7A8A9A"
                  onChange={setNewDepartmentColor}
                />
              </div>
              <button
                type="button"
                className="department-manage-action primary"
                disabled={!nextDepartmentName}
                onClick={() => {
                  if (!nextDepartmentName) return;
                  void onCreateDepartment(nextDepartmentName, newDepartmentColor);
                  setNewDepartmentName('');
                }}
                title={t.addDepartment}
                aria-label={t.addDepartment}
              >
                <Icon name="plus" />
              </button>
            </div>
            <div className="department-manage-list">
              {departments.map((department) => {
                const draft = departmentDrafts[department.id] ?? {
                  name: department.name,
                  colorHex: roleColorOrDefault(department.colorHex),
                };
                const trimmedName = draft.name.trim();
                const canSave =
                  trimmedName.length > 0 &&
                  Boolean(normalizeHex(draft.colorHex)) &&
                  (trimmedName !== department.name || draft.colorHex !== roleColorOrDefault(department.colorHex));

                return (
                  <div className="department-manage-row department-manage-row-color" key={department.id}>
                    <input
                      className="department-manage-input"
                      value={draft.name}
                      placeholder={t.department}
                      onChange={(event) =>
                        setDepartmentDrafts((prev) => ({
                          ...prev,
                          [department.id]: {
                            ...draft,
                            name: event.target.value,
                          },
                        }))
                      }
                    />
                    <div className="role-color-editor">
                      <CustomColorPicker
                        value={draft.colorHex}
                        label={t.color}
                        copyLabel={t.copyHex}
                        fallbackHex={roleColorOrDefault(department.colorHex)}
                        onChange={(nextHex) =>
                          setDepartmentDrafts((prev) => ({
                            ...prev,
                            [department.id]: {
                              ...draft,
                              colorHex: nextHex,
                            },
                          }))
                        }
                      />
                    </div>
                    <button
                      type="button"
                      className="department-manage-action"
                      disabled={!canSave}
                      title={t.save}
                      aria-label={t.save}
                      onClick={() => {
                        if (!canSave) return;
                        void onUpdateDepartment(
                          department.id,
                          trimmedName,
                          normalizeHex(draft.colorHex) ?? roleColorOrDefault(department.colorHex),
                        );
                      }}
                    >
                      <Icon name="check" />
                    </button>
                    <button
                      type="button"
                      className="department-manage-action"
                      title={t.deleteDepartment}
                      aria-label={t.deleteDepartment}
                      onClick={() => {
                        if (!window.confirm(t.confirmDeleteDepartment)) return;
                        void onDeleteDepartment(department.id);
                      }}
                    >
                      <Icon name="x" />
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="settings-column">
            <div className="section-header roles-list-header">
              <h3>{t.gradesList}</h3>
            </div>
            <div className="department-manage-row create department-manage-row-grade">
              <input
                className="department-manage-input"
                value={newGradeName}
                placeholder={t.grade}
                onChange={(event) => setNewGradeName(event.target.value)}
              />
              <button
                type="button"
                className="department-manage-action primary"
                disabled={!nextGradeName}
                onClick={() => {
                  if (!nextGradeName) return;
                  onAddGrade(nextGradeName);
                  setNewGradeName('');
                }}
                title={t.addGrade}
                aria-label={t.addGrade}
              >
                <Icon name="plus" />
              </button>
            </div>
            <div className="department-manage-list">
              {gradeOptions.map((grade) => {
                const draft = gradeDrafts[grade] ?? grade;
                const trimmedName = draft.trim();
                const duplicateExists = gradeOptions.some((item) => item !== grade && item === trimmedName);
                const canSave = trimmedName.length > 0 && trimmedName !== grade && !duplicateExists;

                return (
                  <div className="department-manage-row department-manage-row-grade-edit" key={grade}>
                    <input
                      className="department-manage-input"
                      value={draft}
                      onChange={(event) =>
                        setGradeDrafts((prev) => ({
                          ...prev,
                          [grade]: event.target.value,
                        }))
                      }
                    />
                    <button
                      type="button"
                      className="department-manage-action"
                      disabled={!canSave}
                      title={t.save}
                      aria-label={t.save}
                      onClick={() => {
                        if (!canSave) return;
                        onRenameGrade(grade, trimmedName);
                      }}
                    >
                      <Icon name="check" />
                    </button>
                    <button
                      type="button"
                      className="department-manage-action"
                      title={t.deleteGrade}
                      aria-label={t.deleteGrade}
                      onClick={() => onDeleteGrade(grade)}
                    >
                      <Icon name="x" />
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </article>

      {isCreateRoleOpen ? (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="section-header">
              <h3>{t.createRole}</h3>
              <button type="button" className="ghost-btn" onClick={() => setIsCreateRoleOpen(false)}>
                {t.close}
              </button>
            </div>
            <form className="timeline-form" onSubmit={handleCreateRoleSubmit}>
              <label>
                {t.name}
                <input value={roleName} onChange={(e) => setRoleName(e.target.value)} />
              </label>
              <label>
                {t.shortName}
                <input value={roleShortName} onChange={(e) => setRoleShortName(e.target.value)} />
              </label>
              <label>
                {t.description}
                <input value={roleDescription} onChange={(e) => setRoleDescription(e.target.value)} />
              </label>
              <label>
                {t.level}
                <input type="number" min={1} value={roleLevel} onChange={(e) => setRoleLevel(Number(e.target.value))} />
              </label>
              <button type="submit">{t.createRole}</button>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}
