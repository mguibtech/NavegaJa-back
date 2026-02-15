# 🚢 NavegaJá Captain App - Guia Completo de Desenvolvimento

> **Para:** Equipe de desenvolvimento do App React Native/Expo
> **Perfil:** Captain (Capitão de Embarcação)
> **Versão Backend:** 2.0.0

---

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Tipos e Interfaces](#tipos-e-interfaces)
3. [Fluxo de Telas](#fluxo-de-telas)
4. [Endpoints por Funcionalidade](#endpoints-por-funcionalidade)
5. [Componentes Reutilizáveis](#componentes-reutilizáveis)
6. [Exemplos de Código](#exemplos-de-código)
7. [Priorização (MVP)](#priorização-mvp)
8. [Notificações Push](#notificações-push)

---

## 🎯 Visão Geral

O **Captain App** é a interface para capitães gerenciarem:
- ⛵ **Embarcações** (boats)
- 🗺️ **Viagens** (trips)
- 👥 **Passageiros** (bookings)
- 📦 **Encomendas** (shipments)
- 🚛 **Cargas Comerciais** (cargo)
- ⭐ **Avaliações** (reviews)
- 📊 **Estatísticas**

### Diferenças vs Passenger App

| Funcionalidade | Passenger | Captain |
|----------------|-----------|---------|
| Buscar viagens | ✅ Sim | ❌ Não |
| Criar viagem | ❌ Não | ✅ Sim |
| Reservar assento | ✅ Sim | ❌ Não |
| Check-in passageiro | ❌ Não | ✅ Sim |
| Coletar encomenda | ❌ Não | ✅ Sim (QR) |
| Rastrear GPS | ❌ Não | ✅ Sim |
| Ver estatísticas | Limitado | ✅ Completo |

---

## 📦 Tipos e Interfaces

### User (Captain)

```typescript
export interface Captain extends User {
  role: 'captain';
  rating: number; // Média de avaliações (1-5)
  totalTrips: number;
  totalPoints: number; // NavegaCoins
  level: string; // Ex: "Capitão Experiente"
  boats?: Boat[]; // Embarcações do capitão
}
```

### Boat

```typescript
export enum BoatType {
  LANCHA = 'lancha',
  VOADEIRA = 'voadeira',
  BALSA = 'balsa',
  RECREIO = 'recreio',
}

export interface Boat {
  id: string;
  ownerId: string; // Captain ID
  name: string; // Ex: "Estrela do Rio"
  type: BoatType;
  capacity: number; // Capacidade de passageiros
  model?: string; // Ex: "Mercury 150HP"
  year?: number;
  photoUrl?: string; // Foto principal
  photos?: string[]; // Galeria de fotos
  amenities: string[]; // Ex: ['wifi', 'banheiro', 'colete']
  registrationNum?: string; // Ex: "AM-1234"
  createdAt: string;
  updatedAt: string;
}

export interface CreateBoatDto {
  name: string;
  type: BoatType;
  capacity: number;
  model?: string;
  year?: number;
  photoUrl?: string;
  photos?: string[];
  amenities?: string[];
  registrationNum?: string;
}
```

### Trip (Captain)

```typescript
export enum TripStatus {
  SCHEDULED = 'scheduled',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export interface Trip {
  id: string;
  captainId: string;
  boatId: string;
  boat?: Boat;
  origin: string;
  destination: string;
  departureAt: string; // ISO 8601
  estimatedArrivalAt: string;
  status: TripStatus;
  price: number;
  discount: number; // 0-100%
  totalSeats: number;
  availableSeats: number;
  cargoPriceKg: number;
  cargoCapacityKg?: number;
  availableCargoKg?: number;
  currentLat?: number; // Rastreamento GPS
  currentLng?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;

  // Populated fields
  bookings?: Booking[];
  shipments?: Shipment[];
  cargoShipments?: CargoShipment[];
  reviews?: Review[];
}

export interface CreateTripDto {
  origin: string;
  destination: string;
  boatId: string;
  departureTime: string; // ISO 8601
  arrivalTime: string;
  price: number;
  discount?: number; // 0-100%
  totalSeats: number;
  cargoPriceKg?: number;
  cargoCapacityKg?: number;
}

export interface UpdateLocationDto {
  lat: number;
  lng: number;
}
```

### Booking (Passenger)

```typescript
export enum BookingStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  CHECKED_IN = 'checked_in',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum PaymentStatus {
  PENDING = 'pending',
  PAID = 'paid',
  REFUNDED = 'refunded',
}

export interface Booking {
  id: string;
  passengerId: string;
  passenger?: User;
  tripId: string;
  trip?: Trip;
  seats: number;
  seatNumber?: number;
  totalPrice: number;
  status: BookingStatus;
  qrCode: string; // Format: "NVGJ-{id}"
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  checkedInAt?: string;
  createdAt: string;
  updatedAt: string;
}
```

### Shipment (Encomenda)

```typescript
export enum ShipmentStatus {
  PENDING = 'pending',
  PAID = 'paid',
  COLLECTED = 'collected', // ← Capitão coletou
  IN_TRANSIT = 'in_transit',
  ARRIVED = 'arrived',
  OUT_FOR_DELIVERY = 'out_for_delivery', // ← Capitão saiu para entregar
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
}

export interface Shipment {
  id: string;
  senderId: string;
  sender?: User;
  tripId: string;
  trip?: Trip;
  description: string;
  weight: number; // kg
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
  photos: string[];
  recipientName: string;
  recipientPhone: string;
  recipientAddress: string;
  totalPrice: number;
  paymentMethod: PaymentMethod;
  trackingCode: string; // Ex: "NJ2026000001"
  validationCode: string; // PIN 6 dígitos
  qrCode: string; // Deep link base64
  status: ShipmentStatus;
  collectionPhotoUrl?: string; // ← Foto da coleta
  collectedAt?: string;
  deliveryPhotoUrl?: string;
  deliveredAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CollectShipmentDto {
  validationCode: string; // 6 dígitos
  collectionPhotoUrl?: string;
}
```

### CargoShipment (Carga Comercial)

```typescript
export enum CargoType {
  MOTORCYCLE = 'motorcycle',
  CAR = 'car',
  PICKUP_TRUCK = 'pickup_truck',
  RANCHO = 'rancho', // Compras/suprimentos
  CONSTRUCTION = 'construction',
  FUEL = 'fuel',
  LIVESTOCK = 'livestock',
  ELECTRONICS = 'electronics',
  GENERAL = 'general',
}

export enum CargoStatus {
  PENDING_QUOTE = 'pending_quote', // ← Aguardando capitão cotar
  QUOTED = 'quoted', // ← Capitão cotou
  CONFIRMED = 'confirmed',
  LOADED = 'loaded',
  IN_TRANSIT = 'in_transit',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
}

export interface CargoShipment {
  id: string;
  tripId: string;
  trip?: Trip;
  senderId: string;
  sender?: User;
  cargoType: CargoType;
  description: string; // Ex: "1 moto Honda CG 160 vermelha"
  quantity: number;
  estimatedWeightKg: number;
  dimensions?: string; // Ex: "2m x 0.8m x 1.1m"
  photoUrl?: string;
  receiverName: string;
  receiverPhone: string;
  totalPrice: number;
  status: CargoStatus;
  trackingCode: string;
  deliveryPhotoUrl?: string;
  deliveredAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface QuoteCargoDto {
  totalPrice: number;
}

export interface UpdateCargoStatusDto {
  status: CargoStatus;
}
```

### Review

```typescript
export interface Review {
  id: string;
  tripId: string;
  trip?: Trip;
  reviewerId: string; // Passageiro que avaliou
  reviewer?: User;
  captainId: string;
  rating: number; // 1-5
  comment?: string;
  createdAt: string;
}
```

---

## 🎨 Fluxo de Telas

### 1. Autenticação

```
LoginScreen
  ↓ (role: 'captain')
CaptainTabNavigator
  ├─ HomeScreen (Dashboard)
  ├─ TripsScreen (Viagens)
  ├─ ShipmentsScreen (Encomendas)
  └─ ProfileScreen (Perfil)
```

### 2. Home (Dashboard)

**HomeScreen.tsx**

```
┌─────────────────────────────┐
│  Olá, Capitão João         │
│  ⭐ 4.8  |  🚢 42 viagens  │
├─────────────────────────────┤
│  Viagem Ativa:             │
│  ┌───────────────────────┐ │
│  │ Manaus → Parintins    │ │
│  │ Partida em 2h30min    │ │
│  │ 12/20 assentos        │ │
│  │ [Ver Detalhes]        │ │
│  └───────────────────────┘ │
├─────────────────────────────┤
│  Estatísticas:             │
│  📦 3 encomendas pendentes │
│  🚛 2 cargas para cotar    │
│  👥 8 passageiros (próx.)  │
├─────────────────────────────┤
│  Ações Rápidas:            │
│  [+ Nova Viagem]           │
│  [Minhas Embarcações]      │
└─────────────────────────────┘
```

**Componentes:**
- **ActiveTripCard**: Viagem ativa com timer
- **StatsCards**: Grid de estatísticas
- **QuickActions**: Botões de ação rápida

**Dados:**
```typescript
GET /trips/captain/my-trips?status=scheduled&status=in_progress
GET /shipments?tripId={activeTrip}&status=paid
GET /cargo/trip/{activeTrip}?status=pending_quote
GET /bookings/trip/{activeTrip}?status=confirmed
```

---

### 3. Embarcações

**BoatsListScreen.tsx**

```
┌─────────────────────────────┐
│  Minhas Embarcações        │
│  [+ Adicionar Embarcação]  │
├─────────────────────────────┤
│  ┌───────────────────────┐ │
│  │ 🚤 Estrela do Rio     │ │
│  │ Lancha - 20 lugares   │ │
│  │ Comodidades: WiFi...  │ │
│  │ [Editar] [Criar Viag] │ │
│  └───────────────────────┘ │
│  ┌───────────────────────┐ │
│  │ 🛥️ Rio Negro Express  │ │
│  │ Voadeira - 8 lugares  │ │
│  │ [Editar] [Criar Viag] │ │
│  └───────────────────────┘ │
└─────────────────────────────┘
```

**CreateBoatScreen.tsx**

```
┌─────────────────────────────┐
│  Nova Embarcação           │
├─────────────────────────────┤
│  Nome: [_____________]     │
│  Tipo: [Lancha ▼]          │
│  Capacidade: [__] pessoas  │
│  Modelo: [_____________]   │
│  Ano: [____]               │
│                             │
│  Foto Principal:           │
│  [+ Adicionar Foto]        │
│                             │
│  Galeria (máx 5):          │
│  [+ Foto 1] [+ Foto 2]     │
│                             │
│  Comodidades:              │
│  ☑ WiFi  ☑ Banheiro       │
│  ☐ Ar-Cond ☑ Coletes      │
│                             │
│  [Cancelar] [Criar]        │
└─────────────────────────────┘
```

**Endpoints:**
```typescript
GET /boats/my-boats
POST /boats
GET /boats/:id
PUT /boats/:id (futuro)
DELETE /boats/:id (futuro)
```

---

### 4. Viagens

**TripsListScreen.tsx**

```
┌─────────────────────────────┐
│  Minhas Viagens            │
│  [🔍 Filtros] [+ Nova]     │
├─────────────────────────────┤
│  Tabs: [Ativas] [Agendadas]│
│        [Completadas]        │
├─────────────────────────────┤
│  ┌───────────────────────┐ │
│  │ 🟢 EM ANDAMENTO       │ │
│  │ Manaus → Parintins    │ │
│  │ Partiu há 2h15min     │ │
│  │ 12/20 passageiros     │ │
│  │ [Ver Detalhes]        │ │
│  └───────────────────────┘ │
│  ┌───────────────────────┐ │
│  │ 🔵 AGENDADA           │ │
│  │ Manaus → Santarém     │ │
│  │ Amanhã às 08:00       │ │
│  │ 5/20 passageiros      │ │
│  │ [Gerenciar]           │ │
│  └───────────────────────┘ │
└─────────────────────────────┘
```

**CreateTripScreen.tsx**

```
┌─────────────────────────────┐
│  Nova Viagem               │
├─────────────────────────────┤
│  Embarcação:               │
│  [Estrela do Rio ▼]        │
│                             │
│  Origem: [Manaus______]    │
│  Destino: [Parintins___]   │
│                             │
│  Partida:                  │
│  📅 15/02/2026  ⏰ 08:00   │
│                             │
│  Chegada Estimada:         │
│  📅 15/02/2026  ⏰ 14:00   │
│                             │
│  Passageiros:              │
│  Preço: R$ [45.00]         │
│  Desconto: [10]%           │
│  Assentos: [20]            │
│                             │
│  Carga:                    │
│  R$/kg: [15.00]            │
│  Capacidade: [500]kg       │
│                             │
│  [Cancelar] [Criar Viagem] │
└─────────────────────────────┘
```

**TripDetailsScreen.tsx**

```
┌─────────────────────────────┐
│  ← Manaus → Parintins      │
│  Status: 🟢 EM ANDAMENTO   │
├─────────────────────────────┤
│  Tabs: [Geral] [Passageiros]│
│        [Encomendas] [Cargas]│
├─────────────────────────────┤
│  [TAB GERAL]               │
│  Partida: 15/02 às 08:00   │
│  Chegada: 15/02 às 14:00   │
│  Preço: R$ 45,00           │
│  Ocupação: 12/20 (60%)     │
│                             │
│  Localização Atual:        │
│  [Mapa com pin GPS]        │
│  Última atualização: 10:45 │
│                             │
│  Ações:                    │
│  [Atualizar GPS]           │
│  [Finalizar Viagem]        │
└─────────────────────────────┘
```

**Endpoints:**
```typescript
GET /trips/captain/my-trips
POST /trips
GET /trips/:id
PUT /trips/:id
DELETE /trips/:id
PATCH /trips/:id/status
PATCH /trips/:id/location
```

---

### 5. Passageiros

**PassengersListScreen.tsx** (Tab dentro de TripDetails)

```
┌─────────────────────────────┐
│  👥 Passageiros (12)       │
│  [🔍 Buscar]               │
├─────────────────────────────┤
│  ┌───────────────────────┐ │
│  │ ✅ João Silva         │ │
│  │ 📱 92 99999-9999      │ │
│  │ 2 assentos | Assento 5│ │
│  │ Status: Check-in feito│ │
│  │ [Ver QR Code]         │ │
│  └───────────────────────┘ │
│  ┌───────────────────────┐ │
│  │ ⏳ Maria Santos       │ │
│  │ 📱 92 98888-8888      │ │
│  │ 1 assento | Assento 3 │ │
│  │ Status: Confirmado    │ │
│  │ [Fazer Check-in] 📷   │ │
│  └───────────────────────┘ │
└─────────────────────────────┘
```

**PassengerCheckInScreen.tsx**

```
┌─────────────────────────────┐
│  Check-in: Maria Santos    │
├─────────────────────────────┤
│  Detalhes:                 │
│  Nome: Maria Santos        │
│  Telefone: 92 98888-8888   │
│  Assentos: 1 (Assento #3)  │
│  Pagamento: PIX (Pago)     │
│                             │
│  QR Code do Passageiro:    │
│  ┌───────────────────────┐ │
│  │ [Abrir Scanner QR]    │ │
│  │ ou                    │ │
│  │ [Check-in Manual]     │ │
│  └───────────────────────┘ │
│                             │
│  [Voltar] [Confirmar]      │
└─────────────────────────────┘
```

**Endpoints:**
```typescript
GET /bookings/trip/:tripId
POST /bookings/:id/checkin
PATCH /bookings/:id/complete
```

---

### 6. Encomendas

**ShipmentsListScreen.tsx**

```
┌─────────────────────────────┐
│  📦 Encomendas             │
│  Tabs: [Pendentes] [Ativas]│
│        [Entregues]          │
├─────────────────────────────┤
│  ┌───────────────────────┐ │
│  │ 🔴 AGUARDANDO COLETA  │ │
│  │ #NJ2026000123         │ │
│  │ Documentos - 2.5kg    │ │
│  │ Remetente: João Silva │ │
│  │ Destino: Parintins    │ │
│  │ [Coletar com QR] 📷   │ │
│  └───────────────────────┘ │
│  ┌───────────────────────┐ │
│  │ 🟢 COLETADA           │ │
│  │ #NJ2026000124         │ │
│  │ Roupas - 5kg          │ │
│  │ Destinatário: Maria   │ │
│  │ [Marcar Entrega]      │ │
│  └───────────────────────┘ │
└─────────────────────────────┘
```

**CollectShipmentScreen.tsx**

```
┌─────────────────────────────┐
│  Coletar Encomenda         │
├─────────────────────────────┤
│  #NJ2026000123             │
│  Remetente: João Silva     │
│  Descrição: Documentos     │
│  Peso: 2.5kg               │
│                             │
│  Validação:                │
│  ┌───────────────────────┐ │
│  │ [Escanear QR Code] 📷 │ │
│  │ ou                    │ │
│  │ PIN: [______]         │ │
│  └───────────────────────┘ │
│                             │
│  Foto da Coleta:           │
│  [+ Tirar Foto]            │
│                             │
│  [Cancelar] [Coletar]      │
└─────────────────────────────┘
```

**DeliverShipmentScreen.tsx**

```
┌─────────────────────────────┐
│  Marcar Entrega            │
├─────────────────────────────┤
│  #NJ2026000123             │
│  Destinatário: Maria Santos│
│  Telefone: 92 98888-8888   │
│  Endereço: Rua X, 123      │
│                             │
│  Status Atual:             │
│  🟢 Saiu para entrega      │
│                             │
│  Foto da Entrega:          │
│  [+ Tirar Foto] (obrig.)   │
│                             │
│  OU                        │
│                             │
│  Destinatário valida:      │
│  (Enviar link WhatsApp)    │
│  [Enviar Link de Validação]│
│                             │
│  [Voltar] [Confirmar]      │
└─────────────────────────────┘
```

**Endpoints:**
```typescript
GET /shipments?tripId={id}&status=paid,collected,arrived
POST /shipments/:id/collect
POST /shipments/:id/out-for-delivery
PATCH /shipments/:id/deliver (deprecated)
```

---

### 7. Cargas Comerciais

**CargoListScreen.tsx**

```
┌─────────────────────────────┐
│  🚛 Cargas Comerciais      │
│  Tabs: [Cotações] [Ativas] │
│        [Entregues]          │
├─────────────────────────────┤
│  ┌───────────────────────┐ │
│  │ 💰 AGUARDANDO COTAÇÃO │ │
│  │ 🏍️ Moto Honda CG     │ │
│  │ Peso: ~120kg          │ │
│  │ Remetente: José       │ │
│  │ Preço estimado: R$150 │ │
│  │ [Cotar Preço]         │ │
│  └───────────────────────┘ │
│  ┌───────────────────────┐ │
│  │ ✅ CONFIRMADA         │ │
│  │ 🚗 Carro Gol 2010    │ │
│  │ Peso: ~800kg          │ │
│  │ Preço: R$ 600,00      │ │
│  │ [Marcar Carregada]    │ │
│  └───────────────────────┘ │
└─────────────────────────────┘
```

**QuoteCargoScreen.tsx**

```
┌─────────────────────────────┐
│  Cotar Carga               │
├─────────────────────────────┤
│  Detalhes:                 │
│  Tipo: Motocicleta         │
│  Descrição: Honda CG 160   │
│  Peso estimado: 120kg      │
│  Dimensões: 2m x 0.8m      │
│                             │
│  Remetente: José Silva     │
│  Recebedor: Maria Santos   │
│  Destino: Parintins        │
│                             │
│  Preço Sugerido: R$ 150,00 │
│                             │
│  Seu Preço:                │
│  R$ [____.__]              │
│                             │
│  [Cancelar] [Enviar Cotação│
└─────────────────────────────┘
```

**Endpoints:**
```typescript
GET /cargo/trip/:tripId
PATCH /cargo/:id/quote
PATCH /cargo/:id/status
PATCH /cargo/:id/deliver
```

---

### 8. Avaliações

**ReviewsScreen.tsx**

```
┌─────────────────────────────┐
│  ⭐ Suas Avaliações        │
│  Média: 4.8 (42 avaliações)│
├─────────────────────────────┤
│  Filtros: [Todas ▼] [5⭐▼] │
├─────────────────────────────┤
│  ┌───────────────────────┐ │
│  │ ⭐⭐⭐⭐⭐ 5.0        │ │
│  │ João Silva            │ │
│  │ Viagem: Manaus→Parint │ │
│  │ "Ótima viagem!"       │ │
│  │ 15/02/2026            │ │
│  └───────────────────────┘ │
│  ┌───────────────────────┐ │
│  │ ⭐⭐⭐⭐☆ 4.0        │ │
│  │ Maria Santos          │ │
│  │ Viagem: Manaus→Santré │ │
│  │ "Bom, mas atrasou"    │ │
│  │ 10/02/2026            │ │
│  └───────────────────────┘ │
└─────────────────────────────┘
```

**Endpoints:**
```typescript
GET /reviews/captain/:id
```

---

### 9. Perfil e Estatísticas

**ProfileScreen.tsx**

```
┌─────────────────────────────┐
│  👤 João Silva             │
│  ⭐ 4.8 | Capitão Expert.  │
├─────────────────────────────┤
│  📊 Estatísticas:          │
│  🚢 42 viagens             │
│  👥 156 passageiros        │
│  📦 89 encomendas          │
│  🚛 34 cargas              │
│  💰 R$ 5.280,00 (total)    │
│                             │
│  🎮 NavegaCoins: 5000      │
│  Nível: Capitão Experiente │
│                             │
│  [Ver Histórico Completo]  │
│  [Configurações]           │
│  [Sair]                    │
└─────────────────────────────┘
```

**Endpoints:**
```typescript
GET /auth/profile
GET /gamification/stats (futuro)
GET /captain/dashboard (NÃO IMPLEMENTADO)
```

---

## 🔌 Endpoints por Funcionalidade

### Embarcações

| Método | Endpoint | Auth | Role | Descrição |
|--------|----------|------|------|-----------|
| POST | /boats | ✅ | captain | Criar embarcação |
| GET | /boats/my-boats | ✅ | captain | Listar minhas embarcações |
| GET | /boats/:id | ✅ | - | Detalhes da embarcação |

### Viagens

| Método | Endpoint | Auth | Role | Descrição |
|--------|----------|------|------|-----------|
| POST | /trips | ✅ | captain | Criar viagem |
| GET | /trips/captain/my-trips | ✅ | captain | Minhas viagens |
| GET | /trips/:id | ✅ | - | Detalhes da viagem |
| PUT | /trips/:id | ✅ | captain | Atualizar viagem |
| DELETE | /trips/:id | ✅ | captain | Deletar viagem |
| PATCH | /trips/:id/status | ✅ | captain | Mudar status |
| PATCH | /trips/:id/location | ✅ | captain | Atualizar GPS |

### Passageiros

| Método | Endpoint | Auth | Role | Descrição |
|--------|----------|------|------|-----------|
| GET | /bookings/trip/:tripId | ✅ | captain | Listar passageiros |
| POST | /bookings/:id/checkin | ✅ | captain | Fazer check-in |
| PATCH | /bookings/:id/complete | ✅ | captain | Marcar como completo |

### Encomendas

| Método | Endpoint | Auth | Role | Descrição |
|--------|----------|------|------|-----------|
| POST | /shipments/:id/collect | ✅ | captain | Coletar encomenda (QR) |
| POST | /shipments/:id/out-for-delivery | ✅ | captain | Marcar saiu p/ entrega |
| PATCH | /shipments/:id/status | ✅ | captain | Atualizar status |

### Cargas

| Método | Endpoint | Auth | Role | Descrição |
|--------|----------|------|------|-----------|
| GET | /cargo/trip/:tripId | ✅ | captain | Listar cargas |
| PATCH | /cargo/:id/quote | ✅ | captain | Cotar preço |
| PATCH | /cargo/:id/status | ✅ | captain | Atualizar status |
| PATCH | /cargo/:id/deliver | ✅ | captain | Marcar entregue |

### Avaliações

| Método | Endpoint | Auth | Role | Descrição |
|--------|----------|------|------|-----------|
| GET | /reviews/captain/:id | ✅ | - | Ver avaliações |

---

## 🧩 Componentes Reutilizáveis

### StatusBadge

```tsx
import { View, Text } from 'react-native';

type Status = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

const STATUS_CONFIG = {
  scheduled: { color: '#3B82F6', label: 'Agendada', icon: '🔵' },
  in_progress: { color: '#10B981', label: 'Em Andamento', icon: '🟢' },
  completed: { color: '#6B7280', label: 'Completada', icon: '⚫' },
  cancelled: { color: '#EF4444', label: 'Cancelada', icon: '🔴' },
};

export function StatusBadge({ status }: { status: Status }) {
  const config = STATUS_CONFIG[status];

  return (
    <View style={{
      backgroundColor: config.color + '20',
      borderColor: config.color,
      borderWidth: 1,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 6,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    }}>
      <Text style={{ fontSize: 16 }}>{config.icon}</Text>
      <Text style={{ color: config.color, fontWeight: '600' }}>
        {config.label}
      </Text>
    </View>
  );
}
```

### TripCard

```tsx
export function TripCard({ trip, onPress }: { trip: Trip; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
      }}
    >
      <StatusBadge status={trip.status} />

      <Text style={{ fontSize: 18, fontWeight: 'bold', marginTop: 12 }}>
        {trip.origin} → {trip.destination}
      </Text>

      <View style={{ flexDirection: 'row', gap: 16, marginTop: 8 }}>
        <Text>📅 {format(new Date(trip.departureAt), 'dd/MM HH:mm')}</Text>
        <Text>👥 {trip.totalSeats - trip.availableSeats}/{trip.totalSeats}</Text>
      </View>

      {trip.boat && (
        <Text style={{ marginTop: 4, color: '#666' }}>
          🚤 {trip.boat.name}
        </Text>
      )}
    </TouchableOpacity>
  );
}
```

### PassengerListItem

```tsx
export function PassengerListItem({ booking }: { booking: Booking }) {
  const canCheckIn = booking.status === BookingStatus.CONFIRMED;

  return (
    <View style={{ backgroundColor: 'white', padding: 16, marginBottom: 8 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <View>
          <Text style={{ fontSize: 16, fontWeight: '600' }}>
            {booking.passenger?.name || 'Passageiro'}
          </Text>
          <Text style={{ color: '#666' }}>
            📱 {booking.passenger?.phone}
          </Text>
          <Text style={{ color: '#666' }}>
            💺 {booking.seats} assento(s) | #{booking.seatNumber || 'N/A'}
          </Text>
        </View>

        <View style={{ alignItems: 'flex-end' }}>
          {booking.status === BookingStatus.CHECKED_IN && (
            <Text style={{ color: '#10B981' }}>✅ Check-in feito</Text>
          )}
          {canCheckIn && (
            <TouchableOpacity
              style={{
                backgroundColor: '#3B82F6',
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 8,
              }}
              onPress={() => {/* Navigate to check-in screen */}}
            >
              <Text style={{ color: 'white' }}>Check-in</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}
```

---

## 💻 Exemplos de Código

### 1. Criar Viagem

```typescript
// screens/CreateTripScreen.tsx
import { useState } from 'react';
import { View, TextInput, Button, Alert } from 'react-native';
import api from '../services/api';
import { CreateTripDto } from '../types';

export default function CreateTripScreen({ navigation }) {
  const [form, setForm] = useState<CreateTripDto>({
    origin: '',
    destination: '',
    boatId: '',
    departureTime: '',
    arrivalTime: '',
    price: 0,
    totalSeats: 20,
  });

  const handleCreate = async () => {
    try {
      const response = await api.post('/trips', form);
      const trip = response.data;

      Alert.alert('Sucesso', 'Viagem criada!', [
        {
          text: 'Ver Detalhes',
          onPress: () => navigation.navigate('TripDetails', { tripId: trip.id }),
        },
      ]);
    } catch (error) {
      Alert.alert('Erro', error.response?.data?.message || 'Erro ao criar viagem');
    }
  };

  return (
    <View>
      <TextInput
        placeholder="Origem"
        value={form.origin}
        onChangeText={(text) => setForm({ ...form, origin: text })}
      />
      <TextInput
        placeholder="Destino"
        value={form.destination}
        onChangeText={(text) => setForm({ ...form, destination: text })}
      />
      {/* ... outros campos */}
      <Button title="Criar Viagem" onPress={handleCreate} />
    </View>
  );
}
```

### 2. Listar Passageiros

```typescript
// screens/PassengersListScreen.tsx
import { useState, useEffect } from 'react';
import { FlatList } from 'react-native';
import api from '../services/api';
import { Booking } from '../types';
import { PassengerListItem } from '../components/PassengerListItem';

export default function PassengersListScreen({ route }) {
  const { tripId } = route.params;
  const [bookings, setBookings] = useState<Booking[]>([]);

  useEffect(() => {
    loadPassengers();
  }, []);

  const loadPassengers = async () => {
    const response = await api.get(`/bookings/trip/${tripId}`);
    setBookings(response.data);
  };

  return (
    <FlatList
      data={bookings}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <PassengerListItem booking={item} />
      )}
    />
  );
}
```

### 3. Check-in de Passageiro

```typescript
// screens/PassengerCheckInScreen.tsx
import { View, Text, Button, Alert } from 'react-native';
import { BarCodeScanner } from 'expo-barcode-scanner';
import api from '../services/api';

export default function PassengerCheckInScreen({ route, navigation }) {
  const { bookingId } = route.params;

  const handleCheckIn = async () => {
    try {
      await api.post(`/bookings/${bookingId}/checkin`);
      Alert.alert('Sucesso', 'Check-in realizado!');
      navigation.goBack();
    } catch (error) {
      Alert.alert('Erro', error.response?.data?.message);
    }
  };

  const handleQRScanned = ({ data }: { data: string }) => {
    // Validar se QR code é do passageiro correto
    // Format esperado: "NVGJ-{bookingId}"
    if (data === `NVGJ-${bookingId}`) {
      handleCheckIn();
    } else {
      Alert.alert('Erro', 'QR Code inválido');
    }
  };

  return (
    <View>
      <Text>Escaneie o QR Code do passageiro</Text>
      <BarCodeScanner
        onBarCodeScanned={handleQRScanned}
        style={{ width: '100%', height: 400 }}
      />
      <Button title="Check-in Manual" onPress={handleCheckIn} />
    </View>
  );
}
```

### 4. Coletar Encomenda

```typescript
// screens/CollectShipmentScreen.tsx
import { useState } from 'react';
import { View, TextInput, Button, Alert } from 'react-native';
import { BarCodeScanner } from 'expo-barcode-scanner';
import * as Linking from 'expo-linking';
import api from '../services/api';

export default function CollectShipmentScreen({ route, navigation }) {
  const { shipmentId } = route.params;
  const [validationCode, setValidationCode] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');

  const handleCollect = async () => {
    try {
      await api.post(`/shipments/${shipmentId}/collect`, {
        validationCode,
        collectionPhotoUrl: photoUrl,
      });

      Alert.alert('Sucesso', 'Encomenda coletada!');
      navigation.goBack();
    } catch (error) {
      Alert.alert('Erro', error.response?.data?.message || 'Falha na coleta');
    }
  };

  const handleQRScanned = ({ data }: { data: string }) => {
    // Parse deep link: navegaja://shipment/validate?trackingCode=X&validationCode=Y
    if (data.startsWith('navegaja://')) {
      const { queryParams } = Linking.parse(data);
      const code = queryParams?.validationCode as string;
      setValidationCode(code);
    }
  };

  const takePicture = async () => {
    // Implementar upload de foto para S3
    // Ver seção "Upload de Fotos" no APP_INTEGRATION_GUIDE.md
  };

  return (
    <View>
      <Text>Escaneie o QR Code da encomenda</Text>
      <BarCodeScanner onBarCodeScanned={handleQRScanned} />

      <Text>ou digite o PIN:</Text>
      <TextInput
        placeholder="123456"
        value={validationCode}
        onChangeText={setValidationCode}
        keyboardType="number-pad"
        maxLength={6}
      />

      <Button title="Tirar Foto da Coleta" onPress={takePicture} />

      <Button
        title="Coletar Encomenda"
        onPress={handleCollect}
        disabled={validationCode.length !== 6}
      />
    </View>
  );
}
```

### 5. Atualizar GPS da Viagem

```typescript
// hooks/useLocationTracking.ts
import { useEffect } from 'react';
import * as Location from 'expo-location';
import api from '../services/api';

export function useLocationTracking(tripId: string, isActive: boolean) {
  useEffect(() => {
    if (!isActive) return;

    let intervalId: NodeJS.Timeout;

    const startTracking = async () => {
      // Solicitar permissão
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Erro', 'Permissão de localização negada');
        return;
      }

      // Atualizar a cada 30 segundos
      intervalId = setInterval(async () => {
        try {
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });

          await api.patch(`/trips/${tripId}/location`, {
            lat: location.coords.latitude,
            lng: location.coords.longitude,
          });

          console.log('GPS atualizado:', location.coords);
        } catch (error) {
          console.error('Erro ao atualizar GPS:', error);
        }
      }, 30000); // 30 segundos
    };

    startTracking();

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [tripId, isActive]);
}

// Uso no TripDetailsScreen:
export default function TripDetailsScreen({ route }) {
  const { tripId } = route.params;
  const [trip, setTrip] = useState<Trip | null>(null);

  const isInProgress = trip?.status === TripStatus.IN_PROGRESS;

  // Rastreamento automático
  useLocationTracking(tripId, isInProgress);

  // ...
}
```

---

## 🎯 Priorização (MVP)

### Fase 1 - Essencial (2-3 semanas)

**MUST HAVE:**
- ✅ Autenticação (login como capitão)
- ✅ Dashboard (estatísticas básicas)
- ✅ Embarcações (criar, listar)
- ✅ Viagens (criar, listar minhas, detalhes)
- ✅ Passageiros (listar, check-in manual)
- ✅ Mudar status da viagem (agendada → em andamento → completada)

### Fase 2 - Importante (3-4 semanas)

**SHOULD HAVE:**
- ✅ Rastreamento GPS (atualizar localização)
- ✅ Encomendas (listar, coletar com QR/PIN)
- ✅ Scanner QR Code (check-in + encomendas)
- ✅ Upload de fotos (coleta, entrega)
- ✅ Notificações push (nova reserva, nova encomenda)

### Fase 3 - Desejável (4+ semanas)

**NICE TO HAVE:**
- ✅ Cargas comerciais (listar, cotar, gerenciar)
- ✅ Avaliações (ver reviews recebidas)
- ✅ Relatórios de ganhos
- ✅ Histórico completo de viagens
- ✅ Editar/deletar embarcação
- ✅ Editar/deletar viagem

---

## 🔔 Notificações Push

### Eventos para Capitão

| Evento | Quando | Título | Corpo |
|--------|--------|--------|-------|
| Nova Reserva | Passageiro reserva assento | "Nova Reserva!" | "João fez uma reserva para Manaus → Parintins" |
| Reserva Cancelada | Passageiro cancela | "Reserva Cancelada" | "Maria cancelou a reserva (#5)" |
| Nova Encomenda | Encomenda criada para sua viagem | "Nova Encomenda!" | "Encomenda #NJ2026000123 aguarda coleta" |
| Nova Carga | Carga enviada para cotação | "Nova Carga para Cotar" | "Motocicleta aguarda sua cotação" |
| Nova Avaliação | Passageiro avalia após viagem | "Nova Avaliação ⭐" | "João deixou uma avaliação de 5 estrelas!" |

### Configuração Firebase

```typescript
// services/notifications.ts
import messaging from '@react-native-firebase/messaging';

export async function requestNotificationPermission() {
  const authStatus = await messaging().requestPermission();
  const enabled =
    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
    authStatus === messaging.AuthorizationStatus.PROVISIONAL;

  if (enabled) {
    const fcmToken = await messaging().getToken();
    // Enviar token para o backend
    await api.post('/users/fcm-token', { token: fcmToken });
  }
}

export function setupNotificationListeners() {
  // Notificação quando app está em foreground
  messaging().onMessage(async (remoteMessage) => {
    Alert.alert(
      remoteMessage.notification?.title || 'NavegaJá',
      remoteMessage.notification?.body
    );
  });

  // Notificação quando app está em background
  messaging().setBackgroundMessageHandler(async (remoteMessage) => {
    console.log('Background message:', remoteMessage);
  });

  // Quando usuário toca na notificação
  messaging().onNotificationOpenedApp((remoteMessage) => {
    const { type, tripId, bookingId, shipmentId } = remoteMessage.data || {};

    if (type === 'new_booking') {
      navigation.navigate('TripDetails', { tripId, tab: 'passengers' });
    } else if (type === 'new_shipment') {
      navigation.navigate('ShipmentDetails', { shipmentId });
    }
  });
}
```

---

## ✅ Checklist de Implementação

### Autenticação
- [ ] Tela de login (role: captain)
- [ ] Context de autenticação
- [ ] Persistência de token
- [ ] Logout

### Embarcações
- [ ] Listar minhas embarcações
- [ ] Criar nova embarcação
- [ ] Upload de fotos (galeria)
- [ ] Seleção de comodidades (checkboxes)

### Viagens
- [ ] Dashboard com viagem ativa
- [ ] Listar minhas viagens (tabs: ativas, agendadas, completadas)
- [ ] Criar nova viagem
- [ ] Detalhes da viagem (tabs: geral, passageiros, encomendas, cargas)
- [ ] Mudar status (agendada → em andamento → completada)
- [ ] Rastreamento GPS automático
- [ ] Cancelar viagem

### Passageiros
- [ ] Listar passageiros da viagem
- [ ] Scanner QR Code para check-in
- [ ] Check-in manual
- [ ] Marcar como completado
- [ ] Ver detalhes do passageiro

### Encomendas
- [ ] Listar encomendas (pendentes, ativas, entregues)
- [ ] Scanner QR Code para coletar
- [ ] Validação com PIN (6 dígitos)
- [ ] Foto da coleta
- [ ] Marcar "saiu para entrega"
- [ ] Enviar link WhatsApp para validação do destinatário

### Cargas Comerciais
- [ ] Listar cargas (cotações, ativas, entregues)
- [ ] Cotar preço
- [ ] Marcar como carregada
- [ ] Marcar como entregue (com foto)

### Avaliações
- [ ] Ver avaliações recebidas
- [ ] Filtrar por rating
- [ ] Ver rating médio

### Perfil & Estatísticas
- [ ] Perfil do capitão
- [ ] Estatísticas básicas
- [ ] Histórico de viagens
- [ ] NavegaCoins
- [ ] Configurações

### Notificações
- [ ] Configurar Firebase
- [ ] Solicitar permissão
- [ ] Handlers (foreground, background, opened)
- [ ] Navegação por tipo de notificação

---

## 🔗 Links Úteis

- **API Base URL (Dev):** http://localhost:3000
- **API Base URL (Prod):** https://api.navegaja.com
- **Backend GitHub:** (link do repo)
- **Figma:** (link do design)

---

**Documentação criada para NavegaJá Captain App - v2.0.0**
**Data:** 13/02/2026
