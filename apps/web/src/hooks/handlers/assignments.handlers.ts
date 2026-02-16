import { FormEvent } from 'react';
import { api } from '../../api/client';
import { isoToInputDate, resolveErrorMessage } from '../app-helpers';
import { HandlerDeps } from './handler-deps';

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
    try {
      await api.createAssignment(
        {
          projectId: state.assignmentProjectId,
          employeeId: state.assignmentEmployeeId,
          assignmentStartDate: new Date(state.assignmentStartDate).toISOString(),
          assignmentEndDate: new Date(state.assignmentEndDate).toISOString(),
          allocationPercent: state.assignmentPercent,
        },
        state.token,
      );
      await refreshData(state.token, state.selectedYear, state.assignmentProjectId);
      state.setIsAssignmentModalOpen(false);
    } catch (error) {
      pushToast(resolveErrorMessage(error, t.uiCreateAssignmentFailed, errorText));
    }
  }

  async function handleUpdateAssignment(event: FormEvent) {
    event.preventDefault();
    if (!state.token || !state.editAssignmentId || !state.selectedProjectId) return;
    try {
      await api.updateAssignment(
        state.editAssignmentId,
        {
          assignmentStartDate: new Date(state.editAssignmentStartDate).toISOString(),
          assignmentEndDate: new Date(state.editAssignmentEndDate).toISOString(),
          allocationPercent: state.editAssignmentPercent,
        },
        state.token,
      );
      await refreshData(state.token, state.selectedYear, state.selectedProjectId);
    } catch (error) {
      pushToast(resolveErrorMessage(error, t.uiUpdateAssignmentFailed, errorText));
    }
  }

  async function handleDeleteAssignment(projectId: string, assignmentId: string) {
    if (!state.token) return;
    try {
      await api.deleteAssignment(assignmentId, state.token);
      await refreshData(state.token, state.selectedYear, projectId);
    } catch (error) {
      pushToast(resolveErrorMessage(error, t.uiUpdateAssignmentFailed, errorText));
    }
  }

  async function handleAdjustAssignmentPlan(
    projectId: string,
    assignmentId: string,
    nextStartIso: string,
    nextEndIso: string,
  ) {
    if (!state.token) return;
    try {
      await api.updateAssignment(
        assignmentId,
        {
          assignmentStartDate: nextStartIso,
          assignmentEndDate: nextEndIso,
        },
        state.token,
      );
      await refreshData(state.token, state.selectedYear, projectId);
    } catch (error) {
      pushToast(resolveErrorMessage(error, t.uiUpdateAssignmentFailed, errorText));
    }
  }

  return {
    handleEditorAssignmentChange,
    handleCreateAssignment,
    handleUpdateAssignment,
    handleDeleteAssignment,
    handleAdjustAssignmentPlan,
  };
}
