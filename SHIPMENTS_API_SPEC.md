# 📦 Especificação API - Sistema de Encomendas NavegaJá

## 📋 Índice
- [Visão Geral](#visão-geral)
- [TypeScript Types/DTOs](#typescript-typesdtos)
- [Endpoints REST](#endpoints-rest)
- [Regras de Negócio](#regras-de-negócio)
- [Fluxos de Usuário](#fluxos-de-usuário)
- [Validações](#validações)
- [Tratamento de Erros](#tratamento-de-erros)
- [Exemplos Práticos](#exemplos-práticos)

---

## 🎯 Visão Geral

Sistema completo de encomendas fluviais com:
- ✅ Cálculo de preço com peso volumétrico
- ✅ Sistema de cupons (validação por rota e peso)
- ✅ Rastreamento em tempo real
- ✅ QR Code para identificação
- ✅ Timeline de eventos
- ✅ Sistema de avaliações triplas

**Base URL:** `http://localhost:3000` (development)

**Autenticação:** Bearer Token (JWT) em todos os endpoints exceto `/track/:code`

---

## 📘 TypeScript Types/DTOs

### **Enums**

```typescript
export enum ShipmentStatus {
  PENDING = 'pending',           // Aguardando pagamento
  IN_TRANSIT = 'in_transit',     // Em trânsito
  DELIVERED = 'delivered',       // Entregue
  CANCELLED = 'cancelled',       // Cancelada
}

export enum PaymentMethod {
  PIX = 'pix',
  CREDIT_CARD = 'credit_card',
  DEBIT_CARD = 'debit_card',
  CASH = 'cash',
}
```

---

### **Main Entities**

```typescript
// ========== SHIPMENT ==========
export interface Shipment {
  id: string;                    // UUID
  senderId: string;              // UUID do remetente
  tripId: string;                // UUID da viagem

  // Dados da encomenda
  description: string;           // Descrição do conteúdo
  weightKg: number;              // Peso real em kg (0.1-50)
  length?: number;               // Comprimento em cm (opcional)
  width?: number;                // Largura em cm (opcional)
  height?: number;               // Altura em cm (opcional)
  photos: string[];              // Array de URLs (máx 5)

  // Destinatário
  recipientName: string;         // Nome completo
  recipientPhone: string;        // Telefone/WhatsApp
  recipientAddress: string;      // Endereço completo

  // Financeiro
  totalPrice: number;            // Preço final (já com desconto)
  paymentMethod: string;         // 'pix', 'credit_card', etc

  // Rastreamento
  trackingCode: string;          // NJ2026000123
  qrCode: string;                // Base64 data URL
  status: ShipmentStatus;        // Status atual

  // Metadata
  createdAt: string;             // ISO 8601
  updatedAt: string;             // ISO 8601
  deliveredAt?: string;          // ISO 8601 (se entregue)
  deliveryPhotoUrl?: string;     // Foto da entrega (captain)

  // Relations (quando usar ?include)
  sender?: User;
  trip?: Trip;
}

// ========== TIMELINE ==========
export interface ShipmentTimelineEvent {
  id: string;
  shipmentId: string;
  status: string;                // 'pending', 'in_transit', etc
  description: string;           // "Encomenda criada e aguardando..."
  location?: string;             // "Manaus, AM" (opcional)
  createdBy?: string;            // UUID do usuário (opcional)
  createdAt: string;             // ISO 8601
}

// ========== REVIEW ==========
export interface ShipmentReview {
  id: string;
  shipmentId: string;
  senderId: string;

  // Ratings (1-5)
  rating: number;                // Rating geral
  deliveryQuality: number;       // Qualidade da entrega
  timeliness: number;            // Pontualidade

  comment?: string;              // Comentário opcional

  createdAt: string;
  updatedAt: string;

  // Relations
  sender?: User;
}
```

---

### **Request DTOs**

```typescript
// ========== CALCULAR PREÇO ==========
export interface CalculatePriceRequest {
  tripId: string;                // UUID da viagem
  weightKg: number;              // 0.1 - 50
  length?: number;               // 1 - 200 (cm)
  width?: number;                // 1 - 200 (cm)
  height?: number;               // 1 - 200 (cm)
  couponCode?: string;           // Código do cupom (opcional)
}

export interface CalculatePriceResponse {
  basePrice: number;             // Preço base (peso × preço/kg)
  volumetricWeight?: number;     // Peso volumétrico (se dimensões fornecidas)
  actualWeight: number;          // Peso real informado
  chargedWeight: number;         // Peso cobrado (max entre real e volumétrico)
  weightCharge: number;          // Cobrança por peso
  pricePerKg: number;            // Preço/kg da viagem

  // Cupom
  couponDiscount?: number;       // Desconto do cupom (se aplicado)
  couponCode?: string;           // Código confirmado (se aplicado)
  totalDiscount: number;         // Total de descontos

  finalPrice: number;            // Preço final a pagar
}

// ========== CRIAR ENCOMENDA ==========
export interface CreateShipmentRequest {
  tripId: string;
  description: string;           // Min 10 caracteres
  weightKg: number;              // 0.1 - 50

  // Dimensões (opcional, para peso volumétrico)
  length?: number;               // 1 - 200
  width?: number;                // 1 - 200
  height?: number;               // 1 - 200

  // Fotos (opcional, máx 5)
  photos?: string[];             // Array de URLs

  // Destinatário
  recipientName: string;
  recipientPhone: string;        // Formato: 92998765432
  recipientAddress: string;

  // Pagamento
  paymentMethod?: string;        // Default: 'pix'
  couponCode?: string;           // Cupom de desconto (opcional)
}

// ========== CANCELAR ENCOMENDA ==========
export interface CancelShipmentRequest {
  reason?: string;               // Motivo (opcional)
}

// ========== CRIAR AVALIAÇÃO ==========
export interface CreateShipmentReviewRequest {
  shipmentId: string;
  rating: number;                // 1 - 5
  deliveryQuality: number;       // 1 - 5
  timeliness: number;            // 1 - 5
  comment?: string;              // Opcional
}
```

---

## 🔌 Endpoints REST

### **Base URL**
```
http://localhost:3000/shipments
```

### **Headers Padrão**
```typescript
{
  'Content-Type': 'application/json',
  'Authorization': 'Bearer {accessToken}' // Exceto GET /track/:code
}
```

---

### **1. POST /shipments/calculate-price**

**Descrição:** Calcular preço da encomenda antes de criar (com peso volumétrico e cupom)

**Auth:** ✅ Required

**Request:**
```typescript
POST /shipments/calculate-price
Content-Type: application/json
Authorization: Bearer {token}

{
  "tripId": "uuid-da-viagem",
  "weightKg": 5.5,
  "length": 40,
  "width": 30,
  "height": 20,
  "couponCode": "FRETE10"  // Opcional
}
```

**Response 200:**
```typescript
{
  "basePrice": 72.00,
  "volumetricWeight": 4.0,      // (40×30×20)/6000
  "actualWeight": 5.5,
  "chargedWeight": 5.5,         // max(5.5, 4.0)
  "weightCharge": 66.00,
  "pricePerKg": 12.00,
  "couponDiscount": 6.60,       // 10% do basePrice
  "couponCode": "FRETE10",
  "totalDiscount": 6.60,
  "finalPrice": 59.40           // Use este valor!
}
```

**Response 400:** Cupom inválido (peso/rota errada)
```typescript
{
  "basePrice": 66.00,
  "chargedWeight": 5.5,
  "couponDiscount": 0,          // Cupom não aplicado
  "couponCode": undefined,
  "finalPrice": 66.00
}
```

**Response 404:**
```typescript
{
  "statusCode": 404,
  "message": "Viagem não encontrada"
}
```

---

### **2. POST /shipments**

**Descrição:** Criar nova encomenda

**Auth:** ✅ Required

**Request:**
```typescript
POST /shipments
Content-Type: application/json
Authorization: Bearer {token}

{
  "tripId": "uuid-da-viagem",
  "description": "Caixa com medicamentos e alimentos",
  "weightKg": 5.5,
  "length": 40,
  "width": 30,
  "height": 20,
  "photos": [
    "https://cdn.example.com/photo1.jpg",
    "https://cdn.example.com/photo2.jpg"
  ],
  "recipientName": "Maria Santos",
  "recipientPhone": "92998765432",
  "recipientAddress": "Rua das Flores, 123 - Centro, Parintins-AM",
  "paymentMethod": "pix",
  "couponCode": "FRETE10"
}
```

**Response 201:**
```typescript
{
  "id": "uuid-encomenda",
  "senderId": "uuid-usuario",
  "tripId": "uuid-viagem",
  "description": "Caixa com medicamentos e alimentos",
  "weightKg": 5.5,
  "length": 40,
  "width": 30,
  "height": 20,
  "photos": [
    "https://cdn.example.com/photo1.jpg",
    "https://cdn.example.com/photo2.jpg"
  ],
  "recipientName": "Maria Santos",
  "recipientPhone": "92998765432",
  "recipientAddress": "Rua das Flores, 123 - Centro, Parintins-AM",
  "totalPrice": 59.40,           // Já com desconto do cupom
  "paymentMethod": "pix",
  "trackingCode": "NJ2026000123",
  "qrCode": "data:image/png;base64,iVBORw0KG...",
  "status": "pending",
  "createdAt": "2026-02-14T00:30:00Z",
  "updatedAt": "2026-02-14T00:30:00Z"
}
```

**Validações (Response 400):**
```typescript
// Peso inválido
{ "message": ["weightKg must not be less than 0.1", "weightKg must not be greater than 50"] }

// Fotos excedidas
{ "message": "Máximo de 5 fotos permitidas" }

// Viagem não encontrada
{ "message": "Viagem não encontrada" }
```

---

### **3. GET /shipments/my-shipments**

**Descrição:** Listar todas encomendas do usuário autenticado

**Auth:** ✅ Required

**Request:**
```typescript
GET /shipments/my-shipments
Authorization: Bearer {token}
```

**Response 200:**
```typescript
[
  {
    "id": "uuid-1",
    "trackingCode": "NJ2026000123",
    "description": "Caixa com medicamentos",
    "weightKg": 5.5,
    "recipientName": "Maria Santos",
    "totalPrice": 59.40,
    "status": "in_transit",
    "createdAt": "2026-02-14T00:30:00Z",
    "trip": {
      "id": "uuid-trip",
      "origin": "Manaus",
      "destination": "Parintins",
      "departureAt": "2026-02-15T08:00:00Z",
      "route": { ... },
      "boat": { ... }
    }
  },
  {
    "id": "uuid-2",
    "trackingCode": "NJ2026000124",
    "status": "delivered",
    "deliveredAt": "2026-02-10T14:30:00Z",
    ...
  }
]
```

**Ordenação:** Mais recentes primeiro (createdAt DESC)

---

### **4. GET /shipments/:id**

**Descrição:** Buscar encomenda por ID (detalhes completos)

**Auth:** ✅ Required

**Request:**
```typescript
GET /shipments/uuid-encomenda
Authorization: Bearer {token}
```

**Response 200:**
```typescript
{
  "id": "uuid-encomenda",
  "senderId": "uuid-usuario",
  "tripId": "uuid-viagem",
  "description": "Caixa com medicamentos e alimentos",
  "weightKg": 5.5,
  "length": 40,
  "width": 30,
  "height": 20,
  "photos": [
    "https://cdn.example.com/photo1.jpg",
    "https://cdn.example.com/photo2.jpg"
  ],
  "recipientName": "Maria Santos",
  "recipientPhone": "92998765432",
  "recipientAddress": "Rua das Flores, 123 - Centro, Parintins-AM",
  "totalPrice": 59.40,
  "paymentMethod": "pix",
  "trackingCode": "NJ2026000123",
  "qrCode": "data:image/png;base64,iVBORw0KG...",
  "status": "in_transit",
  "createdAt": "2026-02-14T00:30:00Z",
  "updatedAt": "2026-02-14T10:00:00Z",
  "deliveredAt": null,

  // Relations expandidas
  "sender": {
    "id": "uuid-usuario",
    "name": "João Silva",
    "phone": "92991234567"
  },
  "trip": {
    "id": "uuid-viagem",
    "origin": "Manaus",
    "destination": "Parintins",
    "departureAt": "2026-02-15T08:00:00Z",
    "route": { ... },
    "captain": { ... },
    "boat": { ... }
  }
}
```

**Response 404:**
```typescript
{
  "statusCode": 404,
  "message": "Encomenda não encontrada"
}
```

---

### **5. GET /shipments/track/:code**

**Descrição:** Rastrear encomenda por código (PÚBLICO - sem auth)

**Auth:** ❌ Not Required (público)

**Request:**
```typescript
GET /shipments/track/NJ2026000123
```

**Response 200:**
```typescript
{
  "shipment": {
    "id": "uuid-encomenda",
    "trackingCode": "NJ2026000123",
    "description": "Caixa com medicamentos e alimentos",
    "recipientName": "Maria Santos",
    "status": "in_transit",
    "createdAt": "2026-02-14T00:30:00Z",
    "trip": {
      "origin": "Manaus",
      "destination": "Parintins",
      "departureAt": "2026-02-15T08:00:00Z",
      "estimatedArrivalAt": "2026-02-16T14:00:00Z",
      "captain": {
        "name": "Capitão José",
        "phone": "92999999999"
      },
      "boat": {
        "name": "Lancha Rápida",
        "model": "Alumínio 40 pés"
      }
    }
  },
  "timeline": [
    {
      "id": "uuid-1",
      "status": "pending",
      "description": "Encomenda criada e aguardando confirmação de pagamento",
      "createdAt": "2026-02-14T00:30:00Z"
    },
    {
      "id": "uuid-2",
      "status": "in_transit",
      "description": "Encomenda em trânsito",
      "location": "Manaus, AM",
      "createdAt": "2026-02-15T08:15:00Z"
    }
  ]
}
```

**Response 404:**
```typescript
{
  "statusCode": 404,
  "message": "Encomenda não encontrada"
}
```

---

### **6. GET /shipments/:id/timeline**

**Descrição:** Buscar timeline de eventos da encomenda

**Auth:** ✅ Required

**Request:**
```typescript
GET /shipments/uuid-encomenda/timeline
Authorization: Bearer {token}
```

**Response 200:**
```typescript
[
  {
    "id": "uuid-1",
    "shipmentId": "uuid-encomenda",
    "status": "pending",
    "description": "Encomenda criada e aguardando confirmação de pagamento",
    "location": null,
    "createdBy": null,
    "createdAt": "2026-02-14T00:30:00Z"
  },
  {
    "id": "uuid-2",
    "status": "in_transit",
    "description": "Encomenda em trânsito",
    "location": "Manaus, AM",
    "createdBy": "uuid-captain",
    "createdAt": "2026-02-15T08:15:00Z"
  },
  {
    "id": "uuid-3",
    "status": "delivered",
    "description": "Encomenda entregue ao destinatário",
    "location": "Parintins, AM",
    "createdBy": "uuid-captain",
    "createdAt": "2026-02-16T14:30:00Z"
  }
]
```

**Ordenação:** Mais antigos primeiro (createdAt ASC)

---

### **7. POST /shipments/:id/cancel**

**Descrição:** Cancelar encomenda (somente owner)

**Auth:** ✅ Required

**Request:**
```typescript
POST /shipments/uuid-encomenda/cancel
Content-Type: application/json
Authorization: Bearer {token}

{
  "reason": "Desisti de enviar"  // Opcional
}
```

**Response 200:**
```typescript
{
  "id": "uuid-encomenda",
  "status": "cancelled",
  "updatedAt": "2026-02-14T10:30:00Z",
  ...
}
```

**Validações (Response 400):**
```typescript
// Não é o dono
{ "message": "Você não tem permissão para cancelar esta encomenda" }

// Já entregue
{ "message": "Não é possível cancelar uma encomenda já entregue" }

// Já cancelada
{ "message": "Esta encomenda já foi cancelada" }
```

---

### **8. PATCH /shipments/:id/status** (Captain Only)

**Descrição:** Atualizar status da encomenda (somente capitão)

**Auth:** ✅ Required + Role: captain

**Request:**
```typescript
PATCH /shipments/uuid-encomenda/status
Content-Type: application/json
Authorization: Bearer {token}

{
  "status": "in_transit"  // 'pending', 'in_transit', 'delivered', 'cancelled'
}
```

**Response 200:**
```typescript
{
  "id": "uuid-encomenda",
  "status": "in_transit",
  "updatedAt": "2026-02-15T08:15:00Z",
  ...
}
```

---

### **9. PATCH /shipments/:id/deliver** (Captain Only)

**Descrição:** Confirmar entrega com foto (somente capitão)

**Auth:** ✅ Required + Role: captain

**Request:**
```typescript
PATCH /shipments/uuid-encomenda/deliver
Content-Type: application/json
Authorization: Bearer {token}

{
  "deliveryPhotoUrl": "https://cdn.example.com/delivery.jpg"  // Opcional
}
```

**Response 200:**
```typescript
{
  "id": "uuid-encomenda",
  "status": "delivered",
  "deliveredAt": "2026-02-16T14:30:00Z",
  "deliveryPhotoUrl": "https://cdn.example.com/delivery.jpg",
  "updatedAt": "2026-02-16T14:30:00Z",
  ...
}
```

**Side Effects:**
- ✅ Status mudado para `delivered`
- ✅ `deliveredAt` setado para agora
- ✅ Evento adicionado na timeline
- ✅ NavegaCoins creditados ao remetente

---

### **10. POST /shipments/reviews**

**Descrição:** Criar avaliação da encomenda

**Auth:** ✅ Required

**Request:**
```typescript
POST /shipments/reviews
Content-Type: application/json
Authorization: Bearer {token}

{
  "shipmentId": "uuid-encomenda",
  "rating": 5,             // 1-5
  "deliveryQuality": 5,    // 1-5
  "timeliness": 4,         // 1-5
  "comment": "Entrega rápida e bem cuidadosa!"  // Opcional
}
```

**Response 201:**
```typescript
{
  "id": "uuid-review",
  "shipmentId": "uuid-encomenda",
  "senderId": "uuid-usuario",
  "rating": 5,
  "deliveryQuality": 5,
  "timeliness": 4,
  "comment": "Entrega rápida e bem cuidadosa!",
  "createdAt": "2026-02-16T15:00:00Z",
  "updatedAt": "2026-02-16T15:00:00Z"
}
```

**Validações (Response 400/500):**
```typescript
// Status não é 'delivered'
{ "message": "Só é possível avaliar encomendas entregues" }

// Já avaliada
{ "message": "Esta encomenda já foi avaliada" }

// Rating inválido
{ "message": ["rating must not be less than 1", "rating must not be greater than 5"] }
```

---

### **11. GET /shipments/:id/review**

**Descrição:** Buscar avaliação da encomenda

**Auth:** ✅ Required

**Request:**
```typescript
GET /shipments/uuid-encomenda/review
Authorization: Bearer {token}
```

**Response 200:**
```typescript
{
  "id": "uuid-review",
  "shipmentId": "uuid-encomenda",
  "senderId": "uuid-usuario",
  "rating": 5,
  "deliveryQuality": 5,
  "timeliness": 4,
  "comment": "Entrega rápida e bem cuidadosa!",
  "createdAt": "2026-02-16T15:00:00Z",
  "sender": {
    "id": "uuid-usuario",
    "name": "João Silva"
  }
}
```

**Response 200 (sem avaliação):**
```typescript
null
```

---

## 📏 Regras de Negócio

### **1. Cálculo de Preço**

#### **Peso Volumétrico**
```typescript
// Fórmula marítima/aérea padrão
volumetricWeight = (length × width × height) / 6000

// Exemplo: Caixa 60×50×40cm
volumetricWeight = (60 × 50 × 40) / 6000 = 20kg

// Peso cobrado = MAIOR entre real e volumétrico
chargedWeight = Math.max(actualWeight, volumetricWeight)
```

#### **Preço Base**
```typescript
basePrice = chargedWeight × trip.cargoPriceKg
```

#### **Aplicação de Cupom**
```typescript
// Cupom só é aplicado se TODAS as validações passarem:
✅ Cupom existe e isActive = true
✅ Data atual entre validFrom e validUntil (se definidas)
✅ Rota: trip.origin === coupon.fromCity (se definido)
✅ Rota: trip.destination === coupon.toCity (se definido)
✅ Peso: weightKg >= coupon.minWeight (se definido)
✅ Peso: weightKg <= coupon.maxWeight (se definido)

// Cálculo do desconto
if (coupon.type === 'percentage') {
  discount = basePrice × (coupon.value / 100)
} else {
  discount = coupon.value
}

// Limite máximo
if (coupon.maxDiscount) {
  discount = Math.min(discount, coupon.maxDiscount)
}

// Preço final
finalPrice = Math.max(basePrice - discount, 0)
```

**Importante:** Se QUALQUER validação falhar, `couponDiscount = 0` e cupom não é aplicado!

---

### **2. Status da Encomenda**

#### **Estados Válidos**
```typescript
PENDING      → Criada, aguardando pagamento
IN_TRANSIT   → Em trânsito (barco partiu)
DELIVERED    → Entregue ao destinatário
CANCELLED    → Cancelada (pelo usuário ou capitão)
```

#### **Transições Permitidas**
```typescript
PENDING     → IN_TRANSIT  ✅
PENDING     → CANCELLED   ✅
IN_TRANSIT  → DELIVERED   ✅
IN_TRANSIT  → CANCELLED   ✅
DELIVERED   → (nenhuma)   ❌
CANCELLED   → (nenhuma)   ❌
```

#### **Quem Pode Mudar Status**
```typescript
PENDING → IN_TRANSIT:   Captain only
PENDING → CANCELLED:    Owner ou Captain
IN_TRANSIT → DELIVERED: Captain only
IN_TRANSIT → CANCELLED: Captain only
```

---

### **3. Tracking Code**

**Formato:** `NJ + ANO + SEQUENCIAL (6 dígitos)`

**Exemplos:**
```
NJ2026000001
NJ2026000123
NJ2026999999
```

**Geração:**
- Sequencial incrementado automaticamente
- Único por encomenda
- Público (pode rastrear sem auth)

---

### **4. QR Code**

**Formato:** Base64 data URL

**Conteúdo:**
```json
{
  "type": "shipment",
  "id": "uuid-encomenda",
  "trackingCode": "NJ2026000123",
  "recipient": "Maria Santos"
}
```

**Uso:**
- Gerado automaticamente na criação
- Exibir na tela de detalhes
- Capitão escaneia para confirmar entrega

---

### **5. Fotos**

**Limites:**
- Mínimo: 0 (opcional)
- Máximo: 5 fotos
- Formato: URLs (string[])

**Validação:**
- Array com no máximo 5 elementos
- Cada elemento deve ser URL válida

**Nota:** Upload real não implementado no MVP. App deve:
1. Fazer upload para serviço externo (Cloudinary, S3, etc)
2. Enviar array de URLs no request

---

### **6. Avaliações**

**Regras:**
- ✅ Só pode avaliar encomendas `DELIVERED`
- ✅ Uma avaliação por encomenda
- ✅ 3 ratings: geral (1-5), qualidade (1-5), pontualidade (1-5)
- ✅ Comentário opcional

**Validações:**
```typescript
rating: 1 <= x <= 5
deliveryQuality: 1 <= x <= 5
timeliness: 1 <= x <= 5
comment: string (opcional)
```

---

## 🔄 Fluxos de Usuário

### **Fluxo 1: Criar Encomenda** 📦

```typescript
// 1. Usuário seleciona viagem
const trip = await tripsAPI.search({ origin, destination, date })

// 2. Usuário preenche dados da encomenda
const formData = {
  tripId: trip.id,
  description: "Caixa com medicamentos",
  weightKg: 5.5,
  length: 40,
  width: 30,
  height: 20,
  recipientName: "Maria Santos",
  recipientPhone: "92998765432",
  recipientAddress: "Rua das Flores, 123",
  couponCode: "FRETE10"  // Se tiver
}

// 3. Calcular preço ANTES de criar
const priceCalc = await shipmentsAPI.calculatePrice(formData)

// 4. Mostrar breakdown do preço
console.log(`Peso cobrado: ${priceCalc.chargedWeight}kg`)
console.log(`Preço base: R$ ${priceCalc.basePrice}`)
if (priceCalc.couponDiscount > 0) {
  console.log(`Desconto: -R$ ${priceCalc.couponDiscount}`)
}
console.log(`Total: R$ ${priceCalc.finalPrice}`)

// 5. Usuário confirma e paga
const payment = await paymentAPI.createPixPayment(priceCalc.finalPrice)

// 6. Após pagamento confirmado, criar encomenda
const shipment = await shipmentsAPI.create(formData)

// 7. Mostrar QR Code e tracking code
showQRCode(shipment.qrCode)
showTrackingCode(shipment.trackingCode)
```

**Telas:**
1. SearchScreen → TripDetailsScreen
2. CreateShipmentScreen (formulário)
3. ShipmentPriceBreakdownScreen (preview do preço)
4. PaymentScreen (Pix)
5. ShipmentCreatedScreen (QR code + tracking)

---

### **Fluxo 2: Rastrear Encomenda** 🔍

```typescript
// Opção A: Usuário autenticado (minhas encomendas)
const myShipments = await shipmentsAPI.getMyShipments()
const shipment = myShipments.find(s => s.id === shipmentId)

// Opção B: Rastreamento público (por código)
const tracking = await shipmentsAPI.trackByCode("NJ2026000123")
const { shipment, timeline } = tracking

// Exibir timeline
timeline.forEach(event => {
  console.log(`[${event.createdAt}] ${event.description}`)
  if (event.location) {
    console.log(`  📍 ${event.location}`)
  }
})

// Mostrar status atual
switch (shipment.status) {
  case 'pending':
    return <Badge color="yellow">Aguardando Pagamento</Badge>
  case 'in_transit':
    return <Badge color="blue">Em Trânsito</Badge>
  case 'delivered':
    return <Badge color="green">Entregue</Badge>
  case 'cancelled':
    return <Badge color="red">Cancelada</Badge>
}
```

**Telas:**
1. ShipmentsScreen (lista)
2. ShipmentDetailsScreen (detalhes + timeline)
3. ShipmentTrackingScreen (mapa + eventos)

---

### **Fluxo 3: Avaliar Encomenda** ⭐

```typescript
// 1. Verificar se pode avaliar
const shipment = await shipmentsAPI.getById(shipmentId)

if (shipment.status !== 'delivered') {
  alert("Só é possível avaliar encomendas entregues")
  return
}

// 2. Verificar se já avaliou
const existingReview = await shipmentsAPI.getReview(shipmentId)

if (existingReview) {
  // Mostrar avaliação existente
  return <ShipmentReviewReadOnly review={existingReview} />
}

// 3. Criar avaliação
const review = await shipmentsAPI.createReview({
  shipmentId,
  rating: 5,
  deliveryQuality: 5,
  timeliness: 4,
  comment: "Entrega rápida e cuidadosa!"
})

// 4. Mostrar sucesso
toast.success("Avaliação enviada!")

// 5. Sugerir avaliar o barco também
navigate('TripReview', { tripId: shipment.tripId })
```

**Telas:**
1. ShipmentDetailsScreen (botão "Avaliar")
2. ShipmentReviewScreen (formulário)
3. ReviewSuccessScreen (confirmação)

---

### **Fluxo 4: Cancelar Encomenda** ❌

```typescript
// 1. Verificar se pode cancelar
const shipment = await shipmentsAPI.getById(shipmentId)

if (shipment.status === 'delivered') {
  alert("Não é possível cancelar uma encomenda já entregue")
  return
}

if (shipment.status === 'cancelled') {
  alert("Esta encomenda já foi cancelada")
  return
}

// 2. Confirmar com usuário
const confirmed = await showConfirmDialog({
  title: "Cancelar encomenda?",
  message: "Esta ação não pode ser desfeita",
  confirmText: "Sim, cancelar",
  cancelText: "Não"
})

if (!confirmed) return

// 3. Opcional: Perguntar motivo
const reason = await showReasonDialog()

// 4. Cancelar
const cancelled = await shipmentsAPI.cancel(shipmentId, { reason })

// 5. Mostrar sucesso
toast.success("Encomenda cancelada")
navigate('ShipmentsScreen')
```

**Telas:**
1. ShipmentDetailsScreen (botão "Cancelar")
2. ConfirmCancelDialog
3. ReasonDialog (opcional)

---

## ✅ Validações

### **Client-Side (Frontend)**

```typescript
// ========== CRIAR ENCOMENDA ==========
const validateCreateShipment = (data: CreateShipmentRequest) => {
  const errors = []

  // Descrição
  if (!data.description || data.description.length < 10) {
    errors.push("Descrição deve ter no mínimo 10 caracteres")
  }

  // Peso
  if (data.weightKg < 0.1 || data.weightKg > 50) {
    errors.push("Peso deve estar entre 0.1kg e 50kg")
  }

  // Dimensões (se fornecidas)
  if (data.length && (data.length < 1 || data.length > 200)) {
    errors.push("Comprimento deve estar entre 1cm e 200cm")
  }
  if (data.width && (data.width < 1 || data.width > 200)) {
    errors.push("Largura deve estar entre 1cm e 200cm")
  }
  if (data.height && (data.height < 1 || data.height > 200)) {
    errors.push("Altura deve estar entre 1cm e 200cm")
  }

  // Fotos
  if (data.photos && data.photos.length > 5) {
    errors.push("Máximo de 5 fotos permitidas")
  }

  // Destinatário
  if (!data.recipientName || data.recipientName.length < 3) {
    errors.push("Nome do destinatário inválido")
  }
  if (!data.recipientPhone || !/^\d{10,11}$/.test(data.recipientPhone)) {
    errors.push("Telefone deve ter 10-11 dígitos")
  }
  if (!data.recipientAddress || data.recipientAddress.length < 10) {
    errors.push("Endereço deve ter no mínimo 10 caracteres")
  }

  return errors
}

// ========== CRIAR AVALIAÇÃO ==========
const validateReview = (data: CreateShipmentReviewRequest) => {
  const errors = []

  if (data.rating < 1 || data.rating > 5) {
    errors.push("Rating deve estar entre 1 e 5")
  }
  if (data.deliveryQuality < 1 || data.deliveryQuality > 5) {
    errors.push("Qualidade deve estar entre 1 e 5")
  }
  if (data.timeliness < 1 || data.timeliness > 5) {
    errors.push("Pontualidade deve estar entre 1 e 5")
  }

  return errors
}
```

### **Server-Side (Backend)**

Validações já implementadas via class-validator:
- ✅ Tipos de dados (string, number)
- ✅ Obrigatoriedade (@IsNotEmpty)
- ✅ Ranges numéricos (@Min, @Max)
- ✅ Arrays (@IsArray)
- ✅ Transformações (@Type)

---

## ⚠️ Tratamento de Erros

### **Códigos HTTP**

```typescript
200 OK               // Sucesso (GET, PATCH)
201 Created          // Recurso criado (POST)
400 Bad Request      // Validação falhou
401 Unauthorized     // Token inválido/expirado
403 Forbidden        // Sem permissão (ex: não é captain)
404 Not Found        // Recurso não encontrado
500 Internal Error   // Erro do servidor
```

### **Estrutura de Erro**

```typescript
{
  "statusCode": 400,
  "message": "Descrição do erro",
  "error": "Bad Request"
}

// Ou array de mensagens (validação)
{
  "statusCode": 400,
  "message": [
    "weightKg must not be less than 0.1",
    "weightKg must not be greater than 50"
  ],
  "error": "Bad Request"
}
```

### **Tratamento no Frontend**

```typescript
try {
  const shipment = await shipmentsAPI.create(data)
  toast.success("Encomenda criada!")
} catch (error) {
  if (error.status === 400) {
    // Validação
    const messages = Array.isArray(error.message)
      ? error.message
      : [error.message]
    showValidationErrors(messages)
  } else if (error.status === 404) {
    toast.error("Viagem não encontrada")
  } else if (error.status === 401) {
    // Token expirado
    logout()
    navigate('Login')
  } else {
    toast.error("Erro ao criar encomenda. Tente novamente.")
  }
}
```

---

## 📝 Exemplos Práticos

### **Exemplo 1: Fluxo Completo**

```typescript
// 1. Buscar viagem
const trip = await tripsAPI.getById(tripId)
console.log(`Frete: R$ ${trip.cargoPriceKg}/kg`)

// 2. Calcular preço
const calc = await shipmentsAPI.calculatePrice({
  tripId,
  weightKg: 10,
  length: 50,
  width: 40,
  height: 30,
  couponCode: "FRETE10"
})

console.log(`Peso real: ${calc.actualWeight}kg`)
console.log(`Peso volumétrico: ${calc.volumetricWeight}kg`)
console.log(`Peso cobrado: ${calc.chargedWeight}kg`)
console.log(`Preço base: R$ ${calc.basePrice}`)
console.log(`Desconto: R$ ${calc.couponDiscount}`)
console.log(`Total: R$ ${calc.finalPrice}`)

// 3. Criar encomenda
const shipment = await shipmentsAPI.create({
  tripId,
  description: "Caixa grande com roupas",
  weightKg: 10,
  length: 50,
  width: 40,
  height: 30,
  recipientName: "Maria Santos",
  recipientPhone: "92998765432",
  recipientAddress: "Rua A, 123",
  couponCode: "FRETE10"
})

console.log(`Criada! Código: ${shipment.trackingCode}`)

// 4. Rastrear
const tracking = await shipmentsAPI.trackByCode(shipment.trackingCode)
console.log(`Status: ${tracking.shipment.status}`)
tracking.timeline.forEach(e => console.log(e.description))

// 5. Avaliar (quando delivered)
if (tracking.shipment.status === 'delivered') {
  const review = await shipmentsAPI.createReview({
    shipmentId: shipment.id,
    rating: 5,
    deliveryQuality: 5,
    timeliness: 5,
    comment: "Perfeito!"
  })
  console.log("Avaliação enviada!")
}
```

---

### **Exemplo 2: Cupom Inválido (peso fora da faixa)**

```typescript
// Cupom: "PEQUENO5KG" (0.1-5kg, 20% off)

// ❌ Tentativa 1: 10kg (fora da faixa)
const calc1 = await shipmentsAPI.calculatePrice({
  tripId,
  weightKg: 10,
  couponCode: "PEQUENO5KG"
})

console.log(calc1.couponDiscount)  // 0 ❌
console.log(calc1.couponCode)      // undefined ❌
console.log(calc1.finalPrice)      // 120.00 (sem desconto)

// ✅ Tentativa 2: 3kg (dentro da faixa)
const calc2 = await shipmentsAPI.calculatePrice({
  tripId,
  weightKg: 3,
  couponCode: "PEQUENO5KG"
})

console.log(calc2.couponDiscount)  // 7.20 ✅
console.log(calc2.couponCode)      // "PEQUENO5KG" ✅
console.log(calc2.finalPrice)      // 28.80 (com 20% desconto)
```

---

### **Exemplo 3: Cupom por Rota**

```typescript
// Cupom: "FRETE-MANAUS-PARINTINS" (fromCity: Manaus, toCity: Parintins, 15% off)

// ✅ Trip: Manaus → Parintins
const tripManausParintins = await tripsAPI.getById("trip-1")
const calc1 = await shipmentsAPI.calculatePrice({
  tripId: tripManausParintins.id,
  weightKg: 5,
  couponCode: "FRETE-MANAUS-PARINTINS"
})
console.log(calc1.couponDiscount)  // 9.00 ✅ (15% de 60)

// ❌ Trip: Manaus → Beruri
const tripManausBeruri = await tripsAPI.getById("trip-2")
const calc2 = await shipmentsAPI.calculatePrice({
  tripId: tripManausBeruri.id,
  weightKg: 5,
  couponCode: "FRETE-MANAUS-PARINTINS"
})
console.log(calc2.couponDiscount)  // 0 ❌ (rota errada)
```

---

## 🎁 Bônus: Helpers/Utils para Frontend

```typescript
// ========== shipmentsHelpers.ts ==========

export const formatTrackingCode = (code: string) => {
  // NJ2026000123 → NJ 2026 000123
  return code.replace(/^(NJ)(\d{4})(\d{6})$/, '$1 $2 $3')
}

export const getStatusBadge = (status: ShipmentStatus) => {
  const config = {
    pending: { color: 'yellow', text: 'Aguardando', icon: '⏳' },
    in_transit: { color: 'blue', text: 'Em Trânsito', icon: '🚤' },
    delivered: { color: 'green', text: 'Entregue', icon: '✅' },
    cancelled: { color: 'red', text: 'Cancelada', icon: '❌' },
  }
  return config[status]
}

export const canCancelShipment = (shipment: Shipment) => {
  return shipment.status !== 'delivered' && shipment.status !== 'cancelled'
}

export const canReviewShipment = (shipment: Shipment) => {
  return shipment.status === 'delivered'
}

export const formatPrice = (price: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(price)
}

export const calculateSavings = (basePrice: number, finalPrice: number) => {
  const savings = basePrice - finalPrice
  const percentage = (savings / basePrice) * 100
  return { savings, percentage }
}

// Uso:
const { savings, percentage } = calculateSavings(66, 59.40)
console.log(`Você economizou R$ ${savings.toFixed(2)} (${percentage.toFixed(0)}%)!`)
// "Você economizou R$ 6.60 (10%)!"
```

---

## 📞 Suporte

**Dúvidas sobre a API?**
- 📧 Contato: tech@navegaja.com
- 📚 Documentação: [SHIPMENT_COUPONS_GUIDE.md](./SHIPMENT_COUPONS_GUIDE.md)
- 🧪 Testes: [examples/shipments-with-coupons.http](./examples/shipments-with-coupons.http)

**Issues conhecidas:**
- ⚠️ Upload de fotos não implementado no MVP (enviar URLs)
- ⚠️ Rastreamento em mapa não implementado (pós-MVP)
- ⚠️ Push notifications não implementado (pós-MVP)

---

**Versão:** 1.0.0
**Última atualização:** 2026-02-14
**Status:** ✅ Pronto para implementação no app
