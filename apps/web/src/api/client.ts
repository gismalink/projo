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

export type ProjectListItem = {
  id: string;
  code: string;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
  priority: number;
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

export type CreateRolePayload = {
  name: string;
  description?: string;
  level?: number;
};

export type CreateEmployeePayload = {
  fullName: string;
  email: string;
  roleId: string;
  grade?: string;
  status?: string;
  defaultCapacityHoursPerDay?: number;
};

export type VacationItem = {
  id: string;
  employeeId: string;
  startDate: string;
  endDate: string;
  type: string;
  note?: string | null;
  employee: {
    id: string;
    fullName: string;
    role: { name: string };
  };
};

export type CreateVacationPayload = {
  employeeId: string;
  startDate: string;
  endDate: string;
  type?: string;
  note?: string;
};

export type CreateAssignmentPayload = {
  projectId: string;
  employeeId: string;
  assignmentStartDate: string;
  assignmentEndDate: string;
  allocationPercent?: number;
  plannedHoursPerDay?: number;
  roleOnProject?: string;
};

export type UpdateAssignmentPayload = Partial<CreateAssignmentPayload>;

export type ProjectDetail = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: string;
  priority: number;
  startDate: string;
  endDate: string;
  assignments: Array<{
    id: string;
    projectId: string;
    employeeId: string;
    assignmentStartDate: string;
    assignmentEndDate: string;
    allocationPercent: string | number;
    plannedHoursPerDay: string | number | null;
    roleOnProject: string | null;
    employee: {
      id: string;
      fullName: string;
      email: string;
      role: { name: string };
    };
  }>;
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
  createRole: (payload: CreateRolePayload, token: string) =>
    request('/roles', { method: 'POST', body: JSON.stringify(payload) }, token),
  createEmployee: (payload: CreateEmployeePayload, token: string) =>
    request('/employees', { method: 'POST', body: JSON.stringify(payload) }, token),
  getVacations: (token: string) => request<VacationItem[]>('/vacations', {}, token),
  createVacation: (payload: CreateVacationPayload, token: string) =>
    request('/vacations', { method: 'POST', body: JSON.stringify(payload) }, token),
  getProjects: (token: string) => request('/projects', {}, token),
  getProject: (projectId: string, token: string) => request<ProjectDetail>(`/projects/${projectId}`, {}, token),
  getTimelineYear: (year: number, token: string) =>
    request<ProjectTimelineRow[]>(`/timeline/year?year=${year}`, {}, token),
  createProject: (payload: CreateProjectPayload, token: string) =>
    request('/projects', { method: 'POST', body: JSON.stringify(payload) }, token),
  createAssignment: (payload: CreateAssignmentPayload, token: string) =>
    request('/assignments', { method: 'POST', body: JSON.stringify(payload) }, token),
  updateAssignment: (assignmentId: string, payload: UpdateAssignmentPayload, token: string) =>
    request(`/assignments/${assignmentId}`, { method: 'PATCH', body: JSON.stringify(payload) }, token),
};
