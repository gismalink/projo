import { Injectable, NotFoundException } from '@nestjs/common';
import { DEFAULT_ROLE_COLOR_HEX } from '../common/app-constants';
import { ErrorCode } from '../common/error-codes';
import { PrismaService } from '../common/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureDefaultRoles() {
    const defaults = [
      { name: 'ADMIN', shortName: 'ADMIN', description: 'System administrator', level: 1, colorHex: DEFAULT_ROLE_COLOR_HEX },
      { name: 'PM', shortName: 'PM', description: 'Project manager', level: 2, colorHex: DEFAULT_ROLE_COLOR_HEX },
      { name: 'VIEWER', shortName: 'VIEW', description: 'Read-only user', level: 3, colorHex: DEFAULT_ROLE_COLOR_HEX },
      { name: 'FINANCE', shortName: 'FIN', description: 'Finance visibility role', level: 3, colorHex: DEFAULT_ROLE_COLOR_HEX },
      { name: 'UNITY_DEVELOPER', shortName: 'UNITY', description: 'Unity developer', level: 3, colorHex: '#9B8AFB' },
      { name: 'UI_DESIGNER', shortName: 'UI', description: 'UI designer', level: 3, colorHex: '#46B7D6' },
      { name: 'UX_DESIGNER', shortName: 'UX', description: 'UX designer', level: 3, colorHex: '#31B28D' },
      { name: 'BACKEND_DEVELOPER', shortName: 'BACK', description: 'Backend developer', level: 3, colorHex: '#5B8DEF' },
      { name: 'FRONTEND_DEVELOPER', shortName: 'FRONT', description: 'Frontend developer', level: 3, colorHex: '#4C9F70' },
      { name: 'ARTIST_3D', shortName: '3DART', description: '3D artist', level: 3, colorHex: '#C178E8' },
      { name: 'ANALYST', shortName: 'ANLST', description: 'Business/system analyst', level: 3, colorHex: '#E6A23C' },
      { name: 'QA_ENGINEER', shortName: 'QA', description: 'QA test engineer', level: 3, colorHex: '#F06A8A' },
    ];

    await Promise.all(
      defaults.map((role) =>
        this.prisma.role.upsert({
          where: { name: role.name },
          update: {
            colorHex: role.colorHex,
            shortName: role.shortName,
          },
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
      throw new NotFoundException(ErrorCode.ROLE_NOT_FOUND);
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
