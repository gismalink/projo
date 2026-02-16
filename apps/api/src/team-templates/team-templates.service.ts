import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ErrorCode } from '../common/error-codes';
import { PrismaService } from '../common/prisma.service';
import { CreateTeamTemplateDto } from './dto/create-team-template.dto';
import { UpdateTeamTemplateDto } from './dto/update-team-template.dto';

@Injectable()
export class TeamTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  private async validateRoleIds(roleIds: string[]) {
    const uniqueRoleIds = Array.from(new Set(roleIds));
    const foundCount = await this.prisma.role.count({
      where: {
        id: {
          in: uniqueRoleIds,
        },
      },
    });

    if (foundCount !== uniqueRoleIds.length) {
      throw new BadRequestException('One or more roleIds are invalid');
    }

    return uniqueRoleIds;
  }

  create(dto: CreateTeamTemplateDto) {
    return this.prisma.$transaction(async (tx) => {
      const txClient = tx as any;
      const roleIds = await this.validateRoleIds(dto.roleIds);

      return txClient.projectTeamTemplate.create({
        data: {
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

  findAll() {
    const prismaClient = this.prisma as any;
    return prismaClient.projectTeamTemplate.findMany({
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

  async findOne(id: string) {
    const prismaClient = this.prisma as any;
    const template = await prismaClient.projectTeamTemplate.findUnique({
      where: { id },
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

  async update(id: string, dto: UpdateTeamTemplateDto) {
    await this.findOne(id);

    return this.prisma.$transaction(async (tx) => {
      const txClient = tx as any;
      if (dto.roleIds) {
        const roleIds = await this.validateRoleIds(dto.roleIds);
        await txClient.projectTeamTemplateRole.deleteMany({ where: { templateId: id } });
        await txClient.projectTeamTemplateRole.createMany({
          data: roleIds.map((roleId, index) => ({
            templateId: id,
            roleId,
            position: index,
          })),
        });
      }

      return txClient.projectTeamTemplate.update({
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

  async remove(id: string) {
    await this.findOne(id);
    const prismaClient = this.prisma as any;
    return prismaClient.projectTeamTemplate.delete({ where: { id } });
  }
}
