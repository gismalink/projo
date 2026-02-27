const API_URL = import.meta.env.VITE_API_URL ?? '/api';

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message?: string,
    public readonly details?: unknown,
  ) {
    super(message ?? code);
    this.name = 'ApiError';
  }
}

export type LoginResponse = {
  accessToken: string;
  user: AuthUser;
};

export type SsoGetTokenResponse = {
  authenticated: boolean;
  token?: string;
  id?: string;
  username?: string;
  email?: string | null;
  role?: string;
};

export type AuthUser = {
  id: string;
  email: string;
  fullName: string;
  role: string;
  workspaceId?: string;
  workspaceRole?: string;
};

export type RegisterPayload = {
  email: string;
  fullName: string;
  password: string;
};

export type UpdateMePayload = {
  fullName: string;
};

export type ChangePasswordPayload = {
  currentPassword: string;
  newPassword: string;
};

export type ProjectSpaceItem = {
  id: string;
  name: string;
  role: string;
  isOwner: boolean;
  projectsCount: number;
  totalAllocationPercent: number;
  peakAllocationPercent: number;
  monthlyLoadStats: Array<{
    month: number;
    avgAllocationPercent: number;
    peakAllocationPercent: number;
  }>;
};

export type MyProjectsResponse = {
  activeProjectId: string;
  myProjects: ProjectSpaceItem[];
  sharedProjects: ProjectSpaceItem[];
};

export type CompanyItem = {
  id: string;
  name: string;
  isOwner: boolean;
  projectsCount: number;
};

export type MyCompaniesResponse = {
  activeCompanyId: string;
  companies: CompanyItem[];
};

export type CompanyNameResponse = {
  id: string;
  name: string;
};

export type CompanyXlsxImportIssue = {
  sheet: string;
  row: number;
  col: string;
  message: string;
};

export type CompanyXlsxImportSheetsResponse = {
  sheets: string[];
};

export type AiImportAssistantResponse = {
  provider: string;
  model: string;
  sheetName: string | null;
  answer: string;
};

export type AiImportNormalizeResponse = {
  provider: string;
  model: string;
  sheetName: string | null;
  normalized: {
    assignments: Array<{
      projectName: string;
      employeeName: string;
      monthlyPercent: Record<string, number>;
    }>;
  };
  fileName: string;
  mimeType: string;
  fileBase64: string;
  preview: CompanyXlsxImportPreviewResponse;
  attempts: {
    used: number;
    max: number;
  };
  llmRaw: {
    fileName: string;
    mimeType: string;
    fileBase64: string;
  };
};

export type AiImportNormalizeApplyResponse = {
  provider: string;
  model: string;
  sheetName: string | null;
  normalized: {
    assignments: Array<{
      projectName: string;
      employeeName: string;
      monthlyPercent: Record<string, number>;
    }>;
  };
  preview: CompanyXlsxImportPreviewResponse;
  apply: CompanyXlsxImportApplyResponse;
  attempts: {
    used: number;
    max: number;
  };
  llmRaw: {
    fileName: string;
    mimeType: string;
    fileBase64: string;
  };
};

export type CompanyXlsxImportPreviewResponse = {
  counts: {
    projects: number;
    employees: number;
    assignments: number;
  };
  monthRange: {
    from: string | null;
    to: string | null;
  };
  errors: CompanyXlsxImportIssue[];
  warnings: CompanyXlsxImportIssue[];
};

export type CompanyXlsxImportApplyResponse = {
  company: {
    id: string;
    name: string;
  };
  workspace: {
    id: string;
    name: string;
  };
  counts: {
    projects: number;
    employees: number;
    assignments: number;
  };
  monthRange: {
    from: string | null;
    to: string | null;
  };
  warnings: CompanyXlsxImportIssue[];
};

export type AdminOverviewUserItem = {
  userId: string;
  email: string;
  fullName: string;
  projectsCount: number;
  ownedProjectsCount: number;
};

export type AdminOverviewResponse = {
  companyId: string;
  companyName: string;
  totalUsers: number;
  totalProjects: number;
  users: AdminOverviewUserItem[];
  topUsers: AdminOverviewUserItem[];
  companies: Array<{
    companyId: string;
    companyName: string;
    totalUsers: number;
    totalProjects: number;
  }>;
};

export type ProjectPermission = 'viewer' | 'editor';

export type ProjectMemberItem = {
  userId: string;
  email: string;
  fullName: string;
  role: string;
  isOwner: boolean;
};

export type ProjectMembersResponse = {
  projectId: string;
  members: ProjectMemberItem[];
};

export type ProjectSpaceNameResponse = {
  id: string;
  name: string;
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
  teamTemplateId?: string | null;
  teamTemplate?: {
    id: string;
    name: string;
  } | null;
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
  teamTemplateId?: string;
};
export type UpdateProjectPayload = Partial<CreateProjectPayload>;
export type CopyProjectPayload = {
  name?: string;
};

export type CreateRolePayload = {
  name: string;
  shortName?: string;
  description?: string;
  colorHex?: string;
};

export type CreateEmployeePayload = {
  fullName: string;
  email?: string | null;
  roleId: string;
  departmentId?: string;
  grade?: string;
  status?: string;
  defaultCapacityHoursPerDay?: number;
};

export type UpdateEmployeePayload = Partial<CreateEmployeePayload>;

export type ImportEmployeesCsvPayload = {
  csv: string;
};

export type ImportEmployeesCsvResult = {
  total: number;
  created: number;
  updated: number;
  errors: string[];
};

export type DepartmentItem = {
  id: string;
  name: string;
  description?: string | null;
  colorHex?: string | null;
  _count?: { employees: number };
};

export type CreateDepartmentPayload = {
  name: string;
  description?: string;
  colorHex?: string;
};

export type UpdateDepartmentPayload = Partial<CreateDepartmentPayload>;

export type TeamTemplateRoleItem = {
  id: string;
  roleId: string;
  position: number;
  role: {
    id: string;
    name: string;
    shortName?: string | null;
  };
};

export type TeamTemplateItem = {
  id: string;
  name: string;
  roles: TeamTemplateRoleItem[];
  _count?: { projects: number };
};

export type CreateTeamTemplatePayload = {
  name: string;
  roleIds: string[];
};

export type UpdateTeamTemplatePayload = Partial<CreateTeamTemplatePayload>;

export type GradeItem = {
  id: string;
  name: string;
  colorHex?: string | null;
  _count?: { employees: number };
  createdAt: string;
  updatedAt: string;
};

export type CreateGradePayload = {
  name: string;
  colorHex?: string;
};

export type UpdateGradePayload = Partial<CreateGradePayload>;

export type DefaultsCreateResult = {
  created: number;
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

export type UpdateVacationPayload = Partial<CreateVacationPayload>;

export type CreateAssignmentPayload = {
  projectId: string;
  employeeId: string;
  assignmentStartDate: string;
  assignmentEndDate: string;
  allocationPercent?: number;
  plannedHoursPerDay?: number;
  roleOnProject?: string;
  loadProfile?: {
    mode: 'flat' | 'curve';
    points?: Array<{
      date: string;
      value: number;
    }>;
  };
};

export type UpdateAssignmentPayload = Partial<CreateAssignmentPayload>;

export type CostRateItem = {
  id: string;
  employeeId: string | null;
  roleId: string | null;
  amountPerHour: string | number;
  currency: string;
  validFrom: string;
  validTo: string | null;
  employee?: { id: string; fullName: string } | null;
  role?: { id: string; name: string } | null;
};

export type CreateCostRatePayload = {
  employeeId?: string;
  roleId?: string;
  amountPerHour: number;
  currency?: string;
  validFrom: string;
  validTo?: string;
};

export type UpdateCostRatePayload = Partial<CreateCostRatePayload>;

export type AssignmentItem = {
  id: string;
  projectId: string;
  employeeId: string;
  assignmentStartDate: string;
  assignmentEndDate: string;
  allocationPercent: string | number;
  loadProfile?: {
    mode: 'flat' | 'curve';
    points?: Array<{
      date: string;
      value: number;
    }>;
  } | null;
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
  teamTemplateId?: string | null;
  teamTemplate?: {
    id: string;
    name: string;
    roles: Array<{
      id: string;
      roleId: string;
      position: number;
      role: {
        id: string;
        name: string;
        shortName?: string | null;
      };
    }>;
  } | null;
  costSummary?: {
    totalPlannedHours: number;
    totalActualHours: number;
    totalLostHours: number;
    totalPlannedCost: number;
    totalActualCost: number;
    totalLostCost: number;
    currency: string;
    missingRateDays: number;
    missingRateHours: number;
  };
  assignments: Array<{
    id: string;
    projectId: string;
    employeeId: string;
    assignmentStartDate: string;
    assignmentEndDate: string;
    allocationPercent: string | number;
    loadProfile?: {
      mode: 'flat' | 'curve';
      points?: Array<{
        date: string;
        value: number;
      }>;
    } | null;
    plannedHoursPerDay: string | number | null;
    roleOnProject: string | null;
    employee: {
      id: string;
      fullName: string;
      email: string;
      roleId: string;
      grade?: string | null;
      role: { name: string };
    };
  }>;
  members: Array<{
    id: string;
    projectId: string;
    employeeId: string;
    employee: {
      id: string;
      fullName: string;
      email: string;
      grade?: string | null;
      roleId: string;
      defaultCapacityHoursPerDay?: string | number | null;
      role: { name: string };
      department?: { id: string; name: string } | null;
    };
  }>;
};

export type CalendarDayItem = {
  date: string;
  isWeekend: boolean;
  isHoliday: boolean;
  isWorkingDay: boolean;
  holidayName: string | null;
};

export type CalendarYearResponse = {
  year: number;
  days: CalendarDayItem[];
};

export type CalendarHealthYearState = {
  year: number;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastStatus: string;
  freshness: 'fresh' | 'stale' | 'missing';
};

export type CalendarHealthResponse = {
  ttlHours: number;
  currentYear: CalendarHealthYearState;
  nextYear: CalendarHealthYearState;
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
    let details: unknown;

    try {
      const payload = (await response.json()) as
        | { message?: string | string[]; error?: string; statusCode?: number }
        | undefined;
      details = payload;
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

    if (message && /^ERR_[A-Z0-9_]+$/.test(message)) {
      code = message;
    }
    throw new ApiError(code, response.status, message || code, details);
  }

  return (await response.json()) as T;
}

async function requestFormData<T>(path: string, formData: FormData, token: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    let code = `HTTP_${response.status}`;
    let message = '';
    let details: unknown;

    try {
      const payload = (await response.json()) as
        | { message?: string | string[]; error?: string; statusCode?: number }
        | undefined;
      details = payload;
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

    if (message && /^ERR_[A-Z0-9_]+$/.test(message)) {
      code = message;
    }
    throw new ApiError(code, response.status, message || code, details);
  }

  return (await response.json()) as T;
}

export const api = {
  login: (email: string, password: string) =>
    request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  register: (payload: RegisterPayload) =>
    request<LoginResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getMe: (token: string) => request<AuthUser>('/auth/me', {}, token),
  updateMe: (payload: UpdateMePayload, token: string) =>
    request<AuthUser>('/auth/me', { method: 'PATCH', body: JSON.stringify(payload) }, token),
  changePassword: (payload: ChangePasswordPayload, token: string) =>
    request<{ success: true }>('/auth/change-password', { method: 'POST', body: JSON.stringify(payload) }, token),
  logout: (token: string) => request<{ success: true }>('/auth/logout', { method: 'POST' }, token),

  ssoGetToken: () => request<SsoGetTokenResponse>('/sso/get-token', { credentials: 'include' }),
  ssoCurrentUser: () => request<Record<string, unknown>>('/sso/current-user', { credentials: 'include' }),

  getMyCompanies: (token: string) => request<MyCompaniesResponse>('/auth/companies', {}, token),
  listCompanyXlsxImportSheets: (file: File, token: string) => {
    const formData = new FormData();
    formData.append('file', file);
    return requestFormData<CompanyXlsxImportSheetsResponse>('/imports/xlsx/company/sheets', formData, token);
  },
  askImportAssistant: (message: string, token: string, options?: { file?: File; sheetName?: string }) => {
    const formData = new FormData();
    formData.append('message', message);
    if (options?.sheetName) {
      formData.append('sheetName', options.sheetName);
    }
    if (options?.file) {
      formData.append('file', options.file);
    }
    return requestFormData<AiImportAssistantResponse>('/imports/xlsx/company/ai/ask', formData, token);
  },
  normalizeImportWithAi: (message: string, token: string, options?: { file?: File; sheetName?: string }) => {
    const formData = new FormData();
    formData.append('message', message);
    if (options?.sheetName) {
      formData.append('sheetName', options.sheetName);
    }
    if (options?.file) {
      formData.append('file', options.file);
    }
    return requestFormData<AiImportNormalizeResponse>('/imports/xlsx/company/ai/normalize', formData, token);
  },
  normalizeAndApplyImportWithAi: (message: string, token: string, options?: { file?: File; sheetName?: string }) => {
    const formData = new FormData();
    formData.append('message', message);
    if (options?.sheetName) {
      formData.append('sheetName', options.sheetName);
    }
    if (options?.file) {
      formData.append('file', options.file);
    }
    return requestFormData<AiImportNormalizeApplyResponse>('/imports/xlsx/company/ai/normalize-apply', formData, token);
  },
  previewCompanyXlsxImport: (file: File, token: string, sheetName?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    if (sheetName) {
      formData.append('sheetName', sheetName);
    }
    return requestFormData<CompanyXlsxImportPreviewResponse>('/imports/xlsx/company/preview', formData, token);
  },
  applyCompanyXlsxImport: (file: File, token: string, sheetName?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    if (sheetName) {
      formData.append('sheetName', sheetName);
    }
    return requestFormData<CompanyXlsxImportApplyResponse>('/imports/xlsx/company/apply', formData, token);
  },
  getAdminOverview: (token: string) => request<AdminOverviewResponse>('/auth/admin/overview', {}, token),
  createCompany: (name: string, token: string) =>
    request<LoginResponse>('/auth/companies', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }, token),
  switchCompany: (companyId: string, token: string) =>
    request<LoginResponse>('/auth/companies/switch', {
      method: 'POST',
      body: JSON.stringify({ companyId }),
    }, token),
  updateCompanyName: (companyId: string, name: string, token: string) =>
    request<CompanyNameResponse>(`/auth/companies/${companyId}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    }, token),
  deleteCompany: (companyId: string, token: string) =>
    request<LoginResponse>(`/auth/companies/${companyId}`, {
      method: 'DELETE',
    }, token),
  getMyProjects: (token: string) => request<MyProjectsResponse>('/auth/projects', {}, token),
  createProjectSpace: (name: string, token: string) =>
    request<LoginResponse>('/auth/projects', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }, token),
  switchProjectSpace: (projectId: string, token: string) =>
    request<LoginResponse>('/auth/projects/switch', {
      method: 'POST',
      body: JSON.stringify({ projectId }),
    }, token),
  updateProjectSpaceName: (projectId: string, name: string, token: string) =>
    request<ProjectSpaceNameResponse>(`/auth/projects/${projectId}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    }, token),
  deleteProjectSpace: (projectId: string, token: string) =>
    request<LoginResponse>(`/auth/projects/${projectId}`, {
      method: 'DELETE',
    }, token),
  copyProjectSpace: (projectId: string, name: string, token: string) =>
    request<ProjectSpaceNameResponse>(`/auth/projects/${projectId}/copy`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    }, token),
  getProjectMembers: (projectId: string, token: string) =>
    request<ProjectMembersResponse>(`/auth/projects/${projectId}/members`, {}, token),
  inviteProjectMember: (projectId: string, email: string, permission: ProjectPermission, token: string) =>
    request<ProjectMembersResponse>(`/auth/projects/${projectId}/invite`, {
      method: 'POST',
      body: JSON.stringify({ email, permission }),
    }, token),
  updateProjectMemberPermission: (projectId: string, targetUserId: string, permission: ProjectPermission, token: string) =>
    request<ProjectMembersResponse>(`/auth/projects/${projectId}/members/${targetUserId}`, {
      method: 'PATCH',
      body: JSON.stringify({ permission }),
    }, token),
  removeProjectMember: (projectId: string, targetUserId: string, token: string) =>
    request<ProjectMembersResponse>(`/auth/projects/${projectId}/members/${targetUserId}`, {
      method: 'DELETE',
    }, token),
  getRoles: (token: string) => request('/roles', {}, token),
  getEmployees: (token: string) => request('/employees', {}, token),
  getDepartments: (token: string) => request<DepartmentItem[]>('/departments', {}, token),
  getTeamTemplates: (token: string) => request<TeamTemplateItem[]>('/team-templates', {}, token),
  getGrades: (token: string) => request<GradeItem[]>('/grades', {}, token),
  getSkills: (token: string) => request<SkillItem[]>('/skills', {}, token),
  createRole: (payload: CreateRolePayload, token: string) =>
    request('/roles', { method: 'POST', body: JSON.stringify(payload) }, token),
  createDefaultRoles: (token: string) => request<DefaultsCreateResult>('/roles/defaults', { method: 'POST' }, token),
  deleteRole: (roleId: string, token: string) => request(`/roles/${roleId}`, { method: 'DELETE' }, token),
  createSkill: (payload: CreateSkillPayload, token: string) =>
    request('/skills', { method: 'POST', body: JSON.stringify(payload) }, token),
  updateSkill: (skillId: string, payload: UpdateSkillPayload, token: string) =>
    request(`/skills/${skillId}`, { method: 'PATCH', body: JSON.stringify(payload) }, token),
  updateRole: (roleId: string, payload: UpdateRolePayload, token: string) =>
    request(`/roles/${roleId}`, { method: 'PATCH', body: JSON.stringify(payload) }, token),
  createEmployee: (payload: CreateEmployeePayload, token: string) =>
    request('/employees', { method: 'POST', body: JSON.stringify(payload) }, token),
  updateEmployee: (employeeId: string, payload: UpdateEmployeePayload, token: string) =>
    request(`/employees/${employeeId}`, { method: 'PATCH', body: JSON.stringify(payload) }, token),
  deleteEmployee: (employeeId: string, token: string) => request(`/employees/${employeeId}`, { method: 'DELETE' }, token),
  createDepartment: (payload: CreateDepartmentPayload, token: string) =>
    request('/departments', { method: 'POST', body: JSON.stringify(payload) }, token),
  createDefaultDepartments: (token: string) =>
    request<DefaultsCreateResult>('/departments/defaults', { method: 'POST' }, token),
  createTeamTemplate: (payload: CreateTeamTemplatePayload, token: string) =>
    request<TeamTemplateItem>('/team-templates', { method: 'POST', body: JSON.stringify(payload) }, token),
  createDefaultTeamTemplates: (token: string) =>
    request<DefaultsCreateResult>('/team-templates/defaults', { method: 'POST' }, token),
  updateDepartment: (departmentId: string, payload: UpdateDepartmentPayload, token: string) =>
    request(`/departments/${departmentId}`, { method: 'PATCH', body: JSON.stringify(payload) }, token),
  updateTeamTemplate: (templateId: string, payload: UpdateTeamTemplatePayload, token: string) =>
    request<TeamTemplateItem>(`/team-templates/${templateId}`, { method: 'PATCH', body: JSON.stringify(payload) }, token),
  deleteDepartment: (departmentId: string, token: string) => request(`/departments/${departmentId}`, { method: 'DELETE' }, token),
  deleteTeamTemplate: (templateId: string, token: string) => request(`/team-templates/${templateId}`, { method: 'DELETE' }, token),
  createGrade: (payload: CreateGradePayload, token: string) =>
    request<GradeItem>('/grades', { method: 'POST', body: JSON.stringify(payload) }, token),
  createDefaultGrades: (token: string) => request<DefaultsCreateResult>('/grades/defaults', { method: 'POST' }, token),
  seedDemoWorkspace: (token: string) => request('/demo/seed', { method: 'POST' }, token),
  updateGrade: (gradeId: string, payload: UpdateGradePayload, token: string) =>
    request<GradeItem>(`/grades/${gradeId}`, { method: 'PATCH', body: JSON.stringify(payload) }, token),
  deleteGrade: (gradeId: string, token: string) => request(`/grades/${gradeId}`, { method: 'DELETE' }, token),
  importEmployeesCsv: (payload: ImportEmployeesCsvPayload, token: string) =>
    request<ImportEmployeesCsvResult>('/employees/import-csv', { method: 'POST', body: JSON.stringify(payload) }, token),
  getVacations: (token: string) => request<VacationItem[]>('/vacations', {}, token),
  createVacation: (payload: CreateVacationPayload, token: string) =>
    request('/vacations', { method: 'POST', body: JSON.stringify(payload) }, token),
  updateVacation: (vacationId: string, payload: UpdateVacationPayload, token: string) =>
    request(`/vacations/${vacationId}`, { method: 'PATCH', body: JSON.stringify(payload) }, token),
  deleteVacation: (vacationId: string, token: string) => request(`/vacations/${vacationId}`, { method: 'DELETE' }, token),
  getAssignments: (token: string) => request<AssignmentItem[]>('/assignments', {}, token),
  getProjects: (token: string) => request('/projects', {}, token),
  getProject: (projectId: string, token: string) => request<ProjectDetail>(`/projects/${projectId}`, {}, token),
  getTimelineYear: (year: number, token: string) =>
    request<ProjectTimelineRow[]>(`/timeline/year?year=${year}`, {}, token),
  getCalendarYear: (year: number, token: string) => request<CalendarYearResponse>(`/calendar/${year}`, {}, token),
  getCalendarHealth: (token: string) => request<CalendarHealthResponse>('/calendar/health/status', {}, token),
  createProject: (payload: CreateProjectPayload, token: string) =>
    request('/projects', { method: 'POST', body: JSON.stringify(payload) }, token),
  updateProject: (projectId: string, payload: UpdateProjectPayload, token: string) =>
    request(`/projects/${projectId}`, { method: 'PATCH', body: JSON.stringify(payload) }, token),
  copyProject: (projectId: string, payload: CopyProjectPayload | undefined, token: string) =>
    request<ProjectListItem>(`/projects/${projectId}/copy`, { method: 'POST', body: JSON.stringify(payload ?? {}) }, token),
  deleteProject: (projectId: string, token: string) => request(`/projects/${projectId}`, { method: 'DELETE' }, token),
  createAssignment: (payload: CreateAssignmentPayload, token: string) =>
    request('/assignments', { method: 'POST', body: JSON.stringify(payload) }, token),
  updateAssignment: (assignmentId: string, payload: UpdateAssignmentPayload, token: string) =>
    request(`/assignments/${assignmentId}`, { method: 'PATCH', body: JSON.stringify(payload) }, token),
  deleteAssignment: (assignmentId: string, token: string) => request(`/assignments/${assignmentId}`, { method: 'DELETE' }, token),
  getCostRates: (token: string) => request<CostRateItem[]>('/cost-rates', {}, token),
  createCostRate: (payload: CreateCostRatePayload, token: string) =>
    request<CostRateItem>('/cost-rates', { method: 'POST', body: JSON.stringify(payload) }, token),
  updateCostRate: (costRateId: string, payload: UpdateCostRatePayload, token: string) =>
    request<CostRateItem>(`/cost-rates/${costRateId}`, { method: 'PATCH', body: JSON.stringify(payload) }, token),
};
