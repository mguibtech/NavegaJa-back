# 📦 Fluxo Completo de Encomendas - NavegaJá

## 🎯 Visão Geral

Sistema completo de envio de encomendas com validação por QR Code e rastreamento em tempo real.

---

## 📊 Status da Encomenda

```
PENDING → PAID → COLLECTED → IN_TRANSIT → ARRIVED → OUT_FOR_DELIVERY → DELIVERED
                                                              ↓
                                                          CANCELLED
```

| Status | Descrição | Quem pode atualizar |
|--------|-----------|---------------------|
| `PENDING` | Criada, aguardando pagamento | Sistema (auto) |
| `PAID` | Pagamento confirmado, aguardando coleta | Remetente/Admin |
| `COLLECTED` | Capitão coletou do remetente | Capitão (com QR/PIN) |
| `IN_TRANSIT` | Viagem em andamento | Sistema (auto) |
| `ARRIVED` | Viagem chegou ao destino | Sistema (auto) |
| `OUT_FOR_DELIVERY` | Capitão saiu para entregar | Capitão |
| `DELIVERED` | Destinatário confirmou recebimento | Destinatário (com QR/PIN) |
| `CANCELLED` | Cancelada pelo remetente | Remetente |

---

## 🔄 Fluxo Detalhado

### **1️⃣ Remetente cria encomenda**

**Endpoint:** `POST /shipments`

**Request:**
```json
{
  "tripId": "uuid-da-viagem",
  "description": "Documentos importantes",
  "weight": 2.5,
  "dimensions": {
    "length": 30,
    "width": 20,
    "height": 15
  },
  "photos": ["url1", "url2"],
  "recipientName": "João Silva",
  "recipientPhone": "11987654321",
  "recipientAddress": "Rua X, 123 - Beruri, AM",
  "paymentMethod": "pix",
  "couponCode": "FRETE10"
}
```

**Response:**
```json
{
  "id": "uuid",
  "trackingCode": "NJ2026000001",
  "validationCode": "123456",  // ⚠️ IMPORTANTE: Guardar este código!
  "qrCode": "data:image/png;base64...",
  "status": "pending",
  "totalPrice": 45.00,
  "weight": 2.5,
  "dimensions": {...},
  "createdAt": "2026-02-13T10:00:00Z"
}
```

**🔐 Campos Importantes:**
- **`validationCode`**: PIN de 6 dígitos usado para validação (coleta + entrega)
- **`qrCode`**: QR Code em base64 contendo **deep link**:
  ```
  navegaja://shipment/validate?trackingCode=NJ2026000001&validationCode=123456
  ```

  ✅ **Vantagens do Deep Link:**
  - Escanear fora do app → Abre o app automaticamente
  - Sem app instalado → Redireciona para Google Play/App Store
  - Compartilhável via WhatsApp, SMS, etc.
  - Marketing orgânico

**Status:** `PENDING`

---

### **2️⃣ Remetente confirma pagamento**

**Endpoint:** `POST /shipments/:id/confirm-payment`

**Request:** (vazio)

**Response:**
```json
{
  "id": "uuid",
  "status": "paid",
  ...
}
```

**Timeline:**
- *"Pagamento confirmado. Aguardando coleta pelo capitão."*

**Status:** `PAID`

---

### **3️⃣ Capitão coleta encomenda (VALIDAÇÃO QR CODE)**

**Fluxo no App:**

1. **Capitão abre o app** → Vai em "Minhas Viagens" → Seleciona viagem
2. **Vê lista de encomendas** para coletar (status `PAID`)
3. **Clica em "Coletar Encomenda"**
4. **App abre câmera** para escanear QR Code do remetente
5. **QR Code lido** → App extrai `validationCode`
6. **Capitão tira foto** da encomenda (prova de coleta)
7. **App envia validação** ao backend

**Endpoint:** `POST /shipments/:id/collect`

**Request:**
```json
{
  "validationCode": "123456",
  "collectionPhotoUrl": "https://s3.../collection.jpg"
}
```

**Headers:**
```
Authorization: Bearer {captain_token}
```

**Response:**
```json
{
  "id": "uuid",
  "status": "collected",
  "collectedAt": "2026-02-13T14:00:00Z",
  "collectionPhotoUrl": "https://...",
  ...
}
```

**✅ Validações:**
- Capitão é da viagem ✓
- Status atual é `PAID` ✓
- Código de validação correto ✓

**Timeline:**
- *"Encomenda coletada pelo capitão"*

**Status:** `COLLECTED`

---

### **4️⃣ Viagem parte (AUTOMÁTICO)**

**Quando:** Capitão atualiza status da viagem para `IN_PROGRESS`

**Endpoint:** `PATCH /trips/:id/status`

**Request:**
```json
{
  "status": "in_progress"
}
```

**🤖 Sistema automaticamente:**
1. Atualiza TODAS encomendas da viagem que estão `COLLECTED`
2. Muda status para `IN_TRANSIT`
3. Adiciona evento na timeline

**Timeline (auto):**
- *"Viagem iniciada - Encomenda em trânsito"*

**Status:** `IN_TRANSIT`

---

### **5️⃣ Viagem chega (AUTOMÁTICO)**

**Quando:** Capitão atualiza status da viagem para `COMPLETED`

**Endpoint:** `PATCH /trips/:id/status`

**Request:**
```json
{
  "status": "completed"
}
```

**🤖 Sistema automaticamente:**
1. Atualiza TODAS encomendas da viagem que estão `IN_TRANSIT`
2. Muda status para `ARRIVED`
3. Adiciona evento na timeline

**Timeline (auto):**
- *"Viagem chegou ao destino - Aguardando entrega"*

**Status:** `ARRIVED`

---

### **6️⃣ Capitão sai para entregar**

**Endpoint:** `POST /shipments/:id/out-for-delivery`

**Headers:**
```
Authorization: Bearer {captain_token}
```

**Response:**
```json
{
  "id": "uuid",
  "status": "out_for_delivery",
  ...
}
```

**Timeline:**
- *"Saiu para entrega ao destinatário"*

**Status:** `OUT_FOR_DELIVERY`

---

### **7️⃣ Destinatário valida entrega (VALIDAÇÃO QR CODE)**

**🎯 Fluxo Recomendado (com Deep Link):**

#### **Opção A: Destinatário escaneia QR Code fora do app**

1. **Destinatário escaneia QR Code** com câmera do celular
2. **QR Code contém deep link:** `navegaja://shipment/validate?trackingCode=NJ2026000001&validationCode=123456`
3. **Deep link abre o app** (ou redireciona para download)
4. **App já abre tela de validação** com dados pré-preenchidos
5. **Destinatário confirma** recebimento
6. **Capitão tira foto** da entrega (opcional)
7. **App envia validação** ao backend

#### **Opção B: Destinatário escaneia dentro do app**

1. **Destinatário abre o app**
2. **Vai em "Rastrear Encomenda"** → "Validar Entrega"
3. **App abre câmera** para escanear QR Code
4. **Resto do fluxo igual**

**Endpoint:** `POST /shipments/validate-delivery` (público, sem auth!)

**Request:**
```json
{
  "trackingCode": "NJ2026000001",
  "validationCode": "123456",
  "deliveryPhotoUrl": "https://s3.../delivery.jpg"
}
```

**Response:**
```json
{
  "id": "uuid",
  "status": "delivered",
  "deliveredAt": "2026-02-13T18:00:00Z",
  "deliveryPhotoUrl": "https://...",
  ...
}
```

**✅ Validações:**
- Status atual é `ARRIVED` ou `OUT_FOR_DELIVERY` ✓
- Código de validação correto ✓

**Timeline:**
- *"Entrega confirmada pelo destinatário"*

**🪙 Gamificação:**
- Sistema credita **NavegaCoins** automaticamente ao remetente!

**Status:** `DELIVERED`

---

### **8️⃣ Cancelamento (opcional)**

**Endpoint:** `POST /shipments/:id/cancel`

**Request:**
```json
{
  "reason": "Viagem cancelada"
}
```

**Headers:**
```
Authorization: Bearer {sender_token}
```

**⚠️ Regras:**
- Só remetente pode cancelar
- Não pode cancelar se já foi entregue
- Não pode cancelar se já cancelada

**Status:** `CANCELLED`

---

## 📱 Implementação no App

### **1. QR Code com Deep Link**

**✅ Backend já gera automaticamente!**

O QR Code retornado pelo backend já contém o deep link:

```
navegaja://shipment/validate?trackingCode=NJ2026000001&validationCode=123456
```

**No app, você só precisa:**
1. Exibir o QR Code (já vem em base64)
2. Permitir compartilhar (WhatsApp, SMS, etc.)

**Configuração do Deep Link (React Native):**

```json
// app.json ou app.config.js
{
  "expo": {
    "scheme": "navegaja",
    "android": {
      "intentFilters": [
        {
          "action": "VIEW",
          "data": [
            {
              "scheme": "navegaja",
              "host": "shipment"
            }
          ],
          "category": ["BROWSABLE", "DEFAULT"]
        }
      ]
    },
    "ios": {
      "associatedDomains": ["applinks:navegaja.com"]
    }
  }
}
```

**Tratar deep link no app:**

```typescript
import * as Linking from 'expo-linking';
import { useEffect } from 'react';

// Hook para tratar deep links (App.tsx ou similar)
useEffect(() => {
  // Deep link ao abrir o app
  const handleDeepLink = (event: { url: string }) => {
    const { hostname, queryParams } = Linking.parse(event.url);

    if (hostname === 'shipment') {
      const trackingCode = queryParams?.trackingCode as string;
      const validationCode = queryParams?.validationCode as string;

      if (trackingCode && validationCode) {
        // Navegar para tela de validação
        navigation.navigate('ValidateDelivery', {
          trackingCode,
          validationCode,
        });
      }
    }
  };

  // Listener de deep link
  const subscription = Linking.addEventListener('url', handleDeepLink);

  // Deep link quando app já está aberto
  Linking.getInitialURL().then((url) => {
    if (url) handleDeepLink({ url });
  });

  return () => subscription.remove();
}, []);
```

---

### **2. Tela de Validação de Entrega**

```tsx
// screens/ValidateDeliveryScreen.tsx
import React, { useState } from 'react';
import { View, Button, Image } from 'react-native';
import { Camera } from 'expo-camera';

export default function ValidateDeliveryScreen({ route }) {
  const { trackingCode, validationCode } = route.params;
  const [photo, setPhoto] = useState(null);

  const handleConfirmDelivery = async () => {
    // Upload foto (se tiver)
    let deliveryPhotoUrl = null;
    if (photo) {
      deliveryPhotoUrl = await uploadToS3(photo);
    }

    // Validar entrega
    const response = await fetch('https://api.navegaja.com/shipments/validate-delivery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        trackingCode,
        validationCode,
        deliveryPhotoUrl,
      }),
    });

    if (response.ok) {
      alert('Entrega confirmada com sucesso! 🎉');
      navigation.navigate('Home');
    } else {
      alert('Erro ao validar entrega');
    }
  };

  return (
    <View>
      <Text>Confirmação de Entrega</Text>
      <Text>Código de rastreamento: {trackingCode}</Text>

      {/* Câmera para tirar foto (opcional) */}
      <Camera ref={cameraRef} />
      <Button title="Tirar Foto" onPress={takePhoto} />

      {photo && <Image source={{ uri: photo }} />}

      <Button title="Confirmar Entrega" onPress={handleConfirmDelivery} />
    </View>
  );
}
```

---

### **3. Scanner de QR Code (Capitão)**

```tsx
// screens/CollectShipmentScreen.tsx
import { BarCodeScanner } from 'expo-barcode-scanner';
import * as Linking from 'expo-linking';

export default function CollectShipmentScreen({ route }) {
  const { shipmentId } = route.params;

  const handleQRCodeScanned = async ({ data }) => {
    let validationCode;

    // Detectar se é deep link ou JSON (compatibilidade)
    if (data.startsWith('navegaja://') || data.startsWith('https://')) {
      // Deep link
      const { queryParams } = Linking.parse(data);
      validationCode = queryParams?.validationCode as string;
    } else {
      // JSON (fallback para QR Codes antigos)
      try {
        const qrData = JSON.parse(data);
        validationCode = qrData.validationCode;
      } catch (error) {
        alert('QR Code inválido');
        return;
      }
    }

    if (!validationCode) {
      alert('Código de validação não encontrado');
      return;
    }

    // Upload foto de coleta
    const collectionPhotoUrl = await uploadToS3(photo);

    // Enviar validação
    const response = await fetch(`https://api.navegaja.com/shipments/${shipmentId}/collect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        validationCode,
        collectionPhotoUrl,
      }),
    });

    if (response.ok) {
      alert('Encomenda coletada com sucesso! ✅');
    }
  };

  return (
    <BarCodeScanner
      onBarCodeScanned={handleQRCodeScanned}
      style={{ flex: 1 }}
    />
  );
}
```

---

## 🔐 Segurança

### **validationCode (PIN de 6 dígitos)**

**Onde é usado:**
1. **Coleta** - Capitão precisa do código para coletar
2. **Entrega** - Destinatário precisa do código para confirmar

**Como compartilhar:**
- **Remetente → Capitão**: Mostrar QR Code ou ditar PIN
- **Remetente → Destinatário**: Enviar por WhatsApp/SMS/Telegram

**Exemplo de mensagem para destinatário:**
```
Olá João! 📦

Sua encomenda está a caminho!

🔢 Código de validação: 123456
📍 Rastreamento: NJ2026000001

Para confirmar o recebimento, use este código quando o capitão chegar.

Rastreie em tempo real: https://navegaja.com/track/NJ2026000001
```

---

## 📊 Timeline de Eventos

Todos os eventos são registrados automaticamente:

**Endpoint:** `GET /shipments/:id/timeline`

**Response:**
```json
[
  {
    "id": "uuid",
    "status": "pending",
    "description": "Encomenda criada e aguardando confirmação de pagamento",
    "createdAt": "2026-02-13T10:00:00Z",
    "timestamp": "2026-02-13T10:00:00Z"
  },
  {
    "id": "uuid",
    "status": "paid",
    "description": "Pagamento confirmado. Aguardando coleta pelo capitão.",
    "createdAt": "2026-02-13T10:05:00Z",
    "timestamp": "2026-02-13T10:05:00Z"
  },
  {
    "id": "uuid",
    "status": "collected",
    "description": "Encomenda coletada pelo capitão",
    "location": null,
    "createdBy": "captain-uuid",
    "createdAt": "2026-02-13T14:00:00Z",
    "timestamp": "2026-02-13T14:00:00Z"
  },
  {
    "id": "uuid",
    "status": "in_transit",
    "description": "Viagem iniciada - Encomenda em trânsito",
    "createdAt": "2026-02-13T15:00:00Z",
    "timestamp": "2026-02-13T15:00:00Z"
  },
  {
    "id": "uuid",
    "status": "arrived",
    "description": "Viagem chegou ao destino - Aguardando entrega",
    "createdAt": "2026-02-13T17:30:00Z",
    "timestamp": "2026-02-13T17:30:00Z"
  },
  {
    "id": "uuid",
    "status": "out_for_delivery",
    "description": "Saiu para entrega ao destinatário",
    "createdBy": "captain-uuid",
    "createdAt": "2026-02-13T17:45:00Z",
    "timestamp": "2026-02-13T17:45:00Z"
  },
  {
    "id": "uuid",
    "status": "delivered",
    "description": "Entrega confirmada pelo destinatário",
    "createdAt": "2026-02-13T18:00:00Z",
    "timestamp": "2026-02-13T18:00:00Z"
  }
]
```

---

## 🚀 Endpoints Completos

| Método | Endpoint | Auth | Descrição |
|--------|----------|------|-----------|
| `POST` | `/shipments` | ✅ User | Criar encomenda |
| `POST` | `/shipments/calculate-price` | ✅ User | Calcular preço |
| `POST` | `/shipments/upload/presigned-urls` | ✅ User | Gerar URLs S3 |
| `POST` | `/shipments/:id/confirm-payment` | ✅ User | Confirmar pagamento |
| `POST` | `/shipments/:id/collect` | ✅ Captain | Coletar encomenda (QR) |
| `POST` | `/shipments/:id/out-for-delivery` | ✅ Captain | Sair para entrega |
| `POST` | `/shipments/validate-delivery` | ❌ Público | Validar entrega (QR) |
| `POST` | `/shipments/:id/cancel` | ✅ User | Cancelar encomenda |
| `GET` | `/shipments/my-shipments` | ✅ User | Listar minhas encomendas |
| `GET` | `/shipments/:id` | ✅ User | Buscar por ID |
| `GET` | `/shipments/:id/timeline` | ✅ User | Timeline de eventos |
| `GET` | `/shipments/track/:code` | ❌ Público | Rastrear por código |
| `GET` | `/shipments/:id/review` | ✅ User | Buscar avaliação |
| `POST` | `/shipments/reviews` | ✅ User | Criar avaliação |

---

## 🎨 UI/UX Recomendações

### **Tela de Detalhes da Encomenda (Remetente)**

```
┌─────────────────────────────────────┐
│  📦 Encomenda #NJ2026000001         │
├─────────────────────────────────────┤
│                                     │
│  Status: 🚢 Em Trânsito             │
│                                     │
│  ┌─────────────────────────────┐   │
│  │   [QR CODE AQUI]            │   │
│  │                             │   │
│  └─────────────────────────────┘   │
│                                     │
│  Código de Validação: 123456        │
│  [Copiar]  [Compartilhar]           │
│                                     │
│  📍 Timeline:                       │
│  ✅ Criada (13/02 10:00)            │
│  ✅ Pagamento confirmado            │
│  ✅ Coletada pelo capitão           │
│  🚢 Em trânsito                     │
│  ⏳ Aguardando chegada...           │
│                                     │
│  📦 Detalhes:                       │
│  Peso: 2.5kg                        │
│  Preço: R$ 45,00                    │
│  Destinatário: João Silva           │
│  Telefone: (11) 98765-4321          │
│                                     │
│  🚢 Viagem:                         │
│  Manaus → Beruri                    │
│  Capitão: José Carlos               │
│  Barco: Estrela do Mar              │
│  Saída: 13/02 15:00                 │
│  Chegada prevista: 13/02 17:30      │
│                                     │
│  [Rastrear em Tempo Real]           │
│  [Cancelar Encomenda]               │
│                                     │
└─────────────────────────────────────┘
```

### **Tela de Validação (Destinatário)**

```
┌─────────────────────────────────────┐
│  ✅ Confirmação de Entrega          │
├─────────────────────────────────────┤
│                                     │
│  📦 Encomenda #NJ2026000001         │
│                                     │
│  Remetente: Maria Santos            │
│  Peso: 2.5kg                        │
│  Descrição: Documentos importantes  │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  📸 Tirar foto da encomenda         │
│  (opcional)                         │
│                                     │
│  [📷  Tirar Foto]                   │
│                                     │
│  [Foto tirada...]                   │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  ⚠️ Ao confirmar, você declara     │
│  que recebeu a encomenda em         │
│  perfeito estado.                   │
│                                     │
│  [✅ CONFIRMAR ENTREGA]             │
│                                     │
└─────────────────────────────────────┘
```

---

## 🧪 Testando o Fluxo Completo

1. **Criar encomenda** → `POST /shipments`
2. **Confirmar pagamento** → `POST /shipments/:id/confirm-payment`
3. **Capitão coleta** → `POST /shipments/:id/collect` (validationCode)
4. **Viagem parte** → `PATCH /trips/:id/status` (status: in_progress)
5. **Viagem chega** → `PATCH /trips/:id/status` (status: completed)
6. **Capitão sai para entregar** → `POST /shipments/:id/out-for-delivery`
7. **Destinatário valida** → `POST /shipments/validate-delivery` (validationCode)
8. **Verificar timeline** → `GET /shipments/:id/timeline`

---

## 🪙 Gamificação

**NavegaCoins são creditados quando:**
- Status muda para `DELIVERED` (após validação do destinatário)

**Pontos:**
- Definido em `GamificationService`
- Ação: `SHIPMENT_DELIVERED`

---

## ⚠️ Observações Importantes

1. **validationCode** é sensível - não expor em logs
2. **QR Code** contém validationCode - gerar apenas quando necessário
3. **Deep Link** deve funcionar mesmo sem app instalado (fallback para download)
4. **Timeline** é append-only (nunca deletar eventos)
5. **Fotos** são opcionais mas recomendadas (prova de coleta/entrega)
6. **Auto-update** só acontece para encomendas não canceladas/entregues

---

**Pronto para implementar! 🚀**
