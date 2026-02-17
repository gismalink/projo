import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ErrorCode } from '../common/error-codes';
import { PrismaService } from '../common/prisma.service';
import { CreateVacationDto } from './dto/create-vacation.dto';
import { UpdateVacationDto } from './dto/update-vacation.dto';

@Injectable()
export class VacationsService {
  constructor(private readonly prisma: PrismaService) {}

  private async getWorkspaceOwnerUserId(workspaceId: string): Promise<string> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { ownerUserId: true },
    });

    if (!workspace) {
      throw new NotFoundException(ErrorCode.PROJECT_NOT_FOUND);
    }

    return workspace.ownerUserId;
  }

  private async ensureEmployeeExistsForWorkspaceOwner(workspaceId: string, employeeId: string) {
    const ownerUserId = await this.getWorkspaceOwnerUserId(workspaceId);
    const employee = await this.prisma.employee.findFirst({
      where: {
        id: employeeId,
        workspace: {
          ownerUserId,
        },
      },
      select: { id: true },
    });

    if (!employee) {
      throw new NotFoundException(ErrorCode.EMPLOYEE_NOT_FOUND);
    }
  }

  private ensureDateRange(startDate: Date, endDate: Date) {
    if (endDate < startDate) {
      throw new BadRequestException(ErrorCode.VACATION_DATE_RANGE_INVALID);
    }
  }

  private async ensureNoOverlap(workspaceId: string, employeeId: string, startDate: Date, endDate: Date, excludeId?: string) {
    const overlaps = await this.prisma.vacation.findFirst({
      where: {
        workspaceId,
        employeeId,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
      select: { id: true },
    });

    if (overlaps) {
      throw new BadRequestException('VACATION_OVERLAP_NOT_ALLOWED');
    }
  }

  async create(workspaceId: string, dto: CreateVacationDto) {
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    this.ensureDateRange(startDate, endDate);

    await this.ensureEmployeeExistsForWorkspaceOwner(workspaceId, dto.employeeId);

    await this.ensureNoOverlap(workspaceId, dto.employeeId, startDate, endDate);

    return this.prisma.vacation.create({
      data: {
        workspaceId,
        employeeId: dto.employeeId,
        startDate,
        endDate,
        type: dto.type ?? 'vacation',
        note: dto.note,
      },
      include: {
        employee: {
          include: { role: true },
        },
      },
    });
  }

  findAll(workspaceId: string) {
    return this.prisma.vacation.findMany({
      where: { workspaceId },
      include: {
        employee: {
          include: { role: true },
        },
      },
      orderBy: { startDate: 'asc' },
    });
  }

  async findOne(workspaceId: string, id: string) {
    const vacation = await this.prisma.vacation.findFirst({
      where: { id, workspaceId },
      include: {
        employee: {
          include: { role: true },
        },
      },
    });

    if (!vacation) {
      throw new NotFoundException(ErrorCode.VACATION_NOT_FOUND);
    }

    return vacation;
  }

  async update(workspaceId: string, id: string, dto: UpdateVacationDto) {
    const existing = await this.findOne(workspaceId, id);
    const nextStart = dto.startDate ? new Date(dto.startDate) : existing.startDate;
    const nextEnd = dto.endDate ? new Date(dto.endDate) : existing.endDate;
    const nextEmployeeId = dto.employeeId ?? existing.employeeId;

    await this.ensureEmployeeExistsForWorkspaceOwner(workspaceId, nextEmployeeId);

    this.ensureDateRange(nextStart, nextEnd);
    await this.ensureNoOverlap(workspaceId, nextEmployeeId, nextStart, nextEnd, id);

    return this.prisma.vacation.update({
      where: { id },
      data: {
        employeeId: dto.employeeId,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        type: dto.type,
        note: dto.note,
      },
      include: {
        employee: {
          include: { role: true },
        },
      },
    });
  }

  async remove(workspaceId: string, id: string) {
    await this.findOne(workspaceId, id);
    return this.prisma.vacation.delete({ where: { id } });
  }
}
