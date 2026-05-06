import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { ValidationPipe } from '@nestjs/common';
import type { CustomOrigin } from '@nestjs/common/interfaces/external/cors-options.interface';
import type { RequestHandler } from 'express';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';

const createCookieParser = cookieParser as unknown as () => RequestHandler;

function normalizeOrigin(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const prisma = app.get(PrismaService);
  const allowedOrigins = new Set(
    [
      process.env.PUBLIC_APP_URL ?? 'http://localhost:5173',
      process.env.PUBLIC_ADMIN_URL ?? 'http://localhost:3001',
      'http://127.0.0.1:5173',
      'http://localhost:5173',
      'http://127.0.0.1:3001',
      'http://localhost:3001',
    ]
      .map(normalizeOrigin)
      .filter((origin): origin is string => origin !== null),
  );
  let cachedPublicOrigin: { value: string | null; refreshAfter: number } = {
    value: null,
    refreshAfter: 0,
  };

  async function getConfiguredPublicOrigin(): Promise<string | null> {
    if (Date.now() < cachedPublicOrigin.refreshAfter) {
      return cachedPublicOrigin.value;
    }

    const settings = await prisma.instanceSetting.findUnique({
      where: { singletonKey: 'default' },
      select: { publicOrigin: true },
    });
    cachedPublicOrigin = {
      value: normalizeOrigin(settings?.publicOrigin),
      refreshAfter: Date.now() + 5_000,
    };
    return cachedPublicOrigin.value;
  }

  const corsOrigin: CustomOrigin = (requestOrigin, callback) => {
    const normalizedRequestOrigin = normalizeOrigin(requestOrigin);
    if (!requestOrigin || !normalizedRequestOrigin) {
      callback(null, requestOrigin ? false : true);
      return;
    }

    if (allowedOrigins.has(normalizedRequestOrigin)) {
      callback(null, requestOrigin);
      return;
    }

    void getConfiguredPublicOrigin()
      .then((configuredOrigin) => {
        callback(
          null,
          configuredOrigin === normalizedRequestOrigin ? requestOrigin : false,
        );
      })
      .catch(() => callback(null, false));
  };

  app.enableCors({
    origin: corsOrigin,
    credentials: true,
  });
  app.use(createCookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  await app.listen(process.env.API_PORT ?? process.env.PORT ?? 3000);
}
void bootstrap();
