import { SetMetadata } from '@nestjs/common';

export const APP_ROLES_KEY = 'app_roles';

export enum AppRoleValue {
  ADMIN = 'ADMIN',
  PM = 'PM',
  VIEWER = 'VIEWER',
  FINANCE = 'FINANCE',
}

export const Roles = (...roles: AppRoleValue[]) => SetMetadata(APP_ROLES_KEY, roles);
