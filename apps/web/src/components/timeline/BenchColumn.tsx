type BenchMember = {
  id: string;
  fullName: string;
  roleName: string;
};

type BenchGroup = {
  departmentName: string;
  members: BenchMember[];
};

type BenchColumnProps = {
  t: Record<string, string>;
  benchGroups: BenchGroup[];
  onMemberDragStart: (employeeId: string) => void;
  onMemberDragEnd: () => void;
};

export function BenchColumn(props: BenchColumnProps) {
  const { t, benchGroups, onMemberDragStart, onMemberDragEnd } = props;

  return (
    <aside className="bench-column">
      <div className="bench-header">{t.bench}</div>
      {benchGroups.length === 0 ? (
        <p className="muted">—</p>
      ) : (
        benchGroups.map((group) => (
          <section key={group.departmentName} className="bench-group">
            <h4>{group.departmentName}</h4>
            <div className="bench-members">
              {group.members.map((member) => (
                <button
                  type="button"
                  key={member.id}
                  className="bench-member"
                  draggable
                  title={`${member.fullName} · ${member.roleName}`}
                  onDragStart={() => onMemberDragStart(member.id)}
                  onDragEnd={onMemberDragEnd}
                >
                  <strong>{member.fullName}</strong>
                  <span>{member.roleName}</span>
                </button>
              ))}
            </div>
          </section>
        ))
      )}
    </aside>
  );
}