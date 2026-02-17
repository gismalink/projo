import { FormEvent } from 'react';
import { api } from '../../api/client';
import { HandlerDeps } from './handler-deps';
import { runWithErrorToast, runWithErrorToastVoid } from './handler-utils';

export function createAuthHandlers({ state, t, errorText, pushToast, refreshData }: HandlerDeps) {
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
    if (!state.email.trim() || !state.password.trim()) {
      pushToast(t.uiAuthEmailPasswordRequired);
      return;
    }

    await runWithErrorToast({
      operation: async () => {
        const result = await api.login(state.email, state.password);
        applyAuthSession(result, { includeIdentity: true });
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
    if (!payload.email.trim() || !payload.password.trim() || !payload.fullName.trim()) {
      pushToast(t.uiRegisterRequiredFields);
      return;
    }

    await runWithErrorToast({
      operation: async () => {
        const result = await api.register(payload);
        applyAuthSession(result, { includeIdentity: true });
        state.setEmail(payload.email);
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
    if (!state.token) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      pushToast(t.uiCompanyNameRequired);
      return;
    }

    await runWithErrorToast({
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

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      pushToast(t.uiInviteEmailRequired);
      return null;
    }

    const members = await runWithErrorToast({
      operation: async () => {
        const result = await api.inviteProjectMember(projectId, trimmedEmail, permission, state.token as string);
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
  }

  return {
    handleLogin,
    handleRegister,
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
