import { Injectable, NotFoundException } from '@nestjs/common';
import { DEFAULT_ROLE_COLOR_HEX } from '../common/app-constants';
import { ErrorCode } from '../common/error-codes';
import { PrismaService } from '../common/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

const DEFAULT_ROLES = [
  { name: 'ADMIN', shortName: 'ADMIN', description: 'System administrator', level: 1, colorHex: DEFAULT_ROLE_COLOR_HEX },
  { name: 'PM', shortName: 'PM', description: 'Project manager', level: 2, colorHex: DEFAULT_ROLE_COLOR_HEX },
  { name: 'VIEWER', shortName: 'VIEW', description: 'Read-only user', level: 3, colorHex: DEFAULT_ROLE_COLOR_HEX },
  { name: 'FINANCE', shortName: 'FIN', description: 'Finance visibility role', level: 3, colorHex: DEFAULT_ROLE_COLOR_HEX },
  { name: 'UNITY_DEVELOPER', shortName: 'UNITY', description: 'Unity developer', level: 3, colorHex: '#9B8AFB' },
  { name: 'UI_DESIGNER', shortName: 'UI', description: 'UI designer', level: 3, colorHex: '#46B7D6' },
  { name: 'UX_DESIGNER', shortName: 'UX', description: 'UX designer', level: 3, colorHex: '#31B28D' },
  { name: 'BACKEND_DEVELOPER', shortName: 'BACK', description: 'Backend developer', level: 3, colorHex: '#5B8DEF' },
  { name: 'FRONTEND_DEVELOPER', shortName: 'FRONT', description: 'Frontend developer', level: 3, colorHex: '#4C9F70' },
  { name: '3D_ARTIST', shortName: '3DART', description: '3D artist', level: 3, colorHex: '#C178E8' },
  { name: 'ANALYST', shortName: 'ANLST', description: 'Business/system analyst', level: 3, colorHex: '#E6A23C' },
  { name: 'QA_ENGINEER', shortName: 'QA', description: 'QA test engineer', level: 3, colorHex: '#F06A8A' },
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

    return { created };
  }

  async create(workspaceId: string, dto: CreateRoleDto) {
    const companyId = await this.getWorkspaceCompanyId(workspaceId);
    return this.prisma.role.create({ data: { ...dto, companyId } });
  }

  async findAll(workspaceId: string) {
    const companyId = await this.getWorkspaceCompanyId(workspaceId);
    return this.prisma.role.findMany({
      where: companyId
        ? {
            OR: [{ companyId }, { companyId: null }],
          }
        : { companyId: null },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { employees: true },
        },
      },
    });
  }

  async findOne(workspaceId: string, id: string) {
    const companyId = await this.getWorkspaceCompanyId(workspaceId);
    const role = await this.prisma.role.findFirst({
      where: {
        id,
        ...(companyId
          ? {
              OR: [{ companyId }, { companyId: null }],
            }
          : { companyId: null }),
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
    if (companyId && role.companyId !== companyId) {
      throw new NotFoundException(ErrorCode.ROLE_NOT_FOUND);
    }
    return this.prisma.role.update({ where: { id }, data: dto });
  }

  async remove(workspaceId: string, id: string) {
    const companyId = await this.getWorkspaceCompanyId(workspaceId);
    const role = await this.findOne(workspaceId, id);
    if (companyId && role.companyId !== companyId) {
      throw new NotFoundException(ErrorCode.ROLE_NOT_FOUND);
    }
    return this.prisma.role.delete({ where: { id } });
  }
}
