# NavegaJá — Dashboard Web Admin: O que implementar

> Backend v9.0 — Todas as APIs disponíveis para o painel web (React/Next.js)
> Login: `POST /auth/login-web` com `{ email, password }` — retorna JWT admin

---

## Índice

1. [Autenticação e Layout](#1-autenticação-e-layout)
2. [Dashboard Overview](#2-dashboard-overview)
3. [SOS — Painel em Tempo Real (NOVO)](#3-sos--painel-em-tempo-real)
4. [KYC — Verificação de Capitães (NOVO)](#4-kyc--verificação-de-capitães)
5. [Embarcações — Verificação (NOVO)](#5-embarcações--verificação)
6. [Encomendas — Gestão Completa (NOVO)](#6-encomendas--gestão-completa)
7. [Cupons — CRUD com Notificação (NOVO)](#7-cupons--crud-com-notificação)
8. [Promoções — Banners (NOVO)](#8-promoções--banners)
9. [Broadcast de Notificações (NOVO)](#9-broadcast-de-notificações)
10. [Avaliações — Moderação (NOVO)](#10-avaliações--moderação)
11. [Segurança — Checklists e Contatos](#11-segurança--checklists-e-contatos)
12. [Flood Hub — Widget de Cheias (NOVO)](#12-flood-hub--widget-de-cheias)
13. [Reservas — Gestão](#13-reservas--gestão)
14. [Usuários — Gestão Completa](#14-usuários--gestão-completa)
15. [Viagens — Gestão](#15-viagens--gestão)
16. [Badge de Notificações Admin](#16-badge-de-notificações-admin)
17. [Endpoints — Referência Rápida](#17-endpoints--referência-rápida)

---

## 1. Autenticação e Layout

```typescript
// Login admin
POST /auth/login-web
{ "email": "admin@navegaja.com", "password": "admin123" }
// → { access_token, user }

// Cabeçalho JWT
headers: { Authorization: `Bearer ${token}` }
```

**Sidebar sugerida:**
```
Dashboard
├── Overview
├── Notificações (badge)
Operações
├── Viagens
├── Reservas
├── Encomendas  ← NOVO
Pessoas
├── Usuários
├── Capitães (KYC)  ← NOVO
├── Embarcações  ← NOVO
Segurança
├── SOS Alerts  ← NOVO
├── Checklists
├── Contatos de Emergência
Marketing
├── Cupons  ← NOVO
├── Promoções  ← NOVO
├── Broadcast Push  ← NOVO
Moderação
├── Reviews
Monitoramento
├── Flood Hub  ← NOVO
```

---

## 2. Dashboard Overview

### Endpoints

```
GET /admin/dashboard            → números gerais
GET /admin/dashboard/chart?days=7   → dados para gráfico de linha
GET /admin/dashboard/activity?limit=50  → atividade recente
```

### Resposta de `/admin/dashboard`

```json
{
  "users": { "total": 150, "newToday": 3, "activeUsers": 135 },
  "trips": { "total": 250, "scheduled": 45, "inProgress": 8, "todayTrips": 5 },
  "shipments": { "total": 520, "pending": 45, "inTransit": 25, "todayShipments": 8 },
  "sosAlerts": { "active": 2, "totalToday": 5, "totalThisWeek": 12 },
  "revenue": { "today": 2340.00, "thisWeek": 15680.00, "thisMonth": 58900.00 },
  "recentActivity": []
}
```

### Widgets sugeridos

| Widget | Dados |
|--------|-------|
| Receita do mês | `revenue.thisMonth` |
| Viagens ativas | `trips.inProgress` |
| SOS ativos | `sosAlerts.active` — **vermelho se > 0** |
| Novos hoje | `users.newToday` |
| Encomendas pendentes | `shipments.pending` |

### Gráfico

```typescript
// GET /admin/dashboard/chart?days=30
// Retorna array de { date, bookings, users, trips }
// → Recharts LineChart com 3 linhas
```

---

## 3. SOS — Painel em Tempo Real

> **Prioridade máxima** — admins precisam resolver emergências rapidamente.

### Endpoints

```
GET  /safety/sos/active              → alertas SOS ativos (admin/captain)
PATCH /safety/sos/:id/resolve        → resolver ou marcar falso alarme
```

### Polling / SSE

```typescript
// Polling a cada 30 segundos (ou WebSocket se implementado)
const fetchSos = async () => {
  const { data } = await api.get('/safety/sos/active');
  setSosAlerts(data);
};

useEffect(() => {
  fetchSos();
  const interval = setInterval(fetchSos, 30_000);
  return () => clearInterval(interval);
}, []);
```

### Resolver SOS

```typescript
// PATCH /safety/sos/:id/resolve
{
  "status": "resolved" | "false_alarm",
  "notes": "Situação controlada pela Marinha"
}
```

### UI sugerida

```
┌─ SOS ATIVOS (2) ─────────────────────────────────────────────────────┐
│ 🔴 [emergency]  João Silva  •  Manaus → Parintins  •  há 5 min       │
│    "Motor parou, derivando"  •  Lat: -3.12, Lng: -60.02              │
│    [Resolver] [Falso Alarme]                                           │
│                                                                        │
│ 🟡 [medical]   Maria Santos  •  Sem viagem  •  há 2 min              │
│    "Passageiro com mal estar"                                          │
│    [Resolver] [Falso Alarme]                                           │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 4. KYC — Verificação de Capitães

### Endpoints

```
GET   /admin/users?role=captain&search=...   → lista capitães (com kycStatus)
GET   /admin/users/:id                        → detalhes + documentos KYC
PATCH /admin/users/:id/verify                 → aprovar ou rejeitar
```

### Aprovar KYC

```typescript
// PATCH /admin/users/:id/verify
{ "verified": true }
// ou
{ "verified": false, "rejectionReason": "Habilitação náutica ilegível" }
```

### Campos KYC do capitão

```typescript
interface CaptainKyc {
  kycStatus: 'not_submitted' | 'pending' | 'approved' | 'rejected';
  kycDocumentUrl: string | null;      // URL do documento enviado
  kycSelfieUrl: string | null;        // Selfie para verificação
  kycSubmittedAt: string | null;
  kycRejectionReason: string | null;
  isVerified: boolean;                // true = pode criar viagens
}
```

### UI sugerida

```
Filtro: [Todos] [Pendentes] [Aprovados] [Rejeitados]

┌─ Capitão: Carlos Navegador ──────────────────────────────────────────┐
│ Status KYC: ⏳ pending  •  Enviado em 25/02/2026                     │
│ Documento: [Ver PDF/Imagem]    Selfie: [Ver foto]                    │
│                                                                        │
│ [Aprovar Capitão]  [Rejeitar: motivo___________________________]     │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Embarcações — Verificação

### Endpoints

```
GET   /admin/boats/pending              → lista barcos pendentes de verificação
GET   /admin/boats?page=1&limit=20&verified=false&search=...
PATCH /admin/boats/:id/verify           → aprovar ou rejeitar barco
GET   /admin/users/:id                  → ver documentos do barco (docs no campo boatDocs)
```

### Aprovar embarcação

```typescript
// PATCH /admin/boats/:id/verify
{ "approved": true }
// ou
{ "approved": false, "rejectionReason": "Certificado de vistoria vencido" }
```

### Página "Verificações Pendentes" (atalho rápido)

```typescript
// GET /admin/boats/pending
// Retorna { pendingBoats: [], pendingCaptains: [], total: N }
// → Widget no dashboard com link rápido
```

---

## 6. Encomendas — Gestão Completa

### Endpoints

```
GET   /admin/shipments?page=1&limit=20&status=pending&trackingCode=XXX
GET   /admin/shipments/stats
PATCH /admin/shipments/:id/status       → mudar status manualmente
```

### Status disponíveis

```
pending → paid → collected → in_transit → arrived → out_for_delivery → delivered
cancelled
```

### Campos novos de encomenda

```typescript
interface Shipment {
  paidBy: 'sender' | 'recipient';    // NOVO — frete a cobrar
  recipientUserId: string | null;     // NOVO — destinatário tem conta?
  weightKg: number;
  totalPrice: number;
  trackingCode: string;               // ex: ENV-2025-1234
  validationCode: string;             // PIN de 6 dígitos
  collectionPhotoUrl: string | null;  // foto na coleta
  deliveryPhotoUrl: string | null;    // foto na entrega
}
```

### Tabela sugerida

| Código | Remetente | Destinatário | Peso | Valor | Status | paidBy | Ações |
|--------|-----------|--------------|------|-------|--------|--------|-------|
| ENV-001 | João | Maria | 3.5 kg | R$ 17,33 | pending | sender | [Ver] [Status] |
| ENV-002 | Ana | Pedro | 10 kg | R$ 45,00 | collected | recipient | [Ver] |

---

## 7. Cupons — CRUD com Notificação

> Ao criar um cupom, **todos os usuários com FCM token** recebem push automaticamente.

### Endpoints

```
POST   /coupons          → criar cupom (dispara push para todos)
GET    /coupons          → listar todos (admin)
GET    /coupons/:code    → buscar por código
PUT    /coupons/:id      → atualizar
DELETE /coupons/:id      → deletar
```

### Criar cupom

```typescript
// POST /coupons
{
  "code": "VERAO10",
  "description": "10% de desconto no verão amazônico",
  "type": "percentage",        // "percentage" | "fixed"
  "value": 10,
  "applicableTo": "both",      // "trips" | "shipments" | "both"
  "minPurchase": 50,           // opcional
  "maxDiscount": 30,           // opcional — teto em R$
  "usageLimit": 100,           // opcional
  "validFrom": "2026-03-01T00:00:00Z",
  "validUntil": "2026-03-31T23:59:59Z",
  "firstPurchaseOnly": false,
  "fromCity": null,            // opcional — restringir rota
  "toCity": null,
  "minWeight": null,           // opcional — só para encomendas
  "maxWeight": null
}
```

### Campos de filtro avançado

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `fromCity` | string | Só vale saindo desta cidade |
| `toCity` | string | Só vale indo para esta cidade |
| `minWeight` | number | Peso mínimo em kg (encomendas) |
| `maxWeight` | number | Peso máximo em kg (encomendas) |
| `firstPurchaseOnly` | boolean | Só para 1ª compra |
| `applicableTo` | enum | trips / shipments / both |

---

## 8. Promoções — Banners

> Banners promocionais que aparecem no carrossel do app.

### Endpoints

```
POST   /promotions          → criar promoção (admin)
GET    /promotions          → listar todas (admin)
GET    /promotions/:id      → detalhes
PUT    /promotions/:id      → atualizar
PUT    /promotions/:id/toggle  → ativar/desativar
DELETE /promotions/:id      → deletar
GET    /promotions/active   → público (app usa este)
```

### Criar promoção

```typescript
// POST /promotions
{
  "title": "Festa de Parintins 2026",
  "description": "Garanta sua passagem para o maior festival da Amazônia!",
  "imageUrl": "https://cdn.navegaja.com/banners/parintins.jpg",
  "ctaText": "Comprar agora",
  "ctaAction": "navigate",    // "navigate" | "coupon" | "url"
  "ctaValue": "Parintins",    // destino ou código cupom
  "backgroundColor": "#FF6B00",
  "textColor": "#FFFFFF",
  "priority": 1,              // ordem no carrossel (menor = primeiro)
  "startDate": "2026-05-01T00:00:00Z",
  "endDate": "2026-06-30T23:59:59Z",
  "couponCode": "PARINTINS20", // opcional — associar cupom
  "fromCity": "Manaus",
  "toCity": "Parintins"
}
```

---

## 9. Broadcast de Notificações

> Enviar push para todos os usuários ou segmento específico.

### Endpoint

```
POST /admin/notifications/broadcast
```

### Payload

```typescript
{
  "title": "Promo fim de semana!",
  "body": "Use FIMDESEMANA15 e ganhe 15% de desconto este fim de semana.",
  "cities": ["Manaus", "Parintins"],  // opcional — só estas cidades
  "roles": ["passenger"],             // opcional — só passageiros
  "data": {
    "type": "new_coupon",
    "couponCode": "FIMDESEMANA15"
  }
}
```

### Resposta

```json
{ "sent": 142, "message": "Broadcast enviado para 142 dispositivos" }
```

### UI sugerida

```
┌─ Enviar Notificação ──────────────────────────────────────────────────┐
│ Título: [________________________]                                     │
│ Mensagem: [___________________________________________]                │
│                                                                        │
│ Segmentação:                                                           │
│ Cidades: [Manaus ×] [Parintins ×] [+ Adicionar]  (vazio = todas)    │
│ Público: [✓] Passageiros  [✓] Capitães  [ ] Admins                   │
│                                                                        │
│ Dados extras (deep link):                                              │
│ type: [new_coupon] code: [PROMO10]                                    │
│                                                                        │
│ [Enviar para ~142 dispositivos]                                        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 10. Avaliações — Moderação

### Endpoints

```
GET    /admin/reviews?page=1&limit=20&type=passenger_to_captain&search=
GET    /admin/reviews/stats
GET    /admin/reviews/:id
DELETE /admin/reviews/:id    → remove e recalcula rating do capitão/barco
```

### Tipos de avaliação

- `passenger_to_captain` — passageiro avalia capitão e barco
- `captain_to_passenger` — capitão avalia passageiro

### Filtros de moderação

```typescript
// Buscar avaliações com nota baixa para revisão
GET /admin/reviews?minRating=1&maxRating=2
```

> **Nota:** Ao deletar uma review (`DELETE /admin/reviews/:id`), o backend recalcula automaticamente o `captainRating` e o `boatRating` afectados. Não precisa de ação adicional.

---

## 11. Segurança — Checklists e Contatos

### Checklists

```
GET /admin/safety/checklists?incomplete=true   → checklists incompletos
GET /admin/safety/checklists/stats             → compliance de segurança
```

### Resposta de stats

```json
{
  "total": 45,
  "complete": 38,
  "incomplete": 7,
  "complianceRate": 84.4,
  "itemStats": {
    "lifeJacketsAvailable": { "true": 43, "false": 2 },
    "fireExtinguisherCheck": { "true": 40, "false": 5 }
  }
}
```

### Contatos de Emergência

```
GET  /safety/emergency-contacts              → público
POST /safety/emergency-contacts             → criar (admin)
PUT  /safety/emergency-contacts/:id         → atualizar (admin)
POST /safety/emergency-contacts/seed        → popular defaults AM (admin)
```

---

## 12. Flood Hub — Widget de Cheias

> API pública — exibir alerta no topo do dashboard quando severidade for alta.

### Endpoints

```
GET /weather/flood/status?lat=-3.119&lng=-60.0217&radiusKm=100
GET /weather/flood/events
GET /weather/flood/inundation
```

### Resposta de status

```json
{
  "severity": "NORMAL",   // NORMAL | MODERATE | HIGH | EXTREME
  "level": 23.4,
  "trend": "rising",
  "message": "Nível do Rio Negro dentro do normal",
  "lastUpdated": "2026-02-27T10:00:00Z"
}
```

### Widget sugerido

```
┌─ Rio Negro — Monitoramento de Cheias ────────────────────────────────┐
│ Nível: 23.4m  •  Tendência: subindo  •  Severidade: ⚠️ MODERADO    │
│ Última atualização: 27/02 10:00                                        │
│ [Ver detalhes]                                                         │
└────────────────────────────────────────────────────────────────────────┘
```

> **Se `severity === 'EXTREME'`:** mostrar banner vermelho no topo do dashboard — criação de viagens está bloqueada automaticamente no backend.

---

## 13. Reservas — Gestão

### Endpoints

```
GET    /admin/bookings?page=1&limit=20&status=confirmed&paymentStatus=paid&search=
GET    /admin/bookings/stats
GET    /admin/bookings/:id
PATCH  /admin/bookings/:id/status   { status: 'cancelled' }
DELETE /admin/bookings/:id
```

### Status de reserva

```
pending → confirmed → checked_in → completed
cancelled
```

---

## 14. Usuários — Gestão Completa

### Endpoints

```
GET    /admin/users?page=1&limit=20&role=captain&search=
GET    /admin/users/stats
GET    /admin/users/:id
POST   /admin/captains              → criar conta de capitão
PATCH  /admin/users/:id/role        { role: 'captain' | 'passenger' | 'admin' }
PATCH  /admin/users/:id/status      { active: false }
PATCH  /admin/users/:id/verify      { verified: true }  ← KYC
DELETE /admin/users/:id
```

---

## 15. Viagens — Gestão

### Endpoints

```
GET    /admin/trips?page=1&limit=20&status=scheduled&captainId=
GET    /admin/trips/stats
PATCH  /admin/trips/:id/status      { status: 'cancelled' }
DELETE /admin/trips/:id
```

### GPS em tempo real (opcional no painel)

```
GET /trips/:id/location   → { lat, lng, lastLocationAt, status }
```

> Útil para um mapa ao vivo com as viagens em andamento.

---

## 16. Badge de Notificações Admin

> Polling a cada 60 segundos para manter o badge atualizado.

### Endpoint

```
GET /admin/notifications
```

### Resposta

```json
{
  "totalUnread": 5,
  "sos": {
    "count": 1,
    "items": [{ "id": "uuid", "type": "emergency", "userName": "João" }]
  },
  "pendingVerifications": {
    "count": 3,
    "boats": [],
    "captains": []
  },
  "newTrips": {
    "count": 1,
    "items": [{ "id": "uuid", "origin": "Manaus", "destination": "Parintins" }]
  }
}
```

```typescript
// Badge no header
const badgeCount = notifications?.totalUnread ?? 0;

// Polling
useEffect(() => {
  const interval = setInterval(() => refetch(), 60_000);
  return () => clearInterval(interval);
}, []);
```

---

## 17. Endpoints — Referência Rápida

```typescript
// src/api/config.ts — Dashboard Web

const API = {
  // Auth
  LOGIN_WEB: '/auth/login-web',

  // Admin Dashboard
  ADMIN_DASHBOARD: '/admin/dashboard',
  ADMIN_CHART: '/admin/dashboard/chart',
  ADMIN_ACTIVITY: '/admin/dashboard/activity',
  ADMIN_NOTIFICATIONS: '/admin/notifications',

  // Users
  ADMIN_USERS: '/admin/users',
  ADMIN_USER: (id: string) => `/admin/users/${id}`,
  ADMIN_USER_ROLE: (id: string) => `/admin/users/${id}/role`,
  ADMIN_USER_STATUS: (id: string) => `/admin/users/${id}/status`,
  ADMIN_USER_VERIFY: (id: string) => `/admin/users/${id}/verify`,   // KYC
  ADMIN_CREATE_CAPTAIN: '/admin/captains',
  ADMIN_USER_STATS: '/admin/users/stats',

  // Trips
  ADMIN_TRIPS: '/admin/trips',
  ADMIN_TRIP_STATUS: (id: string) => `/admin/trips/${id}/status`,
  ADMIN_TRIP_STATS: '/admin/trips/stats',

  // Bookings
  ADMIN_BOOKINGS: '/admin/bookings',
  ADMIN_BOOKING: (id: string) => `/admin/bookings/${id}`,
  ADMIN_BOOKING_STATUS: (id: string) => `/admin/bookings/${id}/status`,
  ADMIN_BOOKING_STATS: '/admin/bookings/stats',

  // Shipments (NOVO)
  ADMIN_SHIPMENTS: '/admin/shipments',
  ADMIN_SHIPMENT_STATUS: (id: string) => `/admin/shipments/${id}/status`,
  ADMIN_SHIPMENT_STATS: '/admin/shipments/stats',

  // Boats (NOVO)
  ADMIN_BOATS: '/admin/boats',
  ADMIN_BOATS_PENDING: '/admin/boats/pending',
  ADMIN_BOAT_VERIFY: (id: string) => `/admin/boats/${id}/verify`,

  // Reviews
  ADMIN_REVIEWS: '/admin/reviews',
  ADMIN_REVIEW: (id: string) => `/admin/reviews/${id}`,
  ADMIN_REVIEW_STATS: '/admin/reviews/stats',

  // Safety (NOVO)
  SOS_ACTIVE: '/safety/sos/active',
  SOS_RESOLVE: (id: string) => `/safety/sos/${id}/resolve`,
  CHECKLISTS: '/admin/safety/checklists',
  CHECKLIST_STATS: '/admin/safety/checklists/stats',
  EMERGENCY_CONTACTS: '/safety/emergency-contacts',

  // Coupons (NOVO)
  COUPONS: '/coupons',
  COUPON: (id: string) => `/coupons/${id}`,

  // Promotions (NOVO)
  PROMOTIONS: '/promotions',
  PROMOTION: (id: string) => `/promotions/${id}`,
  PROMOTION_TOGGLE: (id: string) => `/promotions/${id}/toggle`,

  // Broadcast (NOVO)
  BROADCAST: '/admin/notifications/broadcast',

  // Flood Hub (NOVO)
  FLOOD_STATUS: '/weather/flood/status',
  FLOOD_EVENTS: '/weather/flood/events',
};
```

---

## Prioridade de implementação

| Prioridade | Feature | Motivo |
|-----------|---------|--------|
| 🔴 Alta | SOS Painel | Segurança dos usuários |
| 🔴 Alta | KYC Verificação | Capitões bloqueados sem aprovação |
| 🔴 Alta | Embarcações (verify) | Barcos bloqueados sem aprovação |
| 🟡 Média | Encomendas | Novo módulo completo |
| 🟡 Média | Cupons | Novo com push automático |
| 🟡 Média | Broadcast Push | Ferramenta de marketing |
| 🟢 Baixa | Promoções/Banners | Nice to have |
| 🟢 Baixa | Flood Hub widget | Informativo |
| 🟢 Baixa | Reviews moderação | Esporádico |
