import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createAssignmentLoadPercentResolver } from '../common/load-profile.utils';
import { ErrorCode } from '../common/error-codes';
import { PrismaService } from '../common/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

const PROJECT_PERSON_SELECT = {
  id: true,
  fullName: true,
  email: true,
  grade: true,
  roleId: true,
  defaultCapacityHoursPerDay: true,
  role: { select: { name: true } },
} satisfies Prisma.EmployeeSelect;

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  private async nextCopiedProjectCode(workspaceId: string, baseCode: string) {
    let suffix = 1;
    let candidate = `${baseCode}-copy`;
    while (true) {
      const existing = await this.prisma.project.findFirst({
        where: {
          workspaceId,
          code: candidate,
        },
        select: { id: true },
      });
      if (!existing) return candidate;
      suffix += 1;
      candidate = `${baseCode}-copy-${suffix}`;
    }
  }

  private toPrismaJsonInput(value: Prisma.JsonValue | null | undefined) {
    if (value === undefined) return undefined;
    if (value === null) return Prisma.JsonNull;
    return value as Prisma.InputJsonValue;
  }

  private async ensureTeamTemplateExists(workspaceId: string, templateId: string) {
    const scope = await this.getWorkspaceScope(workspaceId);
    const template = await this.prisma.projectTeamTemplate.findFirst({
      where: {
        id: templateId,
        ...(scope.companyId ? { companyId: scope.companyId } : { companyId: null }),
      },
      select: { id: true },
    });
    if (!template) {
      throw new NotFoundException(ErrorCode.PROJECT_TEAM_TEMPLATE_NOT_FOUND);
    }
  }

  private isoDayKey(value: Date): string {
    return this.startOfUtcDay(value).toISOString().slice(0, 10);
  }

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

  async create(workspaceId: string, dto: CreateProjectDto) {
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    this.ensureDateRange(startDate, endDate);

    if (dto.teamTemplateId) {
      await this.ensureTeamTemplateExists(workspaceId, dto.teamTemplateId);
    }

    return this.prisma.project
      .create({
        data: {
          workspaceId,
          code: dto.code,
          name: dto.name,
          description: dto.description,
          status: dto.status ?? 'planned',
          priority: dto.priority ?? 3,
          startDate,
          endDate,
          links: dto.links ?? [],
          teamTemplateId: dto.teamTemplateId || undefined,
        },
      })
      .catch((error) => this.handlePrismaError(error));
  }

  private async ensureProjectExists(workspaceId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({ where: { id: projectId, workspaceId }, select: { id: true } });
    if (!project) {
      throw new NotFoundException(ErrorCode.PROJECT_NOT_FOUND);
    }
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

  private async ensureEmployeeExists(workspaceId: string, employeeId: string) {
    const scope = await this.getWorkspaceScope(workspaceId);
    const employee = await this.prisma.employee.findFirst({
      where: {
        id: employeeId,
        workspace: {
          ...(scope.companyId ? { companyId: scope.companyId } : { ownerUserId: scope.ownerUserId }),
        },
      },
      select: { id: true },
    });
    if (!employee) {
      throw new NotFoundException(ErrorCode.EMPLOYEE_NOT_FOUND);
    }
  }

  async listMembers(workspaceId: string, projectId: string) {
    await this.ensureProjectExists(workspaceId, projectId);

    return this.prisma.projectMember.findMany({
      where: {
        projectId,
        project: {
          workspaceId,
        },
      },
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

  async addMember(workspaceId: string, projectId: string, employeeId: string) {
    await Promise.all([this.ensureProjectExists(workspaceId, projectId), this.ensureEmployeeExists(workspaceId, employeeId)]);

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

  async removeMember(workspaceId: string, projectId: string, employeeId: string) {
    await this.ensureProjectExists(workspaceId, projectId);

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

  findAll(workspaceId: string) {
    return this.prisma.project.findMany({
      where: { workspaceId },
      include: {
        teamTemplate: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: { assignments: true },
        },
      },
      orderBy: [{ startDate: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async findOne(workspaceId: string, id: string) {
    const project = await this.prisma.project.findFirst({
      where: {
        id,
        workspaceId,
      },
      include: {
        teamTemplate: {
          include: {
            roles: {
              orderBy: { position: 'asc' },
              include: {
                role: {
                  select: {
                    id: true,
                    name: true,
                    shortName: true,
                  },
                },
              },
            },
          },
        },
        members: {
          include: {
            employee: {
              select: PROJECT_PERSON_SELECT,
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        assignments: {
          include: {
            employee: {
              select: PROJECT_PERSON_SELECT,
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

    const [rates, vacations, calendarDays] = await Promise.all([
      this.prisma.costRate.findMany({
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
      }),
      this.prisma.vacation.findMany({
        where: {
          employeeId: { in: employeeIds },
          startDate: { lte: project.endDate },
          endDate: { gte: project.startDate },
        },
        select: {
          employeeId: true,
          startDate: true,
          endDate: true,
        },
      }),
      this.prisma.calendarDay.findMany({
        where: {
          date: {
            gte: this.startOfUtcDay(project.startDate),
            lte: this.startOfUtcDay(project.endDate),
          },
        },
        select: {
          date: true,
          isWorkingDay: true,
        },
      }),
    ]);

    const workingDayByIso = new Map<string, boolean>();
    for (const day of calendarDays) {
      workingDayByIso.set(this.isoDayKey(day.date), day.isWorkingDay);
    }

    const vacationsByEmployeeId = new Map<string, Array<{ start: Date; end: Date }>>();
    for (const vacation of vacations) {
      const ranges = vacationsByEmployeeId.get(vacation.employeeId);
      const range = {
        start: this.startOfUtcDay(vacation.startDate),
        end: this.startOfUtcDay(vacation.endDate),
      };
      if (ranges) {
        ranges.push(range);
      } else {
        vacationsByEmployeeId.set(vacation.employeeId, [range]);
      }
    }

    let totalPlannedHours = 0;
    let totalActualHours = 0;
    let totalPlannedCost = 0;
    let totalActualCost = 0;
    let missingRateDays = 0;
    let missingRateHours = 0;
    const usedCurrencies = new Set<string>();

    for (const assignment of project.assignments) {
      const assignmentDays = this.listUtcDays(assignment.assignmentStartDate, assignment.assignmentEndDate);
      const fixedDailyHours = assignment.plannedHoursPerDay !== null ? Number(assignment.plannedHoursPerDay) : null;
      if (fixedDailyHours !== null && (!Number.isFinite(fixedDailyHours) || fixedDailyHours <= 0)) {
        continue;
      }
      const resolveLoadPercent = createAssignmentLoadPercentResolver(assignment);

      const employeeVacations = vacationsByEmployeeId.get(assignment.employeeId) ?? [];

      for (const day of assignmentDays) {
        const dayKey = this.isoDayKey(day);
        const isWorkingDay = workingDayByIso.has(dayKey)
          ? Boolean(workingDayByIso.get(dayKey))
          : (() => {
              const weekday = day.getUTCDay();
              return weekday !== 0 && weekday !== 6;
            })();

        if (!isWorkingDay) continue;

        const dailyHours =
          fixedDailyHours !== null
            ? fixedDailyHours
            : (Number(assignment.employee.defaultCapacityHoursPerDay) * resolveLoadPercent(day)) / 100;
        if (!Number.isFinite(dailyHours) || dailyHours <= 0) {
          continue;
        }

        totalPlannedHours += dailyHours;

        const onVacation = employeeVacations.some((range) => day >= range.start && day <= range.end);
        if (!onVacation) {
          totalActualHours += dailyHours;
        }

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
          missingRateHours += dailyHours;
          continue;
        }

        usedCurrencies.add(rate.currency);
        totalPlannedCost += dailyHours * Number(rate.amountPerHour);
        if (!onVacation) {
          totalActualCost += dailyHours * Number(rate.amountPerHour);
        }
      }
    }

    const totalLostHours = Math.max(0, totalPlannedHours - totalActualHours);
    const totalLostCost = Math.max(0, totalPlannedCost - totalActualCost);
    const currency = usedCurrencies.size === 1 ? Array.from(usedCurrencies)[0] : rates[0]?.currency ?? 'USD';

    return {
      ...project,
      costSummary: {
        totalPlannedHours: Number(totalPlannedHours.toFixed(2)),
        totalActualHours: Number(totalActualHours.toFixed(2)),
        totalLostHours: Number(totalLostHours.toFixed(2)),
        totalPlannedCost: Number(totalPlannedCost.toFixed(2)),
        totalActualCost: Number(totalActualCost.toFixed(2)),
        totalLostCost: Number(totalLostCost.toFixed(2)),
        currency,
        missingRateDays,
        missingRateHours: Number(missingRateHours.toFixed(2)),
      },
    };
  }

  async update(workspaceId: string, id: string, dto: UpdateProjectDto) {
    await this.findOne(workspaceId, id);

    if (dto.teamTemplateId) {
      await this.ensureTeamTemplateExists(workspaceId, dto.teamTemplateId);
    }

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
          teamTemplateId: dto.teamTemplateId === undefined ? undefined : dto.teamTemplateId || null,
        },
      })
      .catch((error) => this.handlePrismaError(error));
  }

  async remove(workspaceId: string, id: string) {
    await this.findOne(workspaceId, id);
    return this.prisma.project.delete({ where: { id } });
  }

  async copy(workspaceId: string, sourceProjectId: string, name?: string) {
    const source = await this.prisma.project.findFirst({
      where: {
        id: sourceProjectId,
        workspaceId,
      },
      include: {
        members: {
          select: {
            employeeId: true,
          },
        },
        assignments: {
          select: {
            employeeId: true,
            assignmentStartDate: true,
            assignmentEndDate: true,
            allocationPercent: true,
            loadProfile: true,
            plannedHoursPerDay: true,
            roleOnProject: true,
          },
        },
      },
    });

    if (!source) {
      throw new NotFoundException(ErrorCode.PROJECT_NOT_FOUND);
    }

    const copiedCode = await this.nextCopiedProjectCode(workspaceId, source.code);
    const copiedName = name?.trim() ? name.trim() : `${source.name} copy`;

    const created = await this.prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          workspaceId,
          code: copiedCode,
          name: copiedName,
          description: source.description,
          status: source.status,
          priority: source.priority,
          startDate: source.startDate,
          endDate: source.endDate,
          links: this.toPrismaJsonInput(source.links),
          teamTemplateId: source.teamTemplateId,
        },
      });

      if (source.members.length > 0) {
        await tx.projectMember.createMany({
          data: source.members.map((member) => ({
            projectId: project.id,
            employeeId: member.employeeId,
          })),
        });
      }

      if (source.assignments.length > 0) {
        await tx.projectAssignment.createMany({
          data: source.assignments.map((assignment) => ({
            projectId: project.id,
            employeeId: assignment.employeeId,
            assignmentStartDate: assignment.assignmentStartDate,
            assignmentEndDate: assignment.assignmentEndDate,
            allocationPercent: assignment.allocationPercent,
            loadProfile: this.toPrismaJsonInput(assignment.loadProfile),
            plannedHoursPerDay: assignment.plannedHoursPerDay,
            roleOnProject: assignment.roleOnProject,
          })),
        });
      }

      return project;
    });

    return created;
  }
}
