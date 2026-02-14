import { useState } from 'react';
import {
  AssignmentItem,
  DepartmentItem,
  ProjectDetail,
  ProjectListItem,
  ProjectTimelineRow,
  SkillItem,
  VacationItem,
} from '../api/client';
import { ActiveTab, Employee, Role, Toast } from '../pages/app-types';

export function useAppState() {
  const [email, setEmail] = useState('admin@projo.local');
  const [password, setPassword] = useState('ProjoAdmin!2026');
  const [token, setToken] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<ActiveTab>('timeline');
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [toasts, setToasts] = useState<Toast[]>([]);

  const [roles, setRoles] = useState<Role[]>([]);
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [roleColorDrafts, setRoleColorDrafts] = useState<Record<string, string>>({});
  const [roleName, setRoleName] = useState('Analyst');
  const [roleShortName, setRoleShortName] = useState('ANLST');
  const [roleDescription, setRoleDescription] = useState('Business analyst role');
  const [roleLevel, setRoleLevel] = useState(3);
  const [skillName, setSkillName] = useState('TypeScript');
  const [skillDescription, setSkillDescription] = useState('Frontend and backend development');

  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [vacations, setVacations] = useState<VacationItem[]>([]);
  const [selectedRoleFilters, setSelectedRoleFilters] = useState<string[]>([]);

  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [isEmployeeDepartmentModalOpen, setIsEmployeeDepartmentModalOpen] = useState(false);
  const [isEmployeeImportModalOpen, setIsEmployeeImportModalOpen] = useState(false);
  const [isDepartmentsModalOpen, setIsDepartmentsModalOpen] = useState(false);
  const [isVacationModalOpen, setIsVacationModalOpen] = useState(false);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
  const [isProjectDatesModalOpen, setIsProjectDatesModalOpen] = useState(false);
  const [vacationEmployeeName, setVacationEmployeeName] = useState('');

  const [employeeFullName, setEmployeeFullName] = useState('Jane Smith');
  const [employeeEmail, setEmployeeEmail] = useState('jane.smith@projo.local');
  const [employeeRoleId, setEmployeeRoleId] = useState('');
  const [employeeDepartmentId, setEmployeeDepartmentId] = useState('');
  const [employeeStatus, setEmployeeStatus] = useState('active');
  const [employeeGrade, setEmployeeGrade] = useState('мидл');
  const [employeeCsv, setEmployeeCsv] = useState(
    'fullName,email,role,department,grade,status,defaultCapacityHoursPerDay\nJohn Doe,john.doe@projo.local,Backend Developer,Engineering,мидл,active,8',
  );
  const [editEmployeeId, setEditEmployeeId] = useState('');
  const [editEmployeeName, setEditEmployeeName] = useState('');
  const [editEmployeeRoleName, setEditEmployeeRoleName] = useState('');
  const [editEmployeeDepartmentId, setEditEmployeeDepartmentId] = useState('');

  const [vacationEmployeeId, setVacationEmployeeId] = useState('');
  const [vacationStartDate, setVacationStartDate] = useState(`${new Date().getFullYear()}-07-01`);
  const [vacationEndDate, setVacationEndDate] = useState(`${new Date().getFullYear()}-07-14`);
  const [vacationType, setVacationType] = useState('vacation');

  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [timeline, setTimeline] = useState<ProjectTimelineRow[]>([]);
  const [timelineOrder, setTimelineOrder] = useState<string[]>([]);
  const [expandedProjectIds, setExpandedProjectIds] = useState<string[]>([]);
  const [projectDetails, setProjectDetails] = useState<Record<string, ProjectDetail>>({});
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedProjectDetail, setSelectedProjectDetail] = useState<ProjectDetail | null>(null);

  const [projectCode, setProjectCode] = useState('PRJ-001');
  const [projectName, setProjectName] = useState('Pilot CRM Rollout');
  const [projectStartDate, setProjectStartDate] = useState(`${new Date().getFullYear()}-02-01`);
  const [projectEndDate, setProjectEndDate] = useState(`${new Date().getFullYear()}-06-30`);
  const [editProjectId, setEditProjectId] = useState('');
  const [editProjectStartDate, setEditProjectStartDate] = useState('');
  const [editProjectEndDate, setEditProjectEndDate] = useState('');

  const [assignmentProjectId, setAssignmentProjectId] = useState('');
  const [assignmentEmployeeId, setAssignmentEmployeeId] = useState('');
  const [assignmentStartDate, setAssignmentStartDate] = useState(`${new Date().getFullYear()}-03-01`);
  const [assignmentEndDate, setAssignmentEndDate] = useState(`${new Date().getFullYear()}-04-30`);
  const [assignmentPercent, setAssignmentPercent] = useState(50);

  const [editAssignmentId, setEditAssignmentId] = useState('');
  const [editAssignmentStartDate, setEditAssignmentStartDate] = useState('');
  const [editAssignmentEndDate, setEditAssignmentEndDate] = useState('');
  const [editAssignmentPercent, setEditAssignmentPercent] = useState(0);

  return {
    email,
    password,
    token,
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
    employees,
    vacations,
    selectedRoleFilters,
    isEmployeeModalOpen,
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
    timelineOrder,
    expandedProjectIds,
    projectDetails,
    selectedProjectId,
    selectedProjectDetail,
    projectCode,
    projectName,
    projectStartDate,
    projectEndDate,
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
    setEmployees,
    setVacations,
    setSelectedRoleFilters,
    setIsEmployeeModalOpen,
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
    setTimelineOrder,
    setExpandedProjectIds,
    setProjectDetails,
    setSelectedProjectId,
    setSelectedProjectDetail,
    setProjectCode,
    setProjectName,
    setProjectStartDate,
    setProjectEndDate,
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
