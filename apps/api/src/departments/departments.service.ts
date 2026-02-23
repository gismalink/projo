import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ErrorCode } from '../common/error-codes';
import { PrismaService } from '../common/prisma.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

const DEFAULT_DEPARTMENTS = [
  { name: 'Production', description: 'Development and art production', colorHex: '#7A8A9A' },
  { name: 'Design', description: 'UI/UX design', colorHex: '#9B7BFF' },
  { name: 'QA', description: 'Testing and quality assurance', colorHex: '#38A169' },
  { name: 'Analytics', description: 'Business and product analytics', colorHex: '#D69E2E' },
  { name: 'Management', description: 'PM and operational management', colorHex: '#E76F51' },
];

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
    for (const department of DEFAULT_DEPARTMENTS) {
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

  async createDefaultDepartmentsForWorkspace(workspaceId: string) {
    const companyId = await this.getWorkspaceCompanyId(workspaceId);
    let created = 0;

    for (const department of DEFAULT_DEPARTMENTS) {
      const existing = await this.prisma.department.findFirst({
        where: {
          companyId,
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
          companyId,
        },
      });
      created += 1;
    }

    // Migrate employees in this workspace off global (companyId=null) departments.
    if (companyId) {
      const [companyDepartments, globalDepartmentsUsed] = await Promise.all([
        this.prisma.department.findMany({
          where: { companyId },
          select: { id: true, name: true },
        }),
        this.prisma.employee.findMany({
          where: {
            workspaceId,
            department: { companyId: null },
          },
          select: {
            departmentId: true,
            department: { select: { name: true } },
          },
        }),
      ]);

      const companyDepartmentIdByName = new Map(companyDepartments.map((dept) => [dept.name, dept.id] as const));
      const seenGlobalDepartmentIds = new Set<string>();

      for (const item of globalDepartmentsUsed) {
        const globalDepartmentId = item.departmentId;
        if (!globalDepartmentId || !item.department) continue;
        if (seenGlobalDepartmentIds.has(globalDepartmentId)) continue;
        seenGlobalDepartmentIds.add(globalDepartmentId);

        const nextDepartmentId = companyDepartmentIdByName.get(item.department.name);
        if (!nextDepartmentId) continue;

        await this.prisma.employee.updateMany({
          where: { workspaceId, departmentId: globalDepartmentId },
          data: { departmentId: nextDepartmentId },
        });
      }
    }

    return { created };
  }

  async create(workspaceId: string, dto: CreateDepartmentDto) {
    const companyId = await this.getWorkspaceCompanyId(workspaceId);
    return this.prisma.department.create({ data: { ...dto, companyId } });
  }

  async findAll(workspaceId: string) {
    const companyId = await this.getWorkspaceCompanyId(workspaceId);
    return this.prisma.department.findMany({
      where: companyId ? { companyId } : { companyId: null },
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
        ...(companyId ? { companyId } : { companyId: null }),
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

    const isGlobalDepartment = department.companyId === null;
    const employeeRefs = await this.prisma.employee.count({
      where: isGlobalDepartment
        ? { departmentId: id }
        : {
            departmentId: id,
            workspace: companyId ? { companyId } : { companyId: null },
          },
    });

    if (employeeRefs > 0) {
      throw new ConflictException(ErrorCode.DEPARTMENT_IN_USE);
    }

    return this.prisma.department.delete({ where: { id } });
  }
}
