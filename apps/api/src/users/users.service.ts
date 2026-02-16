import { Injectable } from '@nestjs/common';
import { AppRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  async ensureBootstrapAdmin() {
    const bootstrapEmailRaw = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim();
    const bootstrapPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD;
    const legacyBootstrapPassword = process.env.LEGACY_BOOTSTRAP_ADMIN_PASSWORD;
    const bootstrapEmail = bootstrapEmailRaw ? this.normalizeEmail(bootstrapEmailRaw) : '';

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
    return this.prisma.user.findUnique({ where: { email: this.normalizeEmail(email) } });
  }

  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async createUser(payload: { email: string; fullName: string; passwordHash: string; appRole?: AppRole }) {
    return this.prisma.user.create({
      data: {
        email: this.normalizeEmail(payload.email),
        fullName: payload.fullName.trim(),
        passwordHash: payload.passwordHash,
        appRole: payload.appRole ?? AppRole.VIEWER,
      },
    });
  }

  async updateProfile(userId: string, payload: { fullName: string }) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        fullName: payload.fullName.trim(),
      },
    });
  }

  async updatePasswordHash(userId: string, passwordHash: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  }
}
