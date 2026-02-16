import { api } from '../../api/client';
import { resolveErrorMessage } from '../app-helpers';
import { HandlerDeps } from './handler-deps';

function shiftIsoDateByDays(value: string, days: number) {
  const date = new Date(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

export function createTimelineHandlers({
  state,
  t,
  errorText,
  pushToast,
  refreshData,
  refreshTimelineYearData,
}: HandlerDeps) {
  async function handleYearChange(nextYear: number) {
    state.setSelectedYear(nextYear);
    if (!state.token) return;
    try {
      await refreshTimelineYearData(state.token, nextYear);
    } catch (error) {
      pushToast(resolveErrorMessage(error, t.uiLoadTimelineFailed, errorText));
    }
  }

  async function handleAdjustProjectPlan(
    projectId: string,
    nextStartIso: string,
    nextEndIso: string,
    shiftDays: number,
    mode: 'move' | 'resize-start' | 'resize-end',
  ) {
    if (!state.token) return;

    try {
      await api.updateProject(
        projectId,
        {
          startDate: nextStartIso,
          endDate: nextEndIso,
        },
        state.token,
      );

      if (mode !== 'resize-end' && shiftDays !== 0) {
        const projectAssignments = state.assignments.filter((assignment) => assignment.projectId === projectId);
        await Promise.all(
          projectAssignments.map((assignment) =>
            api.updateAssignment(
              assignment.id,
              {
                assignmentStartDate: shiftIsoDateByDays(assignment.assignmentStartDate, shiftDays),
                assignmentEndDate: shiftIsoDateByDays(assignment.assignmentEndDate, shiftDays),
              },
              state.token as string,
            ),
          ),
        );
      }

      await refreshData(state.token, state.selectedYear, projectId);
    } catch (error) {
      pushToast(resolveErrorMessage(error, t.uiCreateProjectFailed, errorText));
    }
  }

  return {
    handleYearChange,
    handleAdjustProjectPlan,
  };
}
