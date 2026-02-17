import { Injectable } from '@nestjs/common';
import { AppRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../common/prisma.service';

type UserAuthContext = {
  user: {
    id: string;
    email: string;
    fullName: string;
    appRole: AppRole;
    passwordHash: string;
  };
  workspaceId: string;
  workspaceRole: AppRole;
};

type ProjectMembershipItem = {
  workspaceId: string;
  workspaceName: string;
  ownerUserId: string;
  role: AppRole;
};

type ProjectMemberItem = {
  userId: string;
  email: string;
  fullName: string;
  role: AppRole;
  isOwner: boolean;
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private workspaceNameForUser(fullName: string) {
    const trimmed = fullName.trim();
    return trimmed ? `${trimmed} workspace` : 'Personal workspace';
  }

  private async listProjectMembers(workspaceId: string): Promise<ProjectMemberItem[]> {
    const members = await this.prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: {
        workspace: {
          select: {
            ownerUserId: true,
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
      },
      orderBy: [{ createdAt: 'asc' }],
    });

    return members.map((member) => ({
      userId: member.user.id,
      email: member.user.email,
      fullName: member.user.fullName,
      role: member.role,
      isOwner: member.workspace.ownerUserId === member.user.id,
    }));
  }

  private async ensureActiveWorkspaceForUser(userId: string): Promise<{ workspaceId: string; workspaceRole: AppRole }> {
    const userWithMemberships = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        workspaceMemberships: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!userWithMemberships) {
      throw new Error('User not found while resolving workspace context');
    }

    if (!userWithMemberships.workspaceMemberships.length) {
      const workspace = await this.prisma.workspace.create({
        data: {
          name: this.workspaceNameForUser(userWithMemberships.fullName),
          ownerUserId: userWithMemberships.id,
        },
      });

      const membership = await this.prisma.workspaceMember.create({
        data: {
          workspaceId: workspace.id,
          userId: userWithMemberships.id,
          role: userWithMemberships.appRole,
        },
      });

      await this.prisma.user.update({
        where: { id: userWithMemberships.id },
        data: { activeWorkspaceId: workspace.id },
      });

      return {
        workspaceId: workspace.id,
        workspaceRole: membership.role,
      };
    }

    let membership = userWithMemberships.workspaceMemberships.find((item) => item.workspaceId === userWithMemberships.activeWorkspaceId);
    if (!membership) {
      membership = userWithMemberships.workspaceMemberships[0];
      await this.prisma.user.update({
        where: { id: userWithMemberships.id },
        data: { activeWorkspaceId: membership.workspaceId },
      });
    }

    return {
      workspaceId: membership.workspaceId,
      workspaceRole: membership.role,
    };
  }

  async ensureBootstrapAdmin() {
    const bootstrapEmailRaw = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim();
    const bootstrapPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD;
    const legacyBootstrapPassword = process.env.LEGACY_BOOTSTRAP_ADMIN_PASSWORD;
    const bootstrapEmail = bootstrapEmailRaw ? this.normalizeEmail(bootstrapEmailRaw) : '';

    if (!bootstrapEmail || !bootstrapPassword) {
      return null;
    }

    const existing = await this.prisma.user.findUnique({
      where: { email: bootstrapEmail },
    });

    if (existing) {
      await this.ensureActiveWorkspaceForUser(existing.id);
      if (legacyBootstrapPassword) {
        const isLegacyPassword = await bcrypt.compare(legacyBootstrapPassword, existing.passwordHash);
        if (isLegacyPassword) {
          const passwordHash = await bcrypt.hash(bootstrapPassword, 10);
          const updated = await this.prisma.user.update({
            where: { id: existing.id },
            data: { passwordHash },
          });
          await this.ensureActiveWorkspaceForUser(updated.id);
          return updated;
        }
      }
      return existing;
    }

    const passwordHash = await bcrypt.hash(bootstrapPassword, 10);
    const created = await this.prisma.user.create({
      data: {
        email: bootstrapEmail,
        fullName: 'System Admin',
        passwordHash,
        appRole: AppRole.ADMIN,
      },
    });

    await this.ensureActiveWorkspaceForUser(created.id);
    return created;
  }

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email: this.normalizeEmail(email) } });
  }

  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async createUser(payload: { email: string; fullName: string; passwordHash: string; appRole?: AppRole }) {
    const created = await this.prisma.user.create({
      data: {
        email: this.normalizeEmail(payload.email),
        fullName: payload.fullName.trim(),
        passwordHash: payload.passwordHash,
        appRole: payload.appRole ?? AppRole.VIEWER,
      },
    });

    await this.ensureActiveWorkspaceForUser(created.id);
    return created;
  }

  async listProjectMemberships(userId: string): Promise<ProjectMembershipItem[]> {
    const memberships = await this.prisma.workspaceMember.findMany({
      where: { userId },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            ownerUserId: true,
          },
        },
      },
      orderBy: [{ createdAt: 'asc' }],
    });

    return memberships.map((membership) => ({
      workspaceId: membership.workspace.id,
      workspaceName: membership.workspace.name,
      ownerUserId: membership.workspace.ownerUserId,
      role: membership.role,
    }));
  }

  async createProjectSpace(userId: string, name: string) {
    const trimmedName = name.trim();
    const workspace = await this.prisma.workspace.create({
      data: {
        name: trimmedName,
        ownerUserId: userId,
      },
    });

    await this.prisma.workspaceMember.create({
      data: {
        workspaceId: workspace.id,
        userId,
        role: AppRole.ADMIN,
      },
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        activeWorkspaceId: workspace.id,
      },
    });

    return workspace;
  }

  async renameProjectSpace(ownerUserId: string, workspaceId: string, name: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        id: true,
        ownerUserId: true,
      },
    });

    if (!workspace || workspace.ownerUserId !== ownerUserId) {
      return null;
    }

    return this.prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        name: name.trim(),
      },
      select: {
        id: true,
        name: true,
      },
    });
  }

  async listProjectMembersForUser(userId: string, workspaceId: string): Promise<ProjectMemberItem[] | null> {
    const membership = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
      select: {
        workspaceId: true,
      },
    });

    if (!membership) {
      return null;
    }

    return this.listProjectMembers(workspaceId);
  }

  async inviteProjectMemberByEmail(
    ownerUserId: string,
    workspaceId: string,
    email: string,
    role: AppRole,
  ): Promise<ProjectMemberItem[] | 'FORBIDDEN' | 'USER_NOT_FOUND'> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        id: true,
        ownerUserId: true,
      },
    });

    if (!workspace || workspace.ownerUserId !== ownerUserId) {
      return 'FORBIDDEN';
    }

    const user = await this.prisma.user.findUnique({
      where: { email: this.normalizeEmail(email) },
      select: {
        id: true,
      },
    });

    if (!user) {
      return 'USER_NOT_FOUND';
    }

    if (user.id !== workspace.ownerUserId) {
      await this.prisma.workspaceMember.upsert({
        where: {
          workspaceId_userId: {
            workspaceId,
            userId: user.id,
          },
        },
        create: {
          workspaceId,
          userId: user.id,
          role,
        },
        update: {
          role,
        },
      });
    }

    await this.prisma.user.updateMany({
      where: {
        id: user.id,
        activeWorkspaceId: null,
      },
      data: {
        activeWorkspaceId: workspaceId,
      },
    });

    return this.listProjectMembers(workspaceId);
  }

  async updateProjectMemberPermission(
    ownerUserId: string,
    workspaceId: string,
    targetUserId: string,
    role: AppRole,
  ): Promise<ProjectMemberItem[] | 'FORBIDDEN' | 'TARGET_NOT_FOUND' | 'OWNER_IMMUTABLE'> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        id: true,
        ownerUserId: true,
      },
    });

    if (!workspace || workspace.ownerUserId !== ownerUserId) {
      return 'FORBIDDEN';
    }

    if (targetUserId === workspace.ownerUserId) {
      return 'OWNER_IMMUTABLE';
    }

    const targetMembership = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: targetUserId,
        },
      },
      select: {
        workspaceId: true,
      },
    });

    if (!targetMembership) {
      return 'TARGET_NOT_FOUND';
    }

    await this.prisma.workspaceMember.update({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: targetUserId,
        },
      },
      data: {
        role,
      },
    });

    return this.listProjectMembers(workspaceId);
  }

  async removeProjectMember(
    ownerUserId: string,
    workspaceId: string,
    targetUserId: string,
  ): Promise<ProjectMemberItem[] | 'FORBIDDEN' | 'TARGET_NOT_FOUND' | 'OWNER_IMMUTABLE'> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        id: true,
        ownerUserId: true,
      },
    });

    if (!workspace || workspace.ownerUserId !== ownerUserId) {
      return 'FORBIDDEN';
    }

    if (targetUserId === workspace.ownerUserId) {
      return 'OWNER_IMMUTABLE';
    }

    const targetMembership = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: targetUserId,
        },
      },
      select: {
        workspaceId: true,
      },
    });

    if (!targetMembership) {
      return 'TARGET_NOT_FOUND';
    }

    await this.prisma.workspaceMember.delete({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: targetUserId,
        },
      },
    });

    await this.prisma.user.updateMany({
      where: {
        id: targetUserId,
        activeWorkspaceId: workspaceId,
      },
      data: {
        activeWorkspaceId: null,
      },
    });

    return this.listProjectMembers(workspaceId);
  }

  async switchActiveProjectSpace(userId: string, workspaceId: string) {
    const membership = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
      select: {
        workspaceId: true,
      },
    });

    if (!membership) {
      return null;
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { activeWorkspaceId: workspaceId },
    });

    return membership;
  }

  async resolveAuthContextByUserId(userId: string): Promise<UserAuthContext | null> {
    const user = await this.findById(userId);
    if (!user) {
      return null;
    }

    const { workspaceId, workspaceRole } = await this.ensureActiveWorkspaceForUser(user.id);

    return {
      user,
      workspaceId,
      workspaceRole,
    };
  }

  async resolveAuthContextByEmail(email: string): Promise<UserAuthContext | null> {
    const user = await this.findByEmail(email);
    if (!user) {
      return null;
    }

    return this.resolveAuthContextByUserId(user.id);
  }

  async updateProfile(userId: string, payload: { fullName: string }) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        fullName: payload.fullName.trim(),
      },
    });
  }

  async updatePasswordHash(userId: string, passwordHash: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  }
}
