import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ErrorCode } from '../common/error-codes';
import { PrismaService } from '../common/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

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

  create(dto: CreateProjectDto) {
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    this.ensureDateRange(startDate, endDate);

    return this.prisma.project
      .create({
        data: {
          code: dto.code,
          name: dto.name,
          description: dto.description,
          status: dto.status ?? 'planned',
          priority: dto.priority ?? 3,
          startDate,
          endDate,
          links: dto.links ?? [],
        },
      })
      .catch((error) => this.handlePrismaError(error));
  }

  findAll() {
    return this.prisma.project.findMany({
      include: {
        _count: {
          select: { assignments: true },
        },
      },
      orderBy: [{ startDate: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async findOne(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        assignments: {
          include: {
            employee: {
              select: {
                id: true,
                fullName: true,
                email: true,
                role: { select: { name: true } },
              },
            },
          },
          orderBy: { assignmentStartDate: 'asc' },
        },
      },
    });

    if (!project) {
      throw new NotFoundException(ErrorCode.PROJECT_NOT_FOUND);
    }

    return project;
  }

  async update(id: string, dto: UpdateProjectDto) {
    await this.findOne(id);

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
        },
      })
      .catch((error) => this.handlePrismaError(error));
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.project.delete({ where: { id } });
  }
}
