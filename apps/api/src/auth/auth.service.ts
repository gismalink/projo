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
  };
};

type AccountUser = {
  id: string;
  email: string;
  fullName: string;
  role: string;
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

  private mapUser(user: { id: string; email: string; fullName: string; appRole: string }): AccountUser {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.appRole,
    };
  }

  private async issueAccessToken(user: { id: string; email: string; appRole: string }) {
    const role = user.appRole as unknown as AppRoleValue;
    return this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      role,
    });
  }

  async login(email: string, password: string): Promise<LoginResponse> {
    const user = await this.usersService.findByEmail(this.normalizeEmail(email));
    if (!user) {
      throw new UnauthorizedException(ErrorCode.AUTH_INVALID_CREDENTIALS);
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException(ErrorCode.AUTH_INVALID_CREDENTIALS);
    }

    const accessToken = await this.issueAccessToken(user);

    return {
      accessToken,
      user: this.mapUser(user),
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

    const accessToken = await this.issueAccessToken(created);

    return {
      accessToken,
      user: this.mapUser(created),
    };
  }

  async getMe(userId: string): Promise<AccountUser> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException(ErrorCode.AUTH_USER_NOT_FOUND);
    }
    return this.mapUser(user);
  }

  async updateMe(userId: string, fullName: string): Promise<AccountUser> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException(ErrorCode.AUTH_USER_NOT_FOUND);
    }
    const updated = await this.usersService.updateProfile(userId, { fullName });
    return this.mapUser(updated);
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
