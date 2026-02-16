import { DEFAULT_EMPLOYEE_STATUS, DEFAULT_VACATION_TYPE } from './app.constants';

const currentYear = new Date().getFullYear();

export const DEFAULT_ROLE_FORM = {
  name: 'Analyst',
  shortName: 'ANLST',
  description: 'Business analyst role',
  level: 3,
} as const;

export const DEFAULT_SKILL_FORM = {
  name: 'TypeScript',
  description: 'Frontend and backend development',
} as const;

export const DEFAULT_EMPLOYEE_FORM = {
  fullName: 'Jane Smith',
  email: 'jane.smith@projo.local',
  status: DEFAULT_EMPLOYEE_STATUS,
  grade: 'мидл',
} as const;

export const DEFAULT_EMPLOYEE_IMPORT_CSV =
  'fullName,email,role,department,grade,status,defaultCapacityHoursPerDay\nJohn Doe,john.doe@projo.local,Backend Developer,Engineering,мидл,active,8';

export const DEFAULT_PROJECT_FORM = {
  code: 'PRJ-001',
  name: 'Pilot CRM Rollout',
} as const;

export const DEFAULT_DATE_INPUTS = {
  vacationStart: `${currentYear}-07-01`,
  vacationEnd: `${currentYear}-07-14`,
  assignmentStart: `${currentYear}-03-01`,
  assignmentEnd: `${currentYear}-04-30`,
  projectStart: `${currentYear}-02-01`,
  projectEnd: `${currentYear}-06-30`,
} as const;

export const DEFAULT_VACATION_TYPE_VALUE = DEFAULT_VACATION_TYPE;
