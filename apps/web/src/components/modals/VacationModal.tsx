import { FormEvent } from 'react';
import { VacationTypeSelect } from './VacationTypeSelect';

type VacationModalProps = {
  t: Record<string, string>;
  isOpen: boolean;
  vacationEmployeeName: string;
  vacationStartDate: string;
  vacationEndDate: string;
  vacationType: string;
  onClose: () => void;
  onSubmit: (event: FormEvent) => Promise<void>;
  setVacationStartDate: (value: string) => void;
  setVacationEndDate: (value: string) => void;
  setVacationType: (value: string) => void;
};

export function VacationModal(props: VacationModalProps) {
  const {
    t,
    isOpen,
    vacationEmployeeName,
    vacationStartDate,
    vacationEndDate,
    vacationType,
    onClose,
    onSubmit,
    setVacationStartDate,
    setVacationEndDate,
    setVacationType,
  } = props;

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div className="section-header">
          <h3>{t.addVacation}</h3>
          <button type="button" className="ghost-btn" onClick={onClose}>
            {t.close}
          </button>
        </div>
        <p className="muted">{vacationEmployeeName}</p>
        <form className="timeline-form" onSubmit={onSubmit}>
          <label>
            <span className="field-label required">{t.start}</span>
            <input type="date" value={vacationStartDate} required onChange={(e) => setVacationStartDate(e.target.value)} />
          </label>
          <label>
            <span className="field-label required">{t.end}</span>
            <input type="date" value={vacationEndDate} required onChange={(e) => setVacationEndDate(e.target.value)} />
          </label>
          <label>
            <span className="field-label required">{t.type}</span>
            <VacationTypeSelect t={t} value={vacationType} onChange={setVacationType} />
          </label>
          <button type="submit">{t.saveVacation}</button>
        </form>
      </div>
    </div>
  );
}
