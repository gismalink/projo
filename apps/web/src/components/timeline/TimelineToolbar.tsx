type TimelineToolbarProps = {
  t: Record<string, string>;
  selectedYear: number;
  onOpenProjectModal: () => void;
  onYearChange: (nextYear: number) => Promise<void>;
};

export function TimelineToolbar(props: TimelineToolbarProps) {
  const { t, selectedYear, onOpenProjectModal, onYearChange } = props;

  return (
    <div className="timeline-toolbar">
      <h2>{t.yearTimeline}</h2>
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