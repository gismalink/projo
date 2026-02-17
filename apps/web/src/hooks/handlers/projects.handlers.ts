import { FormEvent } from 'react';
import { api } from '../../api/client';
import { isoToInputDate } from '../app-helpers';
import { HandlerDeps } from './handler-deps';
import { runWithErrorToast, runWithErrorToastVoid } from './handler-utils';

function getNextProjectCode(projects: Array<{ code: string }>) {
  const suffixes = projects
    .map((project) => {
      const match = project.code.match(/^PRJ-(\d+)$/i);
      return match ? Number(match[1]) : null;
    })
    .filter((value): value is number => value !== null && Number.isFinite(value));

  const maxValue = suffixes.length > 0 ? Math.max(...suffixes) : 0;
  const nextValue = maxValue + 1;
  return `PRJ-${String(nextValue).padStart(3, '0')}`;
}

export function createProjectsHandlers({
  state,
  t,
  errorText,
  pushToast,
  refreshData,
  loadProjectDetail,
}: HandlerDeps) {
  function openProjectModal() {
    state.setProjectCode(getNextProjectCode(state.projects));
    state.setProjectTeamTemplateId('');
    state.setIsProjectModalOpen(true);
  }

  function openProjectDatesModal(projectId: string) {
    const detail = state.projectDetails[projectId];
    if (!detail) return;
    state.setEditProjectId(projectId);
    state.setEditProjectStartDate(isoToInputDate(detail.startDate));
    state.setEditProjectEndDate(isoToInputDate(detail.endDate));
    state.setIsProjectDatesModalOpen(true);
  }

  async function handleCreateProject(event: FormEvent) {
    event.preventDefault();
    if (!state.token) return;
    const created = await runWithErrorToastVoid({
      operation: async () => {
        await api.createProject(
          {
            code: state.projectCode,
            name: state.projectName,
            startDate: new Date(state.projectStartDate).toISOString(),
            endDate: new Date(state.projectEndDate).toISOString(),
            status: 'planned',
            priority: 2,
            links: [],
            teamTemplateId: state.projectTeamTemplateId || undefined,
          },
          state.token as string,
        );

        await refreshData(state.token as string, state.selectedYear);
      },
      fallbackMessage: t.uiCreateProjectFailed,
      errorText,
      pushToast,
    });

    if (created) {
      state.setIsProjectModalOpen(false);
      state.setProjectTeamTemplateId('');
      state.setProjectCode((prev) => {
        const match = prev.match(/(\d+)$/);
        if (!match) return `${prev}-1`;
        const next = String(Number(match[1]) + 1).padStart(match[1].length, '0');
        return prev.replace(/\d+$/, next);
      });
    }
  }

  async function handleUpdateProjectDates(event: FormEvent) {
    event.preventDefault();
    if (!state.token || !state.editProjectId) return;

    const updated = await runWithErrorToastVoid({
      operation: async () => {
        await api.updateProject(
          state.editProjectId as string,
          {
            startDate: new Date(state.editProjectStartDate).toISOString(),
            endDate: new Date(state.editProjectEndDate).toISOString(),
          },
          state.token as string,
        );
        await refreshData(state.token as string, state.selectedYear, state.editProjectId as string);
      },
      fallbackMessage: t.uiCreateProjectFailed,
      errorText,
      pushToast,
    });

    if (updated) {
      state.setIsProjectDatesModalOpen(false);
    }
  }

  async function handleAutoSaveProjectMeta(
    projectId: string,
    payload: { code: string; name: string; startDate: string; endDate: string; teamTemplateId?: string | null },
  ) {
    if (!state.token) return;

    await runWithErrorToast({
      operation: async () => {
        await api.updateProject(
          projectId,
          {
            code: payload.code,
            name: payload.name,
            startDate: payload.startDate,
            endDate: payload.endDate,
            teamTemplateId: payload.teamTemplateId === undefined ? undefined : payload.teamTemplateId || '',
          },
          state.token as string,
        );
        await refreshData(state.token as string, state.selectedYear, projectId);
      },
      fallbackMessage: t.uiCreateProjectFailed,
      errorText,
      pushToast,
    });
  }

  async function handleSelectProject(projectId: string) {
    if (!state.token) return;

    if (state.expandedProjectIds.includes(projectId)) {
      const nextExpanded = state.expandedProjectIds.filter((id) => id !== projectId);
      state.setExpandedProjectIds(nextExpanded);

      if (state.selectedProjectId === projectId) {
        const fallbackProjectId = nextExpanded[0] ?? '';
        state.setSelectedProjectId(fallbackProjectId);
        state.setSelectedProjectDetail(fallbackProjectId ? state.projectDetails[fallbackProjectId] ?? null : null);
        if (!fallbackProjectId) state.setEditAssignmentId('');
      }
      return;
    }

    await runWithErrorToast({
      operation: () => loadProjectDetail(state.token as string, projectId, false),
      fallbackMessage: t.uiLoadProjectDetailsFailed,
      errorText,
      pushToast,
    });
  }

  function handleMoveProject(projectId: string, direction: 'up' | 'down') {
    const ids = state.timeline.map((row) => row.id);
    state.setTimelineOrder((prev) => {
      const base = prev.length === ids.length && ids.every((id) => prev.includes(id)) ? [...prev] : [...ids];
      const index = base.indexOf(projectId);
      if (index < 0) return base;
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= base.length) return base;
      const next = [...base];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  return {
    openProjectModal,
    openProjectDatesModal,
    handleCreateProject,
    handleUpdateProjectDates,
    handleAutoSaveProjectMeta,
    handleSelectProject,
    handleMoveProject,
  };
}
