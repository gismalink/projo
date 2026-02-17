import { Injectable } from '@nestjs/common';
import { AppRole, Prisma } from '@prisma/client';
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

type CompanyMembershipItem = {
  companyId: string;
  companyName: string;
  ownerUserId: string;
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

  private companyNameForUser(fullName: string) {
    const trimmed = fullName.trim();
    return trimmed ? `${trimmed} company` : 'Default company';
  }

  private async ensureOwnerCompanyId(ownerUserId: string, ownerFullName?: string): Promise<string> {
    const existing = await this.prisma.company.findFirst({
      where: { ownerUserId },
      select: { id: true },
      orderBy: [{ createdAt: 'asc' }],
    });

    if (existing) return existing.id;

    const user = ownerFullName
      ? { fullName: ownerFullName }
      : await this.prisma.user.findUnique({
          where: { id: ownerUserId },
          select: { fullName: true },
        });

    const company = await this.prisma.company.create({
      data: {
        ownerUserId,
        name: this.companyNameForUser(user?.fullName ?? ''),
      },
      select: { id: true },
    });

    return company.id;
  }

  private async ensureWorkspaceCompanyId(workspaceId: string): Promise<string> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        id: true,
        companyId: true,
        ownerUserId: true,
        owner: {
          select: {
            fullName: true,
          },
        },
      },
    });

    if (!workspace) {
      throw new Error('Workspace not found while resolving company context');
    }

    if (workspace.companyId) {
      return workspace.companyId;
    }

    const companyId = await this.ensureOwnerCompanyId(workspace.ownerUserId, workspace.owner.fullName);
    await this.prisma.workspace.update({
      where: { id: workspace.id },
      data: { companyId },
    });
    return companyId;
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
      const companyId = await this.ensureOwnerCompanyId(userWithMemberships.id, userWithMemberships.fullName);
      const workspace = await this.prisma.workspace.create({
        data: {
          name: this.workspaceNameForUser(userWithMemberships.fullName),
          ownerUserId: userWithMemberships.id,
          companyId,
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

  async listProjectMembershipsInActiveCompany(userId: string, activeWorkspaceId: string): Promise<ProjectMembershipItem[]> {
    const activeCompanyId = await this.ensureWorkspaceCompanyId(activeWorkspaceId);

    const memberships = await this.prisma.workspaceMember.findMany({
      where: {
        userId,
        OR: [
          {
            workspace: {
              companyId: activeCompanyId,
            },
          },
          {
            workspaceId: activeWorkspaceId,
          },
        ],
      },
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

    const unique = new Map<string, ProjectMembershipItem>();
    for (const membership of memberships) {
      unique.set(membership.workspace.id, {
        workspaceId: membership.workspace.id,
        workspaceName: membership.workspace.name,
        ownerUserId: membership.workspace.ownerUserId,
        role: membership.role,
      });
    }

    return Array.from(unique.values());
  }

  async listCompaniesForUser(userId: string): Promise<{ activeCompanyId: string; companies: CompanyMembershipItem[] }> {
    const { workspaceId: activeWorkspaceId } = await this.ensureActiveWorkspaceForUser(userId);

    const memberships = await this.prisma.workspaceMember.findMany({
      where: { userId },
      select: {
        workspaceId: true,
      },
      orderBy: [{ createdAt: 'asc' }],
    });

    const workspaceIds = Array.from(new Set([activeWorkspaceId, ...memberships.map((item) => item.workspaceId)]));
    const companyIds = new Set<string>();
    for (const workspaceId of workspaceIds) {
      const companyId = await this.ensureWorkspaceCompanyId(workspaceId);
      companyIds.add(companyId);
    }

    const activeCompanyId = await this.ensureWorkspaceCompanyId(activeWorkspaceId);

    const companies = await this.prisma.company.findMany({
      where: {
        id: { in: Array.from(companyIds) },
      },
      select: {
        id: true,
        name: true,
        ownerUserId: true,
      },
      orderBy: [{ createdAt: 'asc' }],
    });

    return {
      activeCompanyId,
      companies: companies.map((company) => ({
        companyId: company.id,
        companyName: company.name,
        ownerUserId: company.ownerUserId,
      })),
    };
  }

  async createCompany(ownerUserId: string, name: string): Promise<{ id: string; name: string } | null> {
    const owner = await this.prisma.user.findUnique({
      where: { id: ownerUserId },
      select: { id: true },
    });
    if (!owner) {
      return null;
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      return null;
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          ownerUserId,
          name: trimmedName,
        },
        select: {
          id: true,
          name: true,
        },
      });

      const workspace = await tx.workspace.create({
        data: {
          ownerUserId,
          companyId: company.id,
          name: `${trimmedName} plan`,
        },
        select: {
          id: true,
        },
      });

      await tx.workspaceMember.create({
        data: {
          workspaceId: workspace.id,
          userId: ownerUserId,
          role: AppRole.ADMIN,
        },
      });

      await tx.user.update({
        where: { id: ownerUserId },
        data: {
          activeWorkspaceId: workspace.id,
        },
      });

      return company;
    });

    return created;
  }

  async renameCompany(ownerUserId: string, companyId: string, name: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        ownerUserId: true,
      },
    });

    if (!company || company.ownerUserId !== ownerUserId) {
      return null;
    }

    return this.prisma.company.update({
      where: { id: companyId },
      data: {
        name: name.trim(),
      },
      select: {
        id: true,
        name: true,
      },
    });
  }

  async switchActiveCompany(userId: string, companyId: string): Promise<{ workspaceId: string } | null> {
    const existingMembership = await this.prisma.workspaceMember.findFirst({
      where: {
        userId,
        workspace: {
          companyId,
        },
      },
      select: {
        workspaceId: true,
      },
      orderBy: [{ createdAt: 'asc' }],
    });

    if (existingMembership) {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          activeWorkspaceId: existingMembership.workspaceId,
        },
      });
      return { workspaceId: existingMembership.workspaceId };
    }

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        name: true,
        ownerUserId: true,
      },
    });

    if (!company || company.ownerUserId !== userId) {
      return null;
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.create({
        data: {
          ownerUserId: userId,
          companyId: company.id,
          name: `${company.name} plan`,
        },
        select: {
          id: true,
        },
      });

      await tx.workspaceMember.create({
        data: {
          workspaceId: workspace.id,
          userId,
          role: AppRole.ADMIN,
        },
      });

      await tx.user.update({
        where: { id: userId },
        data: {
          activeWorkspaceId: workspace.id,
        },
      });

      return workspace;
    });

    return { workspaceId: created.id };
  }

  async createProjectSpace(userId: string, name: string) {
    const trimmedName = name.trim();
    const companyId = await this.ensureOwnerCompanyId(userId);
    const workspace = await this.prisma.workspace.create({
      data: {
        name: trimmedName,
        ownerUserId: userId,
        companyId,
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

  async copyProjectSpace(ownerUserId: string, sourceWorkspaceId: string, name: string) {
    const sourceWorkspace = await this.prisma.workspace.findUnique({
      where: { id: sourceWorkspaceId },
      select: { id: true, ownerUserId: true, companyId: true },
    });

    if (!sourceWorkspace || sourceWorkspace.ownerUserId !== ownerUserId) {
      return null;
    }

    return this.prisma.$transaction(async (tx) => {
      const sourceCompanyId =
        sourceWorkspace.companyId ??
        (
          await tx.company.findFirst({
            where: { ownerUserId },
            select: { id: true },
            orderBy: [{ createdAt: 'asc' }],
          })
        )?.id ??
        (
          await tx.company.create({
            data: {
              ownerUserId,
              name: 'Default company',
            },
            select: { id: true },
          })
        ).id;

      const copiedWorkspace = await tx.workspace.create({
        data: {
          name: name.trim(),
          ownerUserId,
          companyId: sourceCompanyId,
        },
        select: {
          id: true,
          name: true,
        },
      });

      const sourceMembers = await tx.workspaceMember.findMany({
        where: { workspaceId: sourceWorkspaceId },
        select: {
          userId: true,
          role: true,
        },
      });

      const memberRows = sourceMembers.length
        ? sourceMembers
        : [
            {
              userId: ownerUserId,
              role: AppRole.ADMIN,
            },
          ];

      await tx.workspaceMember.createMany({
        data: memberRows.map((member) => ({
          workspaceId: copiedWorkspace.id,
          userId: member.userId,
          role: member.role,
        })),
      });

      const sourceProjects = await tx.project.findMany({
        where: { workspaceId: sourceWorkspaceId },
        include: {
          members: true,
          assignments: true,
        },
      });

      for (const sourceProject of sourceProjects) {
        const copiedProject = await tx.project.create({
          data: {
            workspaceId: copiedWorkspace.id,
            code: sourceProject.code,
            name: sourceProject.name,
            description: sourceProject.description,
            status: sourceProject.status,
            priority: sourceProject.priority,
            startDate: sourceProject.startDate,
            endDate: sourceProject.endDate,
            links: sourceProject.links === null ? Prisma.JsonNull : (sourceProject.links as Prisma.InputJsonValue),
            teamTemplateId: sourceProject.teamTemplateId,
          },
          select: { id: true },
        });

        if (sourceProject.members.length > 0) {
          await tx.projectMember.createMany({
            data: sourceProject.members.map((member) => ({
              projectId: copiedProject.id,
              employeeId: member.employeeId,
            })),
          });
        }

        if (sourceProject.assignments.length > 0) {
          await tx.projectAssignment.createMany({
            data: sourceProject.assignments.map((assignment) => ({
              projectId: copiedProject.id,
              employeeId: assignment.employeeId,
              assignmentStartDate: assignment.assignmentStartDate,
              assignmentEndDate: assignment.assignmentEndDate,
              allocationPercent: assignment.allocationPercent,
              plannedHoursPerDay: assignment.plannedHoursPerDay,
              roleOnProject: assignment.roleOnProject,
              loadProfile:
                assignment.loadProfile === null
                  ? Prisma.JsonNull
                  : (assignment.loadProfile as Prisma.InputJsonValue),
            })),
          });
        }
      }

      const sourceVacations = await tx.vacation.findMany({
        where: { workspaceId: sourceWorkspaceId },
        select: {
          employeeId: true,
          startDate: true,
          endDate: true,
          type: true,
          note: true,
        },
      });

      if (sourceVacations.length > 0) {
        await tx.vacation.createMany({
          data: sourceVacations.map((vacation) => ({
            workspaceId: copiedWorkspace.id,
            employeeId: vacation.employeeId,
            startDate: vacation.startDate,
            endDate: vacation.endDate,
            type: vacation.type,
            note: vacation.note,
          })),
        });
      }

      const sourceRates = await tx.costRate.findMany({
        where: { workspaceId: sourceWorkspaceId },
        select: {
          employeeId: true,
          roleId: true,
          amountPerHour: true,
          currency: true,
          validFrom: true,
          validTo: true,
        },
      });

      if (sourceRates.length > 0) {
        await tx.costRate.createMany({
          data: sourceRates.map((rate) => ({
            workspaceId: copiedWorkspace.id,
            employeeId: rate.employeeId,
            roleId: rate.roleId,
            amountPerHour: rate.amountPerHour,
            currency: rate.currency,
            validFrom: rate.validFrom,
            validTo: rate.validTo,
          })),
        });
      }

      return copiedWorkspace;
    });
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

  async deleteProjectSpace(ownerUserId: string, workspaceId: string): Promise<boolean> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        id: true,
        ownerUserId: true,
      },
    });

    if (!workspace || workspace.ownerUserId !== ownerUserId) {
      return false;
    }

    await this.prisma.$transaction(async (tx) => {
      const fallbackWorkspace = await tx.workspace.findFirst({
        where: {
          ownerUserId,
          id: {
            not: workspaceId,
          },
        },
        select: {
          id: true,
        },
        orderBy: [{ createdAt: 'asc' }],
      });

      if (fallbackWorkspace) {
        await tx.employee.updateMany({
          where: {
            workspaceId,
          },
          data: {
            workspaceId: fallbackWorkspace.id,
          },
        });
      }

      await tx.user.updateMany({
        where: {
          activeWorkspaceId: workspaceId,
        },
        data: {
          activeWorkspaceId: fallbackWorkspace?.id ?? null,
        },
      });

      await tx.workspace.delete({
        where: { id: workspaceId },
      });
    });

    return true;
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
