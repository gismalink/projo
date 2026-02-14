import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ErrorCode } from '../common/error-codes';
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
      throw new BadRequestException(ErrorCode.ASSIGNMENT_DATE_RANGE_INVALID);
    }
  }

  private async ensureNoVacationOverlap(params: { employeeId: string; startDate: Date; endDate: Date }) {
    const overlap = await this.prisma.vacation.findFirst({
      where: {
        employeeId: params.employeeId,
        startDate: { lte: params.endDate },
        endDate: { gte: params.startDate },
      },
      select: {
        id: true,
        startDate: true,
        endDate: true,
        type: true,
      },
    });

    if (overlap) {
      throw new BadRequestException(ErrorCode.ASSIGNMENT_OVERLAPS_VACATION);
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
      throw new NotFoundException(ErrorCode.PROJECT_NOT_FOUND);
    }

    if (!employee) {
      throw new NotFoundException(ErrorCode.EMPLOYEE_NOT_FOUND);
    }

    await this.ensureNoVacationOverlap({
      employeeId: dto.employeeId,
      startDate,
      endDate,
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
      throw new NotFoundException(ErrorCode.ASSIGNMENT_NOT_FOUND);
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
      throw new NotFoundException(ErrorCode.PROJECT_NOT_FOUND);
    }

    await this.ensureNoVacationOverlap({
      employeeId: dto.employeeId ?? existing.employeeId,
      startDate: nextStart,
      endDate: nextEnd,
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
