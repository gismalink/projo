import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DEFAULT_ROLE_COLOR_HEX } from '../common/app-constants';
import { ErrorCode } from '../common/error-codes';
import { PrismaService } from '../common/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

const DEFAULT_ROLES = [
  { name: 'PM', shortName: 'PM', description: 'Project manager', colorHex: DEFAULT_ROLE_COLOR_HEX },
  { name: 'UNITY_DEVELOPER', shortName: 'UNITY', description: 'Unity developer', colorHex: '#9B8AFB' },
  { name: 'UI_DESIGNER', shortName: 'UI', description: 'UI designer', colorHex: '#46B7D6' },
  { name: 'UX_DESIGNER', shortName: 'UX', description: 'UX designer', colorHex: '#31B28D' },
  { name: 'BACKEND_DEVELOPER', shortName: 'BACK', description: 'Backend developer', colorHex: '#5B8DEF' },
  { name: 'FRONTEND_DEVELOPER', shortName: 'FRONT', description: 'Frontend developer', colorHex: '#4C9F70' },
  { name: '3D_ARTIST', shortName: '3DART', description: '3D artist', colorHex: '#C178E8' },
  { name: 'ANALYST', shortName: 'ANLST', description: 'Business/system analyst', colorHex: '#E6A23C' },
  { name: 'QA_ENGINEER', shortName: 'QA', description: 'QA test engineer', colorHex: '#F06A8A' },
];

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  private async getWorkspaceCompanyId(workspaceId: string): Promise<string | null> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { companyId: true },
    });

    if (!workspace) {
      throw new NotFoundException(ErrorCode.PROJECT_NOT_FOUND);
    }

    return workspace.companyId;
  }

  async ensureDefaultRoles() {
    for (const role of DEFAULT_ROLES) {
      const existing = await this.prisma.role.findFirst({
        where: {
          companyId: null,
          name: role.name,
        },
        select: { id: true },
      });

      if (existing) {
        await this.prisma.role.update({
          where: { id: existing.id },
          data: {
            colorHex: role.colorHex,
            shortName: role.shortName,
          },
        });
        continue;
      }

      await this.prisma.role.create({
        data: {
          ...role,
          companyId: null,
        },
      });
    }
  }

  async createDefaultRolesForWorkspace(workspaceId: string) {
    const companyId = await this.getWorkspaceCompanyId(workspaceId);
    let created = 0;

    for (const role of DEFAULT_ROLES) {
      const existing = await this.prisma.role.findFirst({
        where: {
          companyId,
          name: role.name,
        },
        select: { id: true },
      });

      if (existing) {
        await this.prisma.role.update({
          where: { id: existing.id },
          data: {
            colorHex: role.colorHex,
            shortName: role.shortName,
          },
        });
        continue;
      }

      await this.prisma.role.create({
        data: {
          ...role,
          companyId,
        },
      });
      created += 1;
    }

    // If this workspace previously used global (companyId=null) roles, migrate employees
    // to the company-scoped equivalents by role name so companies are fully isolated.
    if (companyId) {
      const [companyRoles, globalRolesUsed] = await Promise.all([
        this.prisma.role.findMany({
          where: { companyId },
          select: { id: true, name: true },
        }),
        this.prisma.employee.findMany({
          where: {
            workspaceId,
            role: { companyId: null },
          },
          select: {
            roleId: true,
            role: { select: { name: true } },
          },
        }),
      ]);

      const companyRoleIdByName = new Map(companyRoles.map((role) => [role.name, role.id] as const));

      const seenGlobalRoleIds = new Set<string>();
      for (const item of globalRolesUsed) {
        if (seenGlobalRoleIds.has(item.roleId)) continue;
        seenGlobalRoleIds.add(item.roleId);

        const nextRoleId = companyRoleIdByName.get(item.role.name);
        if (!nextRoleId) continue;

        await this.prisma.employee.updateMany({
          where: { workspaceId, roleId: item.roleId },
          data: { roleId: nextRoleId },
        });
      }
    }

    return { created };
  }

  async create(workspaceId: string, dto: CreateRoleDto) {
    const companyId = await this.getWorkspaceCompanyId(workspaceId);
    return this.prisma.role.create({ data: { ...dto, companyId } });
  }

  async findAll(workspaceId: string) {
    const companyId = await this.getWorkspaceCompanyId(workspaceId);
    const roles = await this.prisma.role.findMany({
      where: companyId ? { companyId } : { companyId: null },
      orderBy: { createdAt: 'desc' },
    });

    const roleIds = roles.map((role) => role.id);
    if (roleIds.length === 0) {
      return roles.map((role) => ({
        ...role,
        _count: { employees: 0, templateRoles: 0, costRates: 0 },
      }));
    }

    const [employeesCounts, templateRoleCounts, costRateCounts] = await Promise.all([
      this.prisma.employee.groupBy({
        by: ['roleId'],
        where: {
          roleId: { in: roleIds },
          workspace: companyId ? { companyId } : { companyId: null },
        },
        _count: { _all: true },
      }),
      this.prisma.projectTeamTemplateRole.groupBy({
        by: ['roleId'],
        where: {
          roleId: { in: roleIds },
          template: companyId ? { companyId } : { companyId: null },
        },
        _count: { _all: true },
      }),
      this.prisma.costRate.groupBy({
        by: ['roleId'],
        where: {
          roleId: { in: roleIds },
          workspace: companyId ? { companyId } : { companyId: null },
        },
        _count: { _all: true },
      }),
    ]);

    const employeesCountByRoleId = new Map<string, number>();
    for (const item of employeesCounts) {
      employeesCountByRoleId.set(item.roleId, item._count._all);
    }
    const templateRolesCountByRoleId = new Map<string, number>();
    for (const item of templateRoleCounts) {
      templateRolesCountByRoleId.set(item.roleId, item._count._all);
    }
    const costRatesCountByRoleId = new Map<string, number>();
    for (const item of costRateCounts) {
      if (!item.roleId) continue;
      costRatesCountByRoleId.set(item.roleId, item._count._all);
    }

    return roles.map((role) => ({
      ...role,
      _count: {
        employees: employeesCountByRoleId.get(role.id) ?? 0,
        templateRoles: templateRolesCountByRoleId.get(role.id) ?? 0,
        costRates: costRatesCountByRoleId.get(role.id) ?? 0,
      },
    }));
  }

  async findOne(workspaceId: string, id: string) {
    const companyId = await this.getWorkspaceCompanyId(workspaceId);
    const role = await this.prisma.role.findFirst({
      where: {
        id,
        ...(companyId ? { companyId } : { companyId: null }),
      },
    });
    if (!role) {
      throw new NotFoundException(ErrorCode.ROLE_NOT_FOUND);
    }
    return role;
  }

  async update(workspaceId: string, id: string, dto: UpdateRoleDto) {
    const companyId = await this.getWorkspaceCompanyId(workspaceId);
    const role = await this.findOne(workspaceId, id);
    if (companyId && role.companyId && role.companyId !== companyId) {
      throw new NotFoundException(ErrorCode.ROLE_NOT_FOUND);
    }
    return this.prisma.role.update({ where: { id }, data: dto });
  }

  async remove(workspaceId: string, id: string) {
    const companyId = await this.getWorkspaceCompanyId(workspaceId);
    const role = await this.findOne(workspaceId, id);
    if (companyId && role.companyId && role.companyId !== companyId) {
      throw new NotFoundException(ErrorCode.ROLE_NOT_FOUND);
    }

    const isGlobalRole = role.companyId === null;

    const [employeeRefs, templateRefs, costRateRefs] = await Promise.all([
      this.prisma.employee.count({
        where: isGlobalRole
          ? {
              roleId: id,
            }
          : companyId
            ? {
                roleId: id,
                workspace: { companyId },
              }
            : {
                roleId: id,
              },
      }),
      this.prisma.projectTeamTemplateRole.count({
        where: {
          roleId: id,
          template: isGlobalRole
            ? undefined
            : companyId
              ? {
                  companyId,
                }
              : undefined,
        },
      }),
      this.prisma.costRate.count({
        where: isGlobalRole
          ? {
              roleId: id,
            }
          : companyId
            ? {
                roleId: id,
                workspace: { companyId },
              }
            : {
                roleId: id,
              },
      }),
    ]);

    if (employeeRefs > 0 || templateRefs > 0 || costRateRefs > 0) {
      throw new ConflictException(ErrorCode.ROLE_IN_USE);
    }

    return this.prisma.role.delete({ where: { id } });
  }
}
