import { FormEvent } from 'react';

type TeamTemplateOption = {
  id: string;
  name: string;
};

type ProjectModalProps = {
  t: Record<string, string>;
  isOpen: boolean;
  projectCode: string;
  projectName: string;
  projectStartDate: string;
  projectEndDate: string;
  teamTemplates: TeamTemplateOption[];
  projectTeamTemplateId: string;
  onClose: () => void;
  onSubmit: (event: FormEvent) => Promise<void>;
  setProjectCode: (value: string) => void;
  setProjectName: (value: string) => void;
  setProjectStartDate: (value: string) => void;
  setProjectEndDate: (value: string) => void;
  setProjectTeamTemplateId: (value: string) => void;
};

export function ProjectModal(props: ProjectModalProps) {
  const {
    t,
    isOpen,
    projectCode,
    projectName,
    projectStartDate,
    projectEndDate,
    teamTemplates,
    projectTeamTemplateId,
    onClose,
    onSubmit,
    setProjectCode,
    setProjectName,
    setProjectStartDate,
    setProjectEndDate,
    setProjectTeamTemplateId,
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
            <span className="field-label required">{t.code}</span>
            <input value={projectCode} placeholder={t.code} required onChange={(e) => setProjectCode(e.target.value)} />
          </label>
          <label>
            <span className="field-label required">{t.name}</span>
            <input value={projectName} placeholder={t.name} required onChange={(e) => setProjectName(e.target.value)} />
          </label>
          <label>
            <span className="field-label required">{t.start}</span>
            <input type="date" value={projectStartDate} required onChange={(e) => setProjectStartDate(e.target.value)} />
          </label>
          <label>
            <span className="field-label required">{t.end}</span>
            <input type="date" value={projectEndDate} required onChange={(e) => setProjectEndDate(e.target.value)} />
          </label>
          <label>
            <span className="field-label optional">{t.teamTemplate}</span>
            <select value={projectTeamTemplateId} onChange={(e) => setProjectTeamTemplateId(e.target.value)}>
              <option value="">{t.noTeamTemplate}</option>
              {teamTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </label>
          <button type="submit">{t.createProject}</button>
        </form>
      </div>
    </div>
  );
}
