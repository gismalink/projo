import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ErrorCode } from '../common/error-codes';
import { PrismaService } from '../common/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  private startOfUtcDay(value: Date): Date {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }

  private listUtcDays(startDate: Date, endDate: Date): Date[] {
    const days: Date[] = [];
    const cursor = this.startOfUtcDay(startDate);
    const end = this.startOfUtcDay(endDate);
    while (cursor <= end) {
      days.push(new Date(cursor));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return days;
  }

  private ensureDateRange(startDate: Date, endDate: Date) {
    if (endDate < startDate) {
      throw new BadRequestException(ErrorCode.PROJECT_DATE_RANGE_INVALID);
    }
  }

  private handlePrismaError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException(ErrorCode.PROJECT_CODE_ALREADY_EXISTS);
    }
    throw error;
  }

  create(dto: CreateProjectDto) {
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    this.ensureDateRange(startDate, endDate);

    return this.prisma.project
      .create({
        data: {
          code: dto.code,
          name: dto.name,
          description: dto.description,
          status: dto.status ?? 'planned',
          priority: dto.priority ?? 3,
          startDate,
          endDate,
          links: dto.links ?? [],
        },
      })
      .catch((error) => this.handlePrismaError(error));
  }

  private async ensureProjectExists(projectId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
    if (!project) {
      throw new NotFoundException(ErrorCode.PROJECT_NOT_FOUND);
    }
  }

  private async ensureEmployeeExists(employeeId: string) {
    const employee = await this.prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true } });
    if (!employee) {
      throw new NotFoundException(ErrorCode.EMPLOYEE_NOT_FOUND);
    }
  }

  async listMembers(projectId: string) {
    await this.ensureProjectExists(projectId);

    return this.prisma.projectMember.findMany({
      where: { projectId },
      include: {
        employee: {
          include: {
            role: true,
            department: true,
          },
        },
      },
      orderBy: [{ createdAt: 'asc' }],
    });
  }

  async addMember(projectId: string, employeeId: string) {
    await Promise.all([this.ensureProjectExists(projectId), this.ensureEmployeeExists(employeeId)]);

    const existing = await this.prisma.projectMember.findUnique({
      where: {
        projectId_employeeId: {
          projectId,
          employeeId,
        },
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException(ErrorCode.PROJECT_MEMBER_ALREADY_EXISTS);
    }

    return this.prisma.projectMember.create({
      data: {
        projectId,
        employeeId,
      },
      include: {
        employee: {
          include: {
            role: true,
            department: true,
          },
        },
      },
    });
  }

  async removeMember(projectId: string, employeeId: string) {
    await this.ensureProjectExists(projectId);

    const existing = await this.prisma.projectMember.findUnique({
      where: {
        projectId_employeeId: {
          projectId,
          employeeId,
        },
      },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException(ErrorCode.PROJECT_MEMBER_NOT_FOUND);
    }

    await this.prisma.projectMember.delete({
      where: {
        projectId_employeeId: {
          projectId,
          employeeId,
        },
      },
    });

    return { success: true };
  }

  findAll() {
    return this.prisma.project.findMany({
      include: {
        _count: {
          select: { assignments: true },
        },
      },
      orderBy: [{ startDate: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async findOne(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            employee: {
              select: {
                id: true,
                fullName: true,
                email: true,
                grade: true,
                roleId: true,
                defaultCapacityHoursPerDay: true,
                role: { select: { name: true } },
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        assignments: {
          include: {
            employee: {
              select: {
                id: true,
                fullName: true,
                email: true,
                grade: true,
                roleId: true,
                defaultCapacityHoursPerDay: true,
                role: { select: { name: true } },
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!project) {
      throw new NotFoundException(ErrorCode.PROJECT_NOT_FOUND);
    }

    const roleIds = Array.from(new Set(project.assignments.map((assignment) => assignment.employee.roleId)));
    const employeeIds = Array.from(new Set(project.assignments.map((assignment) => assignment.employeeId)));

    const rates = await this.prisma.costRate.findMany({
      where: {
        AND: [
          {
            OR: [{ employeeId: { in: employeeIds } }, { roleId: { in: roleIds } }],
          },
          { validFrom: { lte: project.endDate } },
          {
            OR: [{ validTo: null }, { validTo: { gte: project.startDate } }],
          },
        ],
      },
      orderBy: [{ validFrom: 'desc' }],
    });

    let totalPlannedHours = 0;
    let totalPlannedCost = 0;
    let missingRateDays = 0;

    for (const assignment of project.assignments) {
      const assignmentDays = this.listUtcDays(assignment.assignmentStartDate, assignment.assignmentEndDate);
      const dailyHours =
        assignment.plannedHoursPerDay !== null
          ? Number(assignment.plannedHoursPerDay)
          : (Number(assignment.employee.defaultCapacityHoursPerDay) * Number(assignment.allocationPercent)) / 100;

      for (const day of assignmentDays) {
        totalPlannedHours += dailyHours;

        const employeeRate = rates.find(
          (rate) =>
            rate.employeeId === assignment.employeeId &&
            rate.validFrom <= day &&
            (!rate.validTo || rate.validTo >= day),
        );
        const roleRate = rates.find(
          (rate) =>
            rate.roleId === assignment.employee.roleId &&
            rate.validFrom <= day &&
            (!rate.validTo || rate.validTo >= day),
        );

        const rate = employeeRate ?? roleRate;
        if (!rate) {
          missingRateDays += 1;
          continue;
        }

        totalPlannedCost += dailyHours * Number(rate.amountPerHour);
      }
    }

    return {
      ...project,
      costSummary: {
        totalPlannedHours: Number(totalPlannedHours.toFixed(2)),
        totalPlannedCost: Number(totalPlannedCost.toFixed(2)),
        currency: rates[0]?.currency ?? 'USD',
        missingRateDays,
      },
    };
  }

  async update(id: string, dto: UpdateProjectDto) {
    await this.findOne(id);

    if (dto.startDate && dto.endDate) {
      this.ensureDateRange(new Date(dto.startDate), new Date(dto.endDate));
    }

    return this.prisma.project
      .update({
        where: { id },
        data: {
          code: dto.code,
          name: dto.name,
          description: dto.description,
          status: dto.status,
          priority: dto.priority,
          startDate: dto.startDate ? new Date(dto.startDate) : undefined,
          endDate: dto.endDate ? new Date(dto.endDate) : undefined,
          links: dto.links,
        },
      })
      .catch((error) => this.handlePrismaError(error));
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.project.delete({ where: { id } });
  }
}
