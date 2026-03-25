# Backend Technical Backlog

## Contexto

Auditoria local consolidada em 2026-03-25 apos a rodada de hardening, testes, CI, documentacao e refactors incrementais.

## Resumo Executivo

- Swagger esta integrado e os controllers em `src/` estao anotados com `@ApiTags`.
- O projeto ja tem lint, build, testes unitarios, testes e2e e pipeline de CI.
- O principal debito remanescente esta em cobertura de testes por modulo e tamanho de alguns services centrais.

## Contratos e Swagger

- Fonte de verdade atual: Swagger em `/api/docs` e decorators dos controllers.
- Auditoria desta rodada: controllers auditados possuem anotacao `@ApiTags`; endpoints publicados tambem usam `@ApiOperation`.
- Risco residual: a auditoria desta rodada foi estrutural, nao uma revisao endpoint a endpoint de schemas de resposta, exemplos e codigos HTTP.

## Modulos Sem Suite Unitaria Dedicada

Levantamento por pasta em `src/`:

- `admin`
- `boat-staff`
- `captain`
- `cargo`
- `chat`
- `coupons`
- `database`
- `favorites`
- `mail`
- `notifications`
- `payment-methods`
- `payments`
- `pdf`
- `reviews`
- `safety`
- `stop-reviews`
- `upload`
- `users`
- `weather`

## Cobertura E2E Atual

- `test/app.e2e-spec.ts`
- `test/auth.e2e-spec.ts`

Fluxos ainda sem e2e dedicado:

- pagamentos
- bookings
- shipments
- admin
- captain / boat-staff

## Prioridades de Refactor

Services mais extensos nesta auditoria:

- `src/admin/admin.service.ts`: 1859 linhas
- `src/trips/trips.service.ts`: 1510 linhas
- `src/weather/weather.service.ts`: 1063 linhas
- `src/shipments/shipments.service.ts`: 1015 linhas
- `src/bookings/bookings.service.ts`: 895 linhas

## Backlog Recomendado

### P0

- Criar e2e para pagamentos, bookings e shipments cobrindo sucesso, falha, cancelamento e webhook.
- Adicionar suites unitarias para `payments`, `users`, `safety` e `weather`.
- Revisar respostas Swagger dos endpoints criticos para garantir exemplos e codigos HTTP coerentes com implementacao real.

### P1

- Quebrar `AdminService` por dominios internos: usuarios, viagens, reservas, encomendas e moderacao.
- Continuar a extracao em `TripsService`, separando validacao de criacao, operacao do capitao, busca publica e atualizacao de status.
- Separar `WeatherService` entre provedores externos, agregacao de previsao e regras de fallback/cache.

### P2

- Adicionar metricas operacionais basicas para filas/cron, webhook de pagamento e notificacoes.
- Padronizar testes para modulos de suporte ainda sem cobertura: `favorites`, `chat`, `notifications`, `payment-methods`, `stop-reviews`.
- Revisar documentacao tecnica em `docs/` para ligar arquitetura, backlog e padroes operacionais.

## Conclusao

O plano inicial foi executado nas frentes de hardening, testes criticos, CI, documentacao e inicio de desacoplamento. O trabalho restante agora deixou de ser "arrumar o basico" e virou backlog tecnico de confianca e manutencao.
