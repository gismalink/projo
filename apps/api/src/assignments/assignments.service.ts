import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ErrorCode } from '../common/error-codes';
import { PrismaService } from '../common/prisma.service';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';

@Injectable()
export class AssignmentsService {
  constructor(private readonly prisma: PrismaService) {}

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

    await this.ensureUniqueEmployeeInProject({
      projectId: dto.projectId,
      employeeId: dto.employeeId,
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
    this.ensureDateRange(nextStart, nextEnd);

    const projectId = dto.projectId ?? existing.projectId;
    const employeeId = dto.employeeId ?? existing.employeeId;
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      throw new NotFoundException(ErrorCode.PROJECT_NOT_FOUND);
    }

    await this.ensureUniqueEmployeeInProject({
      projectId,
      employeeId,
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
