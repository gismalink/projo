import { FormEvent } from 'react';

type AccountModalProps = {
  isOpen: boolean;
  t: Record<string, string>;
  currentUserEmail: string;
  currentCompanyName: string;
  accountFullNameDraft: string;
  setAccountFullNameDraft: (value: string) => void;
  currentPassword: string;
  setCurrentPassword: (value: string) => void;
  newPassword: string;
  setNewPassword: (value: string) => void;
  newPasswordConfirm: string;
  setNewPasswordConfirm: (value: string) => void;
  onClose: () => void;
  onLogout: () => Promise<void>;
  onUpdateProfileSubmit: (event: FormEvent) => Promise<void>;
  onChangePasswordSubmit: (event: FormEvent) => Promise<void>;
};

export function AccountModal(props: AccountModalProps) {
  const {
    isOpen,
    t,
    currentUserEmail,
    currentCompanyName,
    accountFullNameDraft,
    setAccountFullNameDraft,
    currentPassword,
    setCurrentPassword,
    newPassword,
    setNewPassword,
    newPasswordConfirm,
    setNewPasswordConfirm,
    onClose,
    onLogout,
    onUpdateProfileSubmit,
    onChangePasswordSubmit,
  } = props;

  if (!isOpen) return null;

  const AUTH_MODE = (import.meta.env.VITE_AUTH_MODE ?? 'local').toLowerCase();
  const isSsoOnly = AUTH_MODE === 'sso';

  const accountFullNameValue = accountFullNameDraft.trim();
  const currentPasswordValue = currentPassword.trim();
  const newPasswordValue = newPassword.trim();
  const newPasswordConfirmValue = newPasswordConfirm.trim();
  const isAccountFullNameValid = accountFullNameValue.length >= 2;
  const isCurrentPasswordValid = currentPasswordValue.length >= 8;
  const isNewPasswordValid = newPasswordValue.length >= 8;
  const isNewPasswordConfirmValid = newPasswordConfirmValue.length >= 8 && newPasswordConfirmValue === newPasswordValue;

  return (
    <div className="modal-backdrop">
      <article className="modal-card auth-modal">
        <div className="section-header">
          <h3>{t.account}</h3>
          <div className="lang-toggle">
            <button type="button" className="ghost-btn" onClick={onClose}>
              {t.close}
            </button>
            <button type="button" className="ghost-btn" onClick={() => void onLogout()}>
              {t.logout}
            </button>
          </div>
        </div>
        <div className="timeline-form">
          {!isSsoOnly ? (
            <label>
              <span className="field-label">{t.email}</span>
              <input value={currentUserEmail} readOnly />
            </label>
          ) : null}
          <label>
            <span className="field-label">{t.companyName}</span>
            <input value={currentCompanyName || '-'} readOnly />
          </label>
          <form onSubmit={onUpdateProfileSubmit} className="timeline-form" style={{ padding: 0 }}>
            <label>
              <span className="field-label required">{t.fullName}</span>
              <input
                value={accountFullNameDraft}
                placeholder={t.fullName}
                required
                minLength={2}
                maxLength={120}
                onChange={(event) => setAccountFullNameDraft(event.target.value)}
              />
              <span className={!accountFullNameValue ? 'field-status pending' : isAccountFullNameValid ? 'field-status success' : 'field-status error'}>
                {!accountFullNameValue
                  ? t.uiStatusAwaitingFullName
                  : isAccountFullNameValid
                    ? t.uiStatusFullNameValid
                    : t.uiStatusFullNameInvalid}
              </span>
            </label>
            <button type="submit">{t.saveProfile}</button>
          </form>
          {!isSsoOnly ? (
            <form onSubmit={onChangePasswordSubmit} className="timeline-form" style={{ padding: 0 }}>
              <label>
                <span className="field-label required">{t.currentPassword}</span>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={currentPassword}
                  required
                  minLength={8}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                />
                <span className={!currentPasswordValue ? 'field-status pending' : isCurrentPasswordValid ? 'field-status success' : 'field-status error'}>
                  {!currentPasswordValue
                    ? t.uiStatusAwaitingPassword
                    : isCurrentPasswordValid
                      ? t.uiStatusPasswordValid
                      : t.uiStatusPasswordInvalid}
                </span>
              </label>
              <label>
                <span className="field-label required">{t.newPassword}</span>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={newPassword}
                  required
                  minLength={8}
                  onChange={(event) => setNewPassword(event.target.value)}
                />
                <span className={!newPasswordValue ? 'field-status pending' : isNewPasswordValid ? 'field-status success' : 'field-status error'}>
                  {!newPasswordValue
                    ? t.uiStatusAwaitingPassword
                    : isNewPasswordValid
                      ? t.uiStatusPasswordValid
                      : t.uiStatusPasswordInvalid}
                </span>
              </label>
              <label>
                <span className="field-label required">{t.confirmPassword}</span>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={newPasswordConfirm}
                  required
                  minLength={8}
                  onChange={(event) => setNewPasswordConfirm(event.target.value)}
                />
                <span
                  className={
                    !newPasswordConfirmValue
                      ? 'field-status pending'
                      : isNewPasswordConfirmValid
                        ? 'field-status success'
                        : 'field-status error'
                  }
                >
                  {!newPasswordConfirmValue
                    ? t.uiStatusAwaitingPasswordConfirm
                    : isNewPasswordConfirmValid
                      ? t.uiStatusPasswordConfirmValid
                      : t.uiStatusPasswordConfirmInvalid}
                </span>
              </label>
              <button type="submit">{t.changePassword}</button>
            </form>
          ) : null}
        </div>
      </article>
    </div>
  );
}
