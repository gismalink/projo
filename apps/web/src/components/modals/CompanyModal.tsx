import { FormEvent } from 'react';

type CompanyModalProps = {
  isOpen: boolean;
  t: Record<string, string>;
  mode: 'create' | 'rename';
  companyNameDraft: string;
  setCompanyNameDraft: (value: string) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent) => Promise<void>;
};

export function CompanyModal(props: CompanyModalProps) {
  const { isOpen, t, mode, companyNameDraft, setCompanyNameDraft, onClose, onSubmit } = props;

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <article className="modal-card auth-modal">
        <div className="section-header" style={{ marginBottom: 12 }}>
          <h3>{mode === 'create' ? t.createCompany : t.editCompany}</h3>
          <button type="button" className="ghost-btn" onClick={onClose}>
            {t.close}
          </button>
        </div>
        <form onSubmit={onSubmit} className="timeline-form" style={{ padding: 0 }}>
          <label>
            <span className="field-label required">{t.companyName}</span>
            <input
              value={companyNameDraft}
              placeholder={t.companyName}
              required
              onChange={(event) => setCompanyNameDraft(event.target.value)}
            />
          </label>
          <button type="submit">{mode === 'create' ? t.createCompany : t.save}</button>
        </form>
      </article>
    </div>
  );
}
