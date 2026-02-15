import { Injectable, NotFoundException } from '@nestjs/common';
import { ErrorCode } from '../common/error-codes';
import { PrismaService } from '../common/prisma.service';
import { CreateGradeDto } from './dto/create-grade.dto';
import { UpdateGradeDto } from './dto/update-grade.dto';

@Injectable()
export class GradesService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateGradeDto) {
    const trimmedName = dto.name.trim();
    return this.prisma.grade.create({
      data: {
        name: trimmedName,
        colorHex: dto.colorHex,
      },
    });
  }

  findAll() {
    return this.prisma.grade.findMany({
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(id: string) {
    const grade = await this.prisma.grade.findUnique({ where: { id } });
    if (!grade) {
      throw new NotFoundException(ErrorCode.GRADE_NOT_FOUND);
    }
    return grade;
  }

  async update(id: string, dto: UpdateGradeDto) {
    const grade = await this.findOne(id);
    const nextName = dto.name?.trim();
    const resolvedName = nextName || grade.name;
    const resolvedColor = dto.colorHex ?? grade.colorHex;
    if (resolvedName === grade.name && resolvedColor === grade.colorHex) {
      return grade;
    }

    return this.prisma.$transaction(async (tx) => {
      if (resolvedName !== grade.name) {
        await tx.employee.updateMany({
          where: { grade: grade.name },
          data: { grade: resolvedName },
        });
      }

      return tx.grade.update({
        where: { id },
        data: {
          name: resolvedName,
          colorHex: resolvedColor,
        },
      });
    });
  }

  async remove(id: string) {
    const grade = await this.findOne(id);

    await this.prisma.$transaction(async (tx) => {
      await tx.employee.updateMany({
        where: { grade: grade.name },
        data: { grade: null },
      });

      await tx.grade.delete({ where: { id } });
    });

    return { ok: true };
  }
}
