import { BadRequestException, ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { AppRole } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { ErrorCode } from '../common/error-codes';
import { AppRoleValue } from '../common/decorators/roles.decorator';
import { UsersService } from '../users/users.service';

type LoginResponse = {
  accessToken: string;
  user: {
    id: string;
    email: string;
    fullName: string;
    role: string;
    workspaceId: string;
    workspaceRole: string;
  };
};

type AccountUser = {
  id: string;
  email: string;
  fullName: string;
  role: string;
  workspaceId: string;
  workspaceRole: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private mapUser(payload: {
    user: { id: string; email: string; fullName: string; appRole: string };
    workspaceId: string;
    workspaceRole: string;
  }): AccountUser {
    return {
      id: payload.user.id,
      email: payload.user.email,
      fullName: payload.user.fullName,
      role: payload.user.appRole,
      workspaceId: payload.workspaceId,
      workspaceRole: payload.workspaceRole,
    };
  }

  private async issueAccessToken(payload: {
    user: { id: string; email: string; appRole: string };
    workspaceId: string;
    workspaceRole: string;
  }) {
    const role = payload.workspaceRole as unknown as AppRoleValue;
    return this.jwtService.signAsync({
      sub: payload.user.id,
      email: payload.user.email,
      role,
      workspaceId: payload.workspaceId,
    });
  }

  async login(email: string, password: string): Promise<LoginResponse> {
    const context = await this.usersService.resolveAuthContextByEmail(this.normalizeEmail(email));
    if (!context) {
      throw new UnauthorizedException(ErrorCode.AUTH_INVALID_CREDENTIALS);
    }

    const isValid = await bcrypt.compare(password, context.user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException(ErrorCode.AUTH_INVALID_CREDENTIALS);
    }

    const accessToken = await this.issueAccessToken({
      user: context.user,
      workspaceId: context.workspaceId,
      workspaceRole: context.workspaceRole,
    });

    return {
      accessToken,
      user: this.mapUser({
        user: context.user,
        workspaceId: context.workspaceId,
        workspaceRole: context.workspaceRole,
      }),
    };
  }

  async register(email: string, fullName: string, password: string): Promise<LoginResponse> {
    const normalizedEmail = this.normalizeEmail(email);
    const existing = await this.usersService.findByEmail(normalizedEmail);
    if (existing) {
      throw new ConflictException(ErrorCode.AUTH_EMAIL_ALREADY_EXISTS);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const created = await this.usersService.createUser({
      email: normalizedEmail,
      fullName,
      passwordHash,
      appRole: AppRole.VIEWER,
    });

    const context = await this.usersService.resolveAuthContextByUserId(created.id);
    if (!context) {
      throw new NotFoundException(ErrorCode.AUTH_USER_NOT_FOUND);
    }

    const accessToken = await this.issueAccessToken({
      user: context.user,
      workspaceId: context.workspaceId,
      workspaceRole: context.workspaceRole,
    });

    return {
      accessToken,
      user: this.mapUser({
        user: context.user,
        workspaceId: context.workspaceId,
        workspaceRole: context.workspaceRole,
      }),
    };
  }

  async getMe(userId: string): Promise<AccountUser> {
    const context = await this.usersService.resolveAuthContextByUserId(userId);
    if (!context) {
      throw new NotFoundException(ErrorCode.AUTH_USER_NOT_FOUND);
    }

    return this.mapUser({
      user: context.user,
      workspaceId: context.workspaceId,
      workspaceRole: context.workspaceRole,
    });
  }

  async updateMe(userId: string, fullName: string): Promise<AccountUser> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException(ErrorCode.AUTH_USER_NOT_FOUND);
    }
    const updated = await this.usersService.updateProfile(userId, { fullName });

    const context = await this.usersService.resolveAuthContextByUserId(updated.id);
    if (!context) {
      throw new NotFoundException(ErrorCode.AUTH_USER_NOT_FOUND);
    }

    return this.mapUser({
      user: context.user,
      workspaceId: context.workspaceId,
      workspaceRole: context.workspaceRole,
    });
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException(ErrorCode.AUTH_USER_NOT_FOUND);
    }

    const isCurrentValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isCurrentValid) {
      throw new UnauthorizedException(ErrorCode.AUTH_PASSWORD_INVALID);
    }

    const isSamePassword = await bcrypt.compare(newPassword, user.passwordHash);
    if (isSamePassword) {
      throw new BadRequestException(ErrorCode.AUTH_PASSWORD_SAME_AS_OLD);
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.usersService.updatePasswordHash(userId, passwordHash);

    return { success: true };
  }

  logout() {
    return { success: true };
  }
}
