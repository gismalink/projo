import { FormEvent } from 'react';
import { api } from '../../api/client';
import { HandlerDeps } from './handler-deps';
import { runWithErrorToast, runWithErrorToastVoid } from './handler-utils';

export function createAuthHandlers({ state, t, errorText, pushToast, refreshData }: HandlerDeps) {
  const AUTH_MODE = (import.meta.env.VITE_AUTH_MODE ?? 'local').toLowerCase();
  const AUTH_BASE_URL_OVERRIDE = import.meta.env.VITE_AUTH_BASE_URL ?? '';

  function resolveAuthBaseUrl() {
    if (AUTH_BASE_URL_OVERRIDE) {
      return String(AUTH_BASE_URL_OVERRIDE).replace(/\/+$/, '');
    }
    if (typeof window === 'undefined') {
      return 'https://auth.gismalink.art';
    }
    const isTest = window.location.hostname.startsWith('test.');
    return isTest ? 'https://test.auth.gismalink.art' : 'https://auth.gismalink.art';
  }

  function redirectToSsoLogin(provider: 'google' | 'yandex' = 'google') {
    const authBase = resolveAuthBaseUrl();
    const returnUrl = typeof window === 'undefined' ? '/' : window.location.href;
    window.location.href = `${authBase}/auth/${provider}?returnUrl=${encodeURIComponent(returnUrl)}`;
  }

  function redirectToSsoLogout() {
    const authBase = resolveAuthBaseUrl();
    const returnUrl = typeof window === 'undefined' ? '/' : window.location.href;
    window.location.href = `${authBase}/auth/logout?returnUrl=${encodeURIComponent(returnUrl)}`;
  }

  const EMAIL_PATTERN =
    /^(?=.{6,254}$)(?=.{1,64}@)(?!.*\.\.)[a-z0-9](?:[a-z0-9_%+-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9_%+-]*[a-z0-9])?)*@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/i;

  function normalizeEmail(value: string) {
    return value.trim().toLowerCase();
  }

  function isValidEmail(value: string) {
    return EMAIL_PATTERN.test(value);
  }

  function applyAuthSession(
    payload: {
      accessToken: string;
      user: {
        id: string;
        email: string;
        fullName: string;
        role: string;
        workspaceId?: string;
        workspaceRole?: string;
      };
    },
    options?: { includeIdentity?: boolean },
  ) {
    state.setToken(payload.accessToken);
    state.setCurrentUserRole(payload.user.workspaceRole ?? payload.user.role);
    state.setCurrentWorkspaceId(payload.user.workspaceId ?? '');

    if (options?.includeIdentity) {
      state.setCurrentUserId(payload.user.id);
      state.setCurrentUserEmail(payload.user.email);
      state.setCurrentUserFullName(payload.user.fullName);
    }
  }

  async function loadMyProjects(tokenOverride?: string) {
    const authToken = tokenOverride ?? state.token;
    if (!authToken) return;

    const projects = await runWithErrorToast({
      operation: () => api.getMyProjects(authToken),
      fallbackMessage: t.uiLoadProjectsFailed,
      errorText,
      pushToast,
    });

    if (projects) {
      state.setMyProjectSpaces(projects.myProjects);
      state.setSharedProjectSpaces(projects.sharedProjects);
      state.setActiveProjectSpaceId(projects.activeProjectId);
    }
  }

  async function loadMyCompanies(tokenOverride?: string) {
    const authToken = tokenOverride ?? state.token;
    if (!authToken) return;

    const companiesResult = await runWithErrorToast({
      operation: () => api.getMyCompanies(authToken),
      fallbackMessage: t.uiLoadCompaniesFailed,
      errorText,
      pushToast,
    });

    if (companiesResult) {
      state.setCompanies(companiesResult.companies);
      state.setActiveCompanyId(companiesResult.activeCompanyId);
    }
  }

  async function handleLogin(event: FormEvent) {
    event.preventDefault();

    const normalizedEmail = normalizeEmail(state.email);
    const trimmedPassword = state.password.trim();

    if (!normalizedEmail || !trimmedPassword) {
      pushToast(t.uiAuthEmailPasswordRequired);
      return;
    }
    if (!isValidEmail(normalizedEmail)) {
      pushToast(t.uiAuthEmailInvalid);
      return;
    }
    if (trimmedPassword.length < 8) {
      pushToast(t.uiAuthPasswordMinLength);
      return;
    }

    await runWithErrorToast({
      operation: async () => {
        const result = await api.login(normalizedEmail, trimmedPassword);
        applyAuthSession(result, { includeIdentity: true });
        state.setEmail(normalizedEmail);
        state.setPassword('');
        await refreshData(result.accessToken, state.selectedYear);
        await loadMyCompanies(result.accessToken);
        await loadMyProjects(result.accessToken);
      },
      fallbackMessage: t.uiLoginFailed,
      errorText,
      pushToast,
    });
  }

  async function handleRegister(
    event: FormEvent,
    payload: {
      email: string;
      fullName: string;
      password: string;
    },
  ) {
    event.preventDefault();

    const normalizedEmail = normalizeEmail(payload.email);
    const trimmedFullName = payload.fullName.trim();
    const trimmedPassword = payload.password.trim();

    if (!normalizedEmail || !trimmedPassword || !trimmedFullName) {
      pushToast(t.uiRegisterRequiredFields);
      return;
    }
    if (!isValidEmail(normalizedEmail)) {
      pushToast(t.uiAuthEmailInvalid);
      return;
    }
    if (trimmedFullName.length < 2) {
      pushToast(t.uiRegisterFullNameMinLength);
      return;
    }
    if (trimmedPassword.length < 8) {
      pushToast(t.uiAuthPasswordMinLength);
      return;
    }

    await runWithErrorToast({
      operation: async () => {
        const result = await api.register({
          email: normalizedEmail,
          fullName: trimmedFullName,
          password: trimmedPassword,
        });
        applyAuthSession(result, { includeIdentity: true });
        state.setEmail(normalizedEmail);
        state.setPassword('');
        await refreshData(result.accessToken, state.selectedYear);
        await loadMyCompanies(result.accessToken);
        await loadMyProjects(result.accessToken);
      },
      fallbackMessage: t.uiRegisterFailed,
      errorText,
      pushToast,
    });
  }

  async function handleCreateProjectSpace(name: string) {
    if (!state.token) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      pushToast(t.uiProjectNameRequired);
      return;
    }

    await runWithErrorToast({
      operation: async () => {
        const result = await api.createProjectSpace(trimmedName, state.token as string);
        applyAuthSession(result);
        await refreshData(result.accessToken, state.selectedYear);
        await loadMyProjects(result.accessToken);
      },
      fallbackMessage: t.uiCreateProjectSpaceFailed,
      errorText,
      pushToast,
    });
  }

  async function handleCreateCompany(name: string) {
    if (!state.token) return false;

    const trimmedName = name.trim();
    if (!trimmedName) {
      pushToast(t.uiCompanyNameRequired);
      return false;
    }

    const created = await runWithErrorToastVoid({
      operation: async () => {
        const result = await api.createCompany(trimmedName, state.token as string);
        applyAuthSession(result);
        await refreshData(result.accessToken, state.selectedYear);
        await loadMyCompanies(result.accessToken);
        await loadMyProjects(result.accessToken);
      },
      fallbackMessage: t.uiCreateCompanyFailed,
      errorText,
      pushToast,
    });

    return created;
  }

  async function handleSwitchCompany(companyId: string) {
    if (!state.token) return;

    await runWithErrorToast({
      operation: async () => {
        const result = await api.switchCompany(companyId, state.token as string);
        applyAuthSession(result);
        await refreshData(result.accessToken, state.selectedYear);
        await loadMyCompanies(result.accessToken);
        await loadMyProjects(result.accessToken);
      },
      fallbackMessage: t.uiSwitchCompanyFailed,
      errorText,
      pushToast,
    });
  }

  async function handleUpdateCompanyName(companyId: string, name: string) {
    if (!state.token) return false;

    const trimmedName = name.trim();
    if (!trimmedName) {
      pushToast(t.uiCompanyNameRequired);
      return false;
    }

    const updated = await runWithErrorToastVoid({
      operation: async () => {
        await api.updateCompanyName(companyId, trimmedName, state.token as string);
        await loadMyCompanies(state.token as string);
      },
      fallbackMessage: t.uiUpdateCompanyFailed,
      errorText,
      pushToast,
    });

    if (updated) {
      pushToast(t.uiUpdateCompanySuccess);
      return true;
    }

    return false;
  }

  async function handleSwitchProjectSpace(projectId: string) {
    if (!state.token) return;

    await runWithErrorToast({
      operation: async () => {
        const result = await api.switchProjectSpace(projectId, state.token as string);
        applyAuthSession(result);
        await refreshData(result.accessToken, state.selectedYear);
        await loadMyProjects(result.accessToken);
      },
      fallbackMessage: t.uiSwitchProjectSpaceFailed,
      errorText,
      pushToast,
    });
  }

  async function handleUpdateProjectSpaceName(projectId: string, name: string) {
    if (!state.token) return false;

    const trimmedName = name.trim();
    if (!trimmedName) {
      pushToast(t.uiProjectNameRequired);
      return false;
    }

    const updated = await runWithErrorToastVoid({
      operation: async () => {
        await api.updateProjectSpaceName(projectId, trimmedName, state.token as string);
        await loadMyProjects(state.token as string);
      },
      fallbackMessage: t.uiUpdateProjectSpaceFailed,
      errorText,
      pushToast,
    });

    if (updated) {
      pushToast(t.uiUpdateProjectSpaceSuccess);
      return true;
    }

    return false;
  }

  async function handleDeleteProjectSpace(projectId: string) {
    if (!state.token) return false;

    const deleted = await runWithErrorToastVoid({
      operation: async () => {
        const result = await api.deleteProjectSpace(projectId, state.token as string);
        applyAuthSession(result);
        await refreshData(result.accessToken, state.selectedYear);
        await loadMyProjects(result.accessToken);
      },
      fallbackMessage: t.uiDeleteProjectSpaceFailed,
      errorText,
      pushToast,
    });

    if (deleted) {
      pushToast(t.uiDeleteProjectSpaceSuccess);
      return true;
    }

    return false;
  }

  async function handleCopyProjectSpace(projectId: string, name: string) {
    if (!state.token) return false;

    const trimmedName = name.trim();
    if (!trimmedName) {
      pushToast(t.uiProjectNameRequired);
      return false;
    }

    const copied = await runWithErrorToastVoid({
      operation: async () => {
        await api.copyProjectSpace(projectId, trimmedName, state.token as string);
        await loadMyProjects(state.token as string);
      },
      fallbackMessage: t.uiCopyProjectSpaceFailed,
      errorText,
      pushToast,
    });

    if (copied) {
      pushToast(t.uiCopyProjectSpaceSuccess);
      return true;
    }

    return false;
  }

  async function loadProjectMembers(projectId: string) {
    if (!state.token) return null;

    return (
      (await runWithErrorToast({
        operation: async () => {
          const result = await api.getProjectMembers(projectId, state.token as string);
          return result.members;
        },
        fallbackMessage: t.uiLoadProjectMembersFailed,
        errorText,
        pushToast,
      })) ?? null
    );
  }

  async function handleInviteProjectMember(projectId: string, email: string, permission: 'viewer' | 'editor') {
    if (!state.token) return null;

    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
      pushToast(t.uiInviteEmailRequired);
      return null;
    }
    if (!isValidEmail(normalizedEmail)) {
      pushToast(t.uiInviteEmailInvalid);
      return null;
    }

    const members = await runWithErrorToast({
      operation: async () => {
        const result = await api.inviteProjectMember(projectId, normalizedEmail, permission, state.token as string);
        return result.members;
      },
      fallbackMessage: t.uiInviteFailed,
      errorText,
      pushToast,
    });

    if (members) {
      pushToast(t.uiInviteSuccess);
      return members;
    }

    return null;
  }

  async function handleUpdateProjectMemberPermission(
    projectId: string,
    targetUserId: string,
    permission: 'viewer' | 'editor',
  ) {
    if (!state.token) return null;

    const members = await runWithErrorToast({
      operation: async () => {
        const result = await api.updateProjectMemberPermission(projectId, targetUserId, permission, state.token as string);
        await loadMyProjects(state.token as string);
        return result.members;
      },
      fallbackMessage: t.uiMemberRoleUpdateFailed,
      errorText,
      pushToast,
    });

    if (members) {
      pushToast(t.uiMemberRoleUpdated);
      return members;
    }

    return null;
  }

  async function handleRemoveProjectMember(projectId: string, targetUserId: string) {
    if (!state.token) return null;

    const members = await runWithErrorToast({
      operation: async () => {
        const result = await api.removeProjectMember(projectId, targetUserId, state.token as string);
        await loadMyProjects(state.token as string);
        return result.members;
      },
      fallbackMessage: t.uiMemberRemoveFailed,
      errorText,
      pushToast,
    });

    if (members) {
      pushToast(t.uiMemberRemoved);
      return members;
    }

    return null;
  }

  async function handleUpdateMyProfile(fullName: string) {
    if (!state.token) return;
    const user = await runWithErrorToast({
      operation: () => api.updateMe({ fullName }, state.token as string),
      fallbackMessage: t.uiUpdateProfileFailed,
      errorText,
      pushToast,
    });

    if (user) {
      state.setCurrentUserFullName(user.fullName);
    }
  }

  async function handleChangeMyPassword(currentPassword: string, newPassword: string) {
    if (!state.token) return;
    const changed = await runWithErrorToastVoid({
      operation: async () => {
        await api.changePassword({ currentPassword, newPassword }, state.token as string);
      },
      fallbackMessage: t.uiChangePasswordFailed,
      errorText,
      pushToast,
    });

    if (changed) {
      pushToast(t.passwordChangedSuccess);
    }
  }

  async function handleLogout() {
    const shouldRedirectToSso = AUTH_MODE === 'sso';

    if (state.token) {
      try {
        await api.logout(state.token);
      } catch {
        // client-side logout should proceed even if API logout fails
      }
    }

    state.setToken(null);
    state.setCurrentUserRole(null);
    state.setCurrentUserId('');
    state.setCurrentUserEmail('');
    state.setCurrentUserFullName('');
    state.setCurrentWorkspaceId('');
    state.setMyProjectSpaces([]);
    state.setSharedProjectSpaces([]);
    state.setActiveProjectSpaceId('');
    state.setCompanies([]);
    state.setActiveCompanyId('');

    if (shouldRedirectToSso) {
      redirectToSsoLogout();
    }
  }

  async function bootstrapSsoSession() {
    if (AUTH_MODE !== 'sso') return;
    if (state.token) return;

    const result = await runWithErrorToast({
      operation: () => api.ssoGetToken(),
      fallbackMessage: t.uiLoginFailed,
      errorText,
      pushToast,
    });

    if (!result || !result.authenticated || !result.token) {
      return;
    }

    // projo-specific identity/workspace context comes from projo API, not from auth service.
    state.setToken(result.token);

    const me = await runWithErrorToast({
      operation: () => api.getMe(result.token as string),
      fallbackMessage: t.uiLoginFailed,
      errorText,
      pushToast,
    });

    if (me) {
      state.setCurrentUserId(me.id);
      state.setCurrentUserEmail(me.email);
      state.setCurrentUserFullName(me.fullName);
      state.setCurrentUserRole(me.workspaceRole ?? me.role);
      state.setCurrentWorkspaceId(me.workspaceId ?? '');
    }

    await refreshData(result.token, state.selectedYear);
    await loadMyCompanies(result.token);
    await loadMyProjects(result.token);
  }

  function handleOauthLoginGoogle() {
    redirectToSsoLogin('google');
  }

  function handleOauthLoginYandex() {
    redirectToSsoLogin('yandex');
  }

  return {
    handleLogin,
    handleRegister,
    handleOauthLoginGoogle,
    handleOauthLoginYandex,
    bootstrapSsoSession,
    loadMyProjects,
    loadMyCompanies,
    handleCreateCompany,
    handleSwitchCompany,
    handleUpdateCompanyName,
    handleCreateProjectSpace,
    handleSwitchProjectSpace,
    handleUpdateProjectSpaceName,
    handleDeleteProjectSpace,
    handleCopyProjectSpace,
    loadProjectMembers,
    handleInviteProjectMember,
    handleUpdateProjectMemberPermission,
    handleRemoveProjectMember,
    handleUpdateMyProfile,
    handleChangeMyPassword,
    handleLogout,
  };
}
