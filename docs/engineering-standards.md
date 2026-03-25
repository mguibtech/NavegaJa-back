# Backend Engineering Standards

## Objetivo

Este documento resume os padroes operacionais adotados no backend para reduzir regressao, facilitar manutencao e alinhar onboarding.

## Runtime

- Validar ambiente no bootstrap antes de subir a aplicacao.
- Nao usar `synchronize` fixo para todos os ambientes.
- Restringir CORS por configuracao.
- Evitar `console.log` ad-hoc em fluxos de runtime; preferir `Logger`.
- Mascarar campos sensiveis em logs HTTP.

## API

- Expor contratos atualizados via Swagger.
- Usar DTOs com `class-validator` em entradas publicas.
- Tratar autorizacao por guard/decorator, nao por condicao espalhada em controller.
- Evitar documentacao com contagem fixa de rotas; ela envelhece rapido.

## Testes

- Toda regra de negocio nova deve vir com teste unitario.
- Fluxos HTTP criticos devem ter pelo menos um teste e2e.
- Prioridade de cobertura: auth, autorizacao, pagamentos, bookings e shipments.
- Testes devem preferir mocks focados em vez de depender de banco real.

## Refactor

- Quebrar services grandes por responsabilidade.
- Extrair calculos, validacoes e notificacoes repetidas para helpers privados ou services dedicados.
- Refactor sem mudanca comportamental precisa manter testes verdes antes e depois.

## Qualidade

- `npm run lint` deve ser usado em CI.
- `npm run lint:fix` deve ser usado apenas localmente.
- `npm run ci` e o gate minimo antes de merge.

## Documentacao

- `README.md` deve refletir setup real, scripts e modulos ativos.
- Swagger e codigo sao a fonte de verdade para endpoints.
- Documentos em `docs/` devem registrar padroes e arquitetura, nao espelhar listas estaticas de rotas.
