import { Injectable } from '@nestjs/common';
import { AppRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureBootstrapAdmin() {
    const bootstrapEmail = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim();
    const bootstrapPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD;
    const legacyBootstrapPassword = process.env.LEGACY_BOOTSTRAP_ADMIN_PASSWORD;

    if (!bootstrapEmail || !bootstrapPassword) {
      return null;
    }

    const existing = await this.prisma.user.findUnique({
      where: { email: bootstrapEmail },
    });

    if (existing) {
      if (legacyBootstrapPassword) {
        const isLegacyPassword = await bcrypt.compare(legacyBootstrapPassword, existing.passwordHash);
        if (isLegacyPassword) {
          const passwordHash = await bcrypt.hash(bootstrapPassword, 10);
          return this.prisma.user.update({
            where: { id: existing.id },
            data: { passwordHash },
          });
        }
      }
      return existing;
    }

    const passwordHash = await bcrypt.hash(bootstrapPassword, 10);
    return this.prisma.user.create({
      data: {
        email: bootstrapEmail,
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
