const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';

export type LoginResponse = {
  accessToken: string;
  user: {
    id: string;
    email: string;
    fullName: string;
    role: string;
  };
};

export type ProjectTimelineRow = {
  id: string;
  code: string;
  name: string;
  status: string;
  priority: number;
  startDate: string;
  endDate: string;
  assignmentsCount: number;
  totalAllocationPercent: number;
  totalPlannedHoursPerDay: number;
};

export type CreateProjectPayload = {
  code: string;
  name: string;
  description?: string;
  status?: string;
  priority?: number;
  startDate: string;
  endDate: string;
  links?: string[];
};

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

export const api = {
  login: (email: string, password: string) =>
    request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  getRoles: (token: string) => request('/roles', {}, token),
  getEmployees: (token: string) => request('/employees', {}, token),
  getProjects: (token: string) => request('/projects', {}, token),
  getTimelineYear: (year: number, token: string) =>
    request<ProjectTimelineRow[]>(`/timeline/year?year=${year}`, {}, token),
  createProject: (payload: CreateProjectPayload, token: string) =>
    request('/projects', { method: 'POST', body: JSON.stringify(payload) }, token),
};
