import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ErrorCode } from '../common/error-codes';
import { PrismaService } from '../common/prisma.service';
import { CreateVacationDto } from './dto/create-vacation.dto';
import { UpdateVacationDto } from './dto/update-vacation.dto';

@Injectable()
export class VacationsService {
  constructor(private readonly prisma: PrismaService) {}

  private ensureDateRange(startDate: Date, endDate: Date) {
    if (endDate < startDate) {
      throw new BadRequestException(ErrorCode.VACATION_DATE_RANGE_INVALID);
    }
  }

  private async ensureNoOverlap(employeeId: string, startDate: Date, endDate: Date, excludeId?: string) {
    const overlaps = await this.prisma.vacation.findFirst({
      where: {
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

  async create(dto: CreateVacationDto) {
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    this.ensureDateRange(startDate, endDate);

    const employee = await this.prisma.employee.findUnique({ where: { id: dto.employeeId } });
    if (!employee) {
      throw new NotFoundException(ErrorCode.EMPLOYEE_NOT_FOUND);
    }

    await this.ensureNoOverlap(dto.employeeId, startDate, endDate);

    return this.prisma.vacation.create({
      data: {
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

  findAll() {
    return this.prisma.vacation.findMany({
      include: {
        employee: {
          include: { role: true },
        },
      },
      orderBy: { startDate: 'asc' },
    });
  }

  async findOne(id: string) {
    const vacation = await this.prisma.vacation.findUnique({
      where: { id },
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

  async update(id: string, dto: UpdateVacationDto) {
    const existing = await this.findOne(id);
    const nextStart = dto.startDate ? new Date(dto.startDate) : existing.startDate;
    const nextEnd = dto.endDate ? new Date(dto.endDate) : existing.endDate;
    const nextEmployeeId = dto.employeeId ?? existing.employeeId;
    this.ensureDateRange(nextStart, nextEnd);
    await this.ensureNoOverlap(nextEmployeeId, nextStart, nextEnd, id);

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

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.vacation.delete({ where: { id } });
  }
}
