import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  // Important for correct rate-limiting and logging behind reverse proxies (Caddy/edge).
  // Makes Express derive req.ip from X-Forwarded-For.
  // We trust a single hop proxy in front of the API container.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  const parseAllowedOrigins = (value: string | undefined) => {
    if (!value) {
      return ['http://localhost:5173', 'http://127.0.0.1:5173'];
    }
    return value
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0);
  };

  const allowedOrigins = parseAllowedOrigins(process.env.ALLOWED_ORIGINS);

  const normalizeOriginForLog = (origin: string) => {
    const sanitized = origin.replace(/[\r\n\t]/g, ' ').slice(0, 200).trim();
    return sanitized || '<empty-origin>';
  };

  app.setGlobalPrefix('api');
  const corsOrigin: NonNullable<CorsOptions['origin']> = (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    logger.warn(`CORS denied origin: ${normalizeOriginForLog(origin)}`);
    callback(null, false);
  };

  app.enableCors({
    origin: corsOrigin,
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'Accept', 'Origin', 'X-Requested-With'],
  });
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);
}

void bootstrap();
