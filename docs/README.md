# NavegaJá — Documentação Técnica

> Gerada por engenharia reversa do código-fonte. Versão 1.0 — Fevereiro 2026.

---

## O que é o NavegaJá?

Plataforma de transporte fluvial na Amazónia que conecta **passageiros** e **capitães** de embarcações nas rotas do Rio Negro, Rio Solimões e afluentes (região de Manaus, AM).

**Três actores principais:**
- **Passageiro** — reserva viagens, envia encomendas, avalia capitães
- **Capitão** — cria viagens, gere embarcações, colecta encomendas
- **Administrador** — aprova capitães/barcos, gere a plataforma

---

## Índice

### Arquitectura
| Documento | Descrição |
|---|---|
| [01 — Contexto do Sistema](architecture/01-contexto-sistema.md) | Diagrama C4 nível 1 e 2 — visão geral |
| [02 — Componentes / Módulos](architecture/02-componentes.md) | Módulos NestJS e dependências |
| [03 — Modelo de Dados (ERD)](architecture/03-modelo-dados.md) | Todas as entidades e relações |
| [04 — Matriz de Permissões](architecture/04-matriz-permissoes.md) | Quem pode fazer o quê |
| [Standards de Engenharia](engineering-standards.md) | Regras operacionais, testes e qualidade |

### Casos de Uso
| Documento | Domínio |
|---|---|
| [UC01 — Autenticação](use-cases/UC01-autenticacao.md) | Registo, login, recuperação de senha |
| [UC02 — Gestão de Viagens](use-cases/UC02-viagens.md) | Criar, pesquisar, gerir viagens |
| [UC03 — Reservas](use-cases/UC03-reservas.md) | Reservar, pagar, check-in, cancelar |
| [UC04 — Encomendas](use-cases/UC04-encomendas.md) | Envio de pacotes, rastreamento, entrega |
| [UC05 — Carga](use-cases/UC05-carga.md) | Transporte de cargas especiais |
| [UC06 — Avaliações](use-cases/UC06-avaliacoes.md) | Reviews passageiro↔capitão |
| [UC07 — Segurança](use-cases/UC07-seguranca.md) | Checklist, SOS, clima, contactos |
| [UC08 — Gamificação](use-cases/UC08-gamificacao.md) | Pontos, níveis, descontos, referidos |
| [UC09 — Administração](use-cases/UC09-administracao.md) | Dashboard, verificação, gestão |

### Diagramas de Sequência UML
| Documento | Fluxo |
|---|---|
| [SEQ01 — Login e Registo](diagrams/SEQ01-login-registro.md) | Fluxo completo de autenticação |
| [SEQ02 — Criar Viagem](diagrams/SEQ02-criar-viagem.md) | Capitão cria e gere viagem |
| [SEQ03 — Fluxo de Reserva](diagrams/SEQ03-fluxo-reserva.md) | Do pedido ao check-in |
| [SEQ04 — Fluxo de Encomenda](diagrams/SEQ04-fluxo-encomenda.md) | Da criação à entrega |
| [SEQ05 — Status da Viagem](diagrams/SEQ05-status-viagem.md) | Ciclo de vida da viagem |
| [SEQ06 — Avaliação Pós-Viagem](diagrams/SEQ06-avaliacao.md) | Review após viagem completa |
| [SEQ07 — Verificação de Capitão](diagrams/SEQ07-verificacao-capitao.md) | Fluxo de aprovação pelo admin |

---

## Stack Tecnológica

| Camada | Tecnologia |
|---|---|
| Framework | NestJS 11 (Node.js + TypeScript) |
| Base de dados | PostgreSQL via TypeORM |
| Autenticação | JWT (access + refresh tokens) |
| Rate Limiting | @nestjs/throttler |
| Notificações Push | Firebase Cloud Messaging (FCM) |
| Armazenamento | Local (uploads/) → Firebase Storage (produção) |
| Pagamentos | PIX (QR Code gerado) |
| Clima | OpenWeatherMap API |
| Email | SMTP via MailService |
| Deploy | Railway (PORT dinâmica) |

## Módulos do Sistema

```
Auth • Users • Boats • Trips • Bookings • Shipments • Cargo
Routes • Coupons • Promotions • Favorites • Gamification
Safety • Weather • Upload • Notifications • Admin • Payments
```

---

## Convenções do Projecto

- **IDs:** sempre UUID v4, nunca numéricos
- **Senhas:** bcryptjs, 10 rounds
- **Campos sensíveis:** `passwordHash`, `fcmToken`, `resetCode` nunca expostos em relações
- **Paginação:** `?page=1&limit=20` com `ParseIntPipe({ optional: true })`
- **Timestamps:** UTC, coluna `created_at` / `updated_at` automáticas
- **Soft delete:** não utilizado — deleção real com validações de negócio
