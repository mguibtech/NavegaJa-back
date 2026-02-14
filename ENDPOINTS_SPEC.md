# 📚 Especificação Completa - API NavegaJá

## 🔐 Autenticação

Todos os endpoints (exceto `/auth/register` e `/auth/login`) requerem autenticação JWT via Bearer Token.

**Header necessário:**
```
Authorization: Bearer {access_token}
```

---

## 🚢 TRIPS (Viagens)

### **GET /trips**
Buscar viagens disponíveis com filtros opcionais.

**Auth:** JWT Required
**Query Parameters:**
| Parâmetro | Tipo | Obrigatório | Descrição | Exemplo |
|-----------|------|-------------|-----------|---------|
| `origin` | string | Não | Cidade de origem (busca parcial) | Manaus |
| `destination` | string | Não | Cidade de destino (busca parcial) | Parintins |
| `date` | string | Não | Data no formato YYYY-MM-DD | 2026-02-15 |

**Exemplo de Request:**
```http
GET /trips?origin=Manaus&destination=Parintins&date=2026-02-15
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**Response 200:**
```json
[
  {
    "id": "uuid",
    "origin": "Manaus",
    "destination": "Parintins",
    "departureAt": "2026-02-15T08:00:00.000Z",
    "estimatedArrivalAt": "2026-02-15T14:00:00.000Z",
    "price": 45.00,
    "availableSeats": 18,
    "totalSeats": 20,
    "status": "scheduled",
    "boatId": "uuid",
    "captainId": "uuid",
    "createdAt": "2026-02-10T10:00:00.000Z",
    "updatedAt": "2026-02-10T10:00:00.000Z",
    "boat": {
      "id": "uuid",
      "name": "Barco Amazônia",
      "type": "regional",
      "capacity": 20,
      "photoUrl": "https://..."
    },
    "captain": {
      "id": "uuid",
      "name": "João Silva",
      "phone": "92991234567",
      "rating": 4.8,
      "avatarUrl": "https://..."
    }
  }
]
```

---

### **GET /trips/:id**
Obter detalhes de uma viagem específica.

**Auth:** JWT Required
**Path Parameters:**
| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `id` | uuid | ID da viagem |

**Response 200:**
```json
{
  "id": "uuid",
  "origin": "Manaus",
  "destination": "Parintins",
  "departureAt": "2026-02-15T08:00:00.000Z",
  "estimatedArrivalAt": "2026-02-15T14:00:00.000Z",
  "price": 45.00,
  "availableSeats": 18,
  "totalSeats": 20,
  "status": "scheduled",
  "boatId": "uuid",
  "captainId": "uuid",
  "boat": { ... },
  "captain": { ... },
  "bookings": [
    {
      "id": "uuid",
      "passengerId": "uuid",
      "seats": 2,
      "status": "confirmed"
    }
  ],
  "reviews": [
    {
      "id": "uuid",
      "rating": 5,
      "comment": "Excelente viagem!",
      "reviewer": { ... }
    }
  ]
}
```

**Response 404:**
```json
{
  "statusCode": 404,
  "message": "Viagem não encontrada"
}
```

---

### **POST /trips** ✨ NOVO
Criar nova viagem (apenas Captain).

**Auth:** JWT Required + Role: Captain
**Request Body:**
```json
{
  "origin": "Manaus",
  "destination": "Parintins",
  "boatId": "uuid",
  "departureTime": "2026-02-15T08:00:00Z",
  "arrivalTime": "2026-02-15T14:00:00Z",
  "price": 45.00,
  "totalSeats": 20
}
```

**DTO:** `CreateTripDto`
| Campo | Tipo | Validação | Descrição |
|-------|------|-----------|-----------|
| `origin` | string | Required, NotEmpty | Cidade de origem |
| `destination` | string | Required, NotEmpty | Cidade de destino |
| `boatId` | string | Required, UUID | ID da embarcação |
| `departureTime` | string | Required, ISO 8601 | Horário de partida |
| `arrivalTime` | string | Required, ISO 8601 | Horário previsto de chegada |
| `price` | number | Required, Positive | Preço por assento |
| `totalSeats` | number | Required, Positive | Total de assentos |

**Response 201:**
```json
{
  "id": "uuid",
  "origin": "Manaus",
  "destination": "Parintins",
  "departureAt": "2026-02-15T08:00:00.000Z",
  "estimatedArrivalAt": "2026-02-15T14:00:00.000Z",
  "price": 45.00,
  "totalSeats": 20,
  "availableSeats": 20,
  "status": "scheduled",
  "boatId": "uuid",
  "captainId": "uuid",
  "createdAt": "2026-02-12T15:00:00.000Z",
  "updatedAt": "2026-02-12T15:00:00.000Z"
}
```

**Response 403:**
```json
{
  "statusCode": 403,
  "message": "Acesso negado. Apenas capitães podem criar viagens."
}
```

---

### **PUT /trips/:id** ✨ NOVO
Atualizar viagem existente (apenas Captain dono da viagem).

**Auth:** JWT Required + Role: Captain
**Path Parameters:**
| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `id` | uuid | ID da viagem |

**Request Body:** (mesmo que POST - `CreateTripDto`)
```json
{
  "origin": "Manaus",
  "destination": "Parintins",
  "boatId": "uuid",
  "departureTime": "2026-02-15T09:00:00Z",
  "arrivalTime": "2026-02-15T15:00:00Z",
  "price": 50.00,
  "totalSeats": 25
}
```

**Regras:**
- Apenas o capitão dono da viagem pode atualizar
- `availableSeats` é ajustado automaticamente mantendo a proporção de assentos reservados
- Se `totalSeats` diminuir abaixo do número de assentos já reservados, retorna erro

**Response 200:**
```json
{
  "id": "uuid",
  "origin": "Manaus",
  "destination": "Parintins",
  "departureAt": "2026-02-15T09:00:00.000Z",
  "estimatedArrivalAt": "2026-02-15T15:00:00.000Z",
  "price": 50.00,
  "totalSeats": 25,
  "availableSeats": 23,
  "status": "scheduled",
  "boatId": "uuid",
  "captainId": "uuid",
  "updatedAt": "2026-02-12T15:30:00.000Z"
}
```

**Response 403:**
```json
{
  "statusCode": 403,
  "message": "Apenas o capitão pode atualizar esta viagem"
}
```

---

### **DELETE /trips/:id** ✨ NOVO
Deletar viagem (apenas Captain dono da viagem).

**Auth:** JWT Required + Role: Captain
**Path Parameters:**
| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `id` | uuid | ID da viagem |

**Comportamento:**
- **SE** houver reservas: Marca status como `cancelled` (não deleta)
- **SE NÃO** houver reservas: Remove permanentemente do banco

**Response 200:**
```json
{
  "message": "Viagem cancelada com sucesso"
}
```

**Response 403:**
```json
{
  "statusCode": 403,
  "message": "Apenas o capitão pode deletar esta viagem"
}
```

---

## 🎫 BOOKINGS (Reservas)

### **GET /bookings/my-bookings**
Listar reservas do usuário logado.

**Auth:** JWT Required

**Response 200:**
```json
[
  {
    "id": "uuid",
    "tripId": "uuid",
    "passengerId": "uuid",
    "seatNumber": 5,
    "seats": 2,
    "totalPrice": 90.00,
    "status": "confirmed",
    "paymentMethod": "pix",
    "qrCode": "data:image/png;base64,iVBORw0KGgo...",
    "checkedInAt": null,
    "createdAt": "2026-02-12T10:00:00.000Z",
    "trip": {
      "id": "uuid",
      "origin": "Manaus",
      "destination": "Parintins",
      "departureAt": "2026-02-15T08:00:00.000Z",
      "boat": { ... },
      "captain": { ... }
    }
  }
]
```

---

### **GET /bookings/:id**
Obter detalhes de uma reserva específica (com QR code).

**Auth:** JWT Required
**Path Parameters:**
| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `id` | uuid | ID da reserva |

**Response 200:**
```json
{
  "id": "uuid",
  "tripId": "uuid",
  "passengerId": "uuid",
  "seatNumber": 5,
  "seats": 2,
  "totalPrice": 90.00,
  "status": "confirmed",
  "paymentMethod": "pix",
  "qrCode": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
  "checkedInAt": null,
  "createdAt": "2026-02-12T10:00:00.000Z",
  "updatedAt": "2026-02-12T10:00:00.000Z",
  "trip": {
    "id": "uuid",
    "origin": "Manaus",
    "destination": "Parintins",
    "departureAt": "2026-02-15T08:00:00.000Z",
    "estimatedArrivalAt": "2026-02-15T14:00:00.000Z",
    "price": 45.00,
    "boat": { ... },
    "captain": { ... }
  },
  "passenger": {
    "id": "uuid",
    "name": "Maria Santos",
    "phone": "92998765432",
    "avatarUrl": "https://..."
  }
}
```

---

### **POST /bookings**
Criar nova reserva (gera QR code automaticamente).

**Auth:** JWT Required
**Request Body:**
```json
{
  "tripId": "uuid",
  "seatNumber": 5,
  "quantity": 2,
  "paymentMethod": "pix"
}
```

**DTO:** `CreateBookingDto`
| Campo | Tipo | Validação | Descrição |
|-------|------|-----------|-----------|
| `tripId` | string | Required, UUID | ID da viagem |
| `seatNumber` | number | Optional | Número do assento (se aplicável) |
| `quantity` | number | Required, Min: 1 | Quantidade de assentos |
| `paymentMethod` | enum | Required | Método de pagamento |

**PaymentMethod Enum:**
```typescript
enum PaymentMethod {
  PIX = 'pix',
  CASH = 'cash',
  CREDIT_CARD = 'credit_card',
  DEBIT_CARD = 'debit_card'
}
```

**Response 201:**
```json
{
  "id": "uuid",
  "tripId": "uuid",
  "passengerId": "uuid",
  "seatNumber": 5,
  "seats": 2,
  "totalPrice": 90.00,
  "status": "confirmed",
  "paymentMethod": "pix",
  "paymentStatus": "paid",
  "qrCode": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAABAAAAAQACAYAAA...",
  "createdAt": "2026-02-12T10:00:00.000Z"
}
```

**QR Code Data (JSON dentro do QR):**
```json
{
  "bookingId": "uuid",
  "userId": "uuid",
  "tripId": "uuid",
  "seatNumber": 5,
  "timestamp": "2026-02-12T10:00:00.000Z"
}
```

**Response 400:**
```json
{
  "statusCode": 400,
  "message": "Apenas 5 assentos disponíveis"
}
```

**Response 404:**
```json
{
  "statusCode": 404,
  "message": "Viagem não encontrada"
}
```

---

### **POST /bookings/:id/cancel** ✨ ATUALIZADO (era PATCH)
Cancelar reserva.

**Auth:** JWT Required
**Path Parameters:**
| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `id` | uuid | ID da reserva |

**Request Body:**
```json
{
  "reason": "Imprevisto familiar"
}
```

**DTO:** `CancelBookingDto`
| Campo | Tipo | Validação | Descrição |
|-------|------|-----------|-----------|
| `reason` | string | Optional | Motivo do cancelamento |

**Comportamento:**
- Atualiza status para `cancelled`
- Atualiza paymentStatus para `refunded`
- **Devolve assentos** para a trip (`availableSeats` aumenta)

**Response 200:**
```json
{
  "id": "uuid",
  "status": "cancelled",
  "paymentStatus": "refunded",
  "updatedAt": "2026-02-12T11:00:00.000Z"
}
```

**Response 400:**
```json
{
  "statusCode": 400,
  "message": "Reserva já cancelada"
}
```

**Response 403:**
```json
{
  "statusCode": 403,
  "message": "Apenas o passageiro pode cancelar"
}
```

---

### **POST /bookings/:id/checkin** ✨ ATUALIZADO (era PATCH)
Fazer check-in na viagem (apenas Captain).

**Auth:** JWT Required + Role: Captain
**Path Parameters:**
| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `id` | uuid | ID da reserva |

**Comportamento:**
- Valida QR code
- Atualiza status para `checked_in`
- Registra timestamp em `checkedInAt`

**Response 200:**
```json
{
  "id": "uuid",
  "status": "checked_in",
  "checkedInAt": "2026-02-15T07:45:00.000Z",
  "passenger": {
    "name": "Maria Santos",
    "phone": "92998765432"
  }
}
```

**Response 400:**
```json
{
  "statusCode": 400,
  "message": "Reserva não está confirmada"
}
```

---

## 📊 ENUMS

### **TripStatus**
```typescript
enum TripStatus {
  SCHEDULED = 'scheduled',      // Viagem agendada
  IN_PROGRESS = 'in_progress',  // Viagem em andamento
  COMPLETED = 'completed',       // Viagem concluída
  CANCELLED = 'cancelled'        // Viagem cancelada
}
```

### **BookingStatus**
```typescript
enum BookingStatus {
  PENDING = 'pending',           // Aguardando confirmação
  CONFIRMED = 'confirmed',       // Confirmada
  CHECKED_IN = 'checked_in',     // Check-in realizado
  COMPLETED = 'completed',       // Viagem concluída
  CANCELLED = 'cancelled'        // Cancelada
}
```

### **PaymentMethod**
```typescript
enum PaymentMethod {
  PIX = 'pix',
  CASH = 'cash',
  CREDIT_CARD = 'credit_card',
  DEBIT_CARD = 'debit_card'
}
```

---

## 🗄️ ENTITIES

### **Trip Entity**
```typescript
{
  id: string (UUID)
  origin: string
  destination: string
  departureAt: Date
  estimatedArrivalAt: Date
  price: number
  totalSeats: number
  availableSeats: number
  status: TripStatus
  boatId: string
  captainId: string
  routeId: string (nullable)
  currentLat: number (nullable)
  currentLng: number (nullable)
  notes: string (nullable)
  createdAt: Date
  updatedAt: Date

  // Relações
  boat: Boat
  captain: User
  route: Route
  bookings: Booking[]
  reviews: Review[]
}
```

### **Booking Entity**
```typescript
{
  id: string (UUID)
  tripId: string
  passengerId: string
  seatNumber: number (nullable)
  seats: number
  totalPrice: number
  status: BookingStatus
  paymentMethod: PaymentMethod
  paymentStatus: PaymentStatus
  qrCode: string (base64, nullable)
  checkedInAt: Date (nullable)
  createdAt: Date
  updatedAt: Date

  // Relações
  trip: Trip
  passenger: User
}
```

---

## 🔄 MAPEAMENTO Frontend ↔ Backend

| Campo Frontend | Campo Backend | Conversão |
|----------------|---------------|-----------|
| `userId` | `passengerId` | Automático via DTO |
| `quantity` | `seats` | Automático via DTO |
| `departureTime` | `departureAt` | ISO string → Date |
| `arrivalTime` | `estimatedArrivalAt` | ISO string → Date |

---

## 🚀 Endpoints Adicionais (já existentes)

### Trips
- `GET /trips/captain/my-trips` - Viagens do capitão logado
- `PATCH /trips/:id/status` - Atualizar status da viagem
- `PATCH /trips/:id/location` - Atualizar localização GPS

### Bookings
- `GET /bookings/:id/tracking` - Rastreamento em tempo real
- `GET /bookings/trip/:tripId` - Listar passageiros (Captain)
- `PATCH /bookings/:id/complete` - Concluir viagem (Captain)

---

## 📌 Notas Importantes

1. **QR Code**: Gerado automaticamente em base64 ao criar booking
2. **Validation**: Todos os DTOs usam `class-validator`
3. **Authorization**: Guards verificam role antes de executar ações
4. **Soft Delete**: Trips com bookings são canceladas, não deletadas
5. **Auto-update**: `availableSeats` atualizado automaticamente em create/cancel

---

## 🔗 Swagger Documentation

**URL:** http://localhost:3000/api

Todos os endpoints estão documentados com:
- Descrições detalhadas
- Exemplos de request/response
- Schemas dos DTOs
- Códigos de status HTTP
