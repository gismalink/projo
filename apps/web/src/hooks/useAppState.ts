import { useState } from 'react';
import {
  AssignmentItem,
  CalendarDayItem,
  CalendarHealthResponse,
  DepartmentItem,
  ProjectDetail,
  ProjectListItem,
  ProjectTimelineRow,
  SkillItem,
  TeamTemplateItem,
  VacationItem,
} from '../api/client';
import { DEFAULT_VACATION_TYPE } from '../constants/app.constants';
import {
  DEFAULT_DATE_INPUTS,
  DEFAULT_EMPLOYEE_FORM,
  DEFAULT_EMPLOYEE_IMPORT_CSV,
  DEFAULT_PROJECT_FORM,
  DEFAULT_ROLE_FORM,
  DEFAULT_SKILL_FORM,
} from '../constants/seed-defaults.constants';
import { ActiveTab, Employee, Role, Toast } from '../pages/app-types';

const WEB_DEFAULT_LOGIN_EMAIL = import.meta.env.VITE_WEB_DEFAULT_LOGIN_EMAIL ?? '';
const WEB_DEFAULT_LOGIN_PASSWORD = import.meta.env.VITE_WEB_DEFAULT_LOGIN_PASSWORD ?? '';

export function useAppState() {
  const [email, setEmail] = useState(WEB_DEFAULT_LOGIN_EMAIL);
  const [password, setPassword] = useState(WEB_DEFAULT_LOGIN_PASSWORD);
  const [token, setToken] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<ActiveTab>('timeline');
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [toasts, setToasts] = useState<Toast[]>([]);

  const [roles, setRoles] = useState<Role[]>([]);
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [roleColorDrafts, setRoleColorDrafts] = useState<Record<string, string>>({});
  const [roleName, setRoleName] = useState<string>(DEFAULT_ROLE_FORM.name);
  const [roleShortName, setRoleShortName] = useState<string>(DEFAULT_ROLE_FORM.shortName);
  const [roleDescription, setRoleDescription] = useState<string>(DEFAULT_ROLE_FORM.description);
  const [roleLevel, setRoleLevel] = useState<number>(DEFAULT_ROLE_FORM.level);
  const [skillName, setSkillName] = useState<string>(DEFAULT_SKILL_FORM.name);
  const [skillDescription, setSkillDescription] = useState<string>(DEFAULT_SKILL_FORM.description);

  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [teamTemplates, setTeamTemplates] = useState<TeamTemplateItem[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [vacations, setVacations] = useState<VacationItem[]>([]);
  const [selectedRoleFilters, setSelectedRoleFilters] = useState<string[]>([]);

  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [isEmployeeCreateModalOpen, setIsEmployeeCreateModalOpen] = useState(false);
  const [isEmployeeDepartmentModalOpen, setIsEmployeeDepartmentModalOpen] = useState(false);
  const [isEmployeeImportModalOpen, setIsEmployeeImportModalOpen] = useState(false);
  const [isDepartmentsModalOpen, setIsDepartmentsModalOpen] = useState(false);
  const [isVacationModalOpen, setIsVacationModalOpen] = useState(false);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
  const [isProjectDatesModalOpen, setIsProjectDatesModalOpen] = useState(false);
  const [vacationEmployeeName, setVacationEmployeeName] = useState('');

  const [employeeFullName, setEmployeeFullName] = useState<string>(DEFAULT_EMPLOYEE_FORM.fullName);
  const [employeeEmail, setEmployeeEmail] = useState<string>(DEFAULT_EMPLOYEE_FORM.email);
  const [employeeRoleId, setEmployeeRoleId] = useState('');
  const [employeeDepartmentId, setEmployeeDepartmentId] = useState('');
  const [employeeStatus, setEmployeeStatus] = useState<string>(DEFAULT_EMPLOYEE_FORM.status);
  const [employeeGrade, setEmployeeGrade] = useState<string>(DEFAULT_EMPLOYEE_FORM.grade);
  const [employeeSalary, setEmployeeSalary] = useState('');
  const [employeeSalaryById, setEmployeeSalaryById] = useState<Record<string, number>>({});
  const [employeeActiveRateIdByEmployeeId, setEmployeeActiveRateIdByEmployeeId] = useState<Record<string, string>>({});
  const [employeeCsv, setEmployeeCsv] = useState<string>(DEFAULT_EMPLOYEE_IMPORT_CSV);
  const [editEmployeeId, setEditEmployeeId] = useState('');
  const [editEmployeeName, setEditEmployeeName] = useState('');
  const [editEmployeeRoleName, setEditEmployeeRoleName] = useState('');
  const [editEmployeeDepartmentId, setEditEmployeeDepartmentId] = useState('');

  const [vacationEmployeeId, setVacationEmployeeId] = useState('');
  const [vacationStartDate, setVacationStartDate] = useState<string>(DEFAULT_DATE_INPUTS.vacationStart);
  const [vacationEndDate, setVacationEndDate] = useState<string>(DEFAULT_DATE_INPUTS.vacationEnd);
  const [vacationType, setVacationType] = useState<string>(DEFAULT_VACATION_TYPE);

  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [timeline, setTimeline] = useState<ProjectTimelineRow[]>([]);
  const [calendarDays, setCalendarDays] = useState<CalendarDayItem[]>([]);
  const [calendarHealth, setCalendarHealth] = useState<CalendarHealthResponse | null>(null);
  const [timelineOrder, setTimelineOrder] = useState<string[]>([]);
  const [expandedProjectIds, setExpandedProjectIds] = useState<string[]>([]);
  const [projectDetails, setProjectDetails] = useState<Record<string, ProjectDetail>>({});
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedProjectDetail, setSelectedProjectDetail] = useState<ProjectDetail | null>(null);

  const [projectCode, setProjectCode] = useState<string>(DEFAULT_PROJECT_FORM.code);
  const [projectName, setProjectName] = useState<string>(DEFAULT_PROJECT_FORM.name);
  const [projectStartDate, setProjectStartDate] = useState<string>(DEFAULT_DATE_INPUTS.projectStart);
  const [projectEndDate, setProjectEndDate] = useState<string>(DEFAULT_DATE_INPUTS.projectEnd);
  const [projectTeamTemplateId, setProjectTeamTemplateId] = useState('');
  const [editProjectId, setEditProjectId] = useState('');
  const [editProjectStartDate, setEditProjectStartDate] = useState('');
  const [editProjectEndDate, setEditProjectEndDate] = useState('');

  const [assignmentProjectId, setAssignmentProjectId] = useState('');
  const [assignmentEmployeeId, setAssignmentEmployeeId] = useState('');
  const [assignmentStartDate, setAssignmentStartDate] = useState<string>(DEFAULT_DATE_INPUTS.assignmentStart);
  const [assignmentEndDate, setAssignmentEndDate] = useState<string>(DEFAULT_DATE_INPUTS.assignmentEnd);
  const [assignmentPercent, setAssignmentPercent] = useState(50);

  const [editAssignmentId, setEditAssignmentId] = useState('');
  const [editAssignmentStartDate, setEditAssignmentStartDate] = useState('');
  const [editAssignmentEndDate, setEditAssignmentEndDate] = useState('');
  const [editAssignmentPercent, setEditAssignmentPercent] = useState(0);

  return {
    email,
    password,
    token,
    currentUserRole,
    activeTab,
    selectedYear,
    toasts,
    roles,
    skills,
    roleColorDrafts,
    roleName,
    roleShortName,
    roleDescription,
    roleLevel,
    skillName,
    skillDescription,
    departments,
    teamTemplates,
    employees,
    vacations,
    selectedRoleFilters,
    isEmployeeModalOpen,
    isEmployeeCreateModalOpen,
    isEmployeeDepartmentModalOpen,
    isEmployeeImportModalOpen,
    isDepartmentsModalOpen,
    isVacationModalOpen,
    isProjectModalOpen,
    isAssignmentModalOpen,
    isProjectDatesModalOpen,
    vacationEmployeeName,
    employeeFullName,
    employeeEmail,
    employeeRoleId,
    employeeDepartmentId,
    employeeStatus,
    employeeGrade,
    employeeSalary,
    employeeSalaryById,
    employeeActiveRateIdByEmployeeId,
    employeeCsv,
    editEmployeeId,
    editEmployeeName,
    editEmployeeRoleName,
    editEmployeeDepartmentId,
    vacationEmployeeId,
    vacationStartDate,
    vacationEndDate,
    vacationType,
    assignments,
    projects,
    timeline,
    calendarDays,
    calendarHealth,
    timelineOrder,
    expandedProjectIds,
    projectDetails,
    selectedProjectId,
    selectedProjectDetail,
    projectCode,
    projectName,
    projectStartDate,
    projectEndDate,
    projectTeamTemplateId,
    editProjectId,
    editProjectStartDate,
    editProjectEndDate,
    assignmentProjectId,
    assignmentEmployeeId,
    assignmentStartDate,
    assignmentEndDate,
    assignmentPercent,
    editAssignmentId,
    editAssignmentStartDate,
    editAssignmentEndDate,
    editAssignmentPercent,
    setEmail,
    setPassword,
    setToken,
    setCurrentUserRole,
    setActiveTab,
    setSelectedYear,
    setToasts,
    setRoles,
    setSkills,
    setRoleColorDrafts,
    setRoleName,
    setRoleShortName,
    setRoleDescription,
    setRoleLevel,
    setSkillName,
    setSkillDescription,
    setDepartments,
    setTeamTemplates,
    setEmployees,
    setVacations,
    setSelectedRoleFilters,
    setIsEmployeeModalOpen,
    setIsEmployeeCreateModalOpen,
    setIsEmployeeDepartmentModalOpen,
    setIsEmployeeImportModalOpen,
    setIsDepartmentsModalOpen,
    setIsVacationModalOpen,
    setIsProjectModalOpen,
    setIsAssignmentModalOpen,
    setIsProjectDatesModalOpen,
    setVacationEmployeeName,
    setEmployeeFullName,
    setEmployeeEmail,
    setEmployeeRoleId,
    setEmployeeDepartmentId,
    setEmployeeStatus,
    setEmployeeGrade,
    setEmployeeSalary,
    setEmployeeSalaryById,
    setEmployeeActiveRateIdByEmployeeId,
    setEmployeeCsv,
    setEditEmployeeId,
    setEditEmployeeName,
    setEditEmployeeRoleName,
    setEditEmployeeDepartmentId,
    setVacationEmployeeId,
    setVacationStartDate,
    setVacationEndDate,
    setVacationType,
    setAssignments,
    setProjects,
    setTimeline,
    setCalendarDays,
    setCalendarHealth,
    setTimelineOrder,
    setExpandedProjectIds,
    setProjectDetails,
    setSelectedProjectId,
    setSelectedProjectDetail,
    setProjectCode,
    setProjectName,
    setProjectStartDate,
    setProjectEndDate,
    setProjectTeamTemplateId,
    setEditProjectId,
    setEditProjectStartDate,
    setEditProjectEndDate,
    setAssignmentProjectId,
    setAssignmentEmployeeId,
    setAssignmentStartDate,
    setAssignmentEndDate,
    setAssignmentPercent,
    setEditAssignmentId,
    setEditAssignmentStartDate,
    setEditAssignmentEndDate,
    setEditAssignmentPercent,
  };
}

export type AppState = ReturnType<typeof useAppState>;
