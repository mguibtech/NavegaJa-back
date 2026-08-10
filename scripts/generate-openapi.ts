/* eslint-disable no-console */
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';

/**
 * Escreve o contrato da API em openapi.json, para que o app gere os tipos a
 * partir dele em vez de escrevê-los de memória.
 *
 * Existe porque um testador em Tapauá encontrou o app lendo `label`, `cidade`
 * e `uf` de uma resposta que sempre falou `display`, `city` e `state`. Nada
 * quebrou no build: TypeScript aceita `undefined` de campo que não existe, e o
 * defeito só apareceu na tela de um usuário, meses depois.
 *
 * ── Por que não conecta no banco ──────────────────────────────────────────
 *
 * A versão anterior subia a aplicação de verdade e, com isso, exigia Postgres
 * de pé. Isso soa inofensivo e não é: transformou "gerar o contrato" num ritual
 * com pré-requisito, e o resultado foi que ninguém rodou. O openapi.json nunca
 * existiu no repositório, o `yarn types:api` do app nunca produziu nada, e os
 * tipos continuaram sendo escritos à mão — que é exatamente o problema que este
 * script deveria resolver.
 *
 * O documento OpenAPI vem dos decoradores dos controllers e DTOs. O banco não
 * participa. Trocando NestFactory pelo módulo de teste, dá para substituir o
 * DataSource por um dublê e montar a aplicação sem conexão nenhuma — o contrato
 * gerado é idêntico, e agora qualquer pessoa (ou o CI) roda o comando.
 */

/**
 * Dublê do DataSource. Só precisa responder ao que o TypeOrmModule consulta
 * enquanto monta os providers de repositório; nada aqui executa consulta.
 */
const dataSourceFalso = {
  // O @nestjs/typeorm percorre entityMetadatas ao montar cada repositório
  // (typeorm.providers.js). Vazio basta: sem metadado, ele trata a entidade
  // como não-árvore e chama getRepository, que devolve o dublê abaixo.
  entityMetadatas: [] as unknown[],
  getRepository: () => repositorioFalso,
  getTreeRepository: () => repositorioFalso,
  getMongoRepository: () => repositorioFalso,
  getMetadata: () => ({ columns: [], relations: [] }),
  createQueryRunner: () => ({
    connect: async () => {},
    release: async () => {},
  }),
  options: { type: 'postgres' },
  isInitialized: true,
  destroy: async () => {},
} as unknown;

/**
 * Repositório-dublê. Serviços recebem isto no construtor, mas nenhum método é
 * chamado: gerar o documento OpenAPI só lê decoradores, não executa regra.
 */
const repositorioFalso = {
  find: async () => [],
  findOne: async () => null,
  createQueryBuilder: () => ({
    where: () => repositorioFalso.createQueryBuilder(),
    andWhere: () => repositorioFalso.createQueryBuilder(),
    getCount: async () => 0,
    getMany: async () => [],
  }),
  metadata: { columns: [], relations: [] },
};

/**
 * O AuthModule exige os segredos de JWT para montar. Eles não entram no
 * documento — só precisam existir para o módulo instanciar. Valores
 * propositalmente ridículos, para ninguém confundir com segredo de verdade, e
 * definidos com ||= para nunca sobrescrever o ambiente real de quem rodar isto
 * com um .env carregado.
 */
function preencherSegredosDeMentira() {
  process.env.JWT_ACCESS_SECRET ||= 'apenas-para-gerar-o-contrato';
  process.env.JWT_REFRESH_SECRET ||= 'apenas-para-gerar-o-contrato';
  process.env.NODE_ENV ||= 'development';
}

async function generate() {
  preencherSegredosDeMentira();

  // Carregado aqui dentro, e não no topo: o AppModule lê variáveis de ambiente
  // na carga, então precisa vir depois de preenchê-las. É `require` e não
  // `import()` porque o ts-node roda em CommonJS — o import dinâmico seria
  // tratado como ESM e não acharia o módulo.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { AppModule } = require('../src/app.module') as typeof import('../src/app.module');

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(getDataSourceToken())
    .useValue(dataSourceFalso)
    .compile();

  const app = moduleRef.createNestApplication({ logger: false });
  await app.init();

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

  if (paths.length === 0 || schemas.length === 0) {
    console.error(
      'Contrato vazio — algo impediu os controllers de serem registrados.',
    );
    process.exit(1);
  }

  await app.close();
}

generate().catch((error) => {
  console.error('Falha ao gerar o openapi.json:', error);
  process.exit(1);
});
