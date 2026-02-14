import { FormEvent } from 'react';

type EmployeeImportModalProps = {
  t: Record<string, string>;
  isOpen: boolean;
  csv: string;
  onClose: () => void;
  onSubmit: (event: FormEvent) => Promise<void>;
  setCsv: (value: string) => void;
};

export function EmployeeImportModal(props: EmployeeImportModalProps) {
  const { t, isOpen, csv, onClose, onSubmit, setCsv } = props;

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div className="section-header">
          <h3>{t.importEmployees}</h3>
          <button type="button" className="ghost-btn" onClick={onClose}>
            {t.close}
          </button>
        </div>
        <form className="timeline-form" onSubmit={onSubmit}>
          <label>
            {t.csvData}
            <textarea value={csv} onChange={(e) => setCsv(e.target.value)} rows={10} />
          </label>
          <button type="submit">{t.importCsv}</button>
        </form>
      </div>
    </div>
  );
}
