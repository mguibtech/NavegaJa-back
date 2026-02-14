import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Request, Response, NextFunction } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS
  app.enableCors({ origin: '*' });

  // Logger de requisições
  app.use((req: Request, res: Response, next: NextFunction) => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`\n📥 ${req.method} ${req.url} - ${timestamp}`);
    console.log('   Origin:', req.headers.origin || 'não informado');
    console.log('   User-Agent:', req.headers['user-agent'] || 'não informado');
    if (req.body && Object.keys(req.body).length > 0) {
      console.log('   Body:', JSON.stringify(req.body, null, 2));
    }

    // Log da resposta
    const originalSend = res.send;
    res.send = function(data: any) {
      console.log(`📤 Response ${req.method} ${req.url} - Status: ${res.statusCode}`);
      return originalSend.call(this, data);
    };

    next();
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('NavegaJá API')
    .setDescription('API do NavegaJá - Transporte Fluvial sob Demanda')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(3000);
  console.log('🚤 NavegaJá API rodando em http://localhost:3000');
  console.log('📚 Swagger docs em http://localhost:3000/api/docs');
}
bootstrap();
