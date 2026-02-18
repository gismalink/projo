type InstructionTabProps = {
  t: Record<string, string>;
};

export function InstructionTab(props: InstructionTabProps) {
  const { t } = props;

  return (
    <section className="grid">
      <article className="card">
        <div className="section-header">
          <h2>{t.instructionTitle}</h2>
        </div>
        <ul className="instruction-list">
          <li>{t.instructionStep1}</li>
          <li>{t.instructionStep2}</li>
          <li>{t.instructionStep3}</li>
          <li>{t.instructionStep4}</li>
          <li>{t.instructionStep5}</li>
        </ul>
      </article>
    </section>
  );
}
