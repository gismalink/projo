import { Injectable, NotFoundException } from '@nestjs/common';
import { ErrorCode } from '../common/error-codes';
import { PrismaService } from '../common/prisma.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureDefaultDepartments() {
    const defaults = [
      { name: 'Production', description: 'Development and art production', colorHex: '#7A8A9A' },
      { name: 'Design', description: 'UI/UX design', colorHex: '#9B7BFF' },
      { name: 'QA', description: 'Testing and quality assurance', colorHex: '#38A169' },
      { name: 'Analytics', description: 'Business and product analytics', colorHex: '#D69E2E' },
      { name: 'Management', description: 'PM and operational management', colorHex: '#E76F51' },
    ];

    await Promise.all(
      defaults.map((department) =>
        this.prisma.department.upsert({
          where: { name: department.name },
          update: {
            colorHex: department.colorHex,
          },
          create: department,
        }),
      ),
    );
  }

  create(dto: CreateDepartmentDto) {
    return this.prisma.department.create({ data: dto });
  }

  findAll() {
    return this.prisma.department.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { employees: true },
        },
      },
    });
  }

  async findOne(id: string) {
    const department = await this.prisma.department.findUnique({ where: { id } });
    if (!department) {
      throw new NotFoundException(ErrorCode.DEPARTMENT_NOT_FOUND);
    }
    return department;
  }

  async update(id: string, dto: UpdateDepartmentDto) {
    await this.findOne(id);
    return this.prisma.department.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.department.delete({ where: { id } });
  }
}
