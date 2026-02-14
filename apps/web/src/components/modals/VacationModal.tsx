import { FormEvent } from 'react';

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
            {t.start}
            <input type="date" value={vacationStartDate} onChange={(e) => setVacationStartDate(e.target.value)} />
          </label>
          <label>
            {t.end}
            <input type="date" value={vacationEndDate} onChange={(e) => setVacationEndDate(e.target.value)} />
          </label>
          <label>
            {t.type}
            <select value={vacationType} onChange={(e) => setVacationType(e.target.value)}>
              <option value="vacation">{t.vacationTypeVacation}</option>
              <option value="sick">{t.vacationTypeSick}</option>
              <option value="day_off">{t.vacationTypeDayOff}</option>
            </select>
          </label>
          <button type="submit">{t.saveVacation}</button>
        </form>
      </div>
    </div>
  );
}
