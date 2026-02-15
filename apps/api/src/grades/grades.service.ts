import { Injectable, NotFoundException } from '@nestjs/common';
import { ErrorCode } from '../common/error-codes';
import { PrismaService } from '../common/prisma.service';
import { CreateGradeDto } from './dto/create-grade.dto';
import { UpdateGradeDto } from './dto/update-grade.dto';

@Injectable()
export class GradesService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureDefaultGrades() {
    const defaults = ['джу', 'джун+', 'мидл', 'мидл+', 'синьйор', 'синьйор+', 'лид', 'рук-отдела'];
    await Promise.all(
      defaults.map((name) =>
        this.prisma.grade.upsert({
          where: { name },
          update: {},
          create: { name },
        }),
      ),
    );
  }

  create(dto: CreateGradeDto) {
    return this.prisma.grade.create({
      data: {
        name: dto.name.trim(),
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
    if (!nextName || nextName === grade.name) {
      return grade;
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.employee.updateMany({
        where: { grade: grade.name },
        data: { grade: nextName },
      });

      return tx.grade.update({
        where: { id },
        data: { name: nextName },
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
