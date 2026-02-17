import { FormEvent } from 'react';
import { api } from '../../api/client';
import { resolveErrorMessage } from '../app-helpers';
import { HandlerDeps } from './handler-deps';

export function createAuthHandlers({ state, t, errorText, pushToast, refreshData }: HandlerDeps) {
  async function loadMyProjects(tokenOverride?: string) {
    const authToken = tokenOverride ?? state.token;
    if (!authToken) return;

    try {
      const projects = await api.getMyProjects(authToken);
      state.setMyProjectSpaces(projects.myProjects);
      state.setSharedProjectSpaces(projects.sharedProjects);
      state.setActiveProjectSpaceId(projects.activeProjectId);
    } catch (error) {
      pushToast(resolveErrorMessage(error, t.uiLoadProjectsFailed, errorText));
    }
  }

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    if (!state.email.trim() || !state.password.trim()) {
      pushToast(t.uiAuthEmailPasswordRequired);
      return;
    }

    try {
      const result = await api.login(state.email, state.password);
      state.setToken(result.accessToken);
      state.setCurrentUserRole(result.user.workspaceRole ?? result.user.role);
      state.setCurrentUserId(result.user.id);
      state.setCurrentUserEmail(result.user.email);
      state.setCurrentUserFullName(result.user.fullName);
      state.setCurrentWorkspaceId(result.user.workspaceId ?? '');
      await refreshData(result.accessToken, state.selectedYear);
      await loadMyProjects(result.accessToken);
    } catch (error) {
      pushToast(resolveErrorMessage(error, t.uiLoginFailed, errorText));
    }
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

    try {
      const result = await api.register(payload);
      state.setToken(result.accessToken);
      state.setCurrentUserRole(result.user.workspaceRole ?? result.user.role);
      state.setCurrentUserId(result.user.id);
      state.setCurrentUserEmail(result.user.email);
      state.setCurrentUserFullName(result.user.fullName);
      state.setCurrentWorkspaceId(result.user.workspaceId ?? '');
      state.setEmail(payload.email);
      state.setPassword('');
      await refreshData(result.accessToken, state.selectedYear);
      await loadMyProjects(result.accessToken);
    } catch (error) {
      pushToast(resolveErrorMessage(error, t.uiRegisterFailed, errorText));
    }
  }

  async function handleCreateProjectSpace(name: string) {
    if (!state.token) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      pushToast(t.uiProjectNameRequired);
      return;
    }

    try {
      const result = await api.createProjectSpace(trimmedName, state.token);
      state.setToken(result.accessToken);
      state.setCurrentUserRole(result.user.workspaceRole ?? result.user.role);
      state.setCurrentWorkspaceId(result.user.workspaceId ?? '');
      await refreshData(result.accessToken, state.selectedYear);
      await loadMyProjects(result.accessToken);
    } catch (error) {
      pushToast(resolveErrorMessage(error, t.uiCreateProjectSpaceFailed, errorText));
    }
  }

  async function handleSwitchProjectSpace(projectId: string) {
    if (!state.token) return;

    try {
      const result = await api.switchProjectSpace(projectId, state.token);
      state.setToken(result.accessToken);
      state.setCurrentUserRole(result.user.workspaceRole ?? result.user.role);
      state.setCurrentWorkspaceId(result.user.workspaceId ?? '');
      await refreshData(result.accessToken, state.selectedYear);
      await loadMyProjects(result.accessToken);
    } catch (error) {
      pushToast(resolveErrorMessage(error, t.uiSwitchProjectSpaceFailed, errorText));
    }
  }

  async function handleUpdateProjectSpaceName(projectId: string, name: string) {
    if (!state.token) return false;

    const trimmedName = name.trim();
    if (!trimmedName) {
      pushToast(t.uiProjectNameRequired);
      return false;
    }

    try {
      await api.updateProjectSpaceName(projectId, trimmedName, state.token);
      await loadMyProjects(state.token);
      pushToast(t.uiUpdateProjectSpaceSuccess);
      return true;
    } catch (error) {
      pushToast(resolveErrorMessage(error, t.uiUpdateProjectSpaceFailed, errorText));
      return false;
    }
  }

  async function loadProjectMembers(projectId: string) {
    if (!state.token) return null;

    try {
      const result = await api.getProjectMembers(projectId, state.token);
      return result.members;
    } catch (error) {
      pushToast(resolveErrorMessage(error, t.uiLoadProjectMembersFailed, errorText));
      return null;
    }
  }

  async function handleInviteProjectMember(projectId: string, email: string, permission: 'viewer' | 'editor') {
    if (!state.token) return null;

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      pushToast(t.uiInviteEmailRequired);
      return null;
    }

    try {
      const result = await api.inviteProjectMember(projectId, trimmedEmail, permission, state.token);
      pushToast(t.uiInviteSuccess);
      return result.members;
    } catch (error) {
      pushToast(resolveErrorMessage(error, t.uiInviteFailed, errorText));
      return null;
    }
  }

  async function handleUpdateProjectMemberPermission(
    projectId: string,
    targetUserId: string,
    permission: 'viewer' | 'editor',
  ) {
    if (!state.token) return null;

    try {
      const result = await api.updateProjectMemberPermission(projectId, targetUserId, permission, state.token);
      pushToast(t.uiMemberRoleUpdated);
      await loadMyProjects(state.token);
      return result.members;
    } catch (error) {
      pushToast(resolveErrorMessage(error, t.uiMemberRoleUpdateFailed, errorText));
      return null;
    }
  }

  async function handleRemoveProjectMember(projectId: string, targetUserId: string) {
    if (!state.token) return null;

    try {
      const result = await api.removeProjectMember(projectId, targetUserId, state.token);
      pushToast(t.uiMemberRemoved);
      await loadMyProjects(state.token);
      return result.members;
    } catch (error) {
      pushToast(resolveErrorMessage(error, t.uiMemberRemoveFailed, errorText));
      return null;
    }
  }

  async function handleUpdateMyProfile(fullName: string) {
    if (!state.token) return;
    try {
      const user = await api.updateMe({ fullName }, state.token);
      state.setCurrentUserFullName(user.fullName);
    } catch (error) {
      pushToast(resolveErrorMessage(error, t.uiUpdateProfileFailed, errorText));
    }
  }

  async function handleChangeMyPassword(currentPassword: string, newPassword: string) {
    if (!state.token) return;
    try {
      await api.changePassword({ currentPassword, newPassword }, state.token);
      pushToast(t.passwordChangedSuccess);
    } catch (error) {
      pushToast(resolveErrorMessage(error, t.uiChangePasswordFailed, errorText));
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
  }

  return {
    handleLogin,
    handleRegister,
    loadMyProjects,
    handleCreateProjectSpace,
    handleSwitchProjectSpace,
    handleUpdateProjectSpaceName,
    loadProjectMembers,
    handleInviteProjectMember,
    handleUpdateProjectMemberPermission,
    handleRemoveProjectMember,
    handleUpdateMyProfile,
    handleChangeMyPassword,
    handleLogout,
  };
}
