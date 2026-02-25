import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { AppRole } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { ErrorCode } from '../common/error-codes';
import { AppRoleValue } from '../common/decorators/roles.decorator';
import { UsersService } from '../users/users.service';

type LoginResponse = {
  accessToken: string;
  user: {
    id: string;
    email: string;
    fullName: string;
    role: string;
    workspaceId: string;
    workspaceRole: string;
  };
};

type AccountUser = {
  id: string;
  email: string;
  fullName: string;
  role: string;
  workspaceId: string;
  workspaceRole: string;
};

type ProjectAccessItem = {
  id: string;
  name: string;
  role: string;
  isOwner: boolean;
  projectsCount: number;
  totalAllocationPercent: number;
};

type ProjectsResponse = {
  activeProjectId: string;
  myProjects: ProjectAccessItem[];
  sharedProjects: ProjectAccessItem[];
};

type CompanyAccessItem = {
  id: string;
  name: string;
  isOwner: boolean;
};

type CompaniesResponse = {
  activeCompanyId: string;
  companies: CompanyAccessItem[];
};

type CompanyNameResponse = {
  id: string;
  name: string;
};

type AdminOverviewResponse = {
  companyId: string;
  companyName: string;
  totalUsers: number;
  totalProjects: number;
  users: Array<{
    userId: string;
    email: string;
    fullName: string;
    projectsCount: number;
    ownedProjectsCount: number;
  }>;
  topUsers: Array<{
    userId: string;
    email: string;
    fullName: string;
    projectsCount: number;
    ownedProjectsCount: number;
  }>;
  companies: Array<{
    companyId: string;
    companyName: string;
    totalUsers: number;
    totalProjects: number;
  }>;
};

type ProjectMemberItem = {
  userId: string;
  email: string;
  fullName: string;
  role: string;
  isOwner: boolean;
};

type ProjectMembersResponse = {
  projectId: string;
  members: ProjectMemberItem[];
};

type ProjectNameResponse = {
  id: string;
  name: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private canUseAdminConsole(email: string, role: AppRole) {
    const normalizedEmail = this.normalizeEmail(email);
    return role === AppRole.ADMIN || normalizedEmail === 'gismalink@gmail.com';
  }

  private mapUser(payload: {
    user: { id: string; email: string; fullName: string; appRole: string };
    workspaceId: string;
    workspaceRole: string;
  }): AccountUser {
    return {
      id: payload.user.id,
      email: payload.user.email,
      fullName: payload.user.fullName,
      role: payload.user.appRole,
      workspaceId: payload.workspaceId,
      workspaceRole: payload.workspaceRole,
    };
  }

  private async issueAccessToken(payload: {
    user: { id: string; email: string; appRole: string };
    workspaceId: string;
    workspaceRole: string;
  }) {
    const role = payload.workspaceRole as unknown as AppRoleValue;
    return this.jwtService.signAsync({
      sub: payload.user.id,
      email: payload.user.email,
      role,
      workspaceId: payload.workspaceId,
    });
  }

  async login(email: string, password: string): Promise<LoginResponse> {
    const context = await this.usersService.resolveAuthContextByEmail(this.normalizeEmail(email));
    if (!context) {
      throw new UnauthorizedException(ErrorCode.AUTH_INVALID_CREDENTIALS);
    }

    const isValid = await bcrypt.compare(password, context.user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException(ErrorCode.AUTH_INVALID_CREDENTIALS);
    }

    const accessToken = await this.issueAccessToken({
      user: context.user,
      workspaceId: context.workspaceId,
      workspaceRole: context.workspaceRole,
    });

    return {
      accessToken,
      user: this.mapUser({
        user: context.user,
        workspaceId: context.workspaceId,
        workspaceRole: context.workspaceRole,
      }),
    };
  }

  async register(email: string, fullName: string, password: string): Promise<LoginResponse> {
    const normalizedEmail = this.normalizeEmail(email);
    const existing = await this.usersService.findByEmail(normalizedEmail);
    if (existing) {
      throw new ConflictException(ErrorCode.AUTH_EMAIL_ALREADY_EXISTS);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const created = await this.usersService.createUser({
      email: normalizedEmail,
      fullName,
      passwordHash,
      appRole: AppRole.VIEWER,
    });

    const context = await this.usersService.resolveAuthContextByUserId(created.id);
    if (!context) {
      throw new NotFoundException(ErrorCode.AUTH_USER_NOT_FOUND);
    }

    const accessToken = await this.issueAccessToken({
      user: context.user,
      workspaceId: context.workspaceId,
      workspaceRole: context.workspaceRole,
    });

    return {
      accessToken,
      user: this.mapUser({
        user: context.user,
        workspaceId: context.workspaceId,
        workspaceRole: context.workspaceRole,
      }),
    };
  }

  async getMe(userId: string): Promise<AccountUser> {
    const context = await this.usersService.resolveAuthContextByUserId(userId);
    if (!context) {
      throw new NotFoundException(ErrorCode.AUTH_USER_NOT_FOUND);
    }

    return this.mapUser({
      user: context.user,
      workspaceId: context.workspaceId,
      workspaceRole: context.workspaceRole,
    });
  }

  async updateMe(userId: string, fullName: string): Promise<AccountUser> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException(ErrorCode.AUTH_USER_NOT_FOUND);
    }
    const updated = await this.usersService.updateProfile(userId, { fullName });

    const context = await this.usersService.resolveAuthContextByUserId(updated.id);
    if (!context) {
      throw new NotFoundException(ErrorCode.AUTH_USER_NOT_FOUND);
    }

    return this.mapUser({
      user: context.user,
      workspaceId: context.workspaceId,
      workspaceRole: context.workspaceRole,
    });
  }

  async getMyProjects(userId: string, activeProjectId: string): Promise<ProjectsResponse> {
    const items = await this.usersService.listProjectMembershipsInActiveCompany(userId, activeProjectId);
    const stats = await this.usersService.listWorkspaceProjectStats(items.map((item) => item.workspaceId));
    const statsByWorkspaceId = new Map(
      stats.map((item) => [item.workspaceId, { projectsCount: item.projectsCount, totalAllocationPercent: item.totalAllocationPercent }]),
    );

    const projectItems = items.map((item) => ({
      id: item.workspaceId,
      name: item.workspaceName,
      role: item.role,
      isOwner: item.ownerUserId === userId,
      projectsCount: statsByWorkspaceId.get(item.workspaceId)?.projectsCount ?? 0,
      totalAllocationPercent: statsByWorkspaceId.get(item.workspaceId)?.totalAllocationPercent ?? 0,
    }));

    return {
      activeProjectId,
      myProjects: projectItems.filter((item) => item.isOwner),
      sharedProjects: projectItems.filter((item) => !item.isOwner),
    };
  }

  async getMyCompanies(userId: string): Promise<CompaniesResponse> {
    const list = await this.usersService.listCompaniesForUser(userId);
    return {
      activeCompanyId: list.activeCompanyId,
      companies: list.companies.map((item) => ({
        id: item.companyId,
        name: item.companyName,
        isOwner: item.ownerUserId === userId,
      })),
    };
  }

  async getAdminOverview(userId: string, workspaceId: string): Promise<AdminOverviewResponse> {
    const me = await this.usersService.findById(userId);
    if (!me) {
      throw new NotFoundException(ErrorCode.AUTH_USER_NOT_FOUND);
    }

    if (!this.canUseAdminConsole(me.email, me.appRole)) {
      throw new ForbiddenException(ErrorCode.AUTH_COMPANY_ACCESS_DENIED);
    }

    return this.usersService.getAdminCompanyOverview(workspaceId);
  }

  async createCompany(userId: string, name: string): Promise<LoginResponse> {
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new BadRequestException(ErrorCode.AUTH_COMPANY_NAME_REQUIRED);
    }

    const created = await this.usersService.createCompany(userId, trimmedName);
    if (!created) {
      throw new UnauthorizedException(ErrorCode.AUTH_COMPANY_ACCESS_DENIED);
    }

    const context = await this.usersService.resolveAuthContextByUserId(userId);
    if (!context) {
      throw new NotFoundException(ErrorCode.AUTH_USER_NOT_FOUND);
    }

    const accessToken = await this.issueAccessToken({
      user: context.user,
      workspaceId: context.workspaceId,
      workspaceRole: context.workspaceRole,
    });

    return {
      accessToken,
      user: this.mapUser({
        user: context.user,
        workspaceId: context.workspaceId,
        workspaceRole: context.workspaceRole,
      }),
    };
  }

  async switchCompany(userId: string, companyId: string): Promise<LoginResponse> {
    const switched = await this.usersService.switchActiveCompany(userId, companyId);
    if (!switched) {
      throw new UnauthorizedException(ErrorCode.AUTH_COMPANY_ACCESS_DENIED);
    }

    const context = await this.usersService.resolveAuthContextByUserId(userId);
    if (!context) {
      throw new NotFoundException(ErrorCode.AUTH_USER_NOT_FOUND);
    }

    const accessToken = await this.issueAccessToken({
      user: context.user,
      workspaceId: context.workspaceId,
      workspaceRole: context.workspaceRole,
    });

    return {
      accessToken,
      user: this.mapUser({
        user: context.user,
        workspaceId: context.workspaceId,
        workspaceRole: context.workspaceRole,
      }),
    };
  }

  async updateCompanyName(userId: string, companyId: string, name: string): Promise<CompanyNameResponse> {
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new BadRequestException(ErrorCode.AUTH_COMPANY_NAME_REQUIRED);
    }

    const updated = await this.usersService.renameCompany(userId, companyId, trimmedName);
    if (!updated) {
      throw new UnauthorizedException(ErrorCode.AUTH_COMPANY_ACCESS_DENIED);
    }

    return {
      id: updated.id,
      name: updated.name,
    };
  }

  async createProjectSpace(userId: string, name: string): Promise<LoginResponse> {
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new BadRequestException(ErrorCode.AUTH_PROJECT_NAME_REQUIRED);
    }

    await this.usersService.createProjectSpace(userId, trimmedName);

    const context = await this.usersService.resolveAuthContextByUserId(userId);
    if (!context) {
      throw new NotFoundException(ErrorCode.AUTH_USER_NOT_FOUND);
    }

    const accessToken = await this.issueAccessToken({
      user: context.user,
      workspaceId: context.workspaceId,
      workspaceRole: context.workspaceRole,
    });

    return {
      accessToken,
      user: this.mapUser({
        user: context.user,
        workspaceId: context.workspaceId,
        workspaceRole: context.workspaceRole,
      }),
    };
  }

  async switchProjectSpace(userId: string, projectId: string): Promise<LoginResponse> {
    const switched = await this.usersService.switchActiveProjectSpace(userId, projectId);
    if (!switched) {
      throw new UnauthorizedException(ErrorCode.AUTH_PROJECT_ACCESS_DENIED);
    }

    const context = await this.usersService.resolveAuthContextByUserId(userId);
    if (!context) {
      throw new NotFoundException(ErrorCode.AUTH_USER_NOT_FOUND);
    }

    const accessToken = await this.issueAccessToken({
      user: context.user,
      workspaceId: context.workspaceId,
      workspaceRole: context.workspaceRole,
    });

    return {
      accessToken,
      user: this.mapUser({
        user: context.user,
        workspaceId: context.workspaceId,
        workspaceRole: context.workspaceRole,
      }),
    };
  }

  async updateProjectSpaceName(userId: string, projectId: string, name: string): Promise<ProjectNameResponse> {
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new BadRequestException(ErrorCode.AUTH_PROJECT_NAME_REQUIRED);
    }

    const updated = await this.usersService.renameProjectSpace(userId, projectId, trimmedName);
    if (!updated) {
      throw new UnauthorizedException(ErrorCode.AUTH_PROJECT_ACCESS_DENIED);
    }

    return {
      id: updated.id,
      name: updated.name,
    };
  }

  async deleteProjectSpace(userId: string, projectId: string): Promise<LoginResponse> {
    const deleted = await this.usersService.deleteProjectSpace(userId, projectId);
    if (!deleted) {
      throw new UnauthorizedException(ErrorCode.AUTH_PROJECT_ACCESS_DENIED);
    }

    const context = await this.usersService.resolveAuthContextByUserId(userId);
    if (!context) {
      throw new NotFoundException(ErrorCode.AUTH_USER_NOT_FOUND);
    }

    const accessToken = await this.issueAccessToken({
      user: context.user,
      workspaceId: context.workspaceId,
      workspaceRole: context.workspaceRole,
    });

    return {
      accessToken,
      user: this.mapUser({
        user: context.user,
        workspaceId: context.workspaceId,
        workspaceRole: context.workspaceRole,
      }),
    };
  }

  async copyProjectSpace(userId: string, projectId: string, name: string): Promise<ProjectNameResponse> {
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new BadRequestException(ErrorCode.AUTH_PROJECT_NAME_REQUIRED);
    }

    const copied = await this.usersService.copyProjectSpace(userId, projectId, trimmedName);
    if (!copied) {
      throw new UnauthorizedException(ErrorCode.AUTH_PROJECT_ACCESS_DENIED);
    }

    return {
      id: copied.id,
      name: copied.name,
    };
  }

  async getProjectMembers(userId: string, projectId: string): Promise<ProjectMembersResponse> {
    const members = await this.usersService.listProjectMembersForUser(userId, projectId);
    if (!members) {
      throw new UnauthorizedException(ErrorCode.AUTH_PROJECT_ACCESS_DENIED);
    }

    return {
      projectId,
      members: members.map((member) => ({
        userId: member.userId,
        email: member.email,
        fullName: member.fullName,
        role: member.role,
        isOwner: member.isOwner,
      })),
    };
  }

  async inviteProjectMember(
    userId: string,
    projectId: string,
    email: string,
    permission: 'viewer' | 'editor',
  ): Promise<ProjectMembersResponse> {
    const role = permission === 'editor' ? AppRole.EDITOR : AppRole.VIEWER;
    const invited = await this.usersService.inviteProjectMemberByEmail(userId, projectId, this.normalizeEmail(email), role);

    if (invited === 'FORBIDDEN') {
      throw new UnauthorizedException(ErrorCode.AUTH_PROJECT_ACCESS_DENIED);
    }

    if (invited === 'USER_NOT_FOUND') {
      throw new NotFoundException(ErrorCode.AUTH_PROJECT_INVITE_USER_NOT_FOUND);
    }

    return {
      projectId,
      members: invited.map((member) => ({
        userId: member.userId,
        email: member.email,
        fullName: member.fullName,
        role: member.role,
        isOwner: member.isOwner,
      })),
    };
  }

  async updateProjectMemberPermission(
    userId: string,
    projectId: string,
    targetUserId: string,
    permission: 'viewer' | 'editor',
  ): Promise<ProjectMembersResponse> {
    const role = permission === 'editor' ? AppRole.EDITOR : AppRole.VIEWER;
    const updated = await this.usersService.updateProjectMemberPermission(userId, projectId, targetUserId, role);

    if (updated === 'FORBIDDEN') {
      throw new UnauthorizedException(ErrorCode.AUTH_PROJECT_ACCESS_DENIED);
    }

    if (updated === 'TARGET_NOT_FOUND') {
      throw new NotFoundException(ErrorCode.AUTH_PROJECT_MEMBER_NOT_FOUND);
    }

    if (updated === 'OWNER_IMMUTABLE') {
      throw new BadRequestException(ErrorCode.AUTH_PROJECT_OWNER_IMMUTABLE);
    }

    return {
      projectId,
      members: updated.map((member) => ({
        userId: member.userId,
        email: member.email,
        fullName: member.fullName,
        role: member.role,
        isOwner: member.isOwner,
      })),
    };
  }

  async removeProjectMember(userId: string, projectId: string, targetUserId: string): Promise<ProjectMembersResponse> {
    const updated = await this.usersService.removeProjectMember(userId, projectId, targetUserId);

    if (updated === 'FORBIDDEN') {
      throw new UnauthorizedException(ErrorCode.AUTH_PROJECT_ACCESS_DENIED);
    }

    if (updated === 'TARGET_NOT_FOUND') {
      throw new NotFoundException(ErrorCode.AUTH_PROJECT_MEMBER_NOT_FOUND);
    }

    if (updated === 'OWNER_IMMUTABLE') {
      throw new BadRequestException(ErrorCode.AUTH_PROJECT_OWNER_IMMUTABLE);
    }

    return {
      projectId,
      members: updated.map((member) => ({
        userId: member.userId,
        email: member.email,
        fullName: member.fullName,
        role: member.role,
        isOwner: member.isOwner,
      })),
    };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException(ErrorCode.AUTH_USER_NOT_FOUND);
    }

    const isCurrentValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isCurrentValid) {
      throw new UnauthorizedException(ErrorCode.AUTH_PASSWORD_INVALID);
    }

    const isSamePassword = await bcrypt.compare(newPassword, user.passwordHash);
    if (isSamePassword) {
      throw new BadRequestException(ErrorCode.AUTH_PASSWORD_SAME_AS_OLD);
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.usersService.updatePasswordHash(userId, passwordHash);

    return { success: true };
  }

  logout() {
    return { success: true };
  }
}
