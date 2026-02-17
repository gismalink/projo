import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ErrorCode } from '../common/error-codes';
import { PrismaService } from '../common/prisma.service';
import { CreateCostRateDto } from './dto/create-cost-rate.dto';
import { UpdateCostRateDto } from './dto/update-cost-rate.dto';

@Injectable()
export class CostRatesService {
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

  private ensureScope(dto: { employeeId?: string; roleId?: string }) {
    if (!dto.employeeId && !dto.roleId) {
      throw new BadRequestException(ErrorCode.COST_RATE_SCOPE_REQUIRED);
    }
  }

  private ensureDateRange(validFrom: Date, validTo?: Date) {
    if (validTo && validTo < validFrom) {
      throw new BadRequestException(ErrorCode.COST_RATE_DATE_RANGE_INVALID);
    }
  }

  private async ensureTargetsExist(workspaceId: string, dto: { employeeId?: string; roleId?: string }) {
    if (dto.employeeId) {
      const ownerUserId = await this.getWorkspaceOwnerUserId(workspaceId);
      const employee = await this.prisma.employee.findFirst({
        where: {
          id: dto.employeeId,
          workspace: {
            ownerUserId,
          },
        },
        select: { id: true },
      });
      if (!employee) throw new NotFoundException(ErrorCode.EMPLOYEE_NOT_FOUND);
    }
    if (dto.roleId) {
      const role = await this.prisma.role.findUnique({ where: { id: dto.roleId }, select: { id: true } });
      if (!role) throw new NotFoundException(ErrorCode.ROLE_NOT_FOUND);
    }
  }

  async create(workspaceId: string, dto: CreateCostRateDto) {
    this.ensureScope(dto);
    const validFrom = new Date(dto.validFrom);
    const validTo = dto.validTo ? new Date(dto.validTo) : undefined;
    this.ensureDateRange(validFrom, validTo);
    await this.ensureTargetsExist(workspaceId, dto);

    return this.prisma.costRate.create({
      data: {
        workspaceId,
        employeeId: dto.employeeId,
        roleId: dto.roleId,
        amountPerHour: dto.amountPerHour,
        currency: dto.currency ?? 'USD',
        validFrom,
        validTo,
      },
      include: {
        employee: { select: { id: true, fullName: true } },
        role: { select: { id: true, name: true } },
      },
    });
  }

  findAll(workspaceId: string) {
    return this.prisma.costRate.findMany({
      where: { workspaceId },
      include: {
        employee: { select: { id: true, fullName: true } },
        role: { select: { id: true, name: true } },
      },
      orderBy: [{ validFrom: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async findOne(workspaceId: string, id: string) {
    const row = await this.prisma.costRate.findFirst({
      where: { id, workspaceId },
      include: {
        employee: { select: { id: true, fullName: true } },
        role: { select: { id: true, name: true } },
      },
    });
    if (!row) throw new NotFoundException(ErrorCode.COST_RATE_NOT_FOUND);
    return row;
  }

  async update(workspaceId: string, id: string, dto: UpdateCostRateDto) {
    const existing = await this.findOne(workspaceId, id);
    const next = {
      employeeId: dto.employeeId ?? existing.employeeId ?? undefined,
      roleId: dto.roleId ?? existing.roleId ?? undefined,
    };
    this.ensureScope(next);
    await this.ensureTargetsExist(workspaceId, next);

    const nextValidFrom = dto.validFrom ? new Date(dto.validFrom) : existing.validFrom;
    const nextValidTo =
      dto.validTo !== undefined ? (dto.validTo ? new Date(dto.validTo) : undefined) : (existing.validTo ?? undefined);
    this.ensureDateRange(nextValidFrom, nextValidTo);

    return this.prisma.costRate.update({
      where: { id },
      data: {
        employeeId: dto.employeeId,
        roleId: dto.roleId,
        amountPerHour: dto.amountPerHour,
        currency: dto.currency,
        validFrom: dto.validFrom ? new Date(dto.validFrom) : undefined,
        validTo: dto.validTo !== undefined ? (dto.validTo ? new Date(dto.validTo) : null) : undefined,
      },
      include: {
        employee: { select: { id: true, fullName: true } },
        role: { select: { id: true, name: true } },
      },
    });
  }

  async remove(workspaceId: string, id: string) {
    await this.findOne(workspaceId, id);
    return this.prisma.costRate.delete({ where: { id } });
  }
}
