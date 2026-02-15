# 📦 API de Encomendas NavegaJá - Especificação Completa v2.0

**Atualizado:** 2026-02-14
**Status:** ✅ Implementado e Pronto
**Backend:** NestJS + TypeORM + PostgreSQL + QR Code + Deep Link

---

## 📋 Índice Rápido

- [Mudanças da v1.0 para v2.0](#mudanças-importantes)
- [Fluxo Completo](#fluxo-completo-8-status)
- [Status e Transições](#status-e-transições)
- [Endpoints (14 total)](#endpoints-rest-api)
- [DTOs TypeScript](#tipos-typescript)
- [Deep Link](#deep-link)
- [Validação QR Code](#validação-por-qr-code)
- [Auto-Update](#auto-update-inteligente)
- [Gamificação](#gamificação-navegacoins)

---

## 🆕 Mudanças Importantes

### **v1.0 → v2.0**

| Funcionalidade | v1.0 (antigo) | v2.0 (novo) |
|----------------|---------------|-------------|
| **Status** | 4 status | **8 status** (pending → paid → collected → in_transit → arrived → out_for_delivery → delivered → cancelled) |
| **QR Code** | JSON simples | **Deep Link** (`navegaja://shipment/validate?...`) |
| **Validação** | Manual (capitão) | **QR Code + PIN de 6 dígitos** |
| **Coleta** | Não existia | **Capitão escaneia QR Code para coletar** |
| **Entrega** | Manual | **Destinatário valida com QR Code** (público!) |
| **Auto-update** | Não | **Sim!** (viagem parte/chega → encomendas atualizam) |
| **Fotos** | 1 (entrega) | **2** (coleta + entrega) |
| **Campos Novos** | - | `validationCode`, `collectionPhotoUrl`, `collectedAt` |
| **Endpoints** | 11 | **14** (+3 novos) |

---

## 🔄 Fluxo Completo (8 Status)

```
┌─────────────┐
│  REMETENTE  │
└──────┬──────┘
       │ 1. Cria encomenda
       ↓
   PENDING (aguardando pagamento)
       │
       │ 2. Confirma pagamento (POST /:id/confirm-payment)
       ↓
   PAID (aguardando coleta)
       │
       │ 3. Capitão escaneia QR Code (POST /:id/collect + validationCode)
       ↓
   COLLECTED (coletada)
       │
       │ 4. Viagem parte (AUTO - PATCH /trips/:id/status = in_progress)
       ↓
   IN_TRANSIT (em trânsito)
       │
       │ 5. Viagem chega (AUTO - PATCH /trips/:id/status = completed)
       ↓
   ARRIVED (chegou ao destino)
       │
       │ 6. Capitão sai para entregar (POST /:id/out-for-delivery)
       ↓
   OUT_FOR_DELIVERY (saiu para entrega)
       │
       │ 7. Destinatário escaneia QR Code (POST /validate-delivery + validationCode)
       ↓
   DELIVERED (entregue) → 🪙 NavegaCoins creditados!
```

---

## 📊 Status e Transições

### **Enum**
```typescript
enum ShipmentStatus {
  PENDING = 'pending',               // Criada, aguardando pagamento
  PAID = 'paid',                     // Pagamento confirmado, aguardando coleta
  COLLECTED = 'collected',           // Capitão coletou do remetente
  IN_TRANSIT = 'in_transit',         // Viagem em andamento
  ARRIVED = 'arrived',               // Viagem chegou ao destino
  OUT_FOR_DELIVERY = 'out_for_delivery', // Capitão saiu para entregar
  DELIVERED = 'delivered',           // Destinatário confirmou recebimento
  CANCELLED = 'cancelled',           // Cancelada
}
```

### **Transições Válidas**

| De | Para | Quem | Automático |
|----|------|------|------------|
| PENDING → PAID | Remetente/Admin | ❌ |
| PAID → COLLECTED | Capitão (QR Code) | ❌ |
| COLLECTED → IN_TRANSIT | Sistema | ✅ |
| IN_TRANSIT → ARRIVED | Sistema | ✅ |
| ARRIVED → OUT_FOR_DELIVERY | Capitão | ❌ |
| OUT_FOR_DELIVERY → DELIVERED | Destinatário (QR Code) | ❌ |
| ARRIVED → DELIVERED | Destinatário (QR Code) | ❌ |
| ANY → CANCELLED | Remetente/Admin | ❌ |

---

## 🔌 Endpoints REST API

### **Base:** `http://localhost:3000/shipments`

| Método | Endpoint | Auth | Descrição |
|--------|----------|------|-----------|
| POST | `/calculate-price` | ✅ | Calcular preço |
| POST | `/upload/presigned-urls` | ✅ | Gerar URLs S3 |
| POST | `/` | ✅ | Criar encomenda |
| **POST** | **`/:id/confirm-payment`** | ✅ | **Confirmar pagamento** (NOVO) |
| **POST** | **`/:id/collect`** | ✅ Captain | **Coletar encomenda (QR/PIN)** (NOVO) |
| **POST** | **`/:id/out-for-delivery`** | ✅ Captain | **Sair para entrega** (NOVO) |
| **POST** | **`/validate-delivery`** | ❌ Público | **Validar entrega (QR/PIN)** (NOVO) |
| GET | `/my-shipments` | ✅ | Listar minhas encomendas |
| GET | `/:id` | ✅ | Buscar por ID |
| GET | `/:id/timeline` | ✅ | Timeline de eventos |
| GET | `/track/:code` | ❌ Público | Rastrear (público) |
| POST | `/:id/cancel` | ✅ | Cancelar encomenda |
| POST | `/reviews` | ✅ | Criar avaliação |
| GET | `/:id/review` | ✅ | Buscar avaliação |

---

## 📝 Tipos TypeScript

### **Entidade Shipment**

```typescript
interface Shipment {
  // IDs
  id: string;                        // UUID
  senderId: string;                  // UUID do remetente
  tripId: string;                    // UUID da viagem

  // Descrição
  description: string;               // Conteúdo

  // Peso e dimensões
  weightKg: number;                  // Peso real (0.1-50kg)
  weight: number;                    // Alias (compatibilidade app)
  length?: number;                   // Comprimento cm
  width?: number;                    // Largura cm
  height?: number;                   // Altura cm
  dimensions?: {                     // Alias (compatibilidade app)
    length: number;
    width: number;
    height: number;
  };

  // Destinatário
  recipientName: string;             // Nome completo
  recipientPhone: string;            // Telefone
  recipientAddress: string;          // Endereço completo

  // Fotos
  photos: string[];                  // URLs (máx 5)
  collectionPhotoUrl?: string;       // Foto coleta (capitão)
  deliveryPhotoUrl?: string;         // Foto entrega (capitão)

  // Financeiro
  totalPrice: number;                // Preço final
  price: number;                     // Alias (compatibilidade app)
  paymentMethod: string;             // pix, dinheiro, etc

  // Rastreamento
  trackingCode: string;              // NJ2026000001
  validationCode: string;            // PIN 6 dígitos (⚠️ sensível!)
  qrCode: string;                    // Deep link em base64
  status: ShipmentStatus;            // Status atual

  // Datas
  createdAt: string;                 // ISO 8601
  updatedAt: string;                 // ISO 8601
  collectedAt?: string;              // ISO 8601
  deliveredAt?: string;              // ISO 8601

  // Relations
  trip?: Trip;
  sender?: User;
}
```

### **CreateShipmentDto**

```typescript
interface CreateShipmentDto {
  tripId: string;                    // UUID (obrigatório)
  description: string;               // Min 1 caractere

  // Peso (aceita 'weight' ou 'weightKg')
  weight?: number;                   // 0.1 - 50
  weightKg?: number;                 // 0.1 - 50

  // Dimensões (aceita 'dimensions' ou campos separados)
  dimensions?: {
    length: number;                  // 1 - 300 cm
    width: number;
    height: number;
  };
  length?: number;
  width?: number;
  height?: number;

  // Fotos (opcional, máx 5)
  photos?: string[];

  // Destinatário (obrigatórios)
  recipientName: string;             // Min 3 caracteres
  recipientPhone: string;            // Formato: 11987654321
  recipientAddress: string;          // Min 10 caracteres

  // Pagamento
  paymentMethod?: string;            // Default: 'pix'
  couponCode?: string;               // Opcional
}
```

### **CalculatePriceDto**

```typescript
interface CalculatePriceDto {
  tripId: string;
  weightKg: number;                  // Ou 'weight'
  weight?: number;
  length?: number;
  width?: number;
  height?: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
  couponCode?: string;
}

interface CalculatePriceResponse {
  basePrice: number;                 // Preço base
  volumetricWeight?: number;         // Peso volumétrico
  actualWeight: number;              // Peso real
  chargedWeight: number;             // Peso cobrado
  weightCharge: number;              // Cobrança por peso
  pricePerKg: number;                // Preço/kg da viagem
  couponDiscount: number;            // Desconto cupom
  couponCode?: string;               // Cupom aplicado
  totalDiscount: number;             // Desconto total
  finalPrice: number;                // Preço final
}
```

---

## 🆕 Novos Endpoints (Detalhados)

### **1. POST /shipments/:id/confirm-payment**

**Descrição:** Remetente confirma pagamento

**Auth:** ✅ Required (Bearer Token)

**Request:**
```http
POST /shipments/uuid/confirm-payment
Authorization: Bearer {token}
```

**Response: 200 OK**
```json
{
  "id": "uuid",
  "status": "paid",
  "updatedAt": "2026-02-14T10:05:00Z",
  ...
}
```

**Validações:**
- ❌ 400: Status atual não é `pending`
- ❌ 404: Encomenda não encontrada

**Timeline:**
- *"Pagamento confirmado. Aguardando coleta pelo capitão."*

---

### **2. POST /shipments/:id/collect**

**Descrição:** Capitão coleta encomenda do remetente (validação com QR Code ou PIN)

**Auth:** ✅ Required + Role: `captain`

**Request:**
```http
POST /shipments/uuid/collect
Authorization: Bearer {captain_token}
Content-Type: application/json

{
  "validationCode": "123456",
  "collectionPhotoUrl": "https://s3.../collection.jpg"
}
```

**Response: 200 OK**
```json
{
  "id": "uuid",
  "status": "collected",
  "collectedAt": "2026-02-14T14:00:00Z",
  "collectionPhotoUrl": "https://s3.../collection.jpg",
  ...
}
```

**Validações:**
- ✅ Capitão pertence à viagem
- ✅ Status atual é `paid`
- ✅ Código de validação correto

**Erros:**
- ❌ 400: Você não é o capitão desta viagem
- ❌ 400: Esta encomenda não está pronta para coleta
- ❌ 400: Código de validação inválido
- ❌ 404: Encomenda não encontrada

**Timeline:**
- *"Encomenda coletada pelo capitão"*

---

### **3. POST /shipments/:id/out-for-delivery**

**Descrição:** Capitão marca como saiu para entregar

**Auth:** ✅ Required + Role: `captain`

**Request:**
```http
POST /shipments/uuid/out-for-delivery
Authorization: Bearer {captain_token}
```

**Response: 200 OK**
```json
{
  "id": "uuid",
  "status": "out_for_delivery",
  "updatedAt": "2026-02-14T17:45:00Z",
  ...
}
```

**Validações:**
- ✅ Capitão pertence à viagem
- ✅ Status atual é `arrived`

**Erros:**
- ❌ 400: Você não é o capitão desta viagem
- ❌ 400: A encomenda precisa ter chegado ao destino primeiro

**Timeline:**
- *"Saiu para entrega ao destinatário"*

---

### **4. POST /shipments/validate-delivery**

**Descrição:** Destinatário valida entrega final (QR Code ou PIN)

**Auth:** ❌ PÚBLICO (sem autenticação!)

**Request:**
```http
POST /shipments/validate-delivery
Content-Type: application/json

{
  "trackingCode": "NJ2026000001",
  "validationCode": "123456",
  "deliveryPhotoUrl": "https://s3.../delivery.jpg"
}
```

**Response: 200 OK**
```json
{
  "id": "uuid",
  "status": "delivered",
  "deliveredAt": "2026-02-14T18:00:00Z",
  "deliveryPhotoUrl": "https://s3.../delivery.jpg",
  ...
}
```

**Validações:**
- ✅ Status atual é `arrived` ou `out_for_delivery`
- ✅ Código de validação correto

**Efeitos Colaterais:**
1. Status → `delivered`
2. `deliveredAt` → agora
3. Timeline atualizada
4. 🪙 **NavegaCoins creditados ao remetente**

**Erros:**
- ❌ 404: Encomenda não encontrada
- ❌ 400: Esta encomenda ainda não está disponível para entrega
- ❌ 400: Código de validação inválido

**Timeline:**
- *"Entrega confirmada pelo destinatário"*

---

## 🔗 Deep Link

### **Formato do QR Code:**

```
navegaja://shipment/validate?trackingCode=NJ2026000001&validationCode=123456
```

**Vantagens:**
- ✅ Escanear fora do app → Abre automaticamente
- ✅ Sem app → Redireciona para loja
- ✅ Compartilhável (WhatsApp, SMS)
- ✅ Marketing orgânico

### **Configuração (Expo):**

```json
{
  "expo": {
    "scheme": "navegaja",
    "android": {
      "intentFilters": [{
        "action": "VIEW",
        "data": [{"scheme": "navegaja", "host": "shipment"}],
        "category": ["BROWSABLE", "DEFAULT"]
      }]
    },
    "ios": {
      "associatedDomains": ["applinks:navegaja.com"]
    }
  }
}
```

### **Listener (App.tsx):**

```typescript
import * as Linking from 'expo-linking';

useEffect(() => {
  const handleDeepLink = (event: { url: string }) => {
    const { hostname, queryParams } = Linking.parse(event.url);

    if (hostname === 'shipment') {
      const trackingCode = queryParams?.trackingCode as string;
      const validationCode = queryParams?.validationCode as string;

      if (trackingCode && validationCode) {
        navigation.navigate('ValidateDelivery', {
          trackingCode,
          validationCode,
        });
      }
    }
  };

  const subscription = Linking.addEventListener('url', handleDeepLink);

  Linking.getInitialURL().then((url) => {
    if (url) handleDeepLink({ url });
  });

  return () => subscription.remove();
}, []);
```

---

## 📸 Validação por QR Code

### **Scanner (Capitão - Coleta):**

```typescript
import { BarCodeScanner } from 'expo-barcode-scanner';
import * as Linking from 'expo-linking';

const handleQRCodeScanned = async ({ data }: { data: string }) => {
  let validationCode: string | undefined;

  // Detectar deep link ou JSON (compatibilidade)
  if (data.startsWith('navegaja://') || data.startsWith('https://')) {
    // Deep link
    const { queryParams } = Linking.parse(data);
    validationCode = queryParams?.validationCode as string;
  } else {
    // JSON (fallback)
    try {
      const qrData = JSON.parse(data);
      validationCode = qrData.validationCode;
    } catch {
      alert('QR Code inválido');
      return;
    }
  }

  if (!validationCode) {
    alert('Código de validação não encontrado');
    return;
  }

  // Chamar API
  const response = await fetch(`${API_URL}/shipments/${shipmentId}/collect`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ validationCode }),
  });

  if (response.ok) {
    alert('Encomenda coletada com sucesso! ✅');
  } else {
    const error = await response.json();
    alert(error.message);
  }
};
```

### **Validação (Destinatário - Entrega):**

```typescript
// Destinatário escaneia QR Code (fora do app)
// Deep link abre app → Tela de validação

const handleValidateDelivery = async (trackingCode: string, validationCode: string) => {
  const response = await fetch(`${API_URL}/shipments/validate-delivery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trackingCode, validationCode }),
  });

  if (response.ok) {
    alert('Entrega confirmada! 🎉');
    // Mostrar tela de sucesso
  } else {
    const error = await response.json();
    alert(error.message);
  }
};
```

---

## 🤖 Auto-Update Inteligente

### **Como funciona:**

Quando capitão atualiza status da viagem:

```http
PATCH /trips/:id/status
Authorization: Bearer {captain_token}
Content-Type: application/json

{
  "status": "in_progress"  // ou "completed"
}
```

**Backend automaticamente:**

1. Detecta mudança de status da viagem
2. Busca TODAS encomendas desta viagem
3. Filtra apenas as não canceladas/entregues
4. Atualiza status conforme regras:
   - Trip `IN_PROGRESS` → Encomendas `COLLECTED` → `IN_TRANSIT`
   - Trip `COMPLETED` → Encomendas `IN_TRANSIT` → `ARRIVED`
5. Registra evento na timeline de cada uma

**Código (backend):**

```typescript
// trips.service.ts
async updateStatus(tripId: string, captainId: string, dto: UpdateTripStatusDto) {
  // Atualizar trip
  const trip = await this.findById(tripId);
  const oldStatus = trip.status;
  trip.status = dto.status;
  const saved = await this.tripsRepo.save(trip);

  // Auto-atualizar encomendas
  if (dto.status === TripStatus.IN_PROGRESS && oldStatus !== TripStatus.IN_PROGRESS) {
    await this.shipmentsService.updateShipmentsByTrip(tripId, ShipmentStatus.IN_TRANSIT);
  } else if (dto.status === TripStatus.COMPLETED && oldStatus !== TripStatus.COMPLETED) {
    await this.shipmentsService.updateShipmentsByTrip(tripId, ShipmentStatus.ARRIVED);
  }

  return saved;
}
```

**No App:**
- Implementar push notification quando status muda
- Ou polling periódico (GET /shipments/my-shipments)
- Ou WebSocket (futuro)

---

## 🪙 Gamificação (NavegaCoins)

### **Quando são creditados:**

Apenas quando encomenda é **validada pelo destinatário** (status → `DELIVERED`).

**Backend:**

```typescript
// shipments.service.ts - validateDelivery()
await this.gamificationService.awardPoints(
  shipment.senderId,              // Remetente recebe
  PointAction.SHIPMENT_DELIVERED,
  shipment.id,
);
```

**Pontos:**
- Definido em `GamificationService`
- Ação: `PointAction.SHIPMENT_DELIVERED`
- Exemplo: 10 NavegaCoins por entrega

**No App:**
- Mostrar notificação: "Você ganhou 10 NavegaCoins! 🪙"
- Atualizar saldo na tela de perfil
- Animar confetti/celebração

---

## ✅ Checklist de Implementação (App)

### **Telas Necessárias:**

- [ ] **CreateShipmentScreen** - Formulário + upload fotos + cálculo preço
- [ ] **ConfirmPaymentScreen** - PIX/QR Code + botão confirmar
- [ ] **MyShipmentsScreen** - Lista de encomendas
- [ ] **ShipmentDetailsScreen** - Detalhes + QR Code + Timeline
- [ ] **TrackShipmentScreen** - Rastreamento público (sem login)
- [ ] **ScanQRCodeScreen** - Scanner (capitão - coleta)
- [ ] **ValidateDeliveryScreen** - Validação (destinatário - QR Code)
- [ ] **ShipmentReviewScreen** - Avaliar encomenda

### **Funcionalidades:**

- [ ] Deep Link configurado (`navegaja://`)
- [ ] QR Code Scanner (expo-barcode-scanner)
- [ ] Upload fotos S3 (presigned URLs)
- [ ] Timeline animada (eventos)
- [ ] Push notifications (status changes)
- [ ] Compartilhar tracking (WhatsApp, SMS)
- [ ] Copiar validationCode
- [ ] Mostrar NavegaCoins ganhos
- [ ] Exibir QR Code (deep link)

### **Validações Client-Side:**

- [ ] Peso: 0.1kg ≤ x ≤ 50kg
- [ ] Fotos: máx 5
- [ ] recipientName: min 3 chars
- [ ] recipientPhone: formato válido
- [ ] recipientAddress: min 10 chars
- [ ] validationCode: exatamente 6 dígitos

---

## 🧪 Testando

### **Arquivo Completo:**

[examples/shipments-test-complete.http](examples/shipments-test-complete.http)

### **Fluxo Rápido:**

```http
### 1. Login
POST http://localhost:3000/auth/login
{ "cpf": "12345678900", "password": "senha123" }

### 2. Criar encomenda
POST http://localhost:3000/shipments
Authorization: Bearer {{token}}
{
  "tripId": "{{tripId}}",
  "description": "Teste",
  "weightKg": 2.5,
  "recipientName": "João Silva",
  "recipientPhone": "92987654321",
  "recipientAddress": "Rua Teste, 123",
  "paymentMethod": "pix"
}

### 3. Confirmar pagamento
POST http://localhost:3000/shipments/{{shipmentId}}/confirm-payment
Authorization: Bearer {{token}}

### 4. Capitão coleta
POST http://localhost:3000/shipments/{{shipmentId}}/collect
Authorization: Bearer {{captainToken}}
{ "validationCode": "{{validationCode}}" }

### 5. Viagem parte (capitão)
PATCH http://localhost:3000/trips/{{tripId}}/status
Authorization: Bearer {{captainToken}}
{ "status": "in_progress" }

### 6. Rastrear
GET http://localhost:3000/shipments/track/{{trackingCode}}
```

---

## 📊 Resumo Técnico

| Item | Valor |
|------|-------|
| **Endpoints** | 14 |
| **Status** | 8 |
| **Automação** | 2 (viagem parte/chega) |
| **Validações** | 2 (coleta + entrega) |
| **Fotos** | 3 (encomenda + coleta + entrega) |
| **QR Code** | Deep Link |
| **Auth Pública** | 2 endpoints (track, validate-delivery) |
| **Gamificação** | Sim (NavegaCoins) |
| **Compatibilidade** | Aliases (weight, price, dimensions) |

---

## 📞 Suporte

**Documentação Relacionada:**
- [SHIPMENT_FLOW.md](SHIPMENT_FLOW.md) - Guia de implementação app
- [FRONTEND_API_CONTRACT.md](FRONTEND_API_CONTRACT.md) - Contrato frontend
- [examples/shipments-test-complete.http](examples/shipments-test-complete.http) - Testes

**Contato:**
- Backend: tech@navegaja.com
- Issues: GitHub

---

**Versão:** 2.0.0
**Data:** 2026-02-14
**Status:** ✅ Implementado
**Próximo:** Testes no emulador + App implementação

🚢 **NavegaJá - Conectando a Amazônia!**
