import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';

@Injectable()
export class AssignmentsService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeUtcDay(date: Date) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  }

  private addDays(date: Date, days: number) {
    const value = new Date(date);
    value.setUTCDate(value.getUTCDate() + days);
    return value;
  }

  private ensureDateRange(startDate: Date, endDate: Date) {
    if (endDate < startDate) {
      throw new BadRequestException('assignmentEndDate cannot be earlier than assignmentStartDate');
    }
  }

  private async ensureNoOverload(params: {
    employeeId: string;
    startDate: Date;
    endDate: Date;
    allocationPercent: number;
    excludeAssignmentId?: string;
  }) {
    const overlappingAssignments = await this.prisma.projectAssignment.findMany({
      where: {
        employeeId: params.employeeId,
        assignmentStartDate: { lte: params.endDate },
        assignmentEndDate: { gte: params.startDate },
        id: params.excludeAssignmentId ? { not: params.excludeAssignmentId } : undefined,
      },
      select: {
        assignmentStartDate: true,
        assignmentEndDate: true,
        allocationPercent: true,
      },
    });

    let cursor = this.normalizeUtcDay(params.startDate);
    const end = this.normalizeUtcDay(params.endDate);

    while (cursor <= end) {
      const nextDay = this.addDays(cursor, 1);
      const overlaps = overlappingAssignments.reduce((sum, assignment) => {
        const assignmentStart = this.normalizeUtcDay(assignment.assignmentStartDate);
        const assignmentEnd = this.normalizeUtcDay(assignment.assignmentEndDate);
        if (assignmentStart <= cursor && assignmentEnd >= cursor) {
          return sum + Number(assignment.allocationPercent);
        }

        return sum;
      }, 0);

      if (overlaps + params.allocationPercent > 100) {
        throw new BadRequestException(
          'Employee allocation exceeds 100% for one or more days in selected period',
        );
      }

      cursor = nextDay;
    }
  }

  async create(dto: CreateAssignmentDto) {
    const startDate = new Date(dto.assignmentStartDate);
    const endDate = new Date(dto.assignmentEndDate);
    const allocationPercent = dto.allocationPercent ?? 100;
    this.ensureDateRange(startDate, endDate);

    const [project, employee] = await Promise.all([
      this.prisma.project.findUnique({ where: { id: dto.projectId } }),
      this.prisma.employee.findUnique({ where: { id: dto.employeeId } }),
    ]);

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    if (startDate < project.startDate || endDate > project.endDate) {
      throw new BadRequestException('Assignment dates must be inside project date range');
    }

    await this.ensureNoOverload({
      employeeId: dto.employeeId,
      startDate,
      endDate,
      allocationPercent,
    });

    return this.prisma.projectAssignment.create({
      data: {
        projectId: dto.projectId,
        employeeId: dto.employeeId,
        assignmentStartDate: startDate,
        assignmentEndDate: endDate,
        allocationPercent,
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

  findAll() {
    return this.prisma.projectAssignment.findMany({
      include: {
        employee: {
          include: { role: true },
        },
        project: true,
      },
      orderBy: { assignmentStartDate: 'asc' },
    });
  }

  async findOne(id: string) {
    const assignment = await this.prisma.projectAssignment.findUnique({
      where: { id },
      include: {
        employee: {
          include: { role: true },
        },
        project: true,
      },
    });

    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }

    return assignment;
  }

  async update(id: string, dto: UpdateAssignmentDto) {
    const existing = await this.findOne(id);

    const nextStart = dto.assignmentStartDate ? new Date(dto.assignmentStartDate) : existing.assignmentStartDate;
    const nextEnd = dto.assignmentEndDate ? new Date(dto.assignmentEndDate) : existing.assignmentEndDate;
    const nextAllocationPercent = dto.allocationPercent ?? Number(existing.allocationPercent);
    this.ensureDateRange(nextStart, nextEnd);

    const projectId = dto.projectId ?? existing.projectId;
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (nextStart < project.startDate || nextEnd > project.endDate) {
      throw new BadRequestException('Assignment dates must be inside project date range');
    }

    await this.ensureNoOverload({
      employeeId: dto.employeeId ?? existing.employeeId,
      startDate: nextStart,
      endDate: nextEnd,
      allocationPercent: nextAllocationPercent,
      excludeAssignmentId: id,
    });

    return this.prisma.projectAssignment.update({
      where: { id },
      data: {
        projectId: dto.projectId,
        employeeId: dto.employeeId,
        assignmentStartDate: dto.assignmentStartDate ? new Date(dto.assignmentStartDate) : undefined,
        assignmentEndDate: dto.assignmentEndDate ? new Date(dto.assignmentEndDate) : undefined,
        allocationPercent: dto.allocationPercent,
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

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.projectAssignment.delete({ where: { id } });
  }
}
