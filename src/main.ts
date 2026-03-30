import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NextFunction, Request, Response } from 'express';
import { join } from 'path';
import { AppModule } from './app.module';

const SENSITIVE_LOG_KEYS = new Set([
  'password',
  'passwordhash',
  'pass',
  'token',
  'accesstoken',
  'refreshtoken',
  'authorization',
  'secret',
  'privatekey',
  'pixkey',
  'gatewayref',
]);

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');
  const port = configService.get<number>('PORT', 3000);
  const corsOrigins = configService.get<string[]>('CORS_ORIGINS', [
    'http://localhost:3000',
    'http://localhost:3001',
  ]);
  const swaggerEnabled = configService.get<boolean>('SWAGGER_ENABLED', false);
  const uploadsPublic = configService.get<boolean>('UPLOADS_PUBLIC', false);
  const isDevelopment = nodeEnv !== 'production';
  const isWildcardCors = corsOrigins.includes('*');

  app.enableCors({
    origin: isWildcardCors
      ? true
      : buildCorsOriginChecker(corsOrigins, isDevelopment),
  });

  if (uploadsPublic) {
    app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' });
  }

  if (configService.get<boolean>('HTTP_LOGGING', false)) {
    app.use((req: Request, res: Response, next: NextFunction) => {
      const startedAt = Date.now();
      const route = req.originalUrl || req.url;
      const origin = req.headers.origin || 'not-informed';
      const userAgent = req.headers['user-agent'] || 'not-informed';
      const body = shouldLogBody(req)
        ? sanitizeForLogging(req.body)
        : undefined;

      logger.log(
        `${req.method} ${route} incoming | origin=${origin} | userAgent="${userAgent}"${body ? ` | body=${JSON.stringify(body)}` : ''}`,
      );

      res.on('finish', () => {
        logger.log(
          `${req.method} ${route} completed | status=${res.statusCode} | durationMs=${Date.now() - startedAt}`,
        );
      });

      next();
    });
  }

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  if (swaggerEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('NavegaJa API')
      .setDescription('API do NavegaJa - Transporte Fluvial sob Demanda')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  await app.listen(port);
  logger.log(`NavegaJa API running at http://localhost:${port}`);
  if (swaggerEnabled) {
    logger.log(`Swagger docs available at http://localhost:${port}/api/docs`);
  }
}
void bootstrap();

function shouldLogBody(req: Request): boolean {
  const contentType = req.get('content-type') ?? '';

  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return false;
  }

  if (
    !contentType.match(/application\/json|application\/x-www-form-urlencoded/i)
  ) {
    return false;
  }

  return (
    req.body !== null &&
    typeof req.body === 'object' &&
    Object.keys(req.body as Record<string, unknown>).length > 0
  );
}

function sanitizeForLogging(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForLogging(item));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nested]) => [
        key,
        SENSITIVE_LOG_KEYS.has(key.toLowerCase())
          ? '[REDACTED]'
          : sanitizeForLogging(nested),
      ]),
    );
  }

  return value;
}

type CorsCallback = (error: Error | null, allow?: boolean) => void;

function buildCorsOriginChecker(
  configuredOrigins: string[],
  allowPrivateNetworkOrigins: boolean,
): (origin: string | undefined, callback: CorsCallback) => void {
  const allowedOrigins = new Set(configuredOrigins);

  return (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }

    if (allowedOrigins.has(origin)) {
      callback(null, true);
      return;
    }

    if (allowPrivateNetworkOrigins && isPrivateNetworkOrigin(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`Origin ${origin} is not allowed by CORS`), false);
  };
}

function isPrivateNetworkOrigin(origin: string): boolean {
  let url: URL;

  try {
    url = new URL(origin);
  } catch {
    return false;
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    return false;
  }

  const host = url.hostname.toLowerCase();

  if (host === 'localhost' || host === '127.0.0.1') {
    return true;
  }

  return (
    /^10\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.test(host) ||
    /^192\.168\.(\d{1,3})\.(\d{1,3})$/.test(host) ||
    /^172\.(1[6-9]|2\d|3[0-1])\.(\d{1,3})\.(\d{1,3})$/.test(host)
  );
}
