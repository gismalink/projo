import { FormEvent } from 'react';
import { ProjectMemberItem } from '../../api/client';
import { Icon } from '../Icon';

type ProjectSettingsModalProps = {
  isOpen: boolean;
  t: Record<string, string>;
  isOwner: boolean;
  canInviteParticipants: boolean;
  projectSettingsNameDraft: string;
  setProjectSettingsNameDraft: (value: string) => void;
  projectMemberSearch: string;
  setProjectMemberSearch: (value: string) => void;
  filteredProjectMembers: ProjectMemberItem[];
  inviteEmail: string;
  setInviteEmail: (value: string) => void;
  invitePermission: 'viewer' | 'editor';
  setInvitePermission: (value: 'viewer' | 'editor') => void;
  deleteProjectConfirmText: string;
  setDeleteProjectConfirmText: (value: string) => void;
  onClose: () => void;
  onUpdateProjectNameSubmit: (event: FormEvent) => Promise<void>;
  onUpdateMemberPermission: (targetUserId: string, permission: 'viewer' | 'editor') => Promise<void>;
  onRemoveMember: (targetUserId: string) => Promise<void>;
  onInviteSubmit: (event: FormEvent) => Promise<void>;
  onDeleteProjectSubmit: (event: FormEvent) => Promise<void>;
};

export function ProjectSettingsModal(props: ProjectSettingsModalProps) {
  const {
    isOpen,
    t,
    isOwner,
    canInviteParticipants,
    projectSettingsNameDraft,
    setProjectSettingsNameDraft,
    projectMemberSearch,
    setProjectMemberSearch,
    filteredProjectMembers,
    inviteEmail,
    setInviteEmail,
    invitePermission,
    setInvitePermission,
    deleteProjectConfirmText,
    setDeleteProjectConfirmText,
    onClose,
    onUpdateProjectNameSubmit,
    onUpdateMemberPermission,
    onRemoveMember,
    onInviteSubmit,
    onDeleteProjectSubmit,
  } = props;

  if (!isOpen) return null;

  const emailPattern =
    /^(?=.{6,254}$)(?=.{1,64}@)(?!.*\.\.)[a-z0-9](?:[a-z0-9_%+-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9_%+-]*[a-z0-9])?)*@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/i;
  const inviteEmailValue = inviteEmail.trim().toLowerCase();
  const isInviteEmailValid = Boolean(inviteEmailValue) && emailPattern.test(inviteEmailValue);

  return (
    <div className="modal-backdrop">
      <article className="modal-card auth-modal project-settings-modal">
        <div className="section-header" style={{ marginBottom: 12 }}>
          <h3>{t.projectSettings}</h3>
          <button type="button" className="ghost-btn" onClick={onClose}>
            {t.close}
          </button>
        </div>
        <div className="project-settings-body">
          {isOwner ? (
            <form onSubmit={onUpdateProjectNameSubmit} className="project-settings-form" style={{ padding: 0 }}>
              <label>
                <span className="field-label required">{t.projectName}</span>
              </label>
              <div className="project-settings-inline project-settings-inline-name">
                <input
                  value={projectSettingsNameDraft}
                  placeholder={t.projectName}
                  required
                  onChange={(event) => setProjectSettingsNameDraft(event.target.value)}
                />
                <button type="submit">{t.save}</button>
              </div>
            </form>
          ) : null}

          <h4>{t.participants}</h4>
          <label>
            <span className="field-label optional">{t.searchParticipants}</span>
            <input
              value={projectMemberSearch}
              placeholder={t.searchParticipants}
              onChange={(event) => setProjectMemberSearch(event.target.value)}
            />
          </label>
          <ul>
            {filteredProjectMembers.map((member) => (
              <li key={member.userId} className="project-member-item">
                <div className="project-member-meta">
                  <strong>{member.fullName}</strong>
                  <div>{member.email}</div>
                </div>
                {member.isOwner ? (
                  <span>{t.owner}</span>
                ) : canInviteParticipants ? (
                  <div className="project-member-actions">
                    <select
                      value={member.role === 'PM' ? 'editor' : 'viewer'}
                      onChange={(event) => void onUpdateMemberPermission(member.userId, event.target.value as 'viewer' | 'editor')}
                      aria-label={t.permission}
                    >
                      <option value="viewer">{t.permissionViewer}</option>
                      <option value="editor">{t.permissionEditor}</option>
                    </select>
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => void onRemoveMember(member.userId)}
                      aria-label={t.remove}
                      data-tooltip={t.remove}
                    >
                      <Icon name="x" />
                    </button>
                  </div>
                ) : (
                  <span>{member.role}</span>
                )}
              </li>
            ))}
            {filteredProjectMembers.length === 0 ? <li>{t.noParticipantsFound}</li> : null}
          </ul>

          {canInviteParticipants ? (
            <>
              <form onSubmit={onInviteSubmit} className="project-settings-form" style={{ padding: 0 }}>
                <label>
                  <span className="field-label required">{t.inviteByEmail}</span>
                </label>
                <div className="project-settings-inline project-settings-inline-invite">
                  <div className="project-settings-invite-email">
                    <input
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      placeholder="name@example.com"
                      value={inviteEmail}
                      required
                      maxLength={254}
                      onChange={(event) => setInviteEmail(event.target.value)}
                    />
                    <span className={!inviteEmailValue ? 'field-status pending' : isInviteEmailValid ? 'field-status success' : 'field-status error'}>
                      {!inviteEmailValue ? t.uiStatusAwaitingEmail : isInviteEmailValid ? t.uiStatusEmailValid : t.uiStatusEmailInvalid}
                    </span>
                  </div>
                  <select
                    value={invitePermission}
                    onChange={(event) => setInvitePermission(event.target.value as 'viewer' | 'editor')}
                  >
                    <option value="viewer">{t.permissionViewer}</option>
                    <option value="editor">{t.permissionEditor}</option>
                  </select>
                  <button type="submit">{t.invite}</button>
                </div>
              </form>

              <form onSubmit={onDeleteProjectSubmit} className="project-settings-form project-delete-form" style={{ padding: 0 }}>
                <label>
                  <span className="field-label required">{t.deleteConfirmLabel}</span>
                  <input
                    value={deleteProjectConfirmText}
                    placeholder="delete"
                    required
                    onChange={(event) => setDeleteProjectConfirmText(event.target.value)}
                  />
                </label>
                <button type="submit" className="danger-btn">
                  {t.deleteProject}
                </button>
              </form>
            </>
          ) : null}
        </div>
      </article>
    </div>
  );
}
