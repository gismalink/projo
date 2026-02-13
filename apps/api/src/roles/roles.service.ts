import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureDefaultRoles() {
    const defaults = [
      { name: 'ADMIN', description: 'System administrator', level: 1 },
      { name: 'PM', description: 'Project manager', level: 2 },
      { name: 'VIEWER', description: 'Read-only user', level: 3 },
      { name: 'FINANCE', description: 'Finance visibility role', level: 3 },
      { name: 'UNITY_DEVELOPER', description: 'Unity developer', level: 3 },
      { name: 'UI_DESIGNER', description: 'UI designer', level: 3 },
      { name: 'UX_DESIGNER', description: 'UX designer', level: 3 },
      { name: 'BACKEND_DEVELOPER', description: 'Backend developer', level: 3 },
      { name: 'ANALYST', description: 'Business/system analyst', level: 3 },
      { name: 'QA_ENGINEER', description: 'QA test engineer', level: 3 },
    ];

    await Promise.all(
      defaults.map((role) =>
        this.prisma.role.upsert({
          where: { name: role.name },
          update: {},
          create: role,
        }),
      ),
    );
  }

  create(dto: CreateRoleDto) {
    return this.prisma.role.create({ data: dto });
  }

  findAll() {
    return this.prisma.role.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { employees: true },
        },
      },
    });
  }

  async findOne(id: string) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) {
      throw new NotFoundException('Role not found');
    }
    return role;
  }

  async update(id: string, dto: UpdateRoleDto) {
    await this.findOne(id);
    return this.prisma.role.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.role.delete({ where: { id } });
  }
}
