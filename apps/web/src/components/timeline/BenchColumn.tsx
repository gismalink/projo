type BenchMember = {
  id: string;
  fullName: string;
  grade?: string | null;
  roleName: string;
  roleColorHex: string;
  annualLoadPercent: number;
};

type BenchGroup = {
  departmentName: string;
  members: BenchMember[];
};

type BenchColumnProps = {
  t: Record<string, string>;
  benchGroups: BenchGroup[];
  canDragMembers: boolean;
  onMemberDragStart: (employeeId: string) => void;
  onMemberDragEnd: () => void;
};

export function BenchColumn(props: BenchColumnProps) {
  const { t, benchGroups, canDragMembers, onMemberDragStart, onMemberDragEnd } = props;

  const toInitials = (fullName: string) => {
    const parts = fullName
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    if (parts.length === 0) return '';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
  };

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
                  draggable={canDragMembers}
                  title={`${member.fullName}${member.grade ? ` · ${member.grade}` : ''} · ${member.roleName} · ${member.annualLoadPercent}%`}
                  onDragStart={() => {
                    if (!canDragMembers) return;
                    onMemberDragStart(member.id);
                  }}
                  onDragEnd={onMemberDragEnd}
                >
                  <strong>{toInitials(member.fullName)}</strong>
                  <span className="bench-member-meta">
                    {member.grade ? <span>{member.grade}</span> : null}
                    <span className="timeline-role-chip" style={{ background: member.roleColorHex }}>
                      {member.roleName}
                    </span>
                    <span>{`${member.annualLoadPercent}%`}</span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        ))
      )}
    </aside>
  );
}