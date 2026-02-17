import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ErrorCode } from '../common/error-codes';
import { PrismaService } from '../common/prisma.service';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';

@Injectable()
export class AssignmentsService {
  constructor(private readonly prisma: PrismaService) {}

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
    const allocationPercent = dto.allocationPercent ?? 100;
    this.ensureDateRange(startDate, endDate);

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

    await this.ensureUniqueEmployeeInProject({
      projectId,
      employeeId,
      excludeAssignmentId: id,
    });

    await this.ensureProjectMember(projectId, employeeId);

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

  async remove(workspaceId: string, id: string) {
    await this.findOne(workspaceId, id);
    return this.prisma.projectAssignment.delete({ where: { id } });
  }
}
