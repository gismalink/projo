import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { AUTOSAVE_DEBOUNCE_MS, AUTOSAVE_DEBOUNCE_MS_SLOW, DEFAULT_EDITOR_ACCENT_COLOR_HEX } from '../../constants/app.constants';
import { Icon } from '../Icon';
import { Role } from '../../pages/app-types';
import { DepartmentItem, GradeItem, TeamTemplateItem } from '../../api/client';
import { CustomColorPicker, normalizeHex } from './CustomColorPicker';
import { NameColorActionRow } from './NameColorActionRow';

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
  teamTemplates: TeamTemplateItem[];
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
  onCreateTeamTemplate: (name: string, roleIds: string[]) => Promise<void>;
  onUpdateTeamTemplate: (templateId: string, payload: { name?: string; roleIds?: string[] }) => Promise<void>;
  onDeleteTeamTemplate: (templateId: string) => Promise<void>;
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

type TeamTemplateDraft = {
  name: string;
  roleIds: string[];
};

export function RolesTab(props: RolesTabProps) {
  const {
    t,
    roles,
    departments,
    teamTemplates,
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
    onCreateTeamTemplate,
    onUpdateTeamTemplate,
    onDeleteTeamTemplate,
    onAddGrade,
    onUpdateGrade,
    onDeleteGrade,
  } = props;

  const [isCreateRoleOpen, setIsCreateRoleOpen] = useState(false);
  const [roleDrafts, setRoleDrafts] = useState<Record<string, RoleDraft>>({});
  const [newDepartmentName, setNewDepartmentName] = useState('');
  const [newDepartmentColor, setNewDepartmentColor] = useState(DEFAULT_EDITOR_ACCENT_COLOR_HEX);
  const [departmentDrafts, setDepartmentDrafts] = useState<Record<string, { name: string; colorHex: string }>>({});
  const [newGradeName, setNewGradeName] = useState('');
  const [newGradeColor, setNewGradeColor] = useState(DEFAULT_EDITOR_ACCENT_COLOR_HEX);
  const [gradeDrafts, setGradeDrafts] = useState<Record<string, GradeDraft>>({});
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateRoleIds, setNewTemplateRoleIds] = useState<string[]>([]);
  const [teamTemplateDrafts, setTeamTemplateDrafts] = useState<Record<string, TeamTemplateDraft>>({});
  const saveTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const departmentSaveTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const gradeSaveTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const teamTemplateSaveTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

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
    setTeamTemplateDrafts((prev) => {
      const next: Record<string, TeamTemplateDraft> = {};
      for (const template of teamTemplates) {
        const current = prev[template.id];
        const roleIds = template.roles.map((item) => item.roleId);
        next[template.id] = {
          name: current?.name ?? template.name,
          roleIds: current?.roleIds ?? roleIds,
        };
      }
      return next;
    });
  }, [teamTemplates]);

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
      for (const timer of Object.values(teamTemplateSaveTimersRef.current)) {
        clearTimeout(timer);
      }
    };
  }, []);

  const templateById = useMemo(() => {
    const map = new Map<string, TeamTemplateItem>();
    for (const template of teamTemplates) map.set(template.id, template);
    return map;
  }, [teamTemplates]);

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
    }, AUTOSAVE_DEBOUNCE_MS);
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
    }, AUTOSAVE_DEBOUNCE_MS);
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
    }, AUTOSAVE_DEBOUNCE_MS);
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

  const scheduleTeamTemplateAutosave = (templateId: string, draft: TeamTemplateDraft) => {
    const existing = teamTemplateSaveTimersRef.current[templateId];
    if (existing) clearTimeout(existing);

    teamTemplateSaveTimersRef.current[templateId] = setTimeout(() => {
      const template = templateById.get(templateId);
      if (!template) return;

      const nextName = draft.name.trim();
      if (!nextName || draft.roleIds.length === 0) return;

      const baseRoleIds = template.roles.map((item) => item.roleId);
      const roleIdsUnchanged =
        baseRoleIds.length === draft.roleIds.length &&
        baseRoleIds.every((roleId, index) => roleId === draft.roleIds[index]);
      const unchanged = template.name === nextName && roleIdsUnchanged;
      if (unchanged) return;

      void onUpdateTeamTemplate(templateId, {
        name: nextName,
        roleIds: draft.roleIds,
      });
    }, AUTOSAVE_DEBOUNCE_MS_SLOW);
  };

  const updateTeamTemplateDraft = (templateId: string, patch: Partial<TeamTemplateDraft>) => {
    setTeamTemplateDrafts((prev) => {
      const fallback = templateById.get(templateId);
      const current = prev[templateId] ?? {
        name: fallback?.name ?? '',
        roleIds: fallback?.roles.map((item) => item.roleId) ?? [],
      };
      const next = {
        ...current,
        ...patch,
      };
      scheduleTeamTemplateAutosave(templateId, next);
      return {
        ...prev,
        [templateId]: next,
      };
    });
  };

  const toggleTemplateRole = (templateId: string, roleId: string) => {
    const draft = teamTemplateDrafts[templateId] ?? {
      name: templateById.get(templateId)?.name ?? '',
      roleIds: templateById.get(templateId)?.roles.map((item) => item.roleId) ?? [],
    };

    const nextRoleIds = draft.roleIds.includes(roleId)
      ? draft.roleIds.filter((item) => item !== roleId)
      : [...draft.roleIds, roleId];

    if (nextRoleIds.length === 0) return;
    updateTeamTemplateDraft(templateId, { roleIds: nextRoleIds });
  };

  const toggleNewTemplateRole = (roleId: string) => {
    setNewTemplateRoleIds((prev) =>
      prev.includes(roleId) ? prev.filter((item) => item !== roleId) : [...prev, roleId],
    );
  };

  const handleCreateRoleSubmit = async (event: FormEvent) => {
    await onCreateRole(event);
    setIsCreateRoleOpen(false);
  };

  const nextDepartmentName = newDepartmentName.trim();
  const nextGradeName = newGradeName.trim();
  const nextTemplateName = newTemplateName.trim();

  return (
    <section className="grid">
      <article className="card">
        <div className="section-header roles-list-header">
          <h2>{t.rolesList}</h2>
          <button
            type="button"
            className="create-role-icon-btn"
            onClick={() => setIsCreateRoleOpen(true)}
            aria-label={t.createRole}
            data-tooltip={t.createRole}
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
            <NameColorActionRow
              rowClassName="department-manage-row create department-manage-row-color"
              actionClassName="department-manage-action primary"
              actionIcon="plus"
              placeholder={t.department}
              nameAriaLabel={t.department}
              nameValue={newDepartmentName}
              colorValue={newDepartmentColor}
              fallbackHex={DEFAULT_EDITOR_ACCENT_COLOR_HEX}
              colorLabel={t.color}
              copyHexLabel={t.copyHex}
              actionTitle={t.addDepartment}
              actionLabel={t.addDepartment}
              actionDisabled={!nextDepartmentName}
              onNameChange={setNewDepartmentName}
              onColorChange={setNewDepartmentColor}
              onAction={() => {
                if (!nextDepartmentName) return;
                void onCreateDepartment(nextDepartmentName, newDepartmentColor);
                setNewDepartmentName('');
              }}
            />
            <div className="department-manage-list">
              {departments.map((department) => {
                const draft = departmentDrafts[department.id] ?? {
                  name: department.name,
                  colorHex: roleColorOrDefault(department.colorHex),
                };

                return (
                  <NameColorActionRow
                    key={department.id}
                    rowClassName="department-manage-row department-manage-row-color"
                    actionClassName="department-manage-action"
                    actionIcon="x"
                    placeholder={t.department}
                    nameAriaLabel={t.department}
                    nameValue={draft.name}
                    colorValue={draft.colorHex}
                    fallbackHex={roleColorOrDefault(department.colorHex)}
                    colorLabel={t.color}
                    copyHexLabel={t.copyHex}
                    actionTitle={t.deleteDepartment}
                    actionLabel={t.deleteDepartment}
                    onNameChange={(value) => updateDepartmentDraft(department.id, { name: value })}
                    onColorChange={(value) => updateDepartmentDraft(department.id, { colorHex: value })}
                    onAction={() => {
                      if (!window.confirm(t.confirmDeleteDepartment)) return;
                      void onDeleteDepartment(department.id);
                    }}
                  />
                );
              })}
            </div>
          </section>

          <section className="settings-column">
            <div className="section-header roles-list-header">
              <h3>{t.teamTemplatesList}</h3>
            </div>
            <div className="template-manage-create">
              <input
                className="department-manage-input"
                value={newTemplateName}
                placeholder={t.name}
                onChange={(event) => setNewTemplateName(event.target.value)}
              />
              <div className="template-role-chips">
                {roles.map((role) => {
                  const active = newTemplateRoleIds.includes(role.id);
                  return (
                    <button
                      type="button"
                      key={`create-template-role-${role.id}`}
                      className={active ? 'template-role-chip active' : 'template-role-chip'}
                      onClick={() => toggleNewTemplateRole(role.id)}
                    >
                      {role.shortName || role.name}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                className="department-manage-action primary template-create-btn"
                disabled={!nextTemplateName || newTemplateRoleIds.length === 0}
                onClick={() => {
                  if (!nextTemplateName || newTemplateRoleIds.length === 0) return;
                  void onCreateTeamTemplate(nextTemplateName, newTemplateRoleIds);
                  setNewTemplateName('');
                  setNewTemplateRoleIds([]);
                }}
                aria-label={t.addTeamTemplate}
                data-tooltip={t.addTeamTemplate}
              >
                <Icon name="plus" />
              </button>
            </div>
            <div className="department-manage-list template-manage-list">
              {teamTemplates.map((template) => {
                const draft = teamTemplateDrafts[template.id] ?? {
                  name: template.name,
                  roleIds: template.roles.map((item) => item.roleId),
                };

                return (
                  <div className="template-manage-card" key={template.id}>
                    <div className="template-manage-header">
                      <input
                        className="department-manage-input"
                        value={draft.name}
                        placeholder={t.name}
                        onChange={(event) => updateTeamTemplateDraft(template.id, { name: event.target.value })}
                      />
                      <button
                        type="button"
                        className="department-manage-action"
                        aria-label={t.deleteTeamTemplate}
                        data-tooltip={t.deleteTeamTemplate}
                        onClick={() => {
                          if (!window.confirm(t.confirmDeleteTeamTemplate)) return;
                          void onDeleteTeamTemplate(template.id);
                        }}
                      >
                        <Icon name="x" />
                      </button>
                    </div>
                    <div className="template-role-chips">
                      {roles.map((role) => {
                        const active = draft.roleIds.includes(role.id);
                        return (
                          <button
                            type="button"
                            key={`template-${template.id}-role-${role.id}`}
                            className={active ? 'template-role-chip active' : 'template-role-chip'}
                            onClick={() => toggleTemplateRole(template.id, role.id)}
                          >
                            {role.shortName || role.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="settings-column">
            <div className="section-header roles-list-header">
              <h3>{t.gradesList}</h3>
            </div>
            <NameColorActionRow
              rowClassName="department-manage-row create department-manage-row-grade"
              actionClassName="department-manage-action primary"
              actionIcon="plus"
              placeholder={t.grade}
              nameAriaLabel={t.grade}
              nameValue={newGradeName}
              colorValue={newGradeColor}
              fallbackHex={DEFAULT_EDITOR_ACCENT_COLOR_HEX}
              colorLabel={t.color}
              copyHexLabel={t.copyHex}
              actionTitle={t.addGrade}
              actionLabel={t.addGrade}
              actionDisabled={!nextGradeName}
              onNameChange={setNewGradeName}
              onColorChange={setNewGradeColor}
              onAction={() => {
                if (!nextGradeName) return;
                onAddGrade(nextGradeName, newGradeColor);
                setNewGradeName('');
              }}
            />
            <div className="department-manage-list">
              {grades.map((grade) => {
                const draft = gradeDrafts[grade.id] ?? {
                  name: grade.name,
                  colorHex: roleColorOrDefault(grade.colorHex),
                };

                return (
                  <NameColorActionRow
                    key={grade.id}
                    rowClassName="department-manage-row department-manage-row-grade-edit"
                    actionClassName="department-manage-action"
                    actionIcon="x"
                    placeholder={t.grade}
                    nameAriaLabel={t.grade}
                    nameValue={draft.name}
                    colorValue={draft.colorHex}
                    fallbackHex={roleColorOrDefault(grade.colorHex)}
                    colorLabel={t.color}
                    copyHexLabel={t.copyHex}
                    actionTitle={t.deleteGrade}
                    actionLabel={t.deleteGrade}
                    onNameChange={(value) => updateGradeDraft(grade.id, { name: value })}
                    onColorChange={(value) => updateGradeDraft(grade.id, { colorHex: value })}
                    onAction={() => onDeleteGrade(grade.id)}
                  />
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
