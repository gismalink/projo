import { ReactNode } from 'react';
import { ProjectSpaceItem } from '../../api/client';
import { Icon } from '../Icon';

type ProjectHomeSectionProps = {
  t: Record<string, string>;
  myProjectSpaces: ProjectSpaceItem[];
  sharedProjectSpaces: ProjectSpaceItem[];
  canSeedDemoWorkspace: boolean;
  onOpenProject: (projectId: string) => Promise<void>;
  onCopyProjectSpaceCard: (projectId: string, sourceName: string) => Promise<void>;
  onOpenProjectSettingsById: (projectId: string) => Promise<void>;
  onCreateDemoProjectSpaceCard: () => Promise<void>;
  onCreateProjectSpaceCard: () => Promise<void>;
  renderPlanStats: (projectsCount: number, totalAllocationPercent: number, peakAllocationPercent: number) => ReactNode;
};

export function ProjectHomeSection({
  t,
  myProjectSpaces,
  sharedProjectSpaces,
  canSeedDemoWorkspace,
  onOpenProject,
  onCopyProjectSpaceCard,
  onOpenProjectSettingsById,
  onCreateDemoProjectSpaceCard,
  onCreateProjectSpaceCard,
  renderPlanStats,
}: ProjectHomeSectionProps) {
  return (
    <article className="card" style={{ marginBottom: 12 }}>
      <div className="timeline-form">
        <h4>{t.myProjects}</h4>
        <div className="project-space-grid">
          {myProjectSpaces.map((item) => (
            <div key={item.id} className="project-space-card" onClick={() => void onOpenProject(item.id)}>
              <div className="project-space-card-topline">
                <strong>{item.name}</strong>
                <div className="project-space-card-actions">
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={(event) => {
                      event.stopPropagation();
                      void onCopyProjectSpaceCard(item.id, item.name);
                    }}
                    aria-label={t.copyProjectSpace}
                    data-tooltip={t.copyProjectSpace}
                  >
                    <Icon name="copy" />
                  </button>
                  {item.isOwner || item.role === 'EDITOR' ? (
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={(event) => {
                        event.stopPropagation();
                        void onOpenProjectSettingsById(item.id);
                      }}
                      aria-label={t.projectSettings}
                      data-tooltip={t.projectSettings}
                    >
                      <Icon name="edit" />
                    </button>
                  ) : null}
                </div>
              </div>
              {renderPlanStats(item.projectsCount, item.totalAllocationPercent, item.peakAllocationPercent)}
              <span>{item.role}</span>
            </div>
          ))}
          {canSeedDemoWorkspace ? (
            <button
              type="button"
              className="project-space-card project-space-card-create"
              onClick={() => void onCreateDemoProjectSpaceCard()}
              aria-label={t.createDemoProject}
              data-tooltip={t.createDemoProject}
            >
              <span className="project-space-card-create-plus">
                <Icon name="copy" />
              </span>
            </button>
          ) : null}
          <button
            type="button"
            className="project-space-card project-space-card-create"
            onClick={() => void onCreateProjectSpaceCard()}
            aria-label={t.createProjectSpace}
            data-tooltip={t.createProjectSpace}
          >
            <span className="project-space-card-create-plus">
              <Icon name="plus" />
            </span>
          </button>
        </div>

        <h4>{t.sharedProjects}</h4>
        {sharedProjectSpaces.length === 0 ? (
          <p className="muted">{t.noSharedProjects}</p>
        ) : (
          <div className="project-space-grid">
            {sharedProjectSpaces.map((item) => (
              <div key={item.id} className="project-space-card" onClick={() => void onOpenProject(item.id)}>
                <div className="project-space-card-topline">
                  <strong>{item.name}</strong>
                  {item.isOwner || item.role === 'EDITOR' ? (
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={(event) => {
                        event.stopPropagation();
                        void onOpenProjectSettingsById(item.id);
                      }}
                      aria-label={t.participants}
                      data-tooltip={t.participants}
                    >
                      <Icon name="edit" />
                    </button>
                  ) : null}
                </div>
                {renderPlanStats(item.projectsCount, item.totalAllocationPercent, item.peakAllocationPercent)}
                <span>{item.role}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
