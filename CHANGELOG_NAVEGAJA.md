# 📝 Changelog - NavegaJá Backend

## 🎉 Versão 2.0 - Refatoração Completa de Trips & Bookings

**Data:** 12 de Fevereiro de 2026

---

## ✨ Novos Recursos

### 1. **Sistema de Trips Simplificado**
- ✅ Campos `origin` e `destination` adicionados diretamente na entidade Trip
- ✅ Busca direta por cidades sem dependência de Routes
- ✅ CRUD completo para Trips (Create, Read, Update, Delete)

### 2. **Sistema de QR Code Automático**
- ✅ Geração automática de QR code em base64 ao criar booking
- ✅ QR code contém dados criptografados da reserva
- ✅ Biblioteca `qrcode` integrada
- ✅ Formato: `data:image/png;base64,...`

### 3. **Novos Endpoints**

#### Trips
- **POST /trips** - Criar viagem (Captain only)
- **PUT /trips/:id** - Atualizar viagem (Captain only)
- **DELETE /trips/:id** - Deletar/Cancelar viagem (Captain only)

#### Bookings
- **POST /bookings/:id/cancel** - Cancelar reserva (antes era PATCH)
- **POST /bookings/:id/checkin** - Check-in (antes era PATCH)

### 4. **Melhorias em DTOs**

#### CreateTripDto (NOVO)
```typescript
{
  origin: string          // ✨ NOVO
  destination: string     // ✨ NOVO
  boatId: string
  departureTime: string   // ISO 8601
  arrivalTime: string     // ISO 8601
  price: number
  totalSeats: number
}
```

#### CreateBookingDto (ATUALIZADO)
```typescript
{
  tripId: string
  seatNumber?: number      // ✨ NOVO (opcional)
  quantity: number         // ✨ NOVO (antes era 'seats')
  paymentMethod: enum      // ✨ NOVO (enum tipado)
}
```

#### PaymentMethod Enum (NOVO)
```typescript
enum PaymentMethod {
  PIX = 'pix',
  CASH = 'cash',
  CREDIT_CARD = 'credit_card',
  DEBIT_CARD = 'debit_card'
}
```

---

## 🔄 Mudanças em Entidades

### **Trip Entity**

**Campos Adicionados:**
| Campo | Tipo | Descrição |
|-------|------|-----------|
| `origin` | string | Cidade de origem |
| `destination` | string | Cidade de destino |

**Enum Atualizado:**
```typescript
// ANTES
enum TripStatus {
  SCHEDULED = 'scheduled',
  BOARDING = 'boarding',    ❌ REMOVIDO
  SAILING = 'sailing',      ❌ REMOVIDO
  ARRIVED = 'arrived',      ❌ REMOVIDO
  CANCELLED = 'cancelled'
}

// DEPOIS
enum TripStatus {
  SCHEDULED = 'scheduled',
  IN_PROGRESS = 'in_progress',  ✨ NOVO
  COMPLETED = 'completed',       ✨ NOVO
  CANCELLED = 'cancelled'
}
```

### **Booking Entity**

**Campos Adicionados:**
| Campo | Tipo | Descrição |
|-------|------|-----------|
| `seatNumber` | number (nullable) | Número do assento |
| `paymentMethod` | PaymentMethod enum | Método de pagamento tipado |

**Campos Modificados:**
| Campo | Antes | Depois |
|-------|-------|--------|
| `qrCode` | varchar(255) unique | text nullable |

---

## 🛠️ Alterações Técnicas

### 1. **Dependências Adicionadas**
```json
{
  "qrcode": "^1.5.4",
  "@types/qrcode": "^1.5.6"
}
```

### 2. **Migrations Executadas**

#### Script 1: Update Enum
- ✅ Converteu status antigos para novos valores
- ✅ Removeu enum `trips_status_enum` antigo
- ✅ Criou novo enum com valores atualizados

#### Script 2: Populate Data
- ✅ Populou `origin` e `destination` baseado em Routes
- ✅ Gerou QR codes placeholder para bookings existentes
- ✅ Atualizou 10 trips
- ✅ Atualizou 6 bookings

### 3. **Services Atualizados**

#### TripsService
**Novos Métodos:**
- `update(tripId, captainId, dto)` - Atualizar viagem
- `delete(tripId, captainId)` - Deletar/cancelar viagem

**Métodos Modificados:**
- `create()` - Usa origin/destination diretamente
- `search()` - Busca por LOWER(origin) LIKE e LOWER(destination) LIKE

#### BookingsService
**Métodos Modificados:**
- `create()` - Gera QR code em base64 usando biblioteca qrcode
- `findByPassenger()` - Removido filtro de status (simplificado)

### 4. **Controllers Atualizados**

#### TripsController
- ✅ Endpoint GET unificado (removido `/search` e `/available`)
- ✅ Adicionado PUT /:id
- ✅ Adicionado DELETE /:id

#### BookingsController
- ✅ POST /:id/cancel (antes PATCH)
- ✅ POST /:id/checkin (antes PATCH)

---

## 📊 Comparação Antes x Depois

### Fluxo de Criação de Viagem

**ANTES:**
```
1. Criar Route (origin, destination)
2. Criar Trip (routeId)
3. Trip depende de Route
```

**DEPOIS:**
```
1. Criar Trip (origin, destination diretamente)
2. Route é opcional (para compatibilidade)
```

### Fluxo de Reserva

**ANTES:**
```
1. POST /bookings { tripId, seats }
2. Recebe booking sem QR code
3. Precisa gerar QR code manualmente
```

**DEPOIS:**
```
1. POST /bookings { tripId, quantity, paymentMethod }
2. Recebe booking COM QR code em base64
3. QR code pronto para exibir no app
```

---

## 🔒 Segurança & Validação

### Validações Implementadas

**CreateTripDto:**
- ✅ `origin` - Required, NotEmpty
- ✅ `destination` - Required, NotEmpty
- ✅ `departureTime` - Required, ISO 8601
- ✅ `arrivalTime` - Required, ISO 8601
- ✅ `price` - Required, Number
- ✅ `totalSeats` - Required, Number

**CreateBookingDto:**
- ✅ `tripId` - Required, UUID
- ✅ `quantity` - Required, Min: 1
- ✅ `paymentMethod` - Required, Enum
- ✅ `seatNumber` - Optional, Number

### Autorizações

| Endpoint | Auth | Role |
|----------|------|------|
| GET /trips | JWT | Any |
| POST /trips | JWT | Captain |
| PUT /trips/:id | JWT | Captain (owner) |
| DELETE /trips/:id | JWT | Captain (owner) |
| POST /bookings | JWT | Any |
| POST /bookings/:id/cancel | JWT | Passenger (owner) |
| POST /bookings/:id/checkin | JWT | Captain |

---

## 🐛 Bugs Corrigidos

1. ✅ **Erro de coluna NULL ao adicionar origin/destination**
   - Solução: Campos nullable com default value

2. ✅ **Erro de enum inválido com valores antigos**
   - Solução: Script SQL para converter valores

3. ✅ **Erro ao criar booking sem QR code**
   - Solução: Campo nullable + geração automática

4. ✅ **Dependência circular com Route**
   - Solução: Campos origin/destination diretos

---

## 📁 Arquivos Criados

```
backend/
├── ENDPOINTS_SPEC.md           ✨ Documentação completa
├── ENDPOINTS_EXAMPLES.http     ✨ Exemplos de uso
├── CHANGELOG_NAVEGAJA.md       ✨ Este arquivo
├── fix-database.sql            🛠️ Script SQL de correção
└── scripts/
    ├── update-enum.js          🛠️ Atualização de enum
    ├── populate-data.js        🛠️ Popular dados existentes
    └── fix-database.js         🛠️ Correções gerais
```

---

## 🚀 Como Usar

### 1. Documentação Interativa
```
http://localhost:3000/api
```

### 2. Testar Endpoints
Use o arquivo `ENDPOINTS_EXAMPLES.http` com REST Client (VSCode):
```bash
# Instalar extensão REST Client no VSCode
code --install-extension humao.rest-client

# Abrir arquivo
code ENDPOINTS_EXAMPLES.http
```

### 3. Integração Frontend

**Buscar Viagens:**
```typescript
const response = await api.get('/trips', {
  params: {
    origin: 'Manaus',
    destination: 'Parintins',
    date: '2026-02-15'
  }
});
```

**Criar Reserva:**
```typescript
const booking = await api.post('/bookings', {
  tripId: '123e4567-e89b-12d3-a456-426614174000',
  quantity: 2,
  paymentMethod: 'pix'
});

// QR Code disponível em booking.qrCode (base64)
console.log(booking.qrCode);
// "data:image/png;base64,iVBORw0KGgo..."
```

**Exibir QR Code (React Native):**
```tsx
import { Image } from 'react-native';

<Image
  source={{ uri: booking.qrCode }}
  style={{ width: 200, height: 200 }}
/>
```

---

## ⚠️ Breaking Changes

1. **TripStatus Enum mudou**
   - `BOARDING` → `IN_PROGRESS`
   - `SAILING` → `IN_PROGRESS`
   - `ARRIVED` → `COMPLETED`

2. **CreateTripDto mudou**
   - Removido: `routeId` (obrigatório)
   - Adicionado: `origin`, `destination` (obrigatórios)
   - Renomeado: `departureAt` → `departureTime`
   - Adicionado: `arrivalTime`

3. **CreateBookingDto mudou**
   - Renomeado: `seats` → `quantity`
   - Adicionado: `seatNumber` (opcional)
   - Adicionado: `paymentMethod` (enum obrigatório)

4. **Endpoints mudaram**
   - `/bookings/:id/cancel` - PATCH → POST
   - `/bookings/:id/checkin` - PATCH → POST

---

## 🎯 Próximos Passos (Sugestões)

1. **Testes Automatizados**
   - [ ] Testes unitários para services
   - [ ] Testes E2E para endpoints críticos
   - [ ] Testes de integração QR code

2. **Melhorias**
   - [ ] Implementar sistema de notificações push
   - [ ] Adicionar webhook para status de pagamento
   - [ ] Cache com Redis para buscas frequentes
   - [ ] Rate limiting para APIs públicas

3. **Documentação**
   - [ ] Adicionar diagramas de sequência
   - [ ] Criar guia de contribuição
   - [ ] Documentar fluxo de pagamento completo

---

## 👥 Equipe

**Desenvolvido por:** Claude Sonnet 4.5
**Data:** 12/02/2026
**Versão:** 2.0.0

---

## 📞 Suporte

Para dúvidas ou problemas:
1. Consulte `ENDPOINTS_SPEC.md`
2. Teste com `ENDPOINTS_EXAMPLES.http`
3. Acesse Swagger em `/api`
4. Verifique logs do servidor
