import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AppRoleValue } from '../common/decorators/roles.decorator';
import { ErrorCode } from '../common/error-codes';
import { UsersService } from '../users/users.service';
import { parseJwtSecretMap } from './jwt-secrets';
import * as bcrypt from 'bcrypt';

type JwtPayload = {
  sub: string;
  email?: string | null;
  role?: AppRoleValue | string;
  workspaceId?: string;
  username?: string;
  displayName?: string;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    const jwtSecretMap = parseJwtSecretMap(
      configService.get<string>('JWT_SECRETS'),
      configService.get<string>('MYSECTER') || configService.get<string>('JWT_ACCESS_SECRET') || '',
    );
    const allowedIssuersRaw =
      configService.get<string>('JWT_ALLOWED_ISSUERS') || configService.get<string>('JWT_ISSUER') || '';
    const allowedIssuers = new Set(
      allowedIssuersRaw
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    );

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      issuer: allowedIssuers.size > 0 ? Array.from(allowedIssuers) : undefined,
      secretOrKeyProvider: (_req, rawJwtToken, done) => {
        try {
          // passport-jwt does its own verification after this callback; we only select the key.
          const header = JSON.parse(
            Buffer.from(String(rawJwtToken).split('.')[0] || '', 'base64url').toString('utf8') || '{}',
          ) as { kid?: unknown };
          const kid = typeof header.kid === 'string' ? header.kid : '';

          if (kid && jwtSecretMap.has(kid)) {
            return done(null, jwtSecretMap.get(kid) as string);
          }

          // Legacy: projo tokens without `kid`.
          const legacySecret = configService.get<string>('JWT_ACCESS_SECRET');
          if (legacySecret) {
            return done(null, legacySecret);
          }

          // Fallback: first configured key.
          const first = jwtSecretMap.values().next().value as string | undefined;
          return done(null, first || '');
        } catch (error) {
          return done(error as Error, '');
        }
      },
    });
  }

  async validate(payload: JwtPayload) {
    const tokenEmail = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
    const tokenSub = typeof payload.sub === 'string' ? payload.sub : '';

    let context = tokenEmail ? await this.usersService.resolveAuthContextByEmail(tokenEmail) : null;
    if (!context && tokenSub) {
      context = await this.usersService.resolveAuthContextByUserId(tokenSub);
    }

    if (!context) {
      const shouldAutoProvision = String(this.configService.get<string>('SSO_AUTO_PROVISION') || '').toLowerCase() === 'true';
      if (!shouldAutoProvision || !tokenEmail) {
        throw new ForbiddenException(ErrorCode.AUTH_USER_NOT_FOUND);
      }

      const fullNameCandidate =
        (typeof payload.displayName === 'string' && payload.displayName.trim()) ||
        (typeof payload.username === 'string' && payload.username.trim()) ||
        tokenEmail.split('@')[0] ||
        'New user';

      const tokenRole = typeof payload.role === 'string' ? payload.role.toLowerCase() : '';
      const appRole = tokenRole === 'admin' ? 'ADMIN' : 'VIEWER';

      const randomPasswordHash = await bcrypt.hash(`sso-${tokenSub || tokenEmail}-${Date.now()}`, 10);
      await this.usersService.createUser({
        email: tokenEmail,
        fullName: fullNameCandidate.slice(0, 120),
        passwordHash: randomPasswordHash,
        appRole: appRole as any,
      });

      context = await this.usersService.resolveAuthContextByEmail(tokenEmail);
    }

    if (!context) {
      throw new ForbiddenException(ErrorCode.AUTH_USER_NOT_FOUND);
    }

    return {
      userId: context.user.id,
      email: context.user.email,
      role: context.workspaceRole,
      workspaceId: context.workspaceId,
    };
  }
}

