import { Injectable } from '@nestjs/common';
import { AppRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureBootstrapAdmin() {
    const existing = await this.prisma.user.findUnique({
      where: { email: 'admin@projo.local' },
    });

    if (existing) {
      return existing;
    }

    const passwordHash = await bcrypt.hash('admin12345', 10);
    return this.prisma.user.create({
      data: {
        email: 'admin@projo.local',
        fullName: 'System Admin',
        passwordHash,
        appRole: AppRole.ADMIN,
      },
    });
  }

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }
}
