# 📘 NavegaJá Backend - Documentação Completa do Projeto

> **Versão:** 2.0.0
> **Última atualização:** 13 de fevereiro de 2026
> **Stack:** NestJS + TypeORM + PostgreSQL

---

## 📋 Índice

1. [Visão Geral](#-visão-geral)
2. [Arquitetura](#-arquitetura)
3. [Módulos Principais](#-módulos-principais)
4. [Banco de Dados](#-banco-de-dados)
5. [Fluxos Principais](#-fluxos-principais)
6. [Autenticação e Autorização](#-autenticação-e-autorização)
7. [Integrações](#-integrações)
8. [Documentação Técnica Detalhada](#-documentação-técnica-detalhada)

---

## 🎯 Visão Geral

**NavegaJá** é uma plataforma de transporte fluvial no Amazonas que conecta:
- **Passageiros** que desejam viajar entre cidades
- **Capitães** que operam embarcações
- **Remetentes** que enviam encomendas

### Funcionalidades Principais

1. **Sistema de Viagens**
   - Busca de viagens com filtros avançados (origem, destino, data, preço)
   - Reserva de assentos com seleção de tipo de acomodação
   - Sistema de cupons e promoções em 3 camadas
   - Rastreamento em tempo real

2. **Sistema de Encomendas**
   - Envio de encomendas aproveitando viagens existentes
   - Validação com QR Code e PIN em 2 pontos (coleta + entrega)
   - Rastreamento com 8 estados diferentes
   - Cálculo automático de preço por peso/volume
   - Timeline de eventos

3. **Gamificação**
   - NavegaCoins (moeda virtual)
   - Sistema de pontos por ações
   - Níveis e badges
   - Resgate de benefícios

4. **Sistema de Cupons/Promoções**
   - Camada 1: Cupons tradicionais (código alfanumérico)
   - Camada 2: Promoções automáticas (sem código)
   - Camada 3: Campanhas sazonais com múltiplos cupons

---

## 🏗️ Arquitetura

### Stack Tecnológica

```
Backend:
├── NestJS 10.x (Framework)
├── TypeORM (ORM)
├── PostgreSQL (Banco de Dados)
├── JWT (Autenticação)
├── Passport (Estratégias de Auth)
├── class-validator (Validação de DTOs)
├── class-transformer (Transformação de dados)
├── qrcode (Geração de QR Codes)
└── bcryptjs (Hash de senhas)

Deploy:
├── Docker (Containerização)
└── Yarn (Gerenciador de pacotes)
```

### Estrutura de Diretórios

```
backend/
├── src/
│   ├── auth/              # Autenticação JWT
│   ├── users/             # Usuários e perfis
│   ├── boats/             # Embarcações
│   ├── trips/             # Viagens
│   ├── cargo/             # Cargas disponíveis
│   ├── shipments/         # Encomendas
│   ├── coupons/           # Cupons e Promoções
│   ├── reviews/           # Avaliações
│   ├── gamification/      # NavegaCoins e Gamificação
│   ├── mail/              # Envio de emails
│   ├── database/          # Seeds e migrations
│   └── main.ts            # Entry point
├── scripts/               # Scripts auxiliares (seed, migrations)
├── docs/                  # Documentação adicional
├── examples/              # Exemplos de requisições HTTP
└── PROJECT_OVERVIEW.md    # Este arquivo
```

### Padrões de Arquitetura

- **MVC Pattern**: Controllers → Services → Repositories
- **Dependency Injection**: NestJS DI container
- **Repository Pattern**: TypeORM repositories
- **DTO Pattern**: Data Transfer Objects com validação
- **Guard Pattern**: Autenticação e autorização
- **Circular Dependency Resolution**: forwardRef() para módulos interdependentes

---

## 📦 Módulos Principais

### 1. Auth Module

**Responsabilidade:** Autenticação e autorização de usuários

**Endpoints:**
```
POST   /auth/register          # Registro de novo usuário
POST   /auth/login             # Login (retorna JWT)
GET    /auth/profile           # Perfil do usuário autenticado
POST   /auth/refresh-token     # Renovar token JWT
```

**Fluxo de Autenticação:**
1. Usuário envia `email` + `password`
2. Backend valida credenciais
3. Retorna JWT token (válido por 7 dias)
4. App armazena token e envia em `Authorization: Bearer <token>`

**Roles:**
- `passenger` (padrão)
- `captain`
- `admin`

---

### 2. Users Module

**Responsabilidade:** Gestão de usuários e perfis

**Endpoints:**
```
GET    /users                  # Listar usuários (admin)
GET    /users/:id              # Buscar usuário por ID
PATCH  /users/:id              # Atualizar perfil
DELETE /users/:id              # Deletar usuário (admin)
```

**Entidade User:**
```typescript
{
  id: string (UUID)
  email: string (único)
  password: string (hash bcrypt)
  name: string
  cpf: string (opcional)
  phone: string
  role: 'passenger' | 'captain' | 'admin'
  profilePictureUrl: string (opcional)
  createdAt: Date
  updatedAt: Date
}
```

---

### 3. Boats Module

**Responsabilidade:** Cadastro e gestão de embarcações

**Endpoints:**
```
POST   /boats                  # Criar embarcação (captain)
GET    /boats                  # Listar embarcações
GET    /boats/:id              # Detalhes da embarcação
PATCH  /boats/:id              # Atualizar embarcação (captain)
DELETE /boats/:id              # Deletar embarcação (captain)
```

**Entidade Boat:**
```typescript
{
  id: string (UUID)
  name: string
  registrationNumber: string (único)
  capacity: number
  ownerId: string (FK → users)
  photos: string[] (URLs)
  amenities: string[] (wi-fi, ar-condicionado, etc)
  createdAt: Date
  updatedAt: Date
}
```

---

### 4. Trips Module

**Responsabilidade:** Criação e gestão de viagens

**Endpoints:**
```
POST   /trips                           # Criar viagem (captain)
GET    /trips                           # Buscar viagens (com filtros)
GET    /trips/:id                       # Detalhes da viagem
PATCH  /trips/:id/status                # Atualizar status (captain)
POST   /trips/:id/reserve               # Reservar assento (passenger)
POST   /trips/:id/cancel-reservation    # Cancelar reserva (passenger)
GET    /trips/:id/passengers            # Listar passageiros (captain)
```

**Entidade Trip:**
```typescript
{
  id: string (UUID)
  boatId: string (FK → boats)
  captainId: string (FK → users)
  origin: string
  destination: string
  departureDate: Date
  arrivalDate: Date
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
  availableSeats: number
  pricePerSeat: number
  deckPrice: number
  cabinPrice: number
  vipCabinPrice: number
  description: string
  amenities: string[]
  createdAt: Date
  updatedAt: Date
}
```

**Status da Viagem:**
- `SCHEDULED` → `IN_PROGRESS` → `COMPLETED`
- `CANCELLED` (qualquer momento)

**Filtros de Busca:**
- `origin` (cidade de origem)
- `destination` (cidade de destino)
- `departureDate` (data de partida)
- `minPrice` / `maxPrice` (faixa de preço)
- `minSeats` (assentos mínimos disponíveis)
- `amenities` (comodidades desejadas)

**Sistema de Reservas:**
- Usuário seleciona tipo de acomodação: `deck`, `cabin`, `vip_cabin`
- Sistema valida disponibilidade (`availableSeats > 0`)
- Desconta assento e cria relação `user ↔ trip`
- Aplica cupom/promoção se fornecido

---

### 5. Shipments Module

**Responsabilidade:** Sistema completo de encomendas

#### 5.1 Estados da Encomenda (8 estados)

```
PENDING           → Aguardando pagamento
PAID              → Pagamento confirmado, aguardando coleta
COLLECTED         → Capitão coletou do remetente
IN_TRANSIT        → Viagem em andamento
ARRIVED           → Viagem chegou ao destino
OUT_FOR_DELIVERY  → Capitão saiu para entregar
DELIVERED         → Destinatário confirmou recebimento
CANCELLED         → Cancelada
```

#### 5.2 Endpoints

```
POST   /shipments                      # Criar encomenda
GET    /shipments                      # Listar encomendas do usuário
GET    /shipments/:id                  # Detalhes da encomenda
POST   /shipments/:id/confirm-payment  # Confirmar pagamento
POST   /shipments/:id/collect          # Coletar encomenda (captain + QR/PIN)
POST   /shipments/:id/out-for-delivery # Marcar como saiu para entrega (captain)
POST   /shipments/validate-delivery    # Validar entrega (público - destinatário + QR/PIN)
POST   /shipments/:id/cancel           # Cancelar encomenda
GET    /shipments/:id/timeline         # Timeline de eventos
GET    /shipments/track/:trackingCode  # Rastrear por código
```

#### 5.3 Entidade Shipment

```typescript
{
  id: string (UUID)
  senderId: string (FK → users)
  tripId: string (FK → trips)
  description: string
  weightKg: number
  length: number (cm)
  width: number (cm)
  height: number (cm)
  photos: string[] (URLs S3)
  recipientName: string
  recipientPhone: string
  recipientAddress: string
  totalPrice: number
  paymentMethod: 'pix' | 'credit_card' | 'cash'
  trackingCode: string (único, formato NJ2026000001)
  validationCode: string (PIN 6 dígitos)
  qrCode: string (base64 - deep link)
  status: ShipmentStatus
  collectionPhotoUrl: string (foto da coleta)
  collectedAt: Date
  deliveryPhotoUrl: string (foto da entrega)
  deliveredAt: Date
  createdAt: Date
  updatedAt: Date
}
```

#### 5.4 Cálculo de Preço

```typescript
// Regras de precificação
const pricePerKg = 5; // R$ 5 por kg
const volumetricWeight = (length * width * height) / 6000;
const chargeableWeight = Math.max(weightKg, volumetricWeight);
const basePrice = chargeableWeight * pricePerKg;
const finalPrice = basePrice; // + adicionais futuros
```

#### 5.5 Sistema de Validação

**QR Code com Deep Link:**
```
Formato: navegaja://shipment/validate?trackingCode=NJ2026000001&validationCode=123456
```

**Vantagens:**
- Escanear fora do app → Abre automaticamente o app
- Sem app instalado → Redireciona para Google Play/App Store
- Compartilhável via WhatsApp, SMS, etc.

**Pontos de Validação:**

1. **Coleta (Captain):**
   - Endpoint: `POST /shipments/:id/collect`
   - Requer: JWT do capitão + validationCode
   - Valida: Capitão pertence à viagem + Status = PAID + PIN correto
   - Atualiza: Status → COLLECTED, collectedAt, collectionPhotoUrl

2. **Entrega (Destinatário):**
   - Endpoint: `POST /shipments/validate-delivery`
   - Público (sem autenticação)
   - Requer: trackingCode + validationCode
   - Valida: Status = ARRIVED ou OUT_FOR_DELIVERY + PIN correto
   - Atualiza: Status → DELIVERED, deliveredAt, deliveryPhotoUrl
   - Credita NavegaCoins ao remetente

#### 5.6 Auto-Update por Status da Viagem

Quando uma viagem muda de status, todas as encomendas associadas são atualizadas automaticamente:

```typescript
Trip: SCHEDULED → IN_PROGRESS  =>  Shipments: COLLECTED → IN_TRANSIT
Trip: IN_PROGRESS → COMPLETED  =>  Shipments: IN_TRANSIT → ARRIVED
```

**Implementação:**
```typescript
// trips.service.ts
async updateStatus(tripId: string, captainId: string, dto: UpdateTripStatusDto) {
  // ... validações

  if (dto.status === TripStatus.IN_PROGRESS && oldStatus !== TripStatus.IN_PROGRESS) {
    await this.shipmentsService.updateShipmentsByTrip(tripId, ShipmentStatus.IN_TRANSIT);
  } else if (dto.status === TripStatus.COMPLETED && oldStatus !== TripStatus.COMPLETED) {
    await this.shipmentsService.updateShipmentsByTrip(tripId, ShipmentStatus.ARRIVED);
  }
}
```

#### 5.7 Timeline de Eventos

Cada mudança de status gera um evento na timeline:

```typescript
{
  id: string
  shipmentId: string
  status: ShipmentStatus
  description: string
  location: string (opcional)
  userId: string (opcional - quem realizou a ação)
  createdAt: Date
}
```

Exemplos:
```
"Encomenda criada"
"Pagamento confirmado. Aguardando coleta pelo capitão."
"Encomenda coletada pelo capitão"
"Viagem iniciada - Encomenda em trânsito"
"Viagem chegou ao destino - Aguardando entrega"
"Saiu para entrega ao destinatário"
"Entrega confirmada pelo destinatário"
```

---

### 6. Coupons/Promotions Module

**Responsabilidade:** Sistema de descontos em 3 camadas

#### 6.1 Camada 1: Cupons Tradicionais

**Características:**
- Código alfanumérico único (ex: `BEMVINDO10`)
- Usuário digita manualmente
- Validação no checkout
- Limite de usos (global e por usuário)
- Período de validade

**Entidade Coupon:**
```typescript
{
  id: string (UUID)
  code: string (único, ex: BEMVINDO10)
  description: string
  discountType: 'percentage' | 'fixed'
  discountValue: number
  minPurchase: number (opcional)
  maxDiscount: number (opcional)
  validFrom: Date
  validUntil: Date
  maxUses: number
  currentUses: number
  maxUsesPerUser: number
  active: boolean
  // Filtros opcionais
  routeFrom: string (opcional - origem específica)
  routeTo: string (opcional - destino específico)
  createdAt: Date
  updatedAt: Date
}
```

**Endpoints:**
```
POST   /coupons                # Criar cupom (admin)
GET    /coupons                # Listar cupons (admin)
GET    /coupons/active         # Cupons ativos disponíveis (público)
POST   /coupons/validate       # Validar cupom
PATCH  /coupons/:id            # Atualizar cupom (admin)
DELETE /coupons/:id            # Deletar cupom (admin)
```

#### 6.2 Camada 2: Promoções Automáticas

**Características:**
- Sem código, aplicadas automaticamente
- Baseadas em regras (origem, destino, período)
- Prioridade sobre cupons tradicionais
- Sistema escolhe a melhor promoção

**Entidade Promotion:**
```typescript
{
  id: string (UUID)
  title: string
  description: string
  discountType: 'percentage' | 'fixed'
  discountValue: number
  priority: number (maior = mais importante)
  validFrom: Date
  validUntil: Date
  active: boolean
  // Regras de aplicação
  routeFrom: string (opcional)
  routeTo: string (opcional)
  minPurchase: number (opcional)
  maxDiscount: number (opcional)
  applicableDays: number[] (0=dom, 6=sáb)
  createdAt: Date
  updatedAt: Date
}
```

**Endpoints:**
```
POST   /promotions             # Criar promoção (admin)
GET    /promotions             # Listar promoções (admin)
GET    /promotions/active      # Promoções ativas (público)
POST   /promotions/best-match  # Encontrar melhor promoção
PATCH  /promotions/:id         # Atualizar promoção (admin)
DELETE /promotions/:id         # Deletar promoção (admin)
```

**Lógica de Seleção:**
```typescript
// Promotions com maior priority primeiro
// Dentro da mesma priority, maior desconto primeiro
const bestPromotion = activePromotions
  .sort((a, b) => {
    if (a.priority !== b.priority) return b.priority - a.priority;
    return calculateDiscount(b) - calculateDiscount(a);
  })[0];
```

#### 6.3 Camada 3: Campanhas Sazonais

**Características:**
- Agrupamento de múltiplos cupons
- Válidas por período específico
- Tema/banner customizado
- Exibição destacada no app

**Uso:**
- Campanhas de Natal, Black Friday, etc.
- Banner na home do app
- Exibição de cupons relacionados

---

### 7. Gamification Module

**Responsabilidade:** Sistema de pontos, moedas e recompensas

#### 7.1 NavegaCoins

**Como Ganhar:**
```typescript
enum PointAction {
  TRIP_COMPLETED = 'trip_completed',           // +50 coins
  SHIPMENT_DELIVERED = 'shipment_delivered',   // +30 coins
  REVIEW_CREATED = 'review_created',           // +10 coins
  REFERRAL_SUCCESS = 'referral_success',       // +100 coins
  DAILY_LOGIN = 'daily_login',                 // +5 coins
}
```

**Entidade GamificationHistory:**
```typescript
{
  id: string
  userId: string
  action: PointAction
  points: number (positivo = ganho, negativo = gasto)
  description: string
  referenceId: string (ID da viagem/encomenda/etc)
  createdAt: Date
}
```

**Endpoints:**
```
GET    /gamification/balance           # Saldo atual do usuário
GET    /gamification/history           # Histórico de transações
POST   /gamification/redeem            # Resgatar benefício
```

#### 7.2 Níveis e Badges (Futuro)

Planejado para próximas versões:
- Bronze (0-500 coins)
- Prata (501-2000 coins)
- Ouro (2001+ coins)

---

### 8. Reviews Module

**Responsabilidade:** Avaliações de viagens e capitães

**Entidade Review:**
```typescript
{
  id: string
  tripId: string (FK → trips)
  userId: string (FK → users)
  rating: number (1-5)
  comment: string
  createdAt: Date
  updatedAt: Date
}
```

**Endpoints:**
```
POST   /reviews                # Criar avaliação
GET    /reviews/trip/:tripId   # Avaliações de uma viagem
GET    /reviews/user/:userId   # Avaliações de um usuário
```

---

## 🗄️ Banco de Dados

### Diagrama de Relacionamentos

```
users (1) ─────< (N) boats
  │                    │
  │                    │
  ├─────< trips >──────┘
  │         │
  │         ├─────< reservations
  │         │
  │         └─────< shipments
  │                    │
  │                    └─────< shipment_timeline
  │
  ├─────< reviews
  │
  ├─────< gamification_history
  │
  └─────< coupon_usages

coupons (1) ─────< (N) coupon_usages
promotions (tabela independente)
```

### Tabelas Principais

1. **users**: Usuários do sistema
2. **boats**: Embarcações cadastradas
3. **trips**: Viagens disponíveis
4. **reservations**: Reservas de assentos (M:N entre users e trips)
5. **shipments**: Encomendas
6. **shipment_timeline**: Histórico de eventos das encomendas
7. **coupons**: Cupons de desconto
8. **promotions**: Promoções automáticas
9. **coupon_usages**: Rastreamento de uso de cupons
10. **reviews**: Avaliações
11. **gamification_history**: Histórico de NavegaCoins

### Índices Importantes

```sql
-- Busca rápida de viagens
CREATE INDEX idx_trips_origin_destination ON trips(origin, destination);
CREATE INDEX idx_trips_departure_date ON trips(departure_date);
CREATE INDEX idx_trips_status ON trips(status);

-- Rastreamento de encomendas
CREATE INDEX idx_shipments_tracking_code ON shipments(tracking_code);
CREATE INDEX idx_shipments_sender_id ON shipments(sender_id);
CREATE INDEX idx_shipments_trip_id ON shipments(trip_id);

-- Performance de cupons
CREATE INDEX idx_coupons_code ON coupons(code);
CREATE INDEX idx_coupons_active_valid ON coupons(active, valid_from, valid_until);
```

---

## 🔄 Fluxos Principais

### Fluxo 1: Reservar Viagem

```
1. App busca viagens disponíveis
   GET /trips?origin=Manaus&destination=Parintins&departureDate=2026-02-20

2. Usuário seleciona viagem e tipo de acomodação

3. App verifica cupons/promoções disponíveis
   GET /coupons/active
   POST /promotions/best-match

4. App cria reserva
   POST /trips/:id/reserve
   Body: {
     seatType: 'cabin',
     couponCode: 'BEMVINDO10' (opcional)
   }

5. Backend valida:
   - Assentos disponíveis
   - Cupom válido (se fornecido)
   - Calcula desconto
   - Desconta assento
   - Registra uso do cupom

6. Retorna confirmação com preço final
```

### Fluxo 2: Enviar Encomenda (Completo)

```
1. Remetente cria encomenda
   POST /shipments
   Body: {
     tripId: "uuid",
     description: "Documentos",
     weightKg: 2.5,
     recipientName: "João Silva",
     recipientPhone: "+55 92 99999-9999",
     recipientAddress: "Rua X, Centro, Parintins"
   }

   Status: PENDING
   Backend gera: trackingCode + validationCode + QR Code (deep link)

2. Remetente confirma pagamento
   POST /shipments/:id/confirm-payment

   Status: PENDING → PAID

3. Capitão escaneia QR Code e coleta encomenda
   POST /shipments/:id/collect
   Body: {
     validationCode: "123456",
     collectionPhotoUrl: "https://s3.../photo.jpg"
   }

   Status: PAID → COLLECTED

4. Capitão inicia viagem
   POST /trips/:id/status
   Body: { status: "in_progress" }

   Trip: SCHEDULED → IN_PROGRESS
   Shipments da viagem: COLLECTED → IN_TRANSIT (automático)

5. Viagem chega ao destino
   POST /trips/:id/status
   Body: { status: "completed" }

   Trip: IN_PROGRESS → COMPLETED
   Shipments da viagem: IN_TRANSIT → ARRIVED (automático)

6. Capitão marca como saiu para entrega
   POST /shipments/:id/out-for-delivery

   Status: ARRIVED → OUT_FOR_DELIVERY

7. Destinatário escaneia QR Code e valida entrega
   POST /shipments/validate-delivery (público, sem auth)
   Body: {
     trackingCode: "NJ2026000001",
     validationCode: "123456",
     deliveryPhotoUrl: "https://s3.../delivery.jpg"
   }

   Status: OUT_FOR_DELIVERY → DELIVERED
   Backend credita NavegaCoins ao remetente
```

**Timeline Gerada:**
```
1. "Encomenda criada"
2. "Pagamento confirmado. Aguardando coleta pelo capitão."
3. "Encomenda coletada pelo capitão"
4. "Viagem iniciada - Encomenda em trânsito"
5. "Viagem chegou ao destino - Aguardando entrega"
6. "Saiu para entrega ao destinatário"
7. "Entrega confirmada pelo destinatário"
```

### Fluxo 3: Aplicação de Descontos

```
1. Usuário na tela de checkout com:
   - Viagem: Manaus → Parintins
   - Preço base: R$ 100
   - Data: 15/02/2026 (sábado)

2. Usuário digita cupom "BEMVINDO10"

3. Backend busca promoções ativas:
   - Promoção A: 15% OFF em viagens aos finais de semana (priority: 10)
   - Promoção B: 10% OFF Manaus → Parintins (priority: 5)

4. Backend busca cupom:
   - BEMVINDO10: 10% OFF (sem restrições)

5. Backend compara:
   - Promoção A (priority 10): R$ 100 - 15% = R$ 85 ✅ VENCEDOR
   - Promoção B (priority 5): R$ 100 - 10% = R$ 90
   - Cupom BEMVINDO10: R$ 100 - 10% = R$ 90

6. Aplica Promoção A automaticamente
   Retorna: {
     originalPrice: 100,
     discount: 15,
     finalPrice: 85,
     appliedPromotion: "15% OFF - Finais de Semana"
   }
```

---

## 🔐 Autenticação e Autorização

### JWT Token

**Estrutura:**
```typescript
{
  sub: "user-uuid",           // ID do usuário
  email: "user@example.com",
  role: "passenger",
  iat: 1707840000,            // Issued at
  exp: 1708444800             // Expira em 7 dias
}
```

**Uso no App:**
```typescript
// Armazenar após login
await AsyncStorage.setItem('auth_token', token);

// Enviar em todas requisições
headers: {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json',
}
```

### Guards

1. **JwtAuthGuard**: Valida token JWT
2. **RolesGuard**: Valida role do usuário
3. **@Roles('captain')**: Decorator para restringir acesso

**Exemplo:**
```typescript
@Post(':id/collect')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('captain')
collectShipment() {
  // Apenas capitães podem acessar
}
```

---

## 🔗 Integrações

### Deep Links (React Native)

**Configuração (app.json):**
```json
{
  "expo": {
    "scheme": "navegaja",
    "android": {
      "intentFilters": [{
        "action": "VIEW",
        "data": [
          { "scheme": "navegaja" },
          { "scheme": "https", "host": "navegaja.com" }
        ],
        "category": ["BROWSABLE", "DEFAULT"]
      }]
    },
    "ios": {
      "associatedDomains": ["applinks:navegaja.com"]
    }
  }
}
```

**Tratamento no App:**
```typescript
import * as Linking from 'expo-linking';

useEffect(() => {
  const handleDeepLink = (event: { url: string }) => {
    const { hostname, queryParams } = Linking.parse(event.url);

    // navegaja://shipment/validate?trackingCode=XXX&validationCode=YYY
    if (hostname === 'shipment') {
      const { trackingCode, validationCode } = queryParams;
      navigation.navigate('ValidateDelivery', {
        trackingCode,
        validationCode,
      });
    }
  };

  const subscription = Linking.addEventListener('url', handleDeepLink);

  Linking.getInitialURL().then((url) => {
    if (url) handleDeepLink({ url });
  });

  return () => subscription.remove();
}, []);
```

### Upload de Fotos (S3 - Futuro)

Planejado:
- Presigned URLs para upload direto do app
- Armazenamento em Amazon S3
- CDN CloudFront para servir imagens

**Campos que aceitam fotos:**
- `boats.photos[]`
- `shipments.photos[]`
- `shipments.collectionPhotoUrl`
- `shipments.deliveryPhotoUrl`
- `users.profilePictureUrl`

---

## 📚 Documentação Técnica Detalhada

### Documentos Disponíveis

1. **[ENDPOINTS_SPEC.md](ENDPOINTS_SPEC.md)**
   - Referência completa de todos os endpoints
   - Request/Response examples
   - Status codes

2. **[SHIPMENTS_COMPLETE_SPEC.md](SHIPMENTS_COMPLETE_SPEC.md)**
   - Especificação técnica v2.0 do sistema de encomendas
   - Comparação v1.0 vs v2.0
   - DTOs TypeScript
   - Deep link configuration

3. **[SHIPMENT_FLOW.md](SHIPMENT_FLOW.md)**
   - Fluxo detalhado passo a passo
   - Implementação de QR Code scanner
   - Tela de validação de entrega

4. **[PROMOTIONS_GUIDE.md](PROMOTIONS_GUIDE.md)**
   - Sistema de cupons e promoções
   - 3 camadas de descontos
   - Exemplos de uso

5. **[DATE_FORMAT_GUIDE.md](DATE_FORMAT_GUIDE.md)**
   - Padronização de datas
   - Formato ISO 8601
   - Timezone UTC

6. **[UUID_GUIDE.md](UUID_GUIDE.md)**
   - Uso de UUIDs vs IDs numéricos
   - Benefícios e implementação

### Exemplos de Requisições HTTP

Todos os exemplos estão em:
- `examples/trip-flow.http`
- `examples/shipments-test-complete.http`
- `examples/promotions.http`
- `examples/coupons-with-routes.http`

**Como usar (VSCode REST Client):**
```http
### 1. Registrar usuário
POST {{baseUrl}}/auth/register
Content-Type: application/json

{
  "email": "teste@example.com",
  "password": "senha123",
  "name": "Teste User",
  "phone": "+55 92 99999-9999"
}
```

---

## 🚀 Como Rodar o Projeto

### Pré-requisitos

```bash
- Node.js 18+
- PostgreSQL 14+
- Yarn
```

### Instalação

```bash
# 1. Instalar dependências
yarn install

# 2. Configurar variáveis de ambiente
cp .env.example .env
# Editar .env com suas credenciais

# 3. Criar banco de dados
createdb navegaja_db

# 4. Rodar migrations (TypeORM sincroniza automaticamente)
yarn start:dev

# 5. Popular banco com dados de teste
yarn seed
```

### Variáveis de Ambiente

```env
# Database
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres
DATABASE_NAME=navegaja_db

# JWT
JWT_SECRET=sua-chave-secreta-aqui
JWT_EXPIRES_IN=7d

# App
PORT=3000
NODE_ENV=development
```

### Scripts Disponíveis

```bash
yarn start:dev     # Desenvolvimento (hot reload)
yarn start:prod    # Produção
yarn build         # Compilar TypeScript
yarn lint          # Executar ESLint
yarn format        # Formatar código (Prettier)
yarn seed          # Popular banco de dados
```

---

## 🔧 Troubleshooting

### Erro: "relation does not exist"

Solução: Dropar e recriar tabelas

```bash
# 1. Conectar ao PostgreSQL
psql navegaja_db

# 2. Dropar tabelas problemáticas
\i scripts/drop-and-recreate-shipments.sql

# 3. Reiniciar servidor (TypeORM recria automaticamente)
yarn start:dev
```

### Erro: Circular Dependency

Já resolvido com `forwardRef()`:

```typescript
// trips.module.ts
imports: [
  forwardRef(() => ShipmentsModule),
],

// shipments.module.ts
imports: [
  forwardRef(() => TripsModule),
],
```

---

## 📊 Métricas e Monitoramento (Futuro)

Planejado:
- Logs estruturados (Winston)
- APM (Application Performance Monitoring)
- Sentry para error tracking
- Prometheus + Grafana para métricas

---

## 🎯 Roadmap

### Versão Atual (2.0)
- ✅ Sistema de viagens completo
- ✅ Sistema de encomendas com 8 estados
- ✅ QR Code com deep links
- ✅ Cupons e promoções (3 camadas)
- ✅ Gamificação básica (NavegaCoins)
- ✅ Avaliações

### Próximas Versões

**v2.1 - Notificações**
- Push notifications (Firebase)
- Email notifications (SendGrid)
- SMS notifications (Twilio)

**v2.2 - Pagamentos**
- Integração Stripe/Mercado Pago
- Split de pagamento (capitão + plataforma)
- Reembolsos automáticos

**v2.3 - Rastreamento GPS**
- Posição em tempo real das embarcações
- Mapa com rota no app
- Estimativa de chegada atualizada

**v2.4 - Chat**
- Chat entre passageiro e capitão
- Suporte via chat
- Notificações de mensagens

---

## 📞 Suporte

Para dúvidas sobre a implementação:
1. Consulte a documentação específica de cada módulo
2. Veja os exemplos HTTP em `/examples`
3. Leia os comentários no código-fonte

---

## 📝 Changelog

### v2.0.0 (13/02/2026)
- ✨ Novo sistema de encomendas com 8 estados
- ✨ QR Code com deep links
- ✨ Validação em 2 pontos (coleta + entrega)
- ✨ Auto-update de encomendas por status de viagem
- ✨ Sistema de promoções automáticas
- ✨ Filtros avançados de rotas para cupons
- 🐛 Correção de dependências circulares
- 📚 Documentação completa

### v1.0.0 (01/01/2026)
- 🎉 Release inicial
- Sistema básico de viagens e reservas
- Autenticação JWT
- Encomendas com 4 estados

---

**Desenvolvido com ❤️ usando NestJS**
