import { FormEvent } from 'react';
import { api } from '../../api/client';
import { resolveErrorMessage } from '../app-helpers';
import { HandlerDeps } from './handler-deps';

export function createAuthHandlers({ state, t, errorText, pushToast, refreshData }: HandlerDeps) {
  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    try {
      const result = await api.login(state.email, state.password);
      state.setToken(result.accessToken);
      state.setCurrentUserRole(result.user.role);
      state.setCurrentUserId(result.user.id);
      state.setCurrentUserEmail(result.user.email);
      state.setCurrentUserFullName(result.user.fullName);
      await refreshData(result.accessToken, state.selectedYear);
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
    try {
      const result = await api.register(payload);
      state.setToken(result.accessToken);
      state.setCurrentUserRole(result.user.role);
      state.setCurrentUserId(result.user.id);
      state.setCurrentUserEmail(result.user.email);
      state.setCurrentUserFullName(result.user.fullName);
      state.setEmail(payload.email);
      state.setPassword('');
      await refreshData(result.accessToken, state.selectedYear);
    } catch (error) {
      pushToast(resolveErrorMessage(error, t.uiRegisterFailed, errorText));
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
  }

  return {
    handleLogin,
    handleRegister,
    handleUpdateMyProfile,
    handleChangeMyPassword,
    handleLogout,
  };
}
