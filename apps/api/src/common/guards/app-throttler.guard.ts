import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { createHash } from 'crypto';

type RequestLike = {
  headers?: Record<string, unknown>;
  ip?: string;
  connection?: { remoteAddress?: string | null };
};

@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: RequestLike): Promise<string> {
    const authHeader = String(req.headers?.authorization ?? req.headers?.Authorization ?? '').trim();
    const bearer = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : '';

    if (bearer) {
      const tokenHash = createHash('sha256').update(bearer).digest('hex').slice(0, 16);
      return `token:${tokenHash}`;
    }

    const xff = String(req.headers?.['x-forwarded-for'] ?? req.headers?.['X-Forwarded-For'] ?? '').trim();
    const forwardedIp = xff ? xff.split(',')[0]?.trim() : '';
    const ip = forwardedIp || req.ip || req.connection?.remoteAddress || 'unknown';
    return `ip:${ip}`;
  }
}
