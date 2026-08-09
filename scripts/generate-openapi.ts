/* eslint-disable no-console */
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from '../src/app.module';

/**
 * Escreve o contrato da API em openapi.json, para que o app gere os tipos a
 * partir dele em vez de escrevê-los de memória.
 *
 * Existe porque um testador em Tapauá encontrou o app lendo `label`, `cidade`
 * e `uf` de uma resposta que sempre falou `display`, `city` e `state`. Nada
 * quebrou no build: TypeScript aceita `undefined` de campo que não existe, e o
 * defeito só apareceu na tela de um usuário, meses depois.
 *
 * Precisa de banco de pé — o Nest monta o documento a partir da aplicação
 * inicializada, não por análise estática. Com o Postgres do Docker rodando,
 * basta `npm run openapi`.
 */
async function generate() {
  const app = await NestFactory.create(AppModule, { logger: false });

  const config = new DocumentBuilder()
    .setTitle('NavegaJa API')
    .setDescription('API do NavegaJa - Transporte Fluvial sob Demanda')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  const outputPath = join(__dirname, '..', 'openapi.json');

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(document, null, 2)}\n`);

  const schemas = Object.keys(document.components?.schemas ?? {});
  const paths = Object.keys(document.paths ?? {});
  console.log(`openapi.json escrito: ${paths.length} rotas, ${schemas.length} schemas`);

  await app.close();
}

generate().catch((error) => {
  console.error('Falha ao gerar o openapi.json:', error);
  process.exit(1);
});
