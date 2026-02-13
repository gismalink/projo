import { FormEvent, useState } from 'react';
import { api } from '../api/client';

type Role = {
  id: string;
  name: string;
  description?: string;
  _count?: { employees: number };
};

type Employee = {
  id: string;
  fullName: string;
  email: string;
  status: string;
  role: { name: string };
};

export function App() {
  const [email, setEmail] = useState('admin@projo.local');
  const [password, setPassword] = useState('admin12345');
  const [token, setToken] = useState<string | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    setError(null);

    try {
      const result = await api.login(email, password);
      setToken(result.accessToken);
      const [rolesData, employeesData] = await Promise.all([
        api.getRoles(result.accessToken),
        api.getEmployees(result.accessToken),
      ]);
      setRoles(rolesData as Role[]);
      setEmployees(employeesData as Employee[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    }
  }

  return (
    <main className="container">
      <h1>Projo MVP</h1>
      <p className="subtitle">Project planning workspace</p>

      {!token ? (
        <form onSubmit={handleLogin} className="card">
          <h2>Login</h2>
          <label>
            Email
            <input value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label>
            Password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <button type="submit">Sign in</button>
          {error ? <p className="error">{error}</p> : null}
        </form>
      ) : (
        <section className="grid">
          <article className="card">
            <h2>Roles</h2>
            <ul>
              {roles.map((role) => (
                <li key={role.id}>
                  <strong>{role.name}</strong>
                  <span>{role._count?.employees ?? 0} employees</span>
                </li>
              ))}
            </ul>
          </article>

          <article className="card">
            <h2>Employees</h2>
            <ul>
              {employees.map((employee) => (
                <li key={employee.id}>
                  <strong>{employee.fullName}</strong>
                  <span>
                    {employee.role?.name ?? 'No role'} • {employee.status}
                  </span>
                </li>
              ))}
            </ul>
          </article>
        </section>
      )}
    </main>
  );
}
