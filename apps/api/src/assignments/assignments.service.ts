import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ErrorCode } from '../common/error-codes';
import { PrismaService } from '../common/prisma.service';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { AssignmentLoadProfileDto, AssignmentLoadProfileModeValue } from './dto/load-profile.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';

type AssignmentLoadProfilePoint = {
  date: string;
  value: number;
};

type AssignmentLoadProfile = {
  mode: AssignmentLoadProfileModeValue;
  points?: AssignmentLoadProfilePoint[];
};

@Injectable()
export class AssignmentsService {
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

  private async ensureEmployeeInWorkspaceScope(workspaceId: string, employeeId: string) {
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

  private calculateCurveAveragePercent(
    profile: AssignmentLoadProfile,
    assignmentStartDate: Date,
    assignmentEndDate: Date,
  ): number {
    if (profile.mode !== 'curve' || !profile.points || profile.points.length < 2) {
      return 100;
    }

    const totalDurationMs = assignmentEndDate.getTime() - assignmentStartDate.getTime();
    if (totalDurationMs <= 0) {
      return profile.points[0]?.value ?? 100;
    }

    let weightedArea = 0;
    for (let index = 0; index < profile.points.length - 1; index += 1) {
      const current = profile.points[index]!;
      const next = profile.points[index + 1]!;
      const start = this.ensureValidLoadProfilePointDate(current.date).getTime();
      const end = this.ensureValidLoadProfilePointDate(next.date).getTime();
      const duration = Math.max(0, end - start);
      if (duration === 0) {
        continue;
      }

      weightedArea += ((current.value + next.value) / 2) * duration;
    }

    const average = weightedArea / totalDurationMs;
    return Number(average.toFixed(2));
  }

  private ensureValidLoadProfilePointDate(pointDate: string): Date {
    const parsed = new Date(pointDate);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(ErrorCode.ASSIGNMENT_LOAD_PROFILE_INVALID);
    }
    return parsed;
  }

  private toUtcDayTimestamp(value: Date): number {
    return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
  }

  private normalizeLoadProfile(
    loadProfile: AssignmentLoadProfileDto | undefined,
    assignmentStartDate: Date,
    assignmentEndDate: Date,
  ): AssignmentLoadProfile | undefined {
    if (loadProfile === undefined) {
      return undefined;
    }

    if (loadProfile.mode === 'flat') {
      return { mode: 'flat' };
    }

    const points = loadProfile.points ?? [];
    if (points.length < 2) {
      throw new BadRequestException(ErrorCode.ASSIGNMENT_LOAD_PROFILE_INVALID);
    }

    const normalizedPoints: AssignmentLoadProfilePoint[] = [];
    let previousTimestamp = Number.NEGATIVE_INFINITY;
    for (const point of points) {
      const pointDate = this.ensureValidLoadProfilePointDate(point.date);
      const pointTimestamp = pointDate.getTime();
      if (pointTimestamp < assignmentStartDate.getTime() || pointTimestamp > assignmentEndDate.getTime()) {
        throw new BadRequestException(ErrorCode.ASSIGNMENT_LOAD_PROFILE_INVALID);
      }
      if (pointTimestamp <= previousTimestamp) {
        throw new BadRequestException(ErrorCode.ASSIGNMENT_LOAD_PROFILE_INVALID);
      }

      previousTimestamp = pointTimestamp;
      normalizedPoints.push({
        date: pointDate.toISOString(),
        value: Number(point.value),
      });
    }

    const assignmentStartDay = this.toUtcDayTimestamp(assignmentStartDate);
    const assignmentEndDay = this.toUtcDayTimestamp(assignmentEndDate);
    const firstPointDay = normalizedPoints[0]
      ? this.toUtcDayTimestamp(this.ensureValidLoadProfilePointDate(normalizedPoints[0].date))
      : Number.NaN;
    const lastPointDay = normalizedPoints[normalizedPoints.length - 1]
      ? this.toUtcDayTimestamp(this.ensureValidLoadProfilePointDate(normalizedPoints[normalizedPoints.length - 1].date))
      : Number.NaN;

    if (firstPointDay !== assignmentStartDay) {
      throw new BadRequestException(ErrorCode.ASSIGNMENT_LOAD_PROFILE_INVALID);
    }
    if (lastPointDay !== assignmentEndDay) {
      throw new BadRequestException(ErrorCode.ASSIGNMENT_LOAD_PROFILE_INVALID);
    }

    normalizedPoints[0].date = assignmentStartDate.toISOString();
    normalizedPoints[normalizedPoints.length - 1].date = assignmentEndDate.toISOString();

    return {
      mode: 'curve',
      points: normalizedPoints,
    };
  }

  private readStoredLoadProfile(loadProfile: unknown): AssignmentLoadProfile | null {
    if (!loadProfile || typeof loadProfile !== 'object') {
      return null;
    }

    const profile = loadProfile as {
      mode?: unknown;
      points?: unknown;
    };

    if (profile.mode === 'flat') {
      return { mode: 'flat' };
    }

    if (profile.mode !== 'curve' || !Array.isArray(profile.points)) {
      return null;
    }

    const points = profile.points
      .map((point) => {
        if (!point || typeof point !== 'object') return null;
        const candidate = point as { date?: unknown; value?: unknown };
        if (typeof candidate.date !== 'string' || typeof candidate.value !== 'number') return null;
        return {
          date: candidate.date,
          value: candidate.value,
        };
      })
      .filter((point): point is AssignmentLoadProfilePoint => point !== null);

    if (points.length < 2) {
      return null;
    }

    return {
      mode: 'curve',
      points,
    };
  }

  private scaleCurveProfilePointsToRange(params: {
    profile: AssignmentLoadProfile;
    previousStart: Date;
    previousEnd: Date;
    nextStart: Date;
    nextEnd: Date;
  }): AssignmentLoadProfile | undefined {
    const { profile, previousStart, previousEnd, nextStart, nextEnd } = params;
    if (profile.mode !== 'curve' || !profile.points || profile.points.length < 2) {
      return undefined;
    }

    const previousSpanMs = previousEnd.getTime() - previousStart.getTime();
    const nextSpanMs = nextEnd.getTime() - nextStart.getTime();
    if (previousSpanMs <= 0 || nextSpanMs <= 0) {
      throw new BadRequestException(ErrorCode.ASSIGNMENT_LOAD_PROFILE_INVALID);
    }

    const scaledPoints: AssignmentLoadProfilePoint[] = profile.points.map((point, index) => {
      if (index === 0) {
        return { date: nextStart.toISOString(), value: point.value };
      }
      if (index === profile.points!.length - 1) {
        return { date: nextEnd.toISOString(), value: point.value };
      }

      const sourcePointDate = this.ensureValidLoadProfilePointDate(point.date);
      const ratio = (sourcePointDate.getTime() - previousStart.getTime()) / previousSpanMs;
      const scaledTimestamp = nextStart.getTime() + ratio * nextSpanMs;
      return {
        date: new Date(scaledTimestamp).toISOString(),
        value: point.value,
      };
    });

    return this.normalizeLoadProfile(
      {
        mode: 'curve',
        points: scaledPoints,
      },
      nextStart,
      nextEnd,
    );
  }

  private async ensureProjectMember(projectId: string, employeeId: string) {
    const existing = await this.prisma.projectMember.findUnique({
      where: {
        projectId_employeeId: {
          projectId,
          employeeId,
        },
      },
      select: { id: true },
    });

    if (existing) return;

    await this.prisma.projectMember.create({
      data: {
        projectId,
        employeeId,
      },
    });
  }

  private ensureDateRange(startDate: Date, endDate: Date) {
    if (endDate < startDate) {
      throw new BadRequestException(ErrorCode.ASSIGNMENT_DATE_RANGE_INVALID);
    }
  }

  private async ensureUniqueEmployeeInProject(params: {
    projectId: string;
    employeeId: string;
    excludeAssignmentId?: string;
  }) {
    const duplicate = await this.prisma.projectAssignment.findFirst({
      where: {
        projectId: params.projectId,
        employeeId: params.employeeId,
        id: params.excludeAssignmentId ? { not: params.excludeAssignmentId } : undefined,
      },
      select: { id: true },
    });

    if (duplicate) {
      throw new ConflictException(ErrorCode.ASSIGNMENT_EMPLOYEE_ALREADY_IN_PROJECT);
    }
  }

  async create(workspaceId: string, dto: CreateAssignmentDto) {
    const startDate = new Date(dto.assignmentStartDate);
    const endDate = new Date(dto.assignmentEndDate);
    const requestedAllocationPercent = dto.allocationPercent ?? 100;
    this.ensureDateRange(startDate, endDate);
    const normalizedLoadProfile = this.normalizeLoadProfile(dto.loadProfile, startDate, endDate);
    const allocationPercent =
      normalizedLoadProfile?.mode === 'curve'
        ? this.calculateCurveAveragePercent(normalizedLoadProfile, startDate, endDate)
        : requestedAllocationPercent;

    const project = await this.prisma.project.findFirst({ where: { id: dto.projectId, workspaceId } });
    if (!project) {
      throw new NotFoundException(ErrorCode.PROJECT_NOT_FOUND);
    }

    await this.ensureEmployeeInWorkspaceScope(workspaceId, dto.employeeId);

    await this.ensureUniqueEmployeeInProject({
      projectId: dto.projectId,
      employeeId: dto.employeeId,
    });

    await this.ensureProjectMember(dto.projectId, dto.employeeId);

    return this.prisma.projectAssignment.create({
      data: {
        projectId: dto.projectId,
        employeeId: dto.employeeId,
        assignmentStartDate: startDate,
        assignmentEndDate: endDate,
        allocationPercent,
        loadProfile: normalizedLoadProfile,
        plannedHoursPerDay: dto.plannedHoursPerDay,
        roleOnProject: dto.roleOnProject,
      },
      include: {
        employee: {
          include: { role: true },
        },
        project: true,
      },
    });
  }

  findAll(workspaceId: string) {
    return this.prisma.projectAssignment.findMany({
      where: {
        project: {
          workspaceId,
        },
      },
      include: {
        employee: {
          include: { role: true },
        },
        project: true,
      },
      orderBy: { assignmentStartDate: 'asc' },
    });
  }

  async findOne(workspaceId: string, id: string) {
    const assignment = await this.prisma.projectAssignment.findFirst({
      where: {
        id,
        project: {
          workspaceId,
        },
      },
      include: {
        employee: {
          include: { role: true },
        },
        project: true,
      },
    });

    if (!assignment) {
      throw new NotFoundException(ErrorCode.ASSIGNMENT_NOT_FOUND);
    }

    return assignment;
  }

  async update(workspaceId: string, id: string, dto: UpdateAssignmentDto) {
    const existing = await this.findOne(workspaceId, id);

    const nextStart = dto.assignmentStartDate ? new Date(dto.assignmentStartDate) : existing.assignmentStartDate;
    const nextEnd = dto.assignmentEndDate ? new Date(dto.assignmentEndDate) : existing.assignmentEndDate;
    this.ensureDateRange(nextStart, nextEnd);
    const hasDateRangeChanges =
      nextStart.getTime() !== existing.assignmentStartDate.getTime() ||
      nextEnd.getTime() !== existing.assignmentEndDate.getTime();

    const projectId = dto.projectId ?? existing.projectId;
    const employeeId = dto.employeeId ?? existing.employeeId;
    const project = await this.prisma.project.findFirst({ where: { id: projectId, workspaceId } });
    if (!project) {
      throw new NotFoundException(ErrorCode.PROJECT_NOT_FOUND);
    }

    await this.ensureEmployeeInWorkspaceScope(workspaceId, employeeId);

    await this.ensureUniqueEmployeeInProject({
      projectId,
      employeeId,
      excludeAssignmentId: id,
    });

    await this.ensureProjectMember(projectId, employeeId);

    const normalizedExplicitLoadProfile = this.normalizeLoadProfile(dto.loadProfile, nextStart, nextEnd);
    const storedLoadProfile = this.readStoredLoadProfile(existing.loadProfile);
    const scaledLoadProfile =
      dto.loadProfile === undefined && hasDateRangeChanges && storedLoadProfile
        ? this.scaleCurveProfilePointsToRange({
            profile: storedLoadProfile,
            previousStart: existing.assignmentStartDate,
            previousEnd: existing.assignmentEndDate,
            nextStart,
            nextEnd,
          })
        : undefined;
    const nextLoadProfile = dto.loadProfile !== undefined ? normalizedExplicitLoadProfile : scaledLoadProfile;
    const effectiveLoadProfileForAllocation =
      nextLoadProfile ?? (dto.loadProfile === undefined ? storedLoadProfile ?? undefined : undefined);
    const nextAllocationPercent =
      effectiveLoadProfileForAllocation?.mode === 'curve'
        ? this.calculateCurveAveragePercent(effectiveLoadProfileForAllocation, nextStart, nextEnd)
        : dto.allocationPercent;

    return this.prisma.projectAssignment.update({
      where: { id },
      data: {
        projectId: dto.projectId,
        employeeId: dto.employeeId,
        assignmentStartDate: dto.assignmentStartDate ? new Date(dto.assignmentStartDate) : undefined,
        assignmentEndDate: dto.assignmentEndDate ? new Date(dto.assignmentEndDate) : undefined,
        allocationPercent: nextAllocationPercent,
        loadProfile: nextLoadProfile,
        plannedHoursPerDay: dto.plannedHoursPerDay,
        roleOnProject: dto.roleOnProject,
      },
      include: {
        employee: {
          include: { role: true },
        },
        project: true,
      },
    });
  }

  async remove(workspaceId: string, id: string) {
    await this.findOne(workspaceId, id);
    return this.prisma.projectAssignment.delete({ where: { id } });
  }
}
