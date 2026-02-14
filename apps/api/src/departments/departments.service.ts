import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureDefaultDepartments() {
    const defaults = [
      { name: 'Production', description: 'Development and art production' },
      { name: 'Design', description: 'UI/UX design' },
      { name: 'QA', description: 'Testing and quality assurance' },
      { name: 'Analytics', description: 'Business and product analytics' },
      { name: 'Management', description: 'PM and operational management' },
    ];

    await Promise.all(
      defaults.map((department) =>
        this.prisma.department.upsert({
          where: { name: department.name },
          update: {},
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
      throw new NotFoundException('Department not found');
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
