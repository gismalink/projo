import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ErrorCode } from '../common/error-codes';
import { PrismaService } from '../common/prisma.service';
import { CreateGradeDto } from './dto/create-grade.dto';
import { UpdateGradeDto } from './dto/update-grade.dto';

const DEFAULT_GRADES = [
  { name: 'джу', colorHex: '#64B5F6' },
  { name: 'джун+', colorHex: '#42A5F5' },
  { name: 'мидл', colorHex: '#4DB6AC' },
  { name: 'мидл+', colorHex: '#26A69A' },
  { name: 'синьйор', colorHex: '#FFB74D' },
  { name: 'синьйор+', colorHex: '#FFA726' },
  { name: 'лид', colorHex: '#BA68C8' },
  { name: 'рук-отдела', colorHex: '#9575CD' },
];

@Injectable()
export class GradesService {
  constructor(private readonly prisma: PrismaService) {}

  private buildEmployeeWorkspaceScope(scope: { ownerUserId: string; companyId: string | null }) {
    return scope.companyId ? { companyId: scope.companyId } : { ownerUserId: scope.ownerUserId };
  }

  private async countEmployeesWithGrade(scope: { ownerUserId: string; companyId: string | null }, gradeName: string) {
    return this.prisma.employee.count({
      where: {
        grade: gradeName,
        workspace: this.buildEmployeeWorkspaceScope(scope),
      },
    });
  }

  private async getWorkspaceScope(workspaceId: string): Promise<{ ownerUserId: string; companyId: string | null }> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { ownerUserId: true, companyId: true },
    });

    if (!workspace) {
      throw new NotFoundException(ErrorCode.PROJECT_NOT_FOUND);
    }

    return {
      ownerUserId: workspace.ownerUserId,
      companyId: workspace.companyId,
    };
  }

  async create(workspaceId: string, dto: CreateGradeDto) {
    const scope = await this.getWorkspaceScope(workspaceId);
    const trimmedName = dto.name.trim();
    const created = await this.prisma.grade.create({
      data: {
        companyId: scope.companyId,
        name: trimmedName,
        colorHex: dto.colorHex,
      },
    });

    const employeesCount = await this.countEmployeesWithGrade(scope, created.name);
    return {
      ...created,
      _count: {
        employees: employeesCount,
      },
    };
  }

  async createDefaultGradesForWorkspace(workspaceId: string) {
    const scope = await this.getWorkspaceScope(workspaceId);
    let created = 0;

    for (const grade of DEFAULT_GRADES) {
      const existing = await this.prisma.grade.findFirst({
        where: {
          companyId: scope.companyId,
          name: grade.name,
        },
        select: { id: true },
      });

      if (existing) {
        await this.prisma.grade.update({
          where: { id: existing.id },
          data: {
            colorHex: grade.colorHex,
          },
        });
        continue;
      }

      await this.prisma.grade.create({
        data: {
          companyId: scope.companyId,
          name: grade.name,
          colorHex: grade.colorHex,
        },
      });
      created += 1;
    }

    return { created };
  }

  async findAll(workspaceId: string) {
    const scope = await this.getWorkspaceScope(workspaceId);
    const grades = await this.prisma.grade.findMany({
      where: scope.companyId
        ? {
            OR: [{ companyId: scope.companyId }, { companyId: null }],
          }
        : { companyId: null },
      orderBy: { createdAt: 'asc' },
    });

    const gradeNames = Array.from(new Set(grades.map((grade) => grade.name)));
    if (gradeNames.length === 0) {
      return [];
    }

    const employeeCounts = await this.prisma.employee.groupBy({
      by: ['grade'],
      where: {
        grade: {
          in: gradeNames,
        },
        workspace: scope.companyId ? { companyId: scope.companyId } : { ownerUserId: scope.ownerUserId },
      },
      _count: {
        _all: true,
      },
    });

    const employeesByGradeName = new Map<string, number>();
    for (const row of employeeCounts) {
      if (!row.grade) continue;
      employeesByGradeName.set(row.grade, row._count._all);
    }

    return grades.map((grade) => ({
      ...grade,
      _count: {
        employees: employeesByGradeName.get(grade.name) ?? 0,
      },
    }));
  }

  async findOne(workspaceId: string, id: string) {
    const scope = await this.getWorkspaceScope(workspaceId);
    const grade = await this.prisma.grade.findFirst({
      where: {
        id,
        ...(scope.companyId
          ? {
              OR: [{ companyId: scope.companyId }, { companyId: null }],
            }
          : { companyId: null }),
      },
    });
    if (!grade) {
      throw new NotFoundException(ErrorCode.GRADE_NOT_FOUND);
    }
    return grade;
  }

  async update(workspaceId: string, id: string, dto: UpdateGradeDto) {
    const scope = await this.getWorkspaceScope(workspaceId);
    const grade = await this.findOne(workspaceId, id);
    if (scope.companyId && grade.companyId !== scope.companyId) {
      throw new NotFoundException(ErrorCode.GRADE_NOT_FOUND);
    }

    const nextName = dto.name?.trim();
    const resolvedName = nextName || grade.name;
    const resolvedColor = dto.colorHex ?? grade.colorHex;
    if (resolvedName === grade.name && resolvedColor === grade.colorHex) {
      return grade;
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (resolvedName !== grade.name) {
        await tx.employee.updateMany({
          where: {
            grade: grade.name,
            workspace: {
              ...this.buildEmployeeWorkspaceScope(scope),
            },
          },
          data: { grade: resolvedName },
        });
      }

      return tx.grade.update({
        where: { id },
        data: {
          name: resolvedName,
          colorHex: resolvedColor,
        },
      });
    });

    const employeesCount = await this.countEmployeesWithGrade(scope, updated.name);
    return {
      ...updated,
      _count: {
        employees: employeesCount,
      },
    };
  }

  async remove(workspaceId: string, id: string) {
    const scope = await this.getWorkspaceScope(workspaceId);
    const grade = await this.findOne(workspaceId, id);
    if (scope.companyId && grade.companyId !== scope.companyId) {
      throw new NotFoundException(ErrorCode.GRADE_NOT_FOUND);
    }

    const employeeRefs = await this.countEmployeesWithGrade(scope, grade.name);

    if (employeeRefs > 0) {
      throw new ConflictException(ErrorCode.GRADE_IN_USE);
    }

    await this.prisma.grade.delete({ where: { id } });
    return { ok: true };
  }
}
