type TimelineToolbarProps = {
  t: Record<string, string>;
  selectedYear: number;
  dragStepDays: 1 | 7 | 30;
  onOpenProjectModal: () => void;
  onYearChange: (nextYear: number) => Promise<void>;
  onDragStepDaysChange: (next: 1 | 7 | 30) => void;
};

export function TimelineToolbar(props: TimelineToolbarProps) {
  const { t, selectedYear, dragStepDays, onOpenProjectModal, onYearChange, onDragStepDaysChange } = props;

  return (
    <div className="timeline-toolbar">
      <div className="timeline-toolbar-title-group">
        <h2>{t.yearTimeline}</h2>
        <div className="timeline-step-switch" role="group" aria-label={t.timelineStep}>
          <span className="timeline-step-label">{t.timelineStep}</span>
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
        <button type="button" onClick={onOpenProjectModal}>
          {t.createProject}
        </button>
        <button type="button" onClick={() => onYearChange(selectedYear - 1)}>
          {t.prev}
        </button>
        <strong>{selectedYear}</strong>
        <button type="button" onClick={() => onYearChange(selectedYear + 1)}>
          {t.next}
        </button>
      </div>
    </div>
  );
}