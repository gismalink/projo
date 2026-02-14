import { Injectable } from '@nestjs/common';
import { AppRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../common/prisma.service';

const LEGACY_BOOTSTRAP_PASSWORD = 'admin12345';
const BOOTSTRAP_PASSWORD = 'ProjoAdmin!2026';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureBootstrapAdmin() {
    const existing = await this.prisma.user.findUnique({
      where: { email: 'admin@projo.local' },
    });

    if (existing) {
      const isLegacyPassword = await bcrypt.compare(LEGACY_BOOTSTRAP_PASSWORD, existing.passwordHash);
      if (isLegacyPassword) {
        const passwordHash = await bcrypt.hash(BOOTSTRAP_PASSWORD, 10);
        return this.prisma.user.update({
          where: { id: existing.id },
          data: { passwordHash },
        });
      }
      return existing;
    }

    const passwordHash = await bcrypt.hash(BOOTSTRAP_PASSWORD, 10);
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
