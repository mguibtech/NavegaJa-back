# 🤖 NavegaJá — Prompt Mestre para Claude Code

> Cole este arquivo no início de cada sessão do Claude Code.
> Ele contém todo o contexto do projeto para que o Claude aja como gestor técnico.

---

## 🎯 MISSÃO

Você é o arquiteto técnico sênior do projeto **NavegaJá**. Você conhece cada detalhe do sistema, sabe o que está implementado, o que falta, e como tudo se conecta. Sua missão é implementar, corrigir e evoluir o projeto seguindo os padrões já estabelecidos.

**ANTES DE QUALQUER COISA:** Leia os arquivos do projeto para entender o estado atual do código. Use `find src -name "*.ts"` para mapear a estrutura e leia os arquivos relevantes antes de escrever código.

---

## 📋 VISÃO GERAL DO PROJETO

**NavegaJá** é uma plataforma de transporte fluvial no Amazonas que conecta passageiros, capitães e remetentes de encomendas.

### Três produtos:
1. **App Mobile** (React Native / Expo) — passageiros e capitães
2. **Dashboard Web Admin** (Next.js 14) — administradores
3. **Backend API** (NestJS) — serve ambos

### Stack Backend
```
NestJS 10.x + TypeORM + PostgreSQL
JWT + Passport (auth)
class-validator + class-transformer (DTOs)
bcryptjs (senhas)
qrcode (QR codes)
pdfkit (geração de PDFs — bilhete + manifesto)
firebase-admin (push notifications FCM)
@nestjs/throttler (rate limiting)
OpenWeatherMap API (clima)
npm (package manager — NÃO usar yarn)
```

> **Nota PDFKit:** usar `const PDFDocument = require('pdfkit')` (não `import * as`) e retornar tipo `any` (não `PDFKit.PDFDocument`) para evitar erros TS de construção.

### Rodar o projeto
```bash
npm run start:dev   # backend (porta 3000)
npm run build       # compilar → dist/src/main.js
node dist/src/main.js  # produção
npm run lint        # ESLint
```

### Swagger (documentação interativa)
```
http://localhost:3000/api
```

### Reset do banco de dados
```bash
node scripts/reset-db.js --confirm
# Apaga todos os dados → na próxima inicialização o seed repopula automaticamente
# Seed só corre quando userCount === 0
```

---

## 🗂️ ESTRUTURA DE DIRETÓRIOS

```
backend/src/
├── auth/              # JWT, login, registro, refresh token
├── users/             # Usuários e perfis + KYC (submit/status)
├── boats/             # Embarcações
├── trips/             # Viagens + GPS tracking + Manifesto PDF
├── bookings/          # Reservas + Bilhete PDF
├── shipments/         # Encomendas
├── coupons/           # Cupons + Promoções (módulo unificado)
├── favorites/         # Destinos favoritos
├── reviews/           # Avaliações
├── gamification/      # NavegaCoins, níveis, leaderboard, indicações
├── safety/            # SOS + push FCM para admins, checklists, emergência
├── weather/           # Integração OpenWeatherMap
├── admin/             # Endpoints exclusivos do painel admin
├── mail/              # Envio de emails
├── routes/            # Rotas pré-definidas (ex: Manaus → Parintins)
├── cargo/             # Módulo de carga (integrado com shipments)
├── upload/            # Upload de arquivos (fotos de encomendas)
├── payments/          # Pagamentos PIX
├── notifications/     # Push notifications FCM
├── pdf/               # PdfService — gera bilhete e manifesto (pdfkit)
├── captain/           # Analytics do capitão (receita, rotas, passageiros)
├── stop-reviews/      # Avaliações de portos e pontos de parada
├── chat/              # Chat capitão ↔ passageiro (polling + FCM)
├── database/          # Seeds e migrations
└── main.ts
```

---

## 🚦 RATE LIMITING (implementado em 20/02/2026)

Configurado via `@nestjs/throttler` em `app.module.ts` com dois perfis:

| Perfil | TTL | Limite | Onde se aplica |
|---|---|---|---|
| `default` | 60s | 60 req | todos os endpoints (global guard) |
| `strict` | 60s | 5 req | `POST /auth/login`, `POST /auth/register`, `POST /auth/login-web` |
| `strict` | 60s | 10 req | `POST /auth/refresh` |
| `strict` | 60s | 3 req | `POST /auth/forgot-password` |
| `strict` | 60s | 5 req | `POST /auth/reset-password` |

- `GET /auth/me` tem `@SkipThrottle()` (operação segura com JWT)
- Excedido o limite → `429 Too Many Requests`
- Para isentar um endpoint de throttle: `@SkipThrottle()`
- Para throttle personalizado num endpoint: `@Throttle({ strict: { limit: 3, ttl: 60000 } })`

---

## 🔐 AUTENTICAÇÃO E ROLES

### Dois tipos de login:
- **App Mobile:** `POST /auth/login` — por **telefone + senha**
- **Dashboard Web:** `POST /auth/login-web` — por **email + senha** (só admin)

### Roles:
- `passenger` — passageiro (padrão)
- `captain` — capitão de embarcação
- `admin` — administrador do sistema

### JWT Strategy — CRÍTICO:
O `JwtStrategy.validate()` devolve `{ sub, phone, role }`.
**Nos controllers usar sempre `req.user.sub`** (nunca `req.user.id` — esse campo não existe).

```typescript
// ✅ Correto
return this.service.doSomething(req.user.sub);

// ❌ Errado — req.user.id é undefined → TypeORM "Empty criteria" error
return this.service.doSomething(req.user.id);
```

### Bloqueio de usuário:
O campo `isActive` na entidade `User` controla acesso. O `JwtStrategy` verifica no banco a cada requisição.

### Padrão de proteção de rotas:
```typescript
@UseGuards(JwtAuthGuard)            // qualquer role autenticada
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')                     // só admin
@Roles('captain')                   // só capitão
@Roles('admin', 'captain')          // admin ou capitão
@Public()                           // sem autenticação
```

### Tokens:
- `accessToken` — expira em 15min
- `refreshToken` — expira em 30 dias
- `POST /auth/refresh` — renovar tokens

---

## 👤 CAMPO `capabilities` NO USER (implementado em 20/02/2026)

Todos os endpoints que devolvem o utilizador (`/auth/login`, `/auth/register`, `/auth/me`, `/users/profile`) incluem agora o campo `capabilities`.

**Para passageiros e admins:** `capabilities = null`

**Para capitães:**
```json
{
  "capabilities": {
    "isVerified": false,
    "pendingVerification": false,
    "canOperate": false,
    "canCreateTrips": false,
    "canConfirmPayments": false,
    "canManageShipments": false
  }
}
```

| Campo | Descrição |
|---|---|
| `isVerified` | Admin aprovou os documentos |
| `pendingVerification` | Documentos enviados mas ainda não aprovados |
| `canOperate` | Shorthand — `false` = todas as acções de capitão bloqueadas |
| `canCreateTrips` | Pode criar viagens |
| `canConfirmPayments` | Pode confirmar pagamento PIX |
| `canManageShipments` | Pode recolher/gerir encomendas |

**Lógica sugerida no app:**
```
se capabilities == null → passageiro, UI normal

se capabilities.canOperate == false:
  mostrar banner "Conta pendente de verificação"

  se capabilities.pendingVerification == true:
    → "Documentos enviados. Aguardando aprovação."
  senão:
    → "Envie sua habilitação náutica para começar a operar."
    → botão "Enviar documentos"

bloquear na UI (não esperar pelo 403 do servidor):
  - Criar viagem
  - Confirmar pagamento PIX
  - Recolher encomendas
```

---

## 🛡️ VERIFICAÇÃO DE CAPITÃO (implementado em 20/02/2026)

### Fluxo completo:
```
1. POST /auth/register  { role: "captain", ... }
   → 403 Forbidden — capitães NÃO podem registar-se via API pública
   → Capitão é criado pelo admin via POST /admin/users ou directamente no DB

1b. Admin cria conta do capitão (via script ou painel)
    → isVerified = false (bloqueado de operar)

2. POST /upload/image?folder=captains  (foto da habilitação)
3. POST /upload/image?folder=captains  (foto do certificado)

4. PATCH /users/profile
   { "licensePhotoUrl": "...", "certificatePhotoUrl": "..." }
   → capabilities.pendingVerification = true

5. Admin aprova:
   PATCH /admin/users/:id/verify  { "verified": true }
   → capabilities.canOperate = true

6. Capitão pode criar viagens, confirmar pagamentos, gerir encomendas
```

### Acções bloqueadas para capitão não verificado:
| Endpoint | Erro |
|---|---|
| `POST /trips` | `403 Forbidden` |
| `POST /bookings/:id/confirm-payment` | `403 Forbidden` |
| `POST /shipments/:id/collect` | `403 Forbidden` |

---

## 📅 BOOKINGS — CICLO DE VIDA COMPLETO

### Status flow:
```
PENDING (PIX gerado, aguardando pagamento)
  ↓ pagamento PIX confirmado / método CASH ou CARD
CONFIRMED
  ↓ capitão escaneia QR do passageiro
CHECKED_IN
  ↓ trip → COMPLETED (automático via autoCompleteByTrip)
COMPLETED   ← passageiro pode avaliar + receber NavegaCoins

PENDING + pixExpiresAt < now → CANCELLED (cron a cada 5 min)
```

### Expiração PIX:
- QR Code PIX válido por **15 minutos**
- Cron a cada 5 min cancela `PENDING + PIX expirado`
- Reservas CASH/CARD confirmam imediatamente (sem expiração)

### Auto-complete ao concluir viagem:
Quando capitão marca trip → `COMPLETED`, o sistema **automaticamente**:
1. Envia notificação a todos os passageiros (`CONFIRMED` + `CHECKED_IN`)
2. Marca todas essas reservas como `COMPLETED`
3. Credita NavegaCoins a cada passageiro
4. Verifica bónus de primeira viagem do mês
5. Credita km (milhas fluviais) com base em `trip.route.distanceKm`

> Razão: no Amazonas a conectividade é instável — o capitão pode não conseguir escanear todos os QR codes. O benefício da dúvida é dado ao passageiro que pagou.

### Histórico de reservas:
`GET /bookings/my-bookings` — devolve todas as reservas do passageiro.
Aceita `?status=pending|confirmed|checked_in|completed|cancelled|expired` para filtrar.

---

## 🏗️ PADRÕES DE CÓDIGO

### Estrutura de um módulo NestJS:
```
src/modulo/
├── modulo.module.ts        # imports, providers, exports
├── modulo.controller.ts    # endpoints HTTP
├── modulo.service.ts       # lógica de negócio
├── modulo.entity.ts        # entidade TypeORM
└── dto/
    ├── create-modulo.dto.ts
    └── update-modulo.dto.ts
```

### Padrão de DTO:
```typescript
import { IsString, IsNotEmpty, IsOptional, IsUUID, IsEnum } from 'class-validator';

export class CreateExemploDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsUUID()
  tripId: string;

  @IsEnum(TipoEnum)
  tipo: TipoEnum;
}
```

### Padrão de Entity:
```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';

@Entity('nome_tabela')
export class NomeEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  campo: string;

  @Column({ nullable: true })
  campoOpcional: string;

  // CRÍTICO: colunas number|null DEVEM ter type explícito
  @Column({ name: 'rating', type: 'int', nullable: true })
  rating: number | null;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

### Padrão de paginação em controllers (OBRIGATÓRIO):
```typescript
// ✅ Params OBRIGATÓRIOS com default: DefaultValuePipe antes de ParseIntPipe
@Get()
findAll(
  @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
  @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
) {}

// ✅ Params OPCIONAIS (sem default): ParseIntPipe({ optional: true }) SEM DefaultValuePipe
// O ValidationPipe global converte 'abc' → NaN antes do ParseIntPipe — NÃO misturar
@Get()
search(
  @Query('minPrice', new ParseIntPipe({ optional: true })) minPrice?: number,
) {
  // Double-check no service para NaN:
  if (minPrice !== undefined && !Number.isFinite(minPrice)) {
    throw new BadRequestException('minPrice deve ser um número inteiro válido');
  }
}
```

### Padrão de queries de agregação (OBRIGATÓRIO para receita/totais):
```typescript
// ✅ Correto — SQL SUM, sem carregar dados em memória
const row = await this.repo
  .createQueryBuilder('b')
  .select('COALESCE(SUM(b.total_price), 0)', 'revenue')
  .where('b.created_at > :startDate', { startDate })
  .getRawOne();
const revenue = Number(row?.revenue || 0);

// ❌ Errado — carrega TODOS os registros em memória
const all = await this.repo.find();
const revenue = all.reduce((sum, b) => sum + b.totalPrice, 0);
```

### Tratamento de erros:
```typescript
throw new NotFoundException('Viagem não encontrada');
throw new BadRequestException('Dados inválidos');
throw new ForbiddenException('Sem permissão');
throw new ConflictException('Já existe');
throw new UnauthorizedException('Não autenticado');
```

### Sanitizar relações User (OBRIGATÓRIO):
Sempre remover `passwordHash`, `resetCode`, `resetCodeExpires` ao retornar relações de User.

---

## 📊 ENTIDADES E STATUS

### KycStatus (enum — User entity):
```typescript
export enum KycStatus {
  NONE        = 'none',         // nenhum documento enviado (padrão)
  PENDING     = 'pending',      // docs enviados, aguardando análise
  UNDER_REVIEW= 'under_review', // admin iniciou revisão
  APPROVED    = 'approved',     // aprovado — pode criar viagens
  REJECTED    = 'rejected',     // reprovado — rejectionReason preenchido
}
```

**Campos adicionados em `User`:**
- `kycStatus: KycStatus` (coluna `kyc_status`)
- `selfieUrl: string | null` (coluna `selfie_url`)
- `rnaqNumber: string | null` — número habilitação aquaviária (coluna `rnaq_number`, varchar 30)

**Bloqueio:** capitão com `kycStatus !== 'approved'` → `403 Forbidden` em `POST /trips`.

**Aprovação admin** (`PATCH /admin/users/:id/verify`) seta automaticamente `kycStatus = APPROVED` (ou `REJECTED`).

---

### TripStatus (enum):
```typescript
enum TripStatus {
  SCHEDULED = 'scheduled',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}
```

### BookingStatus (enum):
```typescript
enum BookingStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  CHECKED_IN = 'checked_in',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}
```

### ShipmentStatus (8 estados — CRÍTICO):
```typescript
enum ShipmentStatus {
  PENDING = 'pending',
  PAID = 'paid',
  COLLECTED = 'collected',
  IN_TRANSIT = 'in_transit',
  ARRIVED = 'arrived',
  OUT_FOR_DELIVERY = 'out_for_delivery',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled'
}
```

### QR Code (bookings): `NVGJ-{bookingId}`
### QR Code (shipments): `navegaja://shipment/validate?trackingCode=XXX&validationCode=YYY`

---

## ✅ O QUE ESTÁ IMPLEMENTADO

### Backend — Estado real confirmado em 27/02/2026 (v9.1):

| Módulo | Status | Observação |
|--------|--------|------------|
| Auth (login telefone + web, JWT, refresh, forgot/reset) | ✅ 100% | accessToken 15min, refreshToken 30d. Rate limiting estrito. Registo público bloqueado para captain/admin |
| Users (perfil, busca, editar perfil) | ✅ 100% | `capabilities` incluído em todas as respostas |
| Verificação de capitão (documentos + bloqueio operacional) | ✅ 100% | `isVerified` bloqueia trips, confirmPayment, collectShipment |
| KYC — Verificação de identidade (fase 1) | ✅ 100% | `kycStatus` enum, endpoints `/users/kyc/submit` e `/users/kyc/status`. Admin usa `PATCH /admin/users/:id/verify` |
| CPF Validation | ✅ 100% | `@IsCpfValid()` em RegisterDto + UpdateProfileDto |
| Boats (CRUD + documentos + aprovação admin) | ✅ 100% | isVerified, documentPhotos, rejectionReason |
| Trips (CRUD, busca, filtros, validações) | ✅ 100% | Requer capitão `isVerified` + `kycStatus='approved'`. Auto-complete bookings ao concluir |
| GPS Tracking (tempo real) | ✅ 100% | `PATCH /trips/:id/location` (captain) + `GET /trips/:id/location` (público). `lastLocationAt` em Trip |
| PDF — Bilhete de embarque | ✅ 100% | `GET /bookings/:id/ticket` → `application/pdf`. Usa `PdfService` (pdfkit) |
| PDF — Manifesto de carga | ✅ 100% | `GET /trips/:id/cargo-manifest` → `application/pdf`. Captain/Admin |
| Bookings (criar, cancelar, check-in, QR code, auto-complete) | ✅ 100% | Auto-complete ao trip→COMPLETED. PIX expira em 15min. Filtro `?status=` disponível. **409 Conflict** se usuário já tem booking ativa (PENDING/CONFIRMED/CHECKED_IN) na mesma viagem |
| Shipments (8 estados, QR, tracking, timeline, gamification) | ✅ 100% | collectShipment requer capitão verificado |
| Coupons + Promotions | ✅ 100% | |
| Favorites | ✅ 100% | |
| Gamification (NavegaCoins, níveis, leaderboard) | ✅ 100% | |
| Sistema de Milhas (km fluviais) | ✅ 100% | `KmTransaction`, saldo em `User`, desconto em `Booking`. `GET /gamification/km-stats` |
| Indicações melhoradas (Referral entity) | ✅ 100% | Pontos só ao completar 1ª viagem. `GET /gamification/referrals` |
| Reviews (passageiro→capitão/barco + capitão→passageiro) | ✅ 100% | Requer booking COMPLETED |
| Avaliações de Paradas (`stop-reviews`) | ✅ 100% | Porto/terminal, rating 1-5, fotos, top locais. Dá +5 NavegaCoins |
| Chat capitão ↔ passageiro | ✅ 100% | Polling + FCM. 4 endpoints. Somente participantes da booking |
| Analytics do capitão | ✅ 100% | 4 endpoints: resumo, receita diária, rotas, passageiros recorrentes |
| Weather (OpenWeatherMap, cache 30min) | ✅ 100% | |
| Safety / SOS (+ FCM para admins) | ✅ 100% | SOS dispara push FCM para todos os admins ativos |
| Admin (users, trips, shipments, bookings, dashboard, reviews) | ✅ 100% | |
| Routes | ✅ 100% | Read-only |
| Cargo (fretes comerciais, 9 tipos) | ✅ 100% | |
| Upload (imagens + vídeos) | ✅ 100% | Firebase Storage ou disco |
| Payments (PIX) | ✅ 100% | QR Code PIX, validade 15min |
| Notifications (Push FCM + Broadcast) | ✅ 100% | Firebase FCM, integrado com todos os módulos. `channelId: 'default'` + `priority: 'high'` em todos os payloads Android |
| Rate Limiting | ✅ 100% | `@nestjs/throttler` — 60/min global, 5/min nos endpoints de auth |

---

## ❌ O QUE FALTA / LACUNAS CONHECIDAS

### 🟡 Pequenas lacunas

| Item | Detalhe |
|---|---|
| `GET /admin/dashboard/revenue` | Gráfico de receita por período (dia/semana/mês) ainda não existe |
| Upload para S3 | Upload melhorado com S3 (shipments já usa presigned URLs) |
| Chat — WebSocket | Chat usa polling (10s) + FCM. WebSocket (`@nestjs/platform-socket.io`) não está instalado |

---

## ✈️ SISTEMA DE MILHAS FLUVIAIS (implementado em 25/02/2026)

Inspirado em programas de milhagem de companhias aéreas, mas adaptado para transporte fluvial.

### Regras de negócio:
- **Acúmulo:** ao completar uma viagem, o passageiro ganha km equivalentes à distância da rota (`Route.distanceKm`)
- **Bloco:** cada **500 km** = **R$25** de desconto (constante `KM_BLOCK = 500`, `DISCOUNT_PER_BLOCK = 25`)
- **Resgate flexível:** o usuário escolhe quantos blocos usar — só milhas, só dinheiro, ou parte de cada
- **Múltiplo obrigatório:** `redeemKm` deve ser múltiplo de 500 (ex: 500, 1000, 1500...)
- **Saldo:** campo `redeemableKm` em `User` (atual disponível). `totalKmTraveled` é histórico
- **Devolução:** se a booking for cancelada, os km são devolvidos ao saldo

### Entidades novas / modificadas:
```
src/gamification/km-transaction.entity.ts  ← NOVA
  KmTransactionType: earned | redeemed | refunded
  Campos: userId, km (positivo=crédito), type, description, referenceId (bookingId)

User:
  + totalKmTraveled: int (histórico total, não diminui no resgate)
  + redeemableKm: int   (saldo disponível para resgate)

Booking:
  + kmRedeemed: int     (km usados nesta booking, 0 se nenhum)
  + kmDiscount: decimal (valor R$ descontado pelos km)
```

### GamificationService — novos métodos:
```typescript
calcKmDiscount(redeemKm): number       // calcula R$ de desconto (não debita)
deductKm(userId, redeemKm, bookingId)  // valida e debita km do usuário
creditKm(userId, km, bookingId)        // credita km ao completar viagem
refundKm(userId, kmRedeemed, bookingId)// devolve km ao cancelar booking
getKmStats(userId)                     // retorna saldo, histórico, blocos disponíveis
```

### Endpoints:
```
GET  /gamification/km-stats       (JWT) — saldo de km do usuário logado
POST /bookings/calculate-price    (JWT) — aceita redeemKm para preview de desconto
POST /bookings                    (JWT) — aceita redeemKm para aplicar desconto
```

### Fluxo de acúmulo:
```
1. Passageiro conclui viagem (booking → CHECKED_IN → COMPLETED)
2. Sistema lê trip.route.distanceKm (Route pré-definida) → crédita km
3. Se rota sem distância definida → 0 km (sem prejuízo)
```

### Fluxo de resgate:
```
1. App chama POST /bookings/calculate-price com { tripId, quantity, redeemKm: 500 }
   → resposta: { basePrice: 80, kmDiscount: 25, finalPrice: 55, redeemableKm: 1200 }
2. App confirma → POST /bookings com { ..., redeemKm: 500 }
   → sistema valida saldo, debita 500 km, aplica R$25 de desconto
3. Se cancelar → km são devolvidos automaticamente
```

### GamificationModule:
`KmTransaction` adicionado ao `TypeOrmModule.forFeature([...])`

### StopReviews:
Ao criar uma avaliação de ponto de parada → **+5 NavegaCoins** (mesmo `PointAction.REVIEW_CREATED` das reviews normais).
`StopReviewsModule` importa `GamificationModule`.

---

## 🔗 DEPENDÊNCIAS CIRCULARES (IMPORTANTE)

Trips e Shipments têm dependência circular. **Sempre usar forwardRef():**

```typescript
// trips.module.ts
imports: [
  forwardRef(() => ShipmentsModule),
  forwardRef(() => SafetyModule),
]

// shipments.module.ts — não importa TripsModule directamente, usa Trip entity
```

Se criar um novo módulo que precise de outro já existente e vice-versa, use `forwardRef()` nos dois lados.

---

## 🌦️ WEATHER SERVICE

Endpoints públicos (`@Public()`):
```
GET /weather/current?lat=-3.119&lng=-60.0217&region=Manaus
GET /weather/region/manaus
GET /weather/forecast?lat=-3.119&lng=-60.0217
GET /weather/navigation-safety?lat=-3.119&lng=-60.0217
GET /weather/regions
```

Para usar em outro service:
```typescript
const safety = await this.weatherService.evaluateNavigationSafety(lat, lng);
if (safety.safetyScore < 50) {
  throw new BadRequestException(`Condições climáticas perigosas. Score: ${safety.safetyScore}/100`);
}
```

---

## 🔒 VARIÁVEIS DE AMBIENTE (.env)

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=1234
DB_DATABASE=navegaja

# JWT
JWT_ACCESS_SECRET=navegaja-secret-2026
JWT_REFRESH_SECRET=navegaja-refresh-secret-2026

# App
PORT=3000
NODE_ENV=development

# PIX
PIX_KEY=chave@pix.com.br
PIX_MERCHANT_NAME=NavegaJá
PIX_MERCHANT_CITY=Manaus

# Firebase FCM (opcional — se omitido, notificações desativam silenciosamente)
FIREBASE_PROJECT_ID=navegaja-xxxxx
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@navegaja.iam.gserviceaccount.com

# OpenWeather
OPENWEATHER_API_KEY=sua-chave
```

---

## 👤 USUÁRIOS DE TESTE (seed)

| Phone/Email | Senha | Role | Verificado |
|---|---|---|---|
| `92991001001` | `123456` | passenger | — |
| `92992001001` | `123456` | captain | ✅ isVerified=true |
| `admin@navegaja.com` | `admin123` | admin | — (criado manualmente) |

**Login mobile:**
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone":"92991001001","password":"123456"}'
```

**Login web (dashboard):**
```bash
curl -X POST http://localhost:3000/auth/login-web \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@navegaja.com","password":"admin123"}'
```

**Criar admin manualmente (após reset do DB):**
```bash
node scripts/check-and-create-admin.js
```

---

## 🔔 PUSH NOTIFICATIONS — FCM

### Endpoints:
| Método | Endpoint | Guard | Descrição |
|---|---|---|---|
| POST | `/notifications/register-token` | JWT | Guardar token FCM (chamar após login) |
| DELETE | `/notifications/unregister-token` | JWT | Remover token (logout) |
| POST | `/notifications/test` | JWT + Admin | Enviar notificação de teste |
| POST | `/admin/notifications/broadcast` | JWT + Admin | Broadcast segmentado |

### Notificações automáticas:
- Trip → `in_progress` → passageiros notificados
- Trip → `completed` → passageiros notificados + bookings auto-completados
- Booking CONFIRMED → passageiro notificado
- Booking CANCELLED → passageiro notificado
- Shipment muda estado → remetente notificado
- Nova reserva numa viagem → capitão notificado
- **Capitão favorito cria viagem** → todos que o favoritaram recebem push `{ type: "captain_new_trip", tripId, captainId }`
- **Novo cupom criado (admin)** → broadcast para todos os usuários `{ type: "new_coupon", couponCode, applicableTo }`

### Payload FCM Android (CRÍTICO):
Todos os payloads incluem `android.notification.channelId = 'default'` para exibição na barra em background no Android 8+.
**O app mobile DEVE criar o canal `default`** na inicialização (via `notifee.createChannel` ou `expo-notifications`).

### Broadcast (admin):
```json
POST /admin/notifications/broadcast
{
  "title": "🎉 Promoção",
  "body": "20% OFF nas viagens!",
  "cities": ["Parintins"],     // opcional
  "roles": ["passenger"],       // opcional
  "data": { "type": "coupon" }
}
→ { "sent": 142 }
```

---

## 🚢 BARCOS E VERIFICAÇÃO

### Fluxo capitão novo:
1. `POST /auth/register { role: "captain" }` → **`403 Forbidden`** — capitão não se auto-regista
1b. Admin cria conta manualmente (via painel ou script)
2. `POST /upload/image` → URL da habilitação
3. `POST /upload/image` → URL do certificado
4. `PATCH /users/profile { licensePhotoUrl, certificatePhotoUrl }` → `capabilities.pendingVerification = true`
5. Admin: `PATCH /admin/boats/:id/verify { approved: true }`
6. Admin: `PATCH /admin/users/:id/verify { verified: true }` → `capabilities.canOperate = true`

### Endpoints admin:
| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/admin/boats/pending` | Barcos + capitães com verificação pendente |
| PATCH | `/admin/boats/:id/verify` | Aprovar/rejeitar barco |
| PATCH | `/admin/users/:id/verify` | Verificar/des-verificar capitão |

---

## 🔑 SISTEMA DE REVIEWS

| Método | Endpoint | Guard | Descrição |
|---|---|---|---|
| POST | `/reviews` | JWT | Passageiro avalia capitão + barco |
| POST | `/reviews/captain-review` | JWT + Captain | Capitão avalia passageiro |
| GET | `/reviews/can-review/:tripId` | JWT | Pode avaliar esta viagem? |
| GET | `/reviews/captain/:id` | @Public | Reviews de um capitão + stats |
| GET | `/reviews/boat/:id` | @Public | Reviews de um barco + stats |
| GET | `/reviews/passenger/:id` | @Public | Reviews de um passageiro + stats |
| GET | `/reviews/my` | JWT | Minhas reviews escritas |

**Regras:** Requer `booking.status = COMPLETED`. Uma avaliação por viagem por direcção.

---

## 💳 PAYMENTS — PIX

```
POST /payments/pix/booking/:id   → gera QR Code PIX para reserva (15 min)
POST /payments/pix/shipment/:id  → gera QR Code PIX para encomenda (15 min)
```

---

## 📍 GPS TRACKING — RASTREAMENTO EM TEMPO REAL

**Campos em `Trip`:** `currentLat`, `currentLng` (já existiam) + `lastLocationAt: timestamp | null` (adicionado).

| Método | Endpoint | Auth | Descrição |
|--------|----------|------|-----------|
| PATCH | `/trips/:id/location` | Captain | Atualizar posição GPS `{ lat, lng }` |
| GET | `/trips/:id/location` | Público | Consultar posição atual |

**Response de ambos:**
```json
{ "lat": -3.1019, "lng": -60.0250, "lastLocationAt": "2026-02-25T14:30:00Z", "status": "in_progress" }
```

**Integração:** capitão envia a cada 30s; passageiro faz polling a cada 15s.

---

## 🪪 KYC — VERIFICAÇÃO DE IDENTIDADE DO CAPITÃO

| Método | Endpoint | Auth | Descrição |
|--------|----------|------|-----------|
| POST | `/users/kyc/submit` | Captain | Enviar docs `{ selfieUrl, licensePhotoUrl, rnaqNumber?, certificatePhotoUrl? }` |
| GET | `/users/kyc/status` | Captain | Ver `{ kycStatus, selfieUrl, licensePhotoUrl, isVerified, verifiedAt, rejectionReason }` |
| PATCH | `/admin/users/:id/verify` | Admin | Aprovar `{ verified: true }` ou reprovar `{ verified: false, rejectionReason: "..." }` |

**Fluxo:** Capitão faz upload (POST /upload/image) → envia URLs via `/kyc/submit` → admin aprova/rejeita em `/admin/users/:id/verify` → `kycStatus` é atualizado automaticamente.

---

## 📄 PDF — BILHETE E MANIFESTO DE CARGA

**Módulo `PdfService`** em `src/pdf/pdf.service.ts` — exportado por `PdfModule`.
Importar `PdfModule` nos módulos que precisam de PDF.

**PDFKit:** usar sempre `const PDFDocument = require('pdfkit')` (não `import *`) e retornar `any`.

| Método | Endpoint | Auth | Descrição |
|--------|----------|------|-----------|
| GET | `/bookings/:id/ticket` | JWT | PDF bilhete de embarque (`application/pdf`) |
| GET | `/trips/:id/cargo-manifest` | Captain/Admin | PDF manifesto de carga (`application/pdf`) |

**No app:** receber `responseType: 'blob'` e usar `expo-sharing` ou `react-native-share` para abrir o PDF.

---

## 📊 ANALYTICS DO CAPITÃO

Todos os endpoints em `/captain/analytics` requerem JWT + role `captain`.

| Método | Endpoint | Query | Descrição |
|--------|----------|-------|-----------|
| GET | `/captain/analytics` | — | Resumo: receita total, viagens, passageiros, rating, completion rate |
| GET | `/captain/analytics/revenue` | `?period=7d\|30d\|90d` | Receita diária `[{ date, amount, bookings }]` |
| GET | `/captain/analytics/routes` | — | Top 10 rotas `[{ origin, destination, tripsCount, totalRevenue, avgPrice }]` |
| GET | `/captain/analytics/passengers` | — | Passageiros recorrentes (2+ viagens) `[{ passengerId, name, totalBookings, totalSpent, lastTrip }]` |

Queries usam `DATE_TRUNC`, `COALESCE(SUM(...))` via QueryBuilder — nunca `.find()` + `.reduce()`.

---

## ⭐ AVALIAÇÕES DE PONTOS DE PARADA (`stop-reviews`)

Entidade `StopReview` — tabela `stop_reviews`.

| Método | Endpoint | Auth | Descrição |
|--------|----------|------|-----------|
| POST | `/stop-reviews` | JWT | Criar `{ locationName, rating(1-5), comment?, photos?[], tripId?, lat?, lng? }` |
| GET | `/stop-reviews?location=X` | Público | Avaliações de um local (paginado) |
| GET | `/stop-reviews/top?limit=10` | Público | Top locais por rating médio `[{ locationName, avgRating, totalReviews }]` |
| GET | `/stop-reviews/my` | JWT | Minhas avaliações (paginado) |

---

## 🤝 INDICAÇÕES MELHORADAS (Referral)

Nova entidade `Referral` — tabela `referrals`. Importada pelo `GamificationModule`.

**Campos:** `id`, `referrerId` (FK User), `referredId` (FK User, unique), `status (pending|converted)`, `pointsAwarded (boolean)`, `createdAt`, `convertedAt`.

**Fluxo:**
1. Novo usuário registra com `referralCode` → cria `Referral` status `pending` (sem pontos ainda).
2. Indicado completa a 1ª booking → `convertReferral()` é chamado automaticamente em `bookings.service.ts`.
3. Referral muda para `converted`, indicador recebe **50 NavegaCoins** + push FCM.

| Método | Endpoint | Auth | Descrição |
|--------|----------|------|-----------|
| GET | `/gamification/referrals` | JWT | `{ referralCode, totalReferred, totalConverted, pendingConversion, referrals[] }` |

---

## 💬 CHAT CAPITÃO ↔ PASSAGEIRO

Entidade `ChatMessage` — tabela `chat_messages`. Módulo `ChatModule` importa `Booking` e `NotificationsModule`.

**Acesso:** só o passageiro da booking e o capitão da viagem. Booking `cancelled` → `400`.
**Limite:** 1000 caracteres por mensagem.

| Método | Endpoint | Auth | Descrição |
|--------|----------|------|-----------|
| GET | `/chat/conversations` | JWT | Lista conversas ordenadas pela mensagem mais recente (com `unreadCount`) |
| POST | `/chat/:bookingId/messages` | JWT | Enviar mensagem `{ content }` + push FCM ao destinatário |
| GET | `/chat/:bookingId/messages` | JWT | Polling — aceita `?since=ISO&limit=50` para incremental |
| PATCH | `/chat/:bookingId/read` | JWT | Marca mensagens do outro como lidas → `{ marked: N }` |

**Push FCM ao receber mensagem:** `data: { type: "chat", bookingId }` → app abre o chat.
**Estratégia no app:** poll a cada 10s com `?since=lastMessage.createdAt`; FCM acorda o poll imediatamente.

### QueryBuilder — padrão OBRIGATÓRIO no chat (e em geral):
Usar sempre **nomes de propriedade da entidade (camelCase)** com aliases, nunca nomes de coluna raw:
```typescript
// ✅ Correto
.where('msg.bookingId = :bookingId')
.orderBy('msg.createdAt', 'ASC')
.where('booking.passengerId = :userId OR trip.captainId = :userId')

// ❌ Errado — TypeORM não resolve colunas snake_case com alias → 500
.where('msg.booking_id = :bookingId')
.orderBy('msg.created_at', 'ASC')
.where('booking.passenger_id = :userId OR trip.captain_id = :userId')
```

---

## 🆘 SOS — ATUALIZAÇÃO (FCM para Admins)

O módulo SOS já existia em `src/safety/`. A atualização adicionou push FCM para todos os admins ao criar um alerta:

- `SafetyModule` agora importa `NotificationsModule` e injeta o repositório de `User`.
- Ao `POST /sos`: busca todos os admins com `fcmToken` ativo e envia push instantâneo.
- **Push payload:** `{ title: "🆘 ALERTA SOS!", body: "SOS acionado por [Nome]", data: { type: "sos", alertId } }`

---

## 🚨 REGRAS INVIOLÁVEIS

1. **SEMPRE ler o arquivo existente antes de editar**
2. **NUNCA usar IDs numéricos** — sempre UUIDs
3. **NUNCA retornar senha do usuário** — remover `passwordHash`, `resetCode`, `resetCodeExpires`
4. **SEMPRE validar ownership** — usuário só pode editar seus próprios recursos
5. **SEMPRE usar DTOs com class-validator**
6. **`req.user.sub`** — nunca `req.user.id` (campo não existe no JWT payload)
7. **Dependências circulares** — sempre resolver com `forwardRef()`
8. **Não quebrar endpoints existentes**
9. **`synchronize: true`** ativo em dev — TypeORM cria/altera tabelas automaticamente
10. **ParseIntPipe obrigatório** em todos os `@Query()` numéricos
11. **Queries de receita via SQL** — nunca `.find()` + `.reduce()`
12. **Colunas `number | null`** DEVEM ter `type: 'int'` explícito no `@Column()`
13. **npm** — nunca usar yarn neste projecto

---

## 📋 CHECKLIST ANTES DE FINALIZAR

- [ ] Código compila sem erros TypeScript (`npm run build`)
- [ ] DTOs têm validações com class-validator
- [ ] Guards corretos aplicados
- [ ] `req.user.sub` (não `.id`) nos controllers
- [ ] Ownership verificado
- [ ] `passwordHash`/`resetCode`/`resetCodeExpires` não retornados
- [ ] IDs sempre UUID
- [ ] Módulo actualizado com novo service/controller
- [ ] Module exporta service se outro módulo precisar
- [ ] Query params numéricos usam `ParseIntPipe({ optional: true })` (SEM DefaultValuePipe — causa conflito com ValidationPipe global)
- [ ] Totais calculados via SQL, não em memória
- [ ] Colunas `number | null` têm `type: 'int'` no `@Column()`

---

*Prompt atualizado em: 27/02/2026 | Versão: 9.1 | Projeto: NavegaJá Backend*
