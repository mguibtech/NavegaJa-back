# Backend Technical Backlog

## Contexto

Auditoria local consolidada em 2026-03-25 apos a rodada de hardening, testes, CI, documentacao, suites adicionais e refactors incrementais.

## Resumo Executivo

- Swagger esta integrado e os controllers em `src/` estao anotados com `@ApiTags`.
- O projeto ja tem lint, build, testes unitarios, testes e2e e pipeline de CI.
- Estado validado nesta auditoria: 38 suites unitarias/smoke com 220 testes e 8 suites e2e com 57 testes.
- Cobertura atual (`npm run test:cov -- --runInBand`): 82.45% statements, 59.50% branches, 79.98% functions e 83.17% lines.
- O principal debito remanescente esta em cobertura por modulo ainda sem suite dedicada, auditoria fina de contratos Swagger e tamanho de alguns services centrais.

## Contratos e Swagger

- Fonte de verdade atual: Swagger em `/api/docs` e decorators dos controllers.
- Auditoria desta rodada: controllers auditados possuem anotacao `@ApiTags`; endpoints publicados tambem usam `@ApiOperation`.
- Risco residual: a auditoria desta rodada foi estrutural, nao uma revisao endpoint a endpoint de schemas de resposta, exemplos e codigos HTTP.

## Modulos Sem Suite Unitaria Dedicada

Levantamento por pasta em `src/`:

- `boat-staff`
- `config`
- `reviews`

## Cobertura E2E Atual

- `test/app.e2e-spec.ts`
- `test/admin.e2e-spec.ts`
- `test/auth.e2e-spec.ts`
- `test/boat-staff.e2e-spec.ts`
- `test/bookings.e2e-spec.ts`
- `test/captain.e2e-spec.ts`
- `test/payments.e2e-spec.ts`
- `test/shipments.e2e-spec.ts`

Fluxos ainda sem e2e dedicado:

- webhooks e cenarios de falha mais profundos de pagamento
- operacoes administrativas de moderacao mais profundas e cenarios negativos adicionais de localizacoes comunitarias

## Prioridades de Refactor

Services mais extensos nesta auditoria:

- `src/admin/admin.service.ts`: 1516 linhas
- `src/trips/trips.service.ts`: 1375 linhas
- `src/shipments/shipments.service.ts`: 885 linhas
- `src/bookings/bookings.service.ts`: 805 linhas
- `src/weather/weather.service.ts`: 672 linhas

## Backlog Recomendado

### P0

- Revisar respostas Swagger dos endpoints criticos para garantir exemplos e codigos HTTP coerentes com implementacao real.
- Aprofundar cenarios de pagamento com webhook, falha, idempotencia e reprocessamento.
- Expandir e2e de `admin` para cenarios negativos e combinacoes de filtros em moderacao, verificacao e localizacoes comunitarias.

### P1

- Quebrar `AdminService` por dominios internos: usuarios, viagens, reservas, encomendas e moderacao.
- Continuar a extracao em `TripsService`, separando validacao de criacao, operacao do capitao, busca publica e atualizacao de status.
- Continuar a reduzir o restante de `BookingsService` e `ShipmentsService` agora que lookups, persistencia de status, reconciliacao de carga, recompensas de conclusao e ajuste de assentos ja comecaram a ser centralizados; fluxo de confirmacao de pagamento em reservas agora preserva status do ciclo de vida e evita ajuste duplicado de assentos.

### P2

- Adicionar metricas operacionais basicas para filas/cron, webhook de pagamento e notificacoes.
- Padronizar testes para os modulos que ainda nao possuem suite dedicada: `boat-staff`, `reviews` e componentes de `config`.
- Revisar documentacao tecnica em `docs/` para ligar arquitetura, backlog e padroes operacionais.

## Conclusao

O plano inicial foi executado nas frentes de hardening, testes criticos, CI, documentacao e inicio de desacoplamento. O trabalho restante agora deixou de ser "arrumar o basico" e virou backlog tecnico de confianca e manutencao.
