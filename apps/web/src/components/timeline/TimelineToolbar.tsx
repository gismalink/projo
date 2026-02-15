import { Icon } from '../Icon';

type TimelineToolbarProps = {
  t: Record<string, string>;
  selectedYear: number;
  dragStepDays: 1 | 7 | 30;
  useProductionCalendar: boolean;
  onOpenProjectModal: () => void;
  onYearChange: (nextYear: number) => Promise<void>;
  onDragStepDaysChange: (next: 1 | 7 | 30) => void;
  onUseProductionCalendarChange: (next: boolean) => void;
};

export function TimelineToolbar(props: TimelineToolbarProps) {
  const {
    t,
    selectedYear,
    dragStepDays,
    useProductionCalendar,
    onOpenProjectModal,
    onYearChange,
    onDragStepDaysChange,
    onUseProductionCalendarChange,
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
        <label className="timeline-calendar-toggle-row" aria-label={t.timelineWithWeekends}>
          <span>{t.timelineWithWeekends}</span>
          <button
            type="button"
            role="switch"
            aria-checked={!useProductionCalendar}
            className={!useProductionCalendar ? 'timeline-switch active' : 'timeline-switch'}
            onClick={() => onUseProductionCalendarChange(!useProductionCalendar)}
          >
            <span className="timeline-switch-thumb" />
          </button>
        </label>
      </div>
      <div className="year-switcher">
        <button
          type="button"
          className="timeline-toolbar-icon-btn"
          onClick={onOpenProjectModal}
          title={t.createProject}
          aria-label={t.createProject}
        >
          <Icon name="plus" />
        </button>
        <button
          type="button"
          className="timeline-toolbar-icon-btn"
          onClick={() => onYearChange(selectedYear - 1)}
          title={t.prev}
          aria-label={t.prev}
        >
          <Icon name="chevron-left" />
        </button>
        <strong>{selectedYear}</strong>
        <button
          type="button"
          className="timeline-toolbar-icon-btn"
          onClick={() => onYearChange(selectedYear + 1)}
          title={t.next}
          aria-label={t.next}
        >
          <Icon name="chevron-right" />
        </button>
      </div>
    </div>
  );
}