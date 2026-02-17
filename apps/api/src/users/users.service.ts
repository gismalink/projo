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
