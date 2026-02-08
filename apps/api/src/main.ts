import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Azeroth Dashboard API')
    .setDescription('Admin & monitoring API for AzerothCore private servers')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);
  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:7790',
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Simple health check for orchestration tools (outside of global prefix)
  const express = app.getHttpAdapter().getInstance();
  express.get(
    '/health',
    (_req: unknown, res: { json: (body: unknown) => void }) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    },
  );

  await app.listen(process.env.PORT ?? 7791, '0.0.0.0');
}
bootstrap();
