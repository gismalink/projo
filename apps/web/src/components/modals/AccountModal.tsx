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
          <label>
            <span className="field-label">{t.email}</span>
            <input value={currentUserEmail} readOnly />
          </label>
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
                onChange={(event) => setAccountFullNameDraft(event.target.value)}
              />
            </label>
            <button type="submit">{t.saveProfile}</button>
          </form>
          <form onSubmit={onChangePasswordSubmit} className="timeline-form" style={{ padding: 0 }}>
            <label>
              <span className="field-label required">{t.currentPassword}</span>
              <input
                type="password"
                placeholder="••••••••"
                value={currentPassword}
                required
                onChange={(event) => setCurrentPassword(event.target.value)}
              />
            </label>
            <label>
              <span className="field-label required">{t.newPassword}</span>
              <input
                type="password"
                placeholder="••••••••"
                value={newPassword}
                required
                onChange={(event) => setNewPassword(event.target.value)}
              />
            </label>
            <label>
              <span className="field-label required">{t.confirmPassword}</span>
              <input
                type="password"
                placeholder="••••••••"
                value={newPasswordConfirm}
                required
                onChange={(event) => setNewPasswordConfirm(event.target.value)}
              />
            </label>
            <button type="submit">{t.changePassword}</button>
          </form>
        </div>
      </article>
    </div>
  );
}
