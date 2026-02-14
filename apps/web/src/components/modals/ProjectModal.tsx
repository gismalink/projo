import { FormEvent } from 'react';

type ProjectModalProps = {
  t: Record<string, string>;
  isOpen: boolean;
  projectCode: string;
  projectName: string;
  projectStartDate: string;
  projectEndDate: string;
  onClose: () => void;
  onSubmit: (event: FormEvent) => Promise<void>;
  setProjectCode: (value: string) => void;
  setProjectName: (value: string) => void;
  setProjectStartDate: (value: string) => void;
  setProjectEndDate: (value: string) => void;
};

export function ProjectModal(props: ProjectModalProps) {
  const {
    t,
    isOpen,
    projectCode,
    projectName,
    projectStartDate,
    projectEndDate,
    onClose,
    onSubmit,
    setProjectCode,
    setProjectName,
    setProjectStartDate,
    setProjectEndDate,
  } = props;

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div className="section-header">
          <h3>{t.createProject}</h3>
          <button type="button" className="ghost-btn" onClick={onClose}>
            {t.close}
          </button>
        </div>
        <form className="timeline-form" onSubmit={onSubmit}>
          <label>
            {t.code}
            <input value={projectCode} onChange={(e) => setProjectCode(e.target.value)} />
          </label>
          <label>
            {t.name}
            <input value={projectName} onChange={(e) => setProjectName(e.target.value)} />
          </label>
          <label>
            {t.start}
            <input type="date" value={projectStartDate} onChange={(e) => setProjectStartDate(e.target.value)} />
          </label>
          <label>
            {t.end}
            <input type="date" value={projectEndDate} onChange={(e) => setProjectEndDate(e.target.value)} />
          </label>
          <button type="submit">{t.createProject}</button>
        </form>
      </div>
    </div>
  );
}
