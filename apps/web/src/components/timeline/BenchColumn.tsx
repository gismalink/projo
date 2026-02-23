import { DEFAULT_FALLBACK_COLOR_HEX } from '../../constants/app.constants';
import { Icon } from '../Icon';

type BenchMember = {
  id: string;
  fullName: string;
  grade?: string | null;
  gradeColorHex?: string;
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
  selectedEmployeeId: string;
  selectedDepartmentName: string;
  hoveredEmployeeId: string;
  onToggleEmployeeFilter: (employeeId: string) => void;
  onToggleDepartmentFilter: (departmentName: string) => void;
  onHoverEmployee: (employeeId: string) => void;
  onMemberDragStart: (employeeId: string) => void;
  onMemberDragEnd: () => void;
};

export function BenchColumn(props: BenchColumnProps) {
  const {
    t,
    benchGroups,
    canDragMembers,
    selectedEmployeeId,
    selectedDepartmentName,
    hoveredEmployeeId,
    onToggleEmployeeFilter,
    onToggleDepartmentFilter,
    onHoverEmployee,
    onMemberDragStart,
    onMemberDragEnd,
  } = props;

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
      <div className="bench-header-row">
        <div className="bench-header">{t.bench}</div>
      </div>
      {benchGroups.length === 0 ? (
        <p className="muted">—</p>
      ) : (
        benchGroups.map((group) => (
          <section
            key={group.departmentName}
            className={selectedDepartmentName === group.departmentName ? 'bench-group selected' : 'bench-group'}
          >
            <button
              type="button"
              className="bench-group-title"
              onClick={() => onToggleDepartmentFilter(group.departmentName)}
              aria-label={group.departmentName}
            >
              {group.departmentName}
            </button>
            <div className="bench-members">
              {group.members.map((member) => {
                const isSelected = selectedEmployeeId === member.id;
                const isActive = isSelected || hoveredEmployeeId === member.id;

                return (
                  <button
                    type="button"
                    key={member.id}
                    className={isActive ? 'bench-member active' : 'bench-member'}
                    draggable={canDragMembers}
                    title={`${member.fullName}${member.grade ? ` · ${member.grade}` : ''} · ${member.roleName} · ${member.annualLoadPercent}%`}
                    onClick={() => onToggleEmployeeFilter(member.id)}
                    onMouseEnter={() => onHoverEmployee(member.id)}
                    onMouseLeave={() => onHoverEmployee('')}
                    onDragStart={() => {
                      if (!canDragMembers) return;
                      onMemberDragStart(member.id);
                    }}
                    onDragEnd={onMemberDragEnd}
                  >
                    <span className="bench-member-head">
                      <strong>{toInitials(member.fullName)}</strong>
                      <span className="bench-member-load-wrap">
                        <span className="bench-member-load">{`${member.annualLoadPercent}%`}</span>
                        {isSelected ? (
                          <span className="bench-member-selected" aria-hidden="true">
                            <Icon name="check" size={14} />
                          </span>
                        ) : null}
                      </span>
                    </span>
                    <span className="bench-member-meta">
                      <span className="timeline-role-chip" style={{ background: member.roleColorHex }}>
                        {member.roleName}
                      </span>
                      {member.grade ? (
                        <span className="timeline-role-chip" style={{ background: member.gradeColorHex ?? DEFAULT_FALLBACK_COLOR_HEX }}>
                          {member.grade}
                        </span>
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ))
      )}
    </aside>
  );
}