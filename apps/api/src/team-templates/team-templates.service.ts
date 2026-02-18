import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ErrorCode } from '../common/error-codes';
import { PrismaService } from '../common/prisma.service';
import { CreateTeamTemplateDto } from './dto/create-team-template.dto';
import { UpdateTeamTemplateDto } from './dto/update-team-template.dto';

const DEFAULT_TEAM_TEMPLATES = [
  {
    name: 'Core Team',
    roleNames: ['PM', 'BACKEND_DEVELOPER', 'FRONTEND_DEVELOPER', 'QA_ENGINEER'],
  },
  {
    name: 'Game Team',
    roleNames: ['PM', 'UNITY_DEVELOPER', '3D_ARTIST', 'UI_DESIGNER', 'QA_ENGINEER'],
  },
  {
    name: 'Discovery Team',
    roleNames: ['PM', 'UX_DESIGNER', 'UI_DESIGNER', 'ANALYST'],
  },
];

@Injectable()
export class TeamTemplatesService {
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

  private async validateRoleIds(workspaceId: string, roleIds: string[]) {
    const companyId = await this.getWorkspaceCompanyId(workspaceId);
    const uniqueRoleIds = Array.from(new Set(roleIds));
    const foundCount = await this.prisma.role.count({
      where: {
        id: {
          in: uniqueRoleIds,
        },
        ...(companyId
          ? {
              OR: [{ companyId }, { companyId: null }],
            }
          : { companyId: null }),
      },
    });

    if (foundCount !== uniqueRoleIds.length) {
      throw new BadRequestException('One or more roleIds are invalid');
    }

    return uniqueRoleIds;
  }

  async create(workspaceId: string, dto: CreateTeamTemplateDto) {
    const companyId = await this.getWorkspaceCompanyId(workspaceId);
    return this.prisma.$transaction(async (tx) => {
      const roleIds = await this.validateRoleIds(workspaceId, dto.roleIds);

      return tx.projectTeamTemplate.create({
        data: {
          companyId,
          name: dto.name.trim(),
          roles: {
            create: roleIds.map((roleId, index) => ({
              roleId,
              position: index,
            })),
          },
        },
        include: {
          roles: {
            orderBy: { position: 'asc' },
            include: {
              role: true,
            },
          },
        },
      });
    });
  }

  async createDefaultTemplatesForWorkspace(workspaceId: string) {
    const companyId = await this.getWorkspaceCompanyId(workspaceId);
    const availableRoles = await this.prisma.role.findMany({
      where: companyId
        ? {
            OR: [{ companyId }, { companyId: null }],
          }
        : { companyId: null },
      select: {
        id: true,
        name: true,
        companyId: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const preferredRoleByName = new Map<string, string>();
    for (const role of availableRoles) {
      const currentRoleId = preferredRoleByName.get(role.name);
      if (!currentRoleId) {
        preferredRoleByName.set(role.name, role.id);
        continue;
      }

      if (companyId && role.companyId === companyId) {
        preferredRoleByName.set(role.name, role.id);
      }
    }

    let created = 0;
    for (const template of DEFAULT_TEAM_TEMPLATES) {
      const roleIds = template.roleNames
        .map((roleName) => preferredRoleByName.get(roleName))
        .filter((roleId): roleId is string => Boolean(roleId));

      if (roleIds.length === 0) {
        continue;
      }

      const existing = await this.prisma.projectTeamTemplate.findFirst({
        where: {
          companyId,
          name: template.name,
        },
        select: { id: true },
      });

      if (existing) {
        await this.prisma.$transaction(async (tx) => {
          await tx.projectTeamTemplateRole.deleteMany({ where: { templateId: existing.id } });
          await tx.projectTeamTemplateRole.createMany({
            data: roleIds.map((roleId, index) => ({
              templateId: existing.id,
              roleId,
              position: index,
            })),
          });
        });
        continue;
      }

      await this.prisma.projectTeamTemplate.create({
        data: {
          companyId,
          name: template.name,
          roles: {
            create: roleIds.map((roleId, index) => ({
              roleId,
              position: index,
            })),
          },
        },
      });
      created += 1;
    }

    return { created };
  }

  async findAll(workspaceId: string) {
    const companyId = await this.getWorkspaceCompanyId(workspaceId);
    return this.prisma.projectTeamTemplate.findMany({
      where: companyId
        ? {
            OR: [{ companyId }, { companyId: null }],
          }
        : { companyId: null },
      orderBy: { name: 'asc' },
      include: {
        roles: {
          orderBy: { position: 'asc' },
          include: {
            role: true,
          },
        },
      },
    });
  }

  async findOne(workspaceId: string, id: string) {
    const companyId = await this.getWorkspaceCompanyId(workspaceId);
    const template = await this.prisma.projectTeamTemplate.findFirst({
      where: {
        id,
        ...(companyId
          ? {
              OR: [{ companyId }, { companyId: null }],
            }
          : { companyId: null }),
      },
      include: {
        roles: {
          orderBy: { position: 'asc' },
          include: {
            role: true,
          },
        },
      },
    });

    if (!template) {
      throw new NotFoundException(ErrorCode.PROJECT_TEAM_TEMPLATE_NOT_FOUND);
    }

    return template;
  }

  async update(workspaceId: string, id: string, dto: UpdateTeamTemplateDto) {
    const companyId = await this.getWorkspaceCompanyId(workspaceId);
    const template = await this.findOne(workspaceId, id);
    if (companyId && template.companyId !== companyId) {
      throw new NotFoundException(ErrorCode.PROJECT_TEAM_TEMPLATE_NOT_FOUND);
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.roleIds) {
        const roleIds = await this.validateRoleIds(workspaceId, dto.roleIds);
        await tx.projectTeamTemplateRole.deleteMany({ where: { templateId: id } });
        await tx.projectTeamTemplateRole.createMany({
          data: roleIds.map((roleId, index) => ({
            templateId: id,
            roleId,
            position: index,
          })),
        });
      }

      return tx.projectTeamTemplate.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        },
        include: {
          roles: {
            orderBy: { position: 'asc' },
            include: {
              role: true,
            },
          },
        },
      });
    });
  }

  async remove(workspaceId: string, id: string) {
    const companyId = await this.getWorkspaceCompanyId(workspaceId);
    const template = await this.findOne(workspaceId, id);
    if (companyId && template.companyId !== companyId) {
      throw new NotFoundException(ErrorCode.PROJECT_TEAM_TEMPLATE_NOT_FOUND);
    }
    return this.prisma.projectTeamTemplate.delete({ where: { id } });
  }
}
