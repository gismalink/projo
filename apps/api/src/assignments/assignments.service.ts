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

  private ensureValidLoadProfilePointDate(pointDate: string): Date {
    const parsed = new Date(pointDate);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(ErrorCode.ASSIGNMENT_LOAD_PROFILE_INVALID);
    }
    return parsed;
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

    if (normalizedPoints[0]?.date !== assignmentStartDate.toISOString()) {
      throw new BadRequestException(ErrorCode.ASSIGNMENT_LOAD_PROFILE_INVALID);
    }
    if (normalizedPoints[normalizedPoints.length - 1]?.date !== assignmentEndDate.toISOString()) {
      throw new BadRequestException(ErrorCode.ASSIGNMENT_LOAD_PROFILE_INVALID);
    }

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

  private ensureWithinProjectRange(
    assignmentStartDate: Date,
    assignmentEndDate: Date,
    projectStartDate: Date,
    projectEndDate: Date,
  ) {
    if (assignmentStartDate < projectStartDate || assignmentEndDate > projectEndDate) {
      throw new BadRequestException(ErrorCode.ASSIGNMENT_OUTSIDE_PROJECT_RANGE);
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
    const allocationPercent = dto.allocationPercent ?? 100;
    this.ensureDateRange(startDate, endDate);
    const normalizedLoadProfile = this.normalizeLoadProfile(dto.loadProfile, startDate, endDate);

    const [project, employee] = await Promise.all([
      this.prisma.project.findFirst({ where: { id: dto.projectId, workspaceId } }),
      this.prisma.employee.findFirst({ where: { id: dto.employeeId, workspaceId } }),
    ]);

    if (!project) {
      throw new NotFoundException(ErrorCode.PROJECT_NOT_FOUND);
    }

    if (!employee) {
      throw new NotFoundException(ErrorCode.EMPLOYEE_NOT_FOUND);
    }

    this.ensureWithinProjectRange(startDate, endDate, project.startDate, project.endDate);

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
    const [project, employee] = await Promise.all([
      this.prisma.project.findFirst({ where: { id: projectId, workspaceId } }),
      this.prisma.employee.findFirst({ where: { id: employeeId, workspaceId } }),
    ]);

    if (!project) {
      throw new NotFoundException(ErrorCode.PROJECT_NOT_FOUND);
    }

    if (!employee) {
      throw new NotFoundException(ErrorCode.EMPLOYEE_NOT_FOUND);
    }

    this.ensureWithinProjectRange(nextStart, nextEnd, project.startDate, project.endDate);

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

    return this.prisma.projectAssignment.update({
      where: { id },
      data: {
        projectId: dto.projectId,
        employeeId: dto.employeeId,
        assignmentStartDate: dto.assignmentStartDate ? new Date(dto.assignmentStartDate) : undefined,
        assignmentEndDate: dto.assignmentEndDate ? new Date(dto.assignmentEndDate) : undefined,
        allocationPercent: dto.allocationPercent,
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
