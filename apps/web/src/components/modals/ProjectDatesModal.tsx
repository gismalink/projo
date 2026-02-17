import { FormEvent } from 'react';

type ProjectDatesModalProps = {
  t: Record<string, string>;
  isOpen: boolean;
  startDate: string;
  endDate: string;
  onClose: () => void;
  onSubmit: (event: FormEvent) => Promise<void>;
  setStartDate: (value: string) => void;
  setEndDate: (value: string) => void;
};

export function ProjectDatesModal({
  t,
  isOpen,
  startDate,
  endDate,
  onClose,
  onSubmit,
  setStartDate,
  setEndDate,
}: ProjectDatesModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div className="section-header">
          <h3>{t.editProjectDates}</h3>
          <button type="button" className="ghost-btn" onClick={onClose}>
            {t.close}
          </button>
        </div>
        <form className="timeline-form" onSubmit={onSubmit}>
          <label>
            <span className="field-label required">{t.start}</span>
            <input type="date" value={startDate} required onChange={(e) => setStartDate(e.target.value)} />
          </label>
          <label>
            <span className="field-label required">{t.end}</span>
            <input type="date" value={endDate} required onChange={(e) => setEndDate(e.target.value)} />
          </label>
          <button type="submit">{t.saveProjectDates}</button>
        </form>
      </div>
    </div>
  );
}
