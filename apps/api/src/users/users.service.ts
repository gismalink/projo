import { Injectable } from '@nestjs/common';
import { AppRole, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createAssignmentLoadPercentResolver, startOfUtcDay } from '../common/load-profile.utils';
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

type WorkspaceProjectStatsItem = {
  workspaceId: string;
  projectsCount: number;
  totalAllocationPercent: number;
  peakAllocationPercent: number;
  monthlyLoadStats: Array<{
    month: number;
    avgAllocationPercent: number;
    peakAllocationPercent: number;
  }>;
};

type AdminUserOverviewItem = {
  userId: string;
  email: string;
  fullName: string;
  projectsCount: number;
  ownedProjectsCount: number;
};

type AdminCompanyOverview = {
  companyId: string;
  companyName: string;
  totalUsers: number;
  totalProjects: number;
  users: AdminUserOverviewItem[];
  topUsers: AdminUserOverviewItem[];
  companies: Array<{
    companyId: string;
    companyName: string;
    totalUsers: number;
    totalProjects: number;
  }>;
};

const COMPANY_HOME_WORKSPACE_PREFIX = '__company_home__:';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  private companyHomeWorkspaceName(companyId: string) {
    return `${COMPANY_HOME_WORKSPACE_PREFIX}${companyId}`;
  }

  private isCompanyHomeWorkspaceName(name: string) {
    return name.startsWith(COMPANY_HOME_WORKSPACE_PREFIX);
  }

  private async ensureCompanyHomeWorkspace(
    tx: Prisma.TransactionClient,
    ownerUserId: string,
    companyId: string,
    role: AppRole,
  ): Promise<{ id: string }> {
    const homeName = this.companyHomeWorkspaceName(companyId);

    const existing = await tx.workspace.findFirst({
      where: {
        ownerUserId,
        companyId,
        name: homeName,
      },
      select: { id: true },
    });

    if (existing) {
      await tx.workspaceMember.upsert({
        where: {
          workspaceId_userId: {
            workspaceId: existing.id,
            userId: ownerUserId,
          },
        },
        update: {},
        create: {
          workspaceId: existing.id,
          userId: ownerUserId,
          role,
        },
      });

      return existing;
    }

    const created = await tx.workspace.create({
      data: {
        ownerUserId,
        companyId,
        name: homeName,
      },
      select: { id: true },
    });

    await tx.workspaceMember.create({
      data: {
        workspaceId: created.id,
        userId: ownerUserId,
        role,
      },
    });

    return created;
  }

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
      const workspace = await this.prisma.$transaction(async (tx) => {
        const home = await this.ensureCompanyHomeWorkspace(tx, userWithMemberships.id, companyId, userWithMemberships.appRole);
        await tx.user.update({
          where: { id: userWithMemberships.id },
          data: { activeWorkspaceId: home.id },
        });
        return home;
      });

      const membership = await this.prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId: workspace.id,
            userId: userWithMemberships.id,
          },
        },
        select: { role: true },
      });

      return {
        workspaceId: workspace.id,
        workspaceRole: membership?.role ?? userWithMemberships.appRole,
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
      if (this.isCompanyHomeWorkspaceName(membership.workspace.name)) {
        continue;
      }
      unique.set(membership.workspace.id, {
        workspaceId: membership.workspace.id,
        workspaceName: membership.workspace.name,
        ownerUserId: membership.workspace.ownerUserId,
        role: membership.role,
      });
    }

    return Array.from(unique.values());
  }

  async listWorkspaceProjectStats(workspaceIds: string[]): Promise<WorkspaceProjectStatsItem[]> {
    if (workspaceIds.length === 0) return [];

    const currentYear = new Date().getUTCFullYear();
    const yearStart = new Date(Date.UTC(currentYear, 0, 1));
    const yearEnd = new Date(Date.UTC(currentYear, 11, 31));
    const totalDaysInYear = Math.floor((yearEnd.getTime() - yearStart.getTime()) / 86_400_000) + 1;

    const calendarDays = await this.prisma.calendarDay.findMany({
      where: {
        date: {
          gte: yearStart,
          lte: yearEnd,
        },
      },
      select: {
        date: true,
        isWorkingDay: true,
      },
    });
    const calendarWorkingDayByDateIso = new Map(
      calendarDays.map((item) => [item.date.toISOString().slice(0, 10), item.isWorkingDay]),
    );

    const isLoadBearingDay = (date: Date) => {
      const isoDate = date.toISOString().slice(0, 10);
      const byCalendar = calendarWorkingDayByDateIso.get(isoDate);
      if (typeof byCalendar === 'boolean') return byCalendar;
      const weekDay = date.getUTCDay();
      return weekDay !== 0 && weekDay !== 6;
    };

    const loadBearingDayByIndex = Array.from({ length: totalDaysInYear }, (_, dayIndex) => {
      const currentDate = new Date(yearStart);
      currentDate.setUTCDate(currentDate.getUTCDate() + dayIndex);
      return isLoadBearingDay(currentDate);
    });

    const uniqueWorkspaceIds = Array.from(new Set(workspaceIds));
    const projects = await this.prisma.project.findMany({
      where: {
        workspaceId: {
          in: uniqueWorkspaceIds,
        },
      },
      select: {
        workspaceId: true,
        assignments: {
          select: {
            employeeId: true,
            allocationPercent: true,
            loadProfile: true,
            assignmentStartDate: true,
            assignmentEndDate: true,
          },
        },
      },
    });

    const employeeCounts = await this.prisma.employee.groupBy({
      by: ['workspaceId'],
      where: {
        workspaceId: {
          in: uniqueWorkspaceIds,
        },
      },
      _count: {
        _all: true,
      },
    });
    const employeeCountByWorkspaceId = new Map(employeeCounts.map((item) => [item.workspaceId, item._count._all]));

    const statsByWorkspaceId = new Map<string, WorkspaceProjectStatsItem>();
    const rawDailyLoadByWorkspaceId = new Map<string, number[]>();
    for (const workspaceId of uniqueWorkspaceIds) {
      statsByWorkspaceId.set(workspaceId, {
        workspaceId,
        projectsCount: 0,
        totalAllocationPercent: 0,
        peakAllocationPercent: 0,
        monthlyLoadStats: Array.from({ length: 12 }, (_, index) => ({
          month: index + 1,
          avgAllocationPercent: 0,
          peakAllocationPercent: 0,
        })),
      });
      rawDailyLoadByWorkspaceId.set(workspaceId, Array.from({ length: totalDaysInYear }, () => 0));
    }

    for (const project of projects) {
      const bucket = statsByWorkspaceId.get(project.workspaceId);
      const rawDailyLoad = rawDailyLoadByWorkspaceId.get(project.workspaceId);
      if (!bucket) continue;
      if (!rawDailyLoad) continue;

      bucket.projectsCount += 1;

      for (const assignment of project.assignments) {
        const assignmentStart = startOfUtcDay(assignment.assignmentStartDate);
        const assignmentEnd = startOfUtcDay(assignment.assignmentEndDate);
        const effectiveStart = assignmentStart > yearStart ? assignmentStart : yearStart;
        const effectiveEnd = assignmentEnd < yearEnd ? assignmentEnd : yearEnd;
        if (effectiveEnd < effectiveStart) continue;

        const resolveLoadPercent = createAssignmentLoadPercentResolver(assignment);
        const startIndex = Math.max(0, Math.floor((effectiveStart.getTime() - yearStart.getTime()) / 86_400_000));
        const endIndex = Math.min(totalDaysInYear - 1, Math.floor((effectiveEnd.getTime() - yearStart.getTime()) / 86_400_000));

        for (let dayIndex = startIndex; dayIndex <= endIndex; dayIndex += 1) {
          if (!loadBearingDayByIndex[dayIndex]) continue;

          const currentDate = new Date(yearStart);
          currentDate.setUTCDate(currentDate.getUTCDate() + dayIndex);
          const loadPercent = resolveLoadPercent(currentDate);
          if (!Number.isFinite(loadPercent) || loadPercent <= 0) continue;
          rawDailyLoad[dayIndex] += loadPercent;
        }
      }
    }

    return Array.from(statsByWorkspaceId.values()).map((item) => ({
      ...item,
      ...(() => {
        const rawDailyLoad = rawDailyLoadByWorkspaceId.get(item.workspaceId) ?? [];
        const employeeCapacity = Math.max(1, employeeCountByWorkspaceId.get(item.workspaceId) ?? 0);
        const dailyUtilization = rawDailyLoad.map((value) => value / employeeCapacity);
        const yearlyValues = dailyUtilization.filter((_, dayIndex) => loadBearingDayByIndex[dayIndex]);
        const yearlyAvg = yearlyValues.length > 0 ? yearlyValues.reduce((sum, value) => sum + value, 0) / yearlyValues.length : 0;
        const yearlyPeak = yearlyValues.length > 0 ? Math.max(...yearlyValues) : 0;

        const monthlyLoadStats = Array.from({ length: 12 }, (_, monthIndex) => {
          const monthStart = new Date(Date.UTC(currentYear, monthIndex, 1));
          const nextMonthStart = new Date(Date.UTC(currentYear, monthIndex + 1, 1));
          const startIndex = Math.max(0, Math.floor((monthStart.getTime() - yearStart.getTime()) / 86_400_000));
          const endIndex = Math.max(
            startIndex,
            Math.min(totalDaysInYear, Math.floor((nextMonthStart.getTime() - yearStart.getTime()) / 86_400_000)),
          );
          const monthValues: number[] = [];
          for (let dayIndex = startIndex; dayIndex < endIndex; dayIndex += 1) {
            if (!loadBearingDayByIndex[dayIndex]) continue;
            monthValues.push(dailyUtilization[dayIndex] ?? 0);
          }
          const monthAvg = monthValues.length > 0 ? monthValues.reduce((sum, value) => sum + value, 0) / monthValues.length : 0;
          const monthPeak = monthValues.length > 0 ? Math.max(...monthValues) : 0;

          return {
            month: monthIndex + 1,
            avgAllocationPercent: Number(monthAvg.toFixed(1)),
            peakAllocationPercent: Number(monthPeak.toFixed(1)),
          };
        });

        return {
          totalAllocationPercent: Number(yearlyAvg.toFixed(1)),
          peakAllocationPercent: Number(yearlyPeak.toFixed(1)),
          monthlyLoadStats,
        };
      })(),
    }));
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

    const ownedCompanyIds = await this.prisma.company.findMany({
      where: { ownerUserId: userId },
      select: { id: true },
    });
    for (const item of ownedCompanyIds) {
      companyIds.add(item.id);
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

  async getAdminCompanyOverview(activeWorkspaceId: string): Promise<AdminCompanyOverview> {
    const activeCompanyId = await this.ensureWorkspaceCompanyId(activeWorkspaceId);

    const activeCompany = await this.prisma.company.findUnique({
      where: { id: activeCompanyId },
      select: { id: true, name: true },
    });

    const workspaces = await this.prisma.workspace.findMany({
      where: {
        NOT: {
          name: {
            startsWith: COMPANY_HOME_WORKSPACE_PREFIX,
          },
        },
      },
      select: {
        id: true,
        ownerUserId: true,
        companyId: true,
      },
    });

    const workspaceIds = workspaces.map((workspace) => workspace.id);
    const ownerByWorkspaceId = new Map(workspaces.map((workspace) => [workspace.id, workspace.ownerUserId] as const));
    const companyIdByWorkspaceId = new Map(workspaces.map((workspace) => [workspace.id, workspace.companyId] as const));

    const memberships = workspaceIds.length
      ? await this.prisma.workspaceMember.findMany({
          where: {
            workspaceId: {
              in: workspaceIds,
            },
          },
          select: {
            workspaceId: true,
            userId: true,
          },
        })
      : [];

    const allUsers = await this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        fullName: true,
      },
      orderBy: [{ createdAt: 'asc' }],
    });

    const companies = await this.prisma.company.findMany({
      select: {
        id: true,
        name: true,
      },
      orderBy: [{ createdAt: 'asc' }],
    });

    const projectsByUserId = new Map<string, Set<string>>();
    const ownedProjectsByUserId = new Map<string, number>();
    const companyUsersById = new Map<string, Set<string>>();
    const companyProjectsCountById = new Map<string, number>();

    for (const workspace of workspaces) {
      if (!workspace.companyId) {
        continue;
      }

      companyProjectsCountById.set(workspace.companyId, (companyProjectsCountById.get(workspace.companyId) ?? 0) + 1);
      if (!companyUsersById.has(workspace.companyId)) {
        companyUsersById.set(workspace.companyId, new Set<string>());
      }
    }

    for (const membership of memberships) {
      if (!projectsByUserId.has(membership.userId)) {
        projectsByUserId.set(membership.userId, new Set<string>());
      }
      projectsByUserId.get(membership.userId)?.add(membership.workspaceId);

      if (ownerByWorkspaceId.get(membership.workspaceId) === membership.userId) {
        ownedProjectsByUserId.set(membership.userId, (ownedProjectsByUserId.get(membership.userId) ?? 0) + 1);
      }

      const targetCompanyId = companyIdByWorkspaceId.get(membership.workspaceId);
      if (!targetCompanyId) {
        continue;
      }

      if (!companyUsersById.has(targetCompanyId)) {
        companyUsersById.set(targetCompanyId, new Set<string>());
      }
      companyUsersById.get(targetCompanyId)?.add(membership.userId);
    }

    const users = allUsers
      .map((user) => ({
        userId: user.id,
        email: user.email,
        fullName: user.fullName,
        projectsCount: projectsByUserId.get(user.id)?.size ?? 0,
        ownedProjectsCount: ownedProjectsByUserId.get(user.id) ?? 0,
      }))
      .sort((left, right) => {
        if (right.projectsCount !== left.projectsCount) {
          return right.projectsCount - left.projectsCount;
        }
        return left.email.localeCompare(right.email);
      });

    const topUsers = users.slice(0, 10);

    const companySummaries = companies
      .map((item) => ({
        companyId: item.id,
        companyName: item.name,
        totalUsers: companyUsersById.get(item.id)?.size ?? 0,
        totalProjects: companyProjectsCountById.get(item.id) ?? 0,
      }))
      .sort((left, right) => {
        if (right.totalProjects !== left.totalProjects) {
          return right.totalProjects - left.totalProjects;
        }
        return left.companyName.localeCompare(right.companyName);
      });

    return {
      companyId: activeCompanyId,
      companyName: activeCompany?.name ?? 'Portal',
      totalUsers: users.length,
      totalProjects: workspaceIds.length,
      users,
      topUsers,
      companies: companySummaries,
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

      const workspace = await this.ensureCompanyHomeWorkspace(tx, ownerUserId, company.id, AppRole.ADMIN);

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
      const workspace = await this.ensureCompanyHomeWorkspace(tx, userId, company.id, AppRole.ADMIN);

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
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        activeWorkspaceId: true,
        fullName: true,
      },
    });

    const companyId = user?.activeWorkspaceId
      ? await this.ensureWorkspaceCompanyId(user.activeWorkspaceId)
      : await this.ensureOwnerCompanyId(userId, user?.fullName);
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
        companyId: true,
      },
    });

    if (!workspace || workspace.ownerUserId !== ownerUserId) {
      return false;
    }

    await this.prisma.$transaction(async (tx) => {
      const companyId = workspace.companyId ?? (await this.ensureOwnerCompanyId(ownerUserId));

      const fallbackWorkspace =
        (await tx.workspace.findFirst({
          where: {
            ownerUserId,
            companyId,
            name: this.companyHomeWorkspaceName(companyId),
            id: { not: workspaceId },
          },
          select: { id: true },
        })) ??
        (await tx.workspace.findFirst({
          where: {
            ownerUserId,
            companyId,
            id: { not: workspaceId },
          },
          select: { id: true },
          orderBy: [{ createdAt: 'asc' }],
        })) ??
        (await this.ensureCompanyHomeWorkspace(tx, ownerUserId, companyId, AppRole.ADMIN));

      await tx.employee.updateMany({
        where: {
          workspaceId,
        },
        data: {
          workspaceId: fallbackWorkspace.id,
        },
      });

      await tx.user.updateMany({
        where: {
          activeWorkspaceId: workspaceId,
        },
        data: {
          activeWorkspaceId: fallbackWorkspace.id,
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
