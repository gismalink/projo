import { Icon } from '../Icon';

type TimelineToolbarProps = {
  t: Record<string, string>;
  selectedYear: number;
  dragStepDays: 1 | 7 | 30;
  onOpenProjectModal: () => void;
  onYearChange: (nextYear: number) => Promise<void>;
  onDragStepDaysChange: (next: 1 | 7 | 30) => void;
  canSeedDemoWorkspace: boolean;
  onSeedDemoWorkspace: () => Promise<void>;
};

export function TimelineToolbar(props: TimelineToolbarProps) {
  const {
    t,
    selectedYear,
    dragStepDays,
    onOpenProjectModal,
    onYearChange,
    onDragStepDaysChange,
    canSeedDemoWorkspace,
    onSeedDemoWorkspace,
  } = props;

  return (
    <div className="timeline-toolbar">
      <div className="timeline-toolbar-title-group">
        <div className="timeline-step-switch" role="group" aria-label={t.timelineStep}>
          <button
            type="button"
            className={dragStepDays === 1 ? 'tab active' : 'tab'}
            onClick={() => onDragStepDaysChange(1)}
          >
            {t.stepDay}
          </button>
          <button
            type="button"
            className={dragStepDays === 7 ? 'tab active' : 'tab'}
            onClick={() => onDragStepDaysChange(7)}
          >
            {t.stepWeek}
          </button>
          <button
            type="button"
            className={dragStepDays === 30 ? 'tab active' : 'tab'}
            onClick={() => onDragStepDaysChange(30)}
          >
            {t.stepMonth}
          </button>
        </div>
      </div>
      <div className="year-switcher">
        {canSeedDemoWorkspace ? (
          <button
            type="button"
            className="timeline-toolbar-icon-btn"
            onClick={() => {
              void onSeedDemoWorkspace();
            }}
            aria-label={t.createDemoProject}
            data-tooltip={t.createDemoProject}
          >
            <Icon name="copy" />
          </button>
        ) : null}
        <button
          type="button"
          className="timeline-toolbar-icon-btn"
          onClick={onOpenProjectModal}
          aria-label={t.createProject}
          data-tooltip={t.createProject}
        >
          <Icon name="plus" />
        </button>
        <button
          type="button"
          className="timeline-toolbar-icon-btn"
          onClick={() => onYearChange(selectedYear - 1)}
          aria-label={t.prev}
          data-tooltip={t.prev}
        >
          <Icon name="chevron-left" />
        </button>
        <strong>{selectedYear}</strong>
        <button
          type="button"
          className="timeline-toolbar-icon-btn"
          onClick={() => onYearChange(selectedYear + 1)}
          aria-label={t.next}
          data-tooltip={t.next}
        >
          <Icon name="chevron-right" />
        </button>
      </div>
    </div>
  );
}