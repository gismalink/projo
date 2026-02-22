import type { JwtModuleOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { parseJwtSecretMap } from './jwt-secrets';

export function resolveJwtConfig(configService: ConfigService): JwtModuleOptions {
  const jwtSecretMap = parseJwtSecretMap(
    configService.get<string>('JWT_SECRETS'),
    configService.get<string>('MYSECTER') || configService.get<string>('JWT_ACCESS_SECRET') || '',
  );
  const activeKid = configService.get<string>('JWT_ACTIVE_KID') || Array.from(jwtSecretMap.keys())[0] || 'legacy-v1';
  const activeSecret = jwtSecretMap.get(activeKid) || configService.get<string>('JWT_ACCESS_SECRET') || '';
  const issuer = configService.get<string>('JWT_ISSUER');

  const expiresIn = '1h' as const;

  return {
    secret: activeSecret,
    signOptions: {
      expiresIn,
      ...(issuer ? { issuer } : {}),
      ...(activeKid ? { header: { kid: activeKid, alg: 'HS256' } } : {}),
    },
  };
}
