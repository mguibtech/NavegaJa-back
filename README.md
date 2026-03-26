# NavegaJa Backend

API REST em NestJS para o marketplace de transporte fluvial do NavegaJa. O backend cobre autenticacao, viagens, reservas, encomendas, carga, operacao de capitaes, administracao, notificacoes, pagamentos e servicos auxiliares.

## Stack

- NestJS 11 + TypeScript
- PostgreSQL + TypeORM
- JWT com access token e refresh token
- Swagger em `/api/docs`
- Jest + Supertest para testes unitarios e e2e

## Estado Atual

- Build, lint, testes unitarios e testes e2e configurados no projeto
- Rate limiting global via `@nestjs/throttler`
- Validacao central de ambiente no bootstrap
- CORS e HTTP logging configuraveis por variavel de ambiente
- CI para `main` e pull requests em [`.github/workflows/ci.yml`](/C:/www/softLive/projects/navegaja/backend/.github/workflows/ci.yml)

## Modulos Principais

O backend atual expoe mais do que o conjunto original descrito na documentacao legada. Os modulos ativos em `src/` incluem:

- `auth`, `users`, `boats`, `boat-staff`, `captain`
- `routes`, `trips`, `bookings`, `shipments`, `cargo`
- `payments`, `payment-methods`, `coupons`, `gamification`
- `admin`, `document-change-requests`, `notifications`, `chat`
- `favorites`, `reviews`, `stop-reviews`, `safety`, `weather`, `locations`
- `upload`, `mail`, `database`, `common`, `config`

## Requisitos

- Node.js 22 recomendado
- PostgreSQL 14+
- npm

## Setup

```bash
npm ci
cp .env.example .env
npm run start:dev
```

Servidor local: `http://localhost:3000`

Swagger: `http://localhost:3000/api/docs`

## Deploy com Docker

1. Copie e ajuste as variaveis:

```bash
cp .env.example .env
```

2. Para usar o banco do `docker-compose`, deixe no `.env`:

- `NODE_ENV=production`
- `DB_HOST=db`
- `DB_PORT=5432`
- `DB_SYNCHRONIZE=false`
- Defina valores fortes para `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` e `PAYMENT_WEBHOOK_SECRET`

3. Suba aplicacao e banco:

```bash
docker compose up -d --build
```

4. Acompanhe logs:

```bash
docker compose logs -f app
```

5. Parar servicos:

```bash
docker compose down
```

Persistencia:

- Banco PostgreSQL no volume `pgdata`
- Uploads no volume `uploads`

## Variaveis de Ambiente

O bootstrap valida o ambiente em [`src/config/env.validation.ts`](/C:/www/softLive/projects/navegaja/backend/src/config/env.validation.ts).

Variaveis operacionais principais:

- `NODE_ENV`
- `PORT`
- `APP_URL`
- `BASE_URL`
- `CORS_ORIGINS`
- `HTTP_LOGGING`
- `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE`
- `DB_SYNCHRONIZE`, `DB_MIGRATIONS_RUN`
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`
- `PAYMENT_WEBHOOK_SECRET`

Consulte [`.env.example`](/C:/www/softLive/projects/navegaja/backend/.env.example) para o conjunto completo.

## Scripts

```bash
npm run lint
npm run lint:fix
npm run build
npm run migration:show
npm run migration:run
npm test -- --runInBand
npm run test:e2e -- --runInBand
npm run ci
```

## Migrations (TypeORM)

Comandos principais:

```bash
npm run migration:generate
npm run migration:create
npm run migration:show
npm run migration:run
npm run migration:revert
```

Notas:

- Em producao, manter `DB_SYNCHRONIZE=false`.
- Para deploy (ex.: Railway), use `DB_MIGRATIONS_RUN=true` para aplicar pendencias ao iniciar a API.
- Se o banco ja existe e foi criado via `synchronize`, rode `npm run migration:baseline` uma vez antes do primeiro `migration:run`.

## Qualidade

- `lint`: validacao sem alterar arquivos
- `lint:fix`: correcoes automaticas locais
- `test`: suites unitarias em `src/**/*.spec.ts`
- `test:e2e`: suites HTTP em `test/*.e2e-spec.ts`
- `ci`: lint + build + test + test:e2e

## Documentacao Tecnica

- Visao tecnica geral em [`docs/README.md`](/C:/www/softLive/projects/navegaja/backend/docs/README.md)
- Padroes operacionais em [`docs/engineering-standards.md`](/C:/www/softLive/projects/navegaja/backend/docs/engineering-standards.md)
- Backlog tecnico consolidado em [`docs/technical-backlog.md`](/C:/www/softLive/projects/navegaja/backend/docs/technical-backlog.md)

## Observacoes Operacionais

- `DB_SYNCHRONIZE` deve ficar desligado em producao.
- `CORS_ORIGINS` deve ser definido explicitamente fora de desenvolvimento.
- `HTTP_LOGGING` pode registrar metadados de request; campos sensiveis sao mascarados no bootstrap.
- Os endpoints publicados devem ser consultados pelo Swagger, nao por contagem fixa no README.
