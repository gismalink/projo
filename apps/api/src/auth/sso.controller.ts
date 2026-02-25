import { Controller, Get, Logger, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';

type JsonValue = Record<string, unknown> | unknown[] | string | number | boolean | null;

@Controller('sso')
export class SsoController {
  private readonly logger = new Logger(SsoController.name);

  constructor(private readonly configService: ConfigService) {}

  private resolveAuthBaseUrl() {
    const configured = this.configService.get<string>('AUTH_SSO_BASE_URL');
    if (configured) return configured;

    // Safe local default; prod/test should always configure explicitly.
    return 'http://localhost:3000';
  }

  private resolveTimeoutMs() {
    const configured = Number(this.configService.get<string>('AUTH_SSO_TIMEOUT_MS') ?? '5000');
    if (!Number.isFinite(configured)) return 5000;
    return Math.min(30000, Math.max(1000, configured));
  }

  private async proxyGetJson(req: Request, path: string): Promise<{ status: number; json: JsonValue } | { status: number; text: string }> {
    const base = this.resolveAuthBaseUrl().replace(/\/+$/, '');
    const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;

    let response: globalThis.Response;
    const controller = new AbortController();
    const timeoutMs = this.resolveTimeoutMs();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      response = await fetch(url, {
        method: 'GET',
        headers: {
          cookie: req.headers.cookie || '',
          'user-agent': String(req.headers['user-agent'] || ''),
          accept: 'application/json',
        },
        redirect: 'manual',
        signal: controller.signal,
      });
    } catch (error) {
      const errorName = error instanceof Error ? error.name : 'UnknownError';
      this.logger.warn(`SSO proxy upstream request failed for ${path}: ${errorName}`);
      return {
        status: 503,
        json: {
          error: 'ERR_SSO_UPSTREAM_UNAVAILABLE',
          message: 'SSO upstream is temporarily unavailable',
        },
      };
    } finally {
      clearTimeout(timeout);
    }

    const contentType = response.headers.get('content-type') || '';
    const status = response.status;
    const bodyText = await response.text();

    if (contentType.includes('application/json')) {
      try {
        return { status, json: JSON.parse(bodyText) as JsonValue };
      } catch {
        return { status, text: bodyText };
      }
    }

    return { status, text: bodyText };
  }

  @Get('get-token')
  async getToken(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const proxied = await this.proxyGetJson(req, '/auth/get-token');
    res.status(proxied.status);
    if ('json' in proxied) return proxied.json;
    return { error: proxied.text };
  }

  @Get('current-user')
  async currentUser(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const proxied = await this.proxyGetJson(req, '/auth/current-user');
    res.status(proxied.status);
    if ('json' in proxied) return proxied.json;
    return { error: proxied.text };
  }
}
