import { useMemo, useState } from 'react';
import { AdminOverviewResponse } from '../../api/client';

type AdminUsersSortBy = 'fullName' | 'email' | 'projectsCount' | 'ownedProjectsCount';

type AdminUsersTableProps = {
  t: Record<string, string>;
  adminOverview: AdminOverviewResponse | null;
  isLoading: boolean;
};

export function AdminUsersTable({ t, adminOverview, isLoading }: AdminUsersTableProps) {
  const [sortBy, setSortBy] = useState<AdminUsersSortBy>('projectsCount');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const users = adminOverview?.users ?? [];

  const sortedUsers = useMemo(() => {
    const nextUsers = [...users];
    nextUsers.sort((left, right) => {
      let comparison = 0;

      if (sortBy === 'fullName') {
        comparison = left.fullName.localeCompare(right.fullName);
      } else if (sortBy === 'email') {
        comparison = left.email.localeCompare(right.email);
      } else if (sortBy === 'projectsCount') {
        comparison = left.projectsCount - right.projectsCount;
      } else {
        comparison = left.ownedProjectsCount - right.ownedProjectsCount;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return nextUsers;
  }, [sortBy, sortDirection, users]);

  const toggleSort = (nextSortBy: AdminUsersSortBy) => {
    if (sortBy === nextSortBy) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortBy(nextSortBy);
    if (nextSortBy === 'fullName' || nextSortBy === 'email') {
      setSortDirection('asc');
      return;
    }

    setSortDirection('desc');
  };

  const sortLabel = (label: string, headerSortBy: AdminUsersSortBy) => {
    if (sortBy !== headerSortBy) {
      return label;
    }

    return `${label} ${sortDirection === 'asc' ? '↑' : '↓'}`;
  };

  return (
    <article className="card" style={{ marginBottom: 12 }}>
      <div className="timeline-form">
        <h4>{`${t.adminOverviewTitle} (${adminOverview?.totalUsers ?? 0})`}</h4>

        {isLoading && !adminOverview ? (
          <p className="muted">Loading...</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>
                    <button type="button" className="icon-btn" onClick={() => toggleSort('fullName')}>
                      {sortLabel(t.adminOverviewUserCol, 'fullName')}
                    </button>
                  </th>
                  <th>
                    <button type="button" className="icon-btn" onClick={() => toggleSort('email')}>
                      {sortLabel(t.adminOverviewEmailCol, 'email')}
                    </button>
                  </th>
                  <th>
                    <button type="button" className="icon-btn" onClick={() => toggleSort('projectsCount')}>
                      {sortLabel(t.adminOverviewProjectsCol, 'projectsCount')}
                    </button>
                  </th>
                  <th>
                    <button type="button" className="icon-btn" onClick={() => toggleSort('ownedProjectsCount')}>
                      {sortLabel(t.adminOverviewOwnedProjectsCol, 'ownedProjectsCount')}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedUsers.map((item) => (
                  <tr key={item.userId}>
                    <td>{item.fullName}</td>
                    <td>{item.email}</td>
                    <td>{item.projectsCount}</td>
                    <td>{item.ownedProjectsCount}</td>
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
