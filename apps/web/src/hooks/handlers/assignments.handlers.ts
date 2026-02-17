import { FormEvent } from 'react';
import { api } from '../../api/client';
import { isoToInputDate } from '../app-helpers';
import { HandlerDeps } from './handler-deps';
import { runWithErrorToast, runWithErrorToastVoid } from './handler-utils';

export function createAssignmentsHandlers({
  state,
  t,
  errorText,
  pushToast,
  refreshData,
}: HandlerDeps) {
  function handleEditorAssignmentChange(projectId: string, assignmentId: string) {
    if (state.selectedProjectId === projectId && state.editAssignmentId === assignmentId) {
      state.setEditAssignmentId('');
      state.setEditAssignmentStartDate('');
      state.setEditAssignmentEndDate('');
      state.setEditAssignmentPercent(0);
      return;
    }

    const detail = state.projectDetails[projectId];
    if (!detail) return;

    state.setSelectedProjectId(projectId);
    state.setSelectedProjectDetail(detail);
    state.setEditAssignmentId(assignmentId);
    const next = detail.assignments.find((assignment) => assignment.id === assignmentId);
    if (!next) return;
    state.setEditAssignmentStartDate(isoToInputDate(next.assignmentStartDate));
    state.setEditAssignmentEndDate(isoToInputDate(next.assignmentEndDate));
    state.setEditAssignmentPercent(Number(next.allocationPercent));
  }

  async function handleCreateAssignment(event: FormEvent) {
    event.preventDefault();
    if (!state.token || !state.assignmentProjectId || !state.assignmentEmployeeId) return;
    const created = await runWithErrorToastVoid({
      operation: async () => {
        await api.createAssignment(
          {
            projectId: state.assignmentProjectId,
            employeeId: state.assignmentEmployeeId,
            assignmentStartDate: new Date(state.assignmentStartDate).toISOString(),
            assignmentEndDate: new Date(state.assignmentEndDate).toISOString(),
            allocationPercent: state.assignmentPercent,
          },
          state.token as string,
        );
        await refreshData(state.token as string, state.selectedYear, state.assignmentProjectId as string);
      },
      fallbackMessage: t.uiCreateAssignmentFailed,
      errorText,
      pushToast,
    });

    if (created) {
      state.setIsAssignmentModalOpen(false);
    }
  }

  async function handleUpdateAssignment(event: FormEvent) {
    event.preventDefault();
    if (!state.token || !state.editAssignmentId || !state.selectedProjectId) return;
    await runWithErrorToast({
      operation: async () => {
        await api.updateAssignment(
          state.editAssignmentId as string,
          {
            assignmentStartDate: new Date(state.editAssignmentStartDate).toISOString(),
            assignmentEndDate: new Date(state.editAssignmentEndDate).toISOString(),
            allocationPercent: state.editAssignmentPercent,
          },
          state.token as string,
        );
        await refreshData(state.token as string, state.selectedYear, state.selectedProjectId as string);
      },
      fallbackMessage: t.uiUpdateAssignmentFailed,
      errorText,
      pushToast,
    });
  }

  async function handleDeleteAssignment(projectId: string, assignmentId: string) {
    if (!state.token) return;
    await runWithErrorToast({
      operation: async () => {
        await api.deleteAssignment(assignmentId, state.token as string);
        await refreshData(state.token as string, state.selectedYear, projectId);
      },
      fallbackMessage: t.uiUpdateAssignmentFailed,
      errorText,
      pushToast,
    });
  }

  async function handleAdjustAssignmentPlan(
    projectId: string,
    assignmentId: string,
    nextStartIso: string,
    nextEndIso: string,
  ) {
    if (!state.token) return;
    await runWithErrorToast({
      operation: async () => {
        await api.updateAssignment(
          assignmentId,
          {
            assignmentStartDate: nextStartIso,
            assignmentEndDate: nextEndIso,
          },
          state.token as string,
        );
        await refreshData(state.token as string, state.selectedYear, projectId);
      },
      fallbackMessage: t.uiUpdateAssignmentFailed,
      errorText,
      pushToast,
    });
  }

  async function handleUpdateAssignmentCurve(
    projectId: string,
    assignmentId: string,
    loadProfile: {
      mode: 'curve';
      points: Array<{ date: string; value: number }>;
    },
  ) {
    if (!state.token) return;
    await runWithErrorToast({
      operation: async () => {
        await api.updateAssignment(
          assignmentId,
          {
            loadProfile,
          },
          state.token as string,
        );
        await refreshData(state.token as string, state.selectedYear, projectId);
      },
      fallbackMessage: t.uiUpdateAssignmentFailed,
      errorText,
      pushToast,
    });
  }

  return {
    handleEditorAssignmentChange,
    handleCreateAssignment,
    handleUpdateAssignment,
    handleDeleteAssignment,
    handleAdjustAssignmentPlan,
    handleUpdateAssignmentCurve,
  };
}
