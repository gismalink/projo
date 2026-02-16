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
      await refreshData(result.accessToken, state.selectedYear);
    } catch (error) {
      pushToast(resolveErrorMessage(error, t.uiLoginFailed, errorText));
    }
  }

  return {
    handleLogin,
  };
}
