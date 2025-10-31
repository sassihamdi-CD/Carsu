/**
 * Purpose: Application bootstrap and global middleware/policies wiring.
 * Usage: Configures helmet, CORS, validation, exception filter, and shutdown hooks.
 * Why: Enforces consistent security and validation across all modules from day one.
 * Notes: Add global interceptors/guards here as needed (e.g., logging, auth).
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import helmet from 'helmet';
import { ValidationPipe } from '@nestjs/common';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();

  app.use(helmet());
  app.enableCors({ origin: true, credentials: true });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  const port = process.env.PORT ? Number(process.env.PORT) : 3000;

  // Swagger setup for API documentation
  const config = new DocumentBuilder()
    .setTitle('Carsu Todo API')
    .setDescription('Multi-tenant collaborative todo API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  await app.listen(port);
}
bootstrap();
