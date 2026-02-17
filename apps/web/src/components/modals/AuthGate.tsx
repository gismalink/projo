import { FormEvent } from 'react';

type AuthGateProps = {
  isOpen: boolean;
  t: Record<string, string>;
  authMode: 'login' | 'register';
  setAuthMode: (mode: 'login' | 'register') => void;
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

  return (
    <div className="modal-backdrop">
      <article className="modal-card auth-modal">
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
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <label>
              <span className="field-label required">{t.password}</span>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                required
                onChange={(event) => setPassword(event.target.value)}
              />
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
                onChange={(event) => setRegisterFullName(event.target.value)}
              />
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
                onChange={(event) => setRegisterEmail(event.target.value)}
              />
            </label>
            <label>
              <span className="field-label required">{t.password}</span>
              <input
                type="password"
                placeholder="••••••••"
                value={registerPassword}
                required
                onChange={(event) => setRegisterPassword(event.target.value)}
              />
            </label>
            <label>
              <span className="field-label required">{t.confirmPassword}</span>
              <input
                type="password"
                placeholder="••••••••"
                value={registerPasswordConfirm}
                required
                onChange={(event) => setRegisterPasswordConfirm(event.target.value)}
              />
            </label>
            <button type="submit">{t.createAccount}</button>
          </form>
        )}
      </article>
    </div>
  );
}
