import { FormEvent } from 'react';
import { Role } from '../../pages/app-types';
import { SkillItem } from '../../api/client';

type RolesTabProps = {
  t: Record<string, string>;
  roles: Role[];
  skills: SkillItem[];
  roleName: string;
  roleShortName: string;
  roleDescription: string;
  roleLevel: number;
  skillName: string;
  skillDescription: string;
  roleColorDrafts: Record<string, string>;
  onCreateRole: (event: FormEvent) => Promise<void>;
  onCreateSkill: (event: FormEvent) => Promise<void>;
  onUpdateRoleColor: (role: Role) => Promise<void>;
  setRoleName: (value: string) => void;
  setRoleShortName: (value: string) => void;
  setRoleDescription: (value: string) => void;
  setRoleLevel: (value: number) => void;
  setSkillName: (value: string) => void;
  setSkillDescription: (value: string) => void;
  setRoleColorDraft: (roleId: string, color: string) => void;
  roleColorOrDefault: (colorHex?: string | null) => string;
};

export function RolesTab(props: RolesTabProps) {
  const {
    t,
    roles,
    skills,
    roleName,
    roleShortName,
    roleDescription,
    roleLevel,
    skillName,
    skillDescription,
    roleColorDrafts,
    onCreateRole,
    onCreateSkill,
    onUpdateRoleColor,
    setRoleName,
    setRoleShortName,
    setRoleDescription,
    setRoleLevel,
    setSkillName,
    setSkillDescription,
    setRoleColorDraft,
    roleColorOrDefault,
  } = props;

  return (
    <section className="grid">
      <article className="card">
        <h2>{t.roleMgmt}</h2>
        <form className="timeline-form" onSubmit={onCreateRole}>
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
      </article>

      <article className="card">
        <h2>{t.rolesList}</h2>
        <ul>
          {roles.map((role) => (
            <li key={role.id} className="role-row">
              <div>
                <strong>{role.name}</strong>
                <span>
                  {role.shortName ?? role.name} • {' '}
                  {t.levelEmployees} {role.level ?? '-'} • {role._count?.employees ?? 0} {t.employeesShort}
                </span>
              </div>
              <div className="role-color-editor">
                <input type="color" value={roleColorOrDefault(roleColorDrafts[role.id])} onChange={(e) => setRoleColorDraft(role.id, e.target.value)} />
                <button type="button" className="ghost-btn" onClick={() => onUpdateRoleColor(role)}>
                  {t.saveColor}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </article>

      <article className="card">
        <h2>{t.skillMgmt}</h2>
        <form className="timeline-form" onSubmit={onCreateSkill}>
          <label>
            {t.name}
            <input value={skillName} onChange={(e) => setSkillName(e.target.value)} />
          </label>
          <label>
            {t.description}
            <input value={skillDescription} onChange={(e) => setSkillDescription(e.target.value)} />
          </label>
          <button type="submit">{t.createSkill}</button>
        </form>

        <h2>{t.skillsList}</h2>
        <ul>
          {skills.map((skill) => (
            <li key={skill.id} className="role-row">
              <div>
                <strong>{skill.name}</strong>
                <span>
                  {skill._count?.employees ?? 0} {t.employeesShort}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </article>
    </section>
  );
}
