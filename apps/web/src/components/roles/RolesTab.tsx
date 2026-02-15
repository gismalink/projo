import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../Icon';
import { Role } from '../../pages/app-types';
import { DepartmentItem, GradeItem } from '../../api/client';
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
  grades: GradeItem[];
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
  onAddGrade: (name: string, colorHex: string) => void;
  onUpdateGrade: (gradeId: string, payload: { name?: string; colorHex?: string }) => void;
  onDeleteGrade: (gradeId: string) => void;
};

type RoleDraft = {
  name: string;
  shortName: string;
  description: string;
  level: number;
  colorHex: string;
};

type GradeDraft = {
  name: string;
  colorHex: string;
};

export function RolesTab(props: RolesTabProps) {
  const {
    t,
    roles,
    departments,
    grades,
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
    onUpdateGrade,
    onDeleteGrade,
  } = props;

  const [isCreateRoleOpen, setIsCreateRoleOpen] = useState(false);
  const [roleDrafts, setRoleDrafts] = useState<Record<string, RoleDraft>>({});
  const [newDepartmentName, setNewDepartmentName] = useState('');
  const [newDepartmentColor, setNewDepartmentColor] = useState('#7A8A9A');
  const [departmentDrafts, setDepartmentDrafts] = useState<Record<string, { name: string; colorHex: string }>>({});
  const [newGradeName, setNewGradeName] = useState('');
  const [newGradeColor, setNewGradeColor] = useState('#7A8A9A');
  const [gradeDrafts, setGradeDrafts] = useState<Record<string, GradeDraft>>({});
  const saveTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const departmentSaveTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const gradeSaveTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

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
    setGradeDrafts((prev) => {
      const next: Record<string, GradeDraft> = {};
      for (const grade of grades) {
        const current = prev[grade.id];
        next[grade.id] = {
          name: current?.name ?? grade.name,
          colorHex: current?.colorHex ?? roleColorOrDefault(grade.colorHex),
        };
      }
      return next;
    });
  }, [grades, roleColorOrDefault]);

  useEffect(() => {
    return () => {
      for (const timer of Object.values(saveTimersRef.current)) {
        clearTimeout(timer);
      }
      for (const timer of Object.values(departmentSaveTimersRef.current)) {
        clearTimeout(timer);
      }
      for (const timer of Object.values(gradeSaveTimersRef.current)) {
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

  const scheduleDepartmentAutosave = (departmentId: string, draft: { name: string; colorHex: string }) => {
    const existing = departmentSaveTimersRef.current[departmentId];
    if (existing) clearTimeout(existing);

    departmentSaveTimersRef.current[departmentId] = setTimeout(() => {
      const department = departments.find((item) => item.id === departmentId);
      if (!department) return;

      const trimmedName = draft.name.trim();
      const normalizedColor = normalizeHex(draft.colorHex);
      if (!trimmedName || !normalizedColor) return;

      const baseColor = roleColorOrDefault(department.colorHex);
      const unchanged = trimmedName === department.name && normalizedColor === baseColor;
      if (unchanged) return;

      void onUpdateDepartment(departmentId, trimmedName, normalizedColor);
    }, 420);
  };

  const updateDepartmentDraft = (departmentId: string, patch: Partial<{ name: string; colorHex: string }>) => {
    setDepartmentDrafts((prev) => {
      const fallbackDepartment = departments.find((item) => item.id === departmentId);
      const current = prev[departmentId] ?? {
        name: fallbackDepartment?.name ?? '',
        colorHex: roleColorOrDefault(fallbackDepartment?.colorHex),
      };
      const next = { ...current, ...patch };
      scheduleDepartmentAutosave(departmentId, next);
      return {
        ...prev,
        [departmentId]: next,
      };
    });
  };

  const scheduleGradeAutosave = (gradeId: string, draft: GradeDraft) => {
    const existing = gradeSaveTimersRef.current[gradeId];
    if (existing) clearTimeout(existing);

    gradeSaveTimersRef.current[gradeId] = setTimeout(() => {
      const grade = grades.find((item) => item.id === gradeId);
      if (!grade) return;

      const trimmedName = draft.name.trim();
      const normalizedColor = normalizeHex(draft.colorHex);
      if (!trimmedName || !normalizedColor) return;

      const duplicateExists = grades.some((item) => item.id !== gradeId && item.name === trimmedName);
      if (duplicateExists) return;

      const unchanged = trimmedName === grade.name && normalizedColor === roleColorOrDefault(grade.colorHex);
      if (unchanged) return;

      onUpdateGrade(gradeId, {
        name: trimmedName,
        colorHex: normalizedColor,
      });
    }, 420);
  };

  const updateGradeDraft = (gradeId: string, patch: Partial<GradeDraft>) => {
    setGradeDrafts((prev) => {
      const fallbackGrade = grades.find((item) => item.id === gradeId);
      const current = prev[gradeId] ?? {
        name: fallbackGrade?.name ?? '',
        colorHex: roleColorOrDefault(fallbackGrade?.colorHex),
      };
      const next = { ...current, ...patch };
      scheduleGradeAutosave(gradeId, next);
      return {
        ...prev,
        [gradeId]: next,
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

                return (
                  <div className="department-manage-row department-manage-row-color" key={department.id}>
                    <input
                      className="department-manage-input"
                      value={draft.name}
                      placeholder={t.department}
                      onChange={(event) => updateDepartmentDraft(department.id, { name: event.target.value })}
                    />
                    <div className="role-color-editor">
                      <CustomColorPicker
                        value={draft.colorHex}
                        label={t.color}
                        copyLabel={t.copyHex}
                        fallbackHex={roleColorOrDefault(department.colorHex)}
                        onChange={(nextHex) => updateDepartmentDraft(department.id, { colorHex: nextHex })}
                      />
                    </div>
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
              <div className="role-color-editor">
                <CustomColorPicker
                  value={newGradeColor}
                  label={t.color}
                  copyLabel={t.copyHex}
                  fallbackHex="#7A8A9A"
                  onChange={setNewGradeColor}
                />
              </div>
              <button
                type="button"
                className="department-manage-action primary"
                disabled={!nextGradeName}
                onClick={() => {
                  if (!nextGradeName) return;
                  onAddGrade(nextGradeName, newGradeColor);
                  setNewGradeName('');
                }}
                title={t.addGrade}
                aria-label={t.addGrade}
              >
                <Icon name="plus" />
              </button>
            </div>
            <div className="department-manage-list">
              {grades.map((grade) => {
                const draft = gradeDrafts[grade.id] ?? {
                  name: grade.name,
                  colorHex: roleColorOrDefault(grade.colorHex),
                };

                return (
                  <div className="department-manage-row department-manage-row-grade-edit" key={grade.id}>
                    <input
                      className="department-manage-input"
                      value={draft.name}
                      onChange={(event) => updateGradeDraft(grade.id, { name: event.target.value })}
                    />
                    <div className="role-color-editor">
                      <CustomColorPicker
                        value={draft.colorHex}
                        label={t.color}
                        copyLabel={t.copyHex}
                        fallbackHex={roleColorOrDefault(grade.colorHex)}
                        onChange={(nextHex) => updateGradeDraft(grade.id, { colorHex: nextHex })}
                      />
                    </div>
                    <button
                      type="button"
                      className="department-manage-action"
                      title={t.deleteGrade}
                      aria-label={t.deleteGrade}
                      onClick={() => onDeleteGrade(grade.id)}
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
