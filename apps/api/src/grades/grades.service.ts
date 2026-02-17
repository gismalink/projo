import { Injectable, NotFoundException } from '@nestjs/common';
import { ErrorCode } from '../common/error-codes';
import { PrismaService } from '../common/prisma.service';
import { CreateGradeDto } from './dto/create-grade.dto';
import { UpdateGradeDto } from './dto/update-grade.dto';

@Injectable()
export class GradesService {
  constructor(private readonly prisma: PrismaService) {}

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
    return this.prisma.grade.create({
      data: {
        companyId: scope.companyId,
        name: trimmedName,
        colorHex: dto.colorHex,
      },
    });
  }

  async findAll(workspaceId: string) {
    const scope = await this.getWorkspaceScope(workspaceId);
    return this.prisma.grade.findMany({
      where: scope.companyId
        ? {
            OR: [{ companyId: scope.companyId }, { companyId: null }],
          }
        : { companyId: null },
      orderBy: { createdAt: 'asc' },
    });
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

    return this.prisma.$transaction(async (tx) => {
      if (resolvedName !== grade.name) {
        await tx.employee.updateMany({
          where: {
            grade: grade.name,
            workspace: {
              ...(scope.companyId ? { companyId: scope.companyId } : { ownerUserId: scope.ownerUserId }),
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
  }

  async remove(workspaceId: string, id: string) {
    const scope = await this.getWorkspaceScope(workspaceId);
    const grade = await this.findOne(workspaceId, id);
    if (scope.companyId && grade.companyId !== scope.companyId) {
      throw new NotFoundException(ErrorCode.GRADE_NOT_FOUND);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.employee.updateMany({
        where: {
          grade: grade.name,
          workspace: {
            ...(scope.companyId ? { companyId: scope.companyId } : { ownerUserId: scope.ownerUserId }),
          },
        },
        data: { grade: null },
      });

      await tx.grade.delete({ where: { id } });
    });

    return { ok: true };
  }
}
