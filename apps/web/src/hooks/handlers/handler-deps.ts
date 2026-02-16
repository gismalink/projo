import { ProjectDetail } from '../../api/client';
import { AppState } from '../useAppState';

export type HandlerDeps = {
  state: AppState;
  t: Record<string, string>;
  errorText: Record<string, string>;
  pushToast: (message: string) => void;
  refreshData: (authToken: string, year: number, preferredProjectId?: string) => Promise<void>;
  refreshTimelineYearData: (authToken: string, year: number) => Promise<void>;
  loadProjectDetail: (authToken: string, projectId: string, preserveEditor?: boolean) => Promise<void>;
  setAssignmentEditorFromDetail: (detail: ProjectDetail, assignmentId?: string) => void;
};
