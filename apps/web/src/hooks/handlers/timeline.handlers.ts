import { api } from '../../api/client';
import { HandlerDeps } from './handler-deps';
import { runWithErrorToast } from './handler-utils';

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
    await runWithErrorToast({
      operation: () => refreshTimelineYearData(state.token as string, nextYear),
      fallbackMessage: t.uiLoadTimelineFailed,
      errorText,
      pushToast,
    });
  }

  async function handleAdjustProjectPlan(
    projectId: string,
    nextStartIso: string,
    nextEndIso: string,
    shiftDays: number,
    mode: 'move' | 'resize-start' | 'resize-end',
  ) {
    if (!state.token) return;

    await runWithErrorToast({
      operation: async () => {
        await api.updateProject(
          projectId,
          {
            startDate: nextStartIso,
            endDate: nextEndIso,
          },
          state.token as string,
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

        await refreshData(state.token as string, state.selectedYear, projectId);
      },
      fallbackMessage: t.uiCreateProjectFailed,
      errorText,
      pushToast,
    });
  }

  return {
    handleYearChange,
    handleAdjustProjectPlan,
  };
}
