import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Prefixo global de rotas da API
  app.setGlobalPrefix('api');

  // Habilitação de CORS para integração com o frontend Next.js
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Validação estrita de DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Configuração do Swagger OpenAPI 3.0
  const swaggerConfig = new DocumentBuilder()
    .setTitle('RunManager API')
    .setDescription(
      'Documentação interativa da API REST da Plataforma RunManager - Gestão de Eventos Esportivos e Credenciamento na Arena (ULBRA ADS)',
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Insira o token JWT de autenticação',
        in: 'header',
      },
      'JWT-auth',
    )
    .addTag('Status', 'Operações de verificação e saúde da API')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ?? 3001;
  await app.listen(port);

  logger.log(`🚀 Aplicação RunManager Backend executando na porta ${port}`);
  logger.log(`📚 Documentação Swagger disponível em: http://localhost:${port}/api/docs`);
}

void bootstrap();
