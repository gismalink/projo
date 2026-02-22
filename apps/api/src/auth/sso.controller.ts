import { Controller, Get, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';

type JsonValue = Record<string, unknown> | unknown[] | string | number | boolean | null;

@Controller('sso')
export class SsoController {
  constructor(private readonly configService: ConfigService) {}

  private resolveAuthBaseUrl() {
    const configured = this.configService.get<string>('AUTH_SSO_BASE_URL');
    if (configured) return configured;

    // Safe local default; prod/test should always configure explicitly.
    return 'http://localhost:3000';
  }

  private async proxyGetJson(req: Request, path: string): Promise<{ status: number; json: JsonValue } | { status: number; text: string }> {
    const base = this.resolveAuthBaseUrl().replace(/\/+$/, '');
    const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        cookie: req.headers.cookie || '',
        'user-agent': String(req.headers['user-agent'] || ''),
        accept: 'application/json',
      },
      redirect: 'manual',
    });

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
