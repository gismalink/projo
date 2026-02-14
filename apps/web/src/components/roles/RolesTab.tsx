import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Role } from '../../pages/app-types';

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
  } = props;

  const [isCreateRoleOpen, setIsCreateRoleOpen] = useState(false);
  const [roleDrafts, setRoleDrafts] = useState<Record<string, RoleDraft>>({});
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
      const payload: UpdateRolePayload = {
        name: draft.name,
        shortName: normalizedShortName,
        description: draft.description,
        level: draft.level,
        colorHex: draft.colorHex,
      };

      const unchanged =
        role.name === payload.name &&
        (role.shortName ?? '') === payload.shortName &&
        role.description === payload.description &&
        role.level === payload.level &&
        roleColorOrDefault(role.colorHex) === payload.colorHex;

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
            ＋
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
                <input
                  type="color"
                  value={roleDrafts[role.id]?.colorHex ?? roleColorOrDefault(role.colorHex)}
                  onChange={(event) => updateRoleDraft(role.id, { colorHex: event.target.value })}
                />
              </div>
            </li>
          ))}
        </ul>
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
