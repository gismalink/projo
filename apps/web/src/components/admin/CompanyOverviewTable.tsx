import { useMemo, useState } from 'react';
import { CompanyOverviewResponse } from '../../api/client';

type CompanyUsersSortBy = 'fullName' | 'role' | 'projectsCount' | 'plansCount';

type CompanyOverviewTableProps = {
  t: Record<string, string>;
  companyOverview: CompanyOverviewResponse | null;
  isLoading: boolean;
};

export function CompanyOverviewTable({ t, companyOverview, isLoading }: CompanyOverviewTableProps) {
  const [sortBy, setSortBy] = useState<CompanyUsersSortBy>('projectsCount');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const users = companyOverview?.users ?? [];

  const sortedUsers = useMemo(() => {
    const nextUsers = [...users];
    nextUsers.sort((left, right) => {
      let comparison = 0;

      if (sortBy === 'fullName') {
        comparison = left.fullName.localeCompare(right.fullName);
      } else if (sortBy === 'role') {
        comparison = left.role.localeCompare(right.role);
      } else if (sortBy === 'plansCount') {
        comparison = left.plansCount - right.plansCount;
      } else {
        comparison = left.projectsCount - right.projectsCount;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return nextUsers;
  }, [sortBy, sortDirection, users]);

  const toggleSort = (nextSortBy: CompanyUsersSortBy) => {
    if (sortBy === nextSortBy) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortBy(nextSortBy);
    if (nextSortBy === 'fullName' || nextSortBy === 'role') {
      setSortDirection('asc');
      return;
    }

    setSortDirection('desc');
  };

  const sortLabel = (label: string, headerSortBy: CompanyUsersSortBy) => {
    if (sortBy !== headerSortBy) return label;
    return `${label} ${sortDirection === 'asc' ? '↑' : '↓'}`;
  };

  return (
    <article className="card" style={{ marginBottom: 12 }}>
      <div className="timeline-form">
        <h4>{`${t.companyOverviewTitle}: ${companyOverview?.companyName ?? '-'}`}</h4>
        <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
          <div style={{ display: 'grid', gap: 4 }}>
            <span className="muted">{t.companyOverviewUsers}</span>
            <strong>{companyOverview?.totalUsers ?? 0}</strong>
          </div>
          <div style={{ display: 'grid', gap: 4 }}>
            <span className="muted">{t.companyOverviewProjects}</span>
            <strong>{companyOverview?.totalProjects ?? 0}</strong>
          </div>
        </div>

        {isLoading && !companyOverview ? (
          <p className="muted">Loading...</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>
                    <button type="button" className="icon-btn" onClick={() => toggleSort('fullName')}>
                      {sortLabel(t.companyOverviewUserCol, 'fullName')}
                    </button>
                  </th>
                  <th>
                    <button type="button" className="icon-btn" onClick={() => toggleSort('role')}>
                      {sortLabel(t.companyOverviewRoleCol, 'role')}
                    </button>
                  </th>
                  <th>
                    <button type="button" className="icon-btn" onClick={() => toggleSort('projectsCount')}>
                      {sortLabel(t.companyOverviewProjectsCol, 'projectsCount')}
                    </button>
                  </th>
                  <th>
                    <button type="button" className="icon-btn" onClick={() => toggleSort('plansCount')}>
                      {sortLabel(t.companyOverviewPlansCol, 'plansCount')}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedUsers.map((item) => (
                  <tr key={item.userId}>
                    <td>{item.fullName}</td>
                    <td>{item.role}</td>
                    <td>{item.projectsCount}</td>
                    <td>{item.plansCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </article>
  );
}
