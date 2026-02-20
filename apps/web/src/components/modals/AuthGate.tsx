import { FormEvent } from 'react';
import { LANGUAGE_OPTIONS } from '../../pages/app-i18n';
import { Lang } from '../../pages/app-types';

type AuthGateProps = {
  isOpen: boolean;
  t: Record<string, string>;
  authMode: 'login' | 'register';
  setAuthMode: (mode: 'login' | 'register') => void;
  lang: Lang;
  setLang: (value: Lang) => void;
  email: string;
  setEmail: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  registerEmail: string;
  setRegisterEmail: (value: string) => void;
  registerFullName: string;
  setRegisterFullName: (value: string) => void;
  registerPassword: string;
  setRegisterPassword: (value: string) => void;
  registerPasswordConfirm: string;
  setRegisterPasswordConfirm: (value: string) => void;
  onLoginSubmit: (event: FormEvent) => Promise<void> | void;
  onRegisterSubmit: (event: FormEvent) => Promise<void> | void;
};

export function AuthGate(props: AuthGateProps) {
  const {
    isOpen,
    t,
    authMode,
    setAuthMode,
    lang,
    setLang,
    email,
    setEmail,
    password,
    setPassword,
    registerEmail,
    setRegisterEmail,
    registerFullName,
    setRegisterFullName,
    registerPassword,
    setRegisterPassword,
    registerPasswordConfirm,
    setRegisterPasswordConfirm,
    onLoginSubmit,
    onRegisterSubmit,
  } = props;

  if (!isOpen) return null;

  const emailPattern =
    /^(?=.{6,254}$)(?=.{1,64}@)(?!.*\.\.)[a-z0-9](?:[a-z0-9_%+-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9_%+-]*[a-z0-9])?)*@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/i;
  const loginEmailValue = email.trim().toLowerCase();
  const loginPasswordValue = password.trim();
  const registerEmailValue = registerEmail.trim().toLowerCase();
  const registerFullNameValue = registerFullName.trim();
  const registerPasswordValue = registerPassword.trim();
  const registerPasswordConfirmValue = registerPasswordConfirm.trim();
  const isLoginEmailValid = Boolean(loginEmailValue) && emailPattern.test(loginEmailValue);
  const isLoginPasswordValid = loginPasswordValue.length >= 8;
  const isRegisterFullNameValid = registerFullNameValue.length >= 2;
  const isRegisterEmailValid = Boolean(registerEmailValue) && emailPattern.test(registerEmailValue);
  const isRegisterPasswordValid = registerPasswordValue.length >= 8;
  const isRegisterPasswordConfirmValid =
    registerPasswordConfirmValue.length >= 8 && registerPasswordConfirmValue === registerPasswordValue;

  return (
    <div className="modal-backdrop">
      <article className="modal-card auth-modal">
        <div className="auth-modal-lang">
          <select
            value={lang}
            onChange={(event) => setLang(event.target.value as Lang)}
            aria-label={t.language}
            className="lang-select"
          >
            {LANGUAGE_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
        <div className="tabs auth-tabs" style={{ marginBottom: 12 }}>
          <button type="button" className={authMode === 'login' ? 'tab active' : 'tab'} onClick={() => setAuthMode('login')}>
            {t.login}
          </button>
          <button
            type="button"
            className={authMode === 'register' ? 'tab active' : 'tab'}
            onClick={() => setAuthMode('register')}
          >
            {t.register}
          </button>
        </div>

        {authMode === 'login' ? (
          <form onSubmit={onLoginSubmit} className="timeline-form">
            <h2>{t.login}</h2>
            <label>
              <span className="field-label required">{t.email}</span>
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="name@example.com"
                value={email}
                required
                maxLength={254}
                onChange={(event) => setEmail(event.target.value)}
              />
              <span className={!loginEmailValue ? 'field-status pending' : isLoginEmailValid ? 'field-status success' : 'field-status error'}>
                {!loginEmailValue ? t.uiStatusAwaitingEmail : isLoginEmailValid ? t.uiStatusEmailValid : t.uiStatusEmailInvalid}
              </span>
            </label>
            <label>
              <span className="field-label required">{t.password}</span>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                required
                minLength={8}
                onChange={(event) => setPassword(event.target.value)}
              />
              <span className={!loginPasswordValue ? 'field-status pending' : isLoginPasswordValid ? 'field-status success' : 'field-status error'}>
                {!loginPasswordValue
                  ? t.uiStatusAwaitingPassword
                  : isLoginPasswordValid
                    ? t.uiStatusPasswordValid
                    : t.uiStatusPasswordInvalid}
              </span>
            </label>
            <button type="submit">{t.signIn}</button>
          </form>
        ) : (
          <form onSubmit={onRegisterSubmit} className="timeline-form">
            <h2>{t.register}</h2>
            <label>
              <span className="field-label required">{t.fullName}</span>
              <input
                value={registerFullName}
                placeholder={t.fullName}
                required
                minLength={2}
                maxLength={120}
                onChange={(event) => setRegisterFullName(event.target.value)}
              />
              <span className={!registerFullNameValue ? 'field-status pending' : isRegisterFullNameValid ? 'field-status success' : 'field-status error'}>
                {!registerFullNameValue
                  ? t.uiStatusAwaitingFullName
                  : isRegisterFullNameValid
                    ? t.uiStatusFullNameValid
                    : t.uiStatusFullNameInvalid}
              </span>
            </label>
            <label>
              <span className="field-label required">{t.email}</span>
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="name@example.com"
                value={registerEmail}
                required
                maxLength={254}
                onChange={(event) => setRegisterEmail(event.target.value)}
              />
              <span className={!registerEmailValue ? 'field-status pending' : isRegisterEmailValid ? 'field-status success' : 'field-status error'}>
                {!registerEmailValue
                  ? t.uiStatusAwaitingEmail
                  : isRegisterEmailValid
                    ? t.uiStatusEmailValid
                    : t.uiStatusEmailInvalid}
              </span>
            </label>
            <label>
              <span className="field-label required">{t.password}</span>
              <input
                type="password"
                placeholder="••••••••"
                value={registerPassword}
                required
                minLength={8}
                onChange={(event) => setRegisterPassword(event.target.value)}
              />
              <span className={!registerPasswordValue ? 'field-status pending' : isRegisterPasswordValid ? 'field-status success' : 'field-status error'}>
                {!registerPasswordValue
                  ? t.uiStatusAwaitingPassword
                  : isRegisterPasswordValid
                    ? t.uiStatusPasswordValid
                    : t.uiStatusPasswordInvalid}
              </span>
            </label>
            <label>
              <span className="field-label required">{t.confirmPassword}</span>
              <input
                type="password"
                placeholder="••••••••"
                value={registerPasswordConfirm}
                required
                minLength={8}
                onChange={(event) => setRegisterPasswordConfirm(event.target.value)}
              />
              <span
                className={
                  !registerPasswordConfirmValue
                    ? 'field-status pending'
                    : isRegisterPasswordConfirmValid
                      ? 'field-status success'
                      : 'field-status error'
                }
              >
                {!registerPasswordConfirmValue
                  ? t.uiStatusAwaitingPasswordConfirm
                  : isRegisterPasswordConfirmValid
                    ? t.uiStatusPasswordConfirmValid
                    : t.uiStatusPasswordConfirmInvalid}
              </span>
            </label>
            <button type="submit">{t.createAccount}</button>
          </form>
        )}
      </article>
    </div>
  );
}
