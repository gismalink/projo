const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'ApiError';
  }
}

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
  colorHex?: string;
};

export type CreateEmployeePayload = {
  fullName: string;
  email: string;
  roleId: string;
  departmentId?: string;
  grade?: string;
  status?: string;
  defaultCapacityHoursPerDay?: number;
};

export type DepartmentItem = {
  id: string;
  name: string;
  description?: string | null;
  _count?: { employees: number };
};

export type SkillItem = {
  id: string;
  name: string;
  description?: string | null;
  _count?: { employees: number };
};

export type UpdateRolePayload = Partial<CreateRolePayload>;
export type CreateSkillPayload = {
  name: string;
  description?: string;
};
export type UpdateSkillPayload = Partial<CreateSkillPayload>;

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

export type AssignmentItem = {
  id: string;
  projectId: string;
  employeeId: string;
  assignmentStartDate: string;
  assignmentEndDate: string;
  allocationPercent: string | number;
  plannedHoursPerDay: string | number | null;
  roleOnProject: string | null;
};

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
    let code = `HTTP_${response.status}`;
    let message = '';

    try {
      const payload = (await response.json()) as
        | { message?: string | string[]; error?: string; statusCode?: number }
        | undefined;
      if (payload) {
        if (Array.isArray(payload.message)) {
          message = payload.message.join(', ');
        } else if (typeof payload.message === 'string') {
          message = payload.message;
        }
        if (typeof payload.error === 'string' && !message) {
          message = payload.error;
        }
      }
    } catch {
      message = await response.text();
    }

    if (message) code = message;
    throw new ApiError(code, response.status, message || code);
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
  getDepartments: (token: string) => request<DepartmentItem[]>('/departments', {}, token),
  getSkills: (token: string) => request<SkillItem[]>('/skills', {}, token),
  createRole: (payload: CreateRolePayload, token: string) =>
    request('/roles', { method: 'POST', body: JSON.stringify(payload) }, token),
  createSkill: (payload: CreateSkillPayload, token: string) =>
    request('/skills', { method: 'POST', body: JSON.stringify(payload) }, token),
  updateSkill: (skillId: string, payload: UpdateSkillPayload, token: string) =>
    request(`/skills/${skillId}`, { method: 'PATCH', body: JSON.stringify(payload) }, token),
  updateRole: (roleId: string, payload: UpdateRolePayload, token: string) =>
    request(`/roles/${roleId}`, { method: 'PATCH', body: JSON.stringify(payload) }, token),
  createEmployee: (payload: CreateEmployeePayload, token: string) =>
    request('/employees', { method: 'POST', body: JSON.stringify(payload) }, token),
  getVacations: (token: string) => request<VacationItem[]>('/vacations', {}, token),
  createVacation: (payload: CreateVacationPayload, token: string) =>
    request('/vacations', { method: 'POST', body: JSON.stringify(payload) }, token),
  getAssignments: (token: string) => request<AssignmentItem[]>('/assignments', {}, token),
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
