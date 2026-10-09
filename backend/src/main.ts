import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Den Den API')
    .setDescription('Privacy-focused E2E encrypted messaging backend')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth', 'Authentication')
    .addTag('users', 'User management')
    .addTag('devices', 'Device registration & keys')
    .addTag('conversations', 'Conversation metadata')
    .addTag('messages', 'Message relay')
    .addTag('sync', 'Offline synchronization')
    .addTag('notifications', 'Push notifications')
    .addTag('health', 'Health checks')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 Den Den Backend running on http://localhost:${port}`);
  console.log(`📚 API docs at http://localhost:${port}/docs`);
}

bootstrap();