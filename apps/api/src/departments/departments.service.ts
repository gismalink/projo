import { Injectable, NotFoundException } from '@nestjs/common';
import { ErrorCode } from '../common/error-codes';
import { PrismaService } from '../common/prisma.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

@Injectable()
export class DepartmentsService {
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

  async ensureDefaultDepartments() {
    const defaults = [
      { name: 'Production', description: 'Development and art production', colorHex: '#7A8A9A' },
      { name: 'Design', description: 'UI/UX design', colorHex: '#9B7BFF' },
      { name: 'QA', description: 'Testing and quality assurance', colorHex: '#38A169' },
      { name: 'Analytics', description: 'Business and product analytics', colorHex: '#D69E2E' },
      { name: 'Management', description: 'PM and operational management', colorHex: '#E76F51' },
    ];

    for (const department of defaults) {
      const existing = await this.prisma.department.findFirst({
        where: {
          companyId: null,
          name: department.name,
        },
        select: { id: true },
      });

      if (existing) {
        await this.prisma.department.update({
          where: { id: existing.id },
          data: {
            colorHex: department.colorHex,
          },
        });
        continue;
      }

      await this.prisma.department.create({
        data: {
          ...department,
          companyId: null,
        },
      });
    }
  }

  async create(workspaceId: string, dto: CreateDepartmentDto) {
    const companyId = await this.getWorkspaceCompanyId(workspaceId);
    return this.prisma.department.create({ data: { ...dto, companyId } });
  }

  async findAll(workspaceId: string) {
    const companyId = await this.getWorkspaceCompanyId(workspaceId);
    return this.prisma.department.findMany({
      where: companyId
        ? {
            OR: [{ companyId }, { companyId: null }],
          }
        : { companyId: null },
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { employees: true },
        },
      },
    });
  }

  async findOne(workspaceId: string, id: string) {
    const companyId = await this.getWorkspaceCompanyId(workspaceId);
    const department = await this.prisma.department.findFirst({
      where: {
        id,
        ...(companyId
          ? {
              OR: [{ companyId }, { companyId: null }],
            }
          : { companyId: null }),
      },
    });
    if (!department) {
      throw new NotFoundException(ErrorCode.DEPARTMENT_NOT_FOUND);
    }
    return department;
  }

  async update(workspaceId: string, id: string, dto: UpdateDepartmentDto) {
    const companyId = await this.getWorkspaceCompanyId(workspaceId);
    const department = await this.findOne(workspaceId, id);
    if (companyId && department.companyId !== companyId) {
      throw new NotFoundException(ErrorCode.DEPARTMENT_NOT_FOUND);
    }
    return this.prisma.department.update({ where: { id }, data: dto });
  }

  async remove(workspaceId: string, id: string) {
    const companyId = await this.getWorkspaceCompanyId(workspaceId);
    const department = await this.findOne(workspaceId, id);
    if (companyId && department.companyId !== companyId) {
      throw new NotFoundException(ErrorCode.DEPARTMENT_NOT_FOUND);
    }
    return this.prisma.department.delete({ where: { id } });
  }
}
