# 🔌 NavegaJá Captain - API Completa (DTOs + Endpoints)

**Data:** 16/02/2026
**Versão:** 1.0
**Para:** Time de desenvolvimento mobile

---

## 📋 SUMÁRIO

1. [DTOs e Interfaces TypeScript](#dtos-e-interfaces-typescript)
2. [Endpoints Completos](#endpoints-completos)
3. [Exemplos de Requisições](#exemplos-de-requisições)

---

## 📦 DTOs E INTERFACES TYPESCRIPT

### **User**

```typescript
export enum UserRole {
  PASSENGER = 'passenger',
  CAPTAIN = 'captain',
  ADMIN = 'admin',
}

export interface User {
  id: string;
  name: string;
  email?: string;
  phone: string;
  cpf?: string;
  role: UserRole;
  rating?: number;
  totalTrips?: number;
  totalPoints?: number;
  level?: string;
  createdAt: string;
  updatedAt: string;
}
```

### **Boat**

```typescript
export enum BoatType {
  LANCHA = 'lancha',
  VOADEIRA = 'voadeira',
  BALSA = 'balsa',
  RECREIO = 'recreio',
}

export interface Boat {
  id: string;
  ownerId: string;
  name: string;
  type: BoatType;
  capacity: number;
  model?: string;
  year?: number;
  photoUrl?: string;
  photos?: string[];
  amenities: string[];
  registrationNum?: string;
  isVerified: boolean;
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

### **Trip**

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
  captain?: User;
  origin: string;
  destination: string;
  departureAt: string;
  estimatedArrivalAt: string;
  status: TripStatus;
  price: number;
  discount?: number;
  totalSeats: number;
  availableSeats: number;
  cargoPriceKg?: number;
  cargoCapacityKg?: number;
  availableCargoKg?: number;
  currentLat?: number;
  currentLng?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;

  // Populated relations
  bookings?: Booking[];
  shipments?: Shipment[];
  cargoShipments?: CargoShipment[];
}

export interface CreateTripDto {
  origin: string;
  destination: string;
  boatId: string;
  departureTime: string; // ISO 8601
  arrivalTime: string;   // ISO 8601
  price: number;
  discount?: number;
  totalSeats: number;
  cargoPriceKg?: number;
  cargoCapacityKg?: number;
}

export interface UpdateTripStatusDto {
  status: TripStatus;
}

export interface UpdateLocationDto {
  lat: number;
  lng: number;
}
```

### **Booking**

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

export enum PaymentMethod {
  PIX = 'pix',
  CASH = 'cash',
  CREDIT_CARD = 'credit_card',
  DEBIT_CARD = 'debit_card',
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
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  qrCodeCheckin?: string;
  checkedInAt?: string;
  createdAt: string;
  updatedAt: string;
}
```

### **Shipment**

```typescript
export enum ShipmentStatus {
  PENDING = 'pending',
  PAID = 'paid',
  COLLECTED = 'collected',
  IN_TRANSIT = 'in_transit',
  ARRIVED = 'arrived',
  OUT_FOR_DELIVERY = 'out_for_delivery',
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
  weight: number; // kg (também disponível como weightKg)
  weightKg: number; // alias
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
  paymentMethod: string;
  trackingCode: string;
  validationCode: string; // PIN 6 dígitos
  qrCode: string;
  status: ShipmentStatus;
  collectionPhotoUrl?: string;
  collectedAt?: string;
  deliveryPhotoUrl?: string;
  deliveredAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CollectShipmentDto {
  validationCode: string; // PIN 6 dígitos
  collectionPhotoUrl?: string;
}
```

### **CargoShipment**

```typescript
export enum CargoType {
  MOTORCYCLE = 'motorcycle',
  CAR = 'car',
  PICKUP_TRUCK = 'pickup_truck',
  RANCHO = 'rancho',
  CONSTRUCTION = 'construction',
  FUEL = 'fuel',
  LIVESTOCK = 'livestock',
  ELECTRONICS = 'electronics',
  GENERAL = 'general',
}

export enum CargoStatus {
  PENDING_QUOTE = 'pending_quote',
  QUOTED = 'quoted',
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
  description: string;
  quantity: number;
  estimatedWeightKg: number;
  dimensions?: string;
  photoUrl?: string;
  receiverName: string;
  receiverPhone: string;
  totalPrice: number;
  status: CargoStatus;
  trackingCode: string;
  deliveryPhotoUrl?: string;
  deliveredAt?: string;
  notes?: string;
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

### **Weather**

```typescript
export interface CurrentWeather {
  region: string;
  latitude: number;
  longitude: number;
  temperature: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  windGust?: number;
  windDirection: number;
  condition: string;
  description: string;
  icon: string;
  cloudiness: number;
  visibility: number;
  rain?: number;
  pressure: number;
  isSafeForNavigation: boolean;
  safetyWarnings: string[];
  alerts: any[];
  recordedAt: string;
}

export interface NavigationSafety {
  isSafe: boolean;
  score: number; // 0-100
  warnings: string[];
  recommendations: string[];
  weather: CurrentWeather;
}

export interface ForecastDay {
  date: string;
  tempMin: number;
  tempMax: number;
  condition: string;
  description: string;
  icon: string;
  humidity: number;
  windSpeed: number;
  rain: number;
  chanceOfRain: number;
}

export interface WeatherForecast {
  region: string;
  forecast: ForecastDay[];
}
```

### **Safety**

```typescript
export enum EmergencyServiceType {
  MARINHA = 'marinha',
  BOMBEIROS = 'bombeiros',
  POLICIA = 'policia',
  SAMU = 'samu',
  DEFESA_CIVIL = 'defesa_civil',
  CAPITANIA_PORTOS = 'capitania_portos',
  OUTROS = 'outros',
}

export interface EmergencyContact {
  id: string;
  type: EmergencyServiceType;
  name: string;
  phoneNumber: string;
  description?: string;
  region?: string;
  isActive: boolean;
  createdAt: string;
}

export interface SafetyChecklist {
  id: string;
  tripId: string;
  lifejacketsAvailable: boolean;
  lifejacketsQuantity?: number;
  fireExtinguisher: boolean;
  weatherConditionsOk: boolean;
  boatConditionGood: boolean;
  emergencyEquipment: boolean;
  navigationLights: boolean;
  maxCapacityRespected: boolean;
  notes?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateChecklistDto {
  tripId: string;
  lifejacketsAvailable: boolean;
  lifejacketsQuantity?: number;
  fireExtinguisher: boolean;
  weatherConditionsOk: boolean;
  boatConditionGood: boolean;
  emergencyEquipment: boolean;
  navigationLights: boolean;
  maxCapacityRespected: boolean;
  notes?: string;
}

export enum SosAlertType {
  EMERGENCY = 'emergency',
  MEDICAL = 'medical',
  FIRE = 'fire',
  LEAK_SINKING = 'leak_sinking',
  MECHANICAL = 'mechanical',
  WEATHER = 'weather',
  ACCIDENT = 'accident',
}

export enum SosAlertStatus {
  ACTIVE = 'active',
  RESOLVED = 'resolved',
  CANCELLED = 'cancelled',
}

export interface SosAlert {
  id: string;
  userId: string;
  user?: User;
  tripId?: string;
  trip?: Trip;
  type: SosAlertType;
  description: string;
  latitude: number;
  longitude: number;
  status: SosAlertStatus;
  resolvedAt?: string;
  resolvedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSosAlertDto {
  tripId?: string;
  type: SosAlertType;
  description: string;
  latitude: number;
  longitude: number;
}
```

### **Review**

```typescript
export interface Review {
  id: string;
  tripId: string;
  trip?: Trip;
  reviewerId: string;
  reviewer?: User;
  captainId: string;
  rating: number; // 1-5
  comment?: string;
  createdAt: string;
}
```

---

## 🔌 ENDPOINTS COMPLETOS

**Base URL:**
- Dev: `http://localhost:3000`
- Prod: `https://api.navegaja.com`

**Autenticação:** Header `Authorization: Bearer {token}`

---

## 1. AUTENTICAÇÃO

### **POST /auth/login**

Login (passageiro ou capitão)

**Body:**
```json
{
  "phone": "92992001001",
  "password": "123456"
}
```

**Response 200:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "name": "Carlos Ribeiro",
    "phone": "92992001001",
    "role": "captain",
    "rating": 4.9,
    "totalTrips": 230
  }
}
```

### **GET /auth/profile**

Obter perfil do usuário logado

**Headers:** `Authorization: Bearer {token}`

**Response 200:**
```json
{
  "id": "uuid",
  "name": "Carlos Ribeiro",
  "phone": "92992001001",
  "role": "captain",
  "rating": 4.9,
  "totalTrips": 230
}
```

---

## 2. EMBARCAÇÕES

### **GET /boats/my-boats**

Listar minhas embarcações

**Auth:** Captain only

**Response 200:**
```json
[
  {
    "id": "uuid",
    "ownerId": "uuid",
    "name": "Estrela do Rio",
    "type": "lancha",
    "capacity": 25,
    "model": "Mercury 150HP",
    "year": 2020,
    "photoUrl": "https://...",
    "photos": ["https://...", "https://..."],
    "amenities": ["wifi", "banheiro", "colete"],
    "registrationNum": "AM-2024-001",
    "isVerified": true,
    "createdAt": "2024-01-15T10:00:00Z"
  }
]
```

### **POST /boats**

Criar embarcação

**Auth:** Captain only

**Body:**
```json
{
  "name": "Estrela do Rio",
  "type": "lancha",
  "capacity": 25,
  "model": "Mercury 150HP",
  "year": 2020,
  "photoUrl": "https://...",
  "photos": ["https://...", "https://..."],
  "amenities": ["wifi", "banheiro", "colete"],
  "registrationNum": "AM-2024-001"
}
```

**Response 201:**
```json
{
  "id": "uuid",
  "ownerId": "uuid",
  "name": "Estrela do Rio",
  "type": "lancha",
  "capacity": 25,
  "createdAt": "2024-01-15T10:00:00Z"
}
```

### **GET /boats/:id**

Detalhes da embarcação

**Response 200:** (mesmo formato do GET /boats/my-boats)

---

## 3. VIAGENS

### **GET /trips/captain/my-trips**

Listar minhas viagens (capitão)

**Auth:** Captain only

**Query Parameters:**
- `status` (opcional): `scheduled`, `in_progress`, `completed`, `cancelled`

**Example:**
```
GET /trips/captain/my-trips?status=scheduled
GET /trips/captain/my-trips?status=in_progress
```

**Response 200:**
```json
[
  {
    "id": "uuid",
    "captainId": "uuid",
    "boatId": "uuid",
    "boat": {
      "id": "uuid",
      "name": "Estrela do Rio",
      "type": "lancha",
      "capacity": 25
    },
    "origin": "Manaus",
    "destination": "Parintins",
    "departureAt": "2026-02-20T08:00:00Z",
    "estimatedArrivalAt": "2026-02-20T14:00:00Z",
    "status": "scheduled",
    "price": 75.00,
    "discount": 10,
    "totalSeats": 25,
    "availableSeats": 18,
    "cargoPriceKg": 15.00,
    "currentLat": null,
    "currentLng": null,
    "createdAt": "2026-02-15T10:00:00Z"
  }
]
```

### **POST /trips**

Criar viagem

**Auth:** Captain only

**Body:**
```json
{
  "origin": "Manaus",
  "destination": "Parintins",
  "boatId": "uuid",
  "departureTime": "2026-02-20T08:00:00Z",
  "arrivalTime": "2026-02-20T14:00:00Z",
  "price": 75.00,
  "discount": 10,
  "totalSeats": 25,
  "cargoPriceKg": 15.00,
  "cargoCapacityKg": 500
}
```

**Response 201:**
```json
{
  "id": "uuid",
  "captainId": "uuid",
  "origin": "Manaus",
  "destination": "Parintins",
  "status": "scheduled",
  "createdAt": "2026-02-15T10:00:00Z"
}
```

**Validações:**
- Data de partida deve ser futura
- Data de chegada deve ser posterior à partida
- Embarcação deve pertencer ao capitão
- Total de assentos não pode exceder capacidade da embarcação
- Embarcação não pode ter conflito de horário

### **GET /trips/:id**

Detalhes da viagem

**Response 200:** (mesmo formato do GET /trips/captain/my-trips com mais detalhes)

### **PATCH /trips/:id/status**

Mudar status da viagem

**Auth:** Captain only (owner)

**Body:**
```json
{
  "status": "in_progress"
}
```

**Response 200:**
```json
{
  "id": "uuid",
  "status": "in_progress",
  "updatedAt": "2026-02-20T08:00:00Z"
}
```

**⚠️ IMPORTANTE - Validações ao mudar para `in_progress`:**

1. **Checklist de segurança deve estar completo**
   - Se não estiver: retorna `400 Bad Request`
   - Mensagem: "Checklist de segurança não está completo. Complete o checklist antes de iniciar a viagem."

2. **Validação automática de clima**
   - Backend busca clima da localização
   - Calcula score de segurança (0-100)
   - **Score < 50 (PERIGOSO):**
     - retorna `400 Bad Request`
     - Mensagem: "❌ Condições climáticas PERIGOSAS (Score: X/100). NÃO é seguro navegar. Avisos: [...]. Recomendações: [...]"
   - **Score 50-69 (MODERADO):**
     - Permite viagem
     - Loga alerta no console do servidor
   - **Score >= 70 (SEGURO):**
     - Permite viagem normalmente

3. **Efeitos colaterais ao iniciar viagem:**
   - Encomendas com status `collected` mudam para `in_transit`
   - GPS tracking deve ser iniciado no app

**Exemplo de erro (clima perigoso):**
```json
{
  "statusCode": 400,
  "message": "❌ Condições climáticas PERIGOSAS (Score: 35/100). NÃO é seguro navegar. Avisos: Tempestade, Rajadas de vento perigosas, Visibilidade reduzida. Recomendações: NÃO navegue! Aguarde melhora das condições, Use luzes de navegação",
  "error": "Bad Request"
}
```

### **PATCH /trips/:id/location**

Atualizar localização GPS

**Auth:** Captain only (owner)

**Body:**
```json
{
  "lat": -3.1800,
  "lng": -60.2500
}
```

**Response 200:**
```json
{
  "id": "uuid",
  "currentLat": -3.1800,
  "currentLng": -60.2500,
  "updatedAt": "2026-02-20T09:30:00Z"
}
```

**Uso:** Chamado automaticamente pelo hook `useLocationTracking` a cada 30 segundos durante viagem em andamento.

### **PUT /trips/:id**

Atualizar viagem

**Auth:** Captain only (owner)

**Body:** (todos os campos opcionais)
```json
{
  "origin": "Manaus",
  "destination": "Parintins",
  "departureTime": "2026-02-20T08:00:00Z",
  "arrivalTime": "2026-02-20T14:00:00Z",
  "price": 80.00,
  "totalSeats": 25
}
```

### **DELETE /trips/:id**

Deletar viagem

**Auth:** Captain only (owner)

**Response 200:**
```json
{
  "message": "Viagem deletada com sucesso"
}
```

**Regra:** Só pode deletar viagens com status `scheduled` e sem reservas confirmadas.

---

## 4. PASSAGEIROS (BOOKINGS)

### **GET /bookings/trip/:tripId**

Listar passageiros de uma viagem

**Auth:** Captain only

**Response 200:**
```json
[
  {
    "id": "uuid",
    "passengerId": "uuid",
    "passenger": {
      "id": "uuid",
      "name": "João Silva",
      "phone": "+5592988888888",
      "email": "joao@example.com"
    },
    "tripId": "uuid",
    "seats": 2,
    "seatNumber": 5,
    "totalPrice": 150.00,
    "status": "confirmed",
    "paymentMethod": "pix",
    "paymentStatus": "paid",
    "qrCodeCheckin": "base64_qr_code",
    "checkedInAt": null,
    "createdAt": "2026-02-15T10:00:00Z"
  }
]
```

### **POST /bookings/:id/checkin**

Fazer check-in do passageiro

**Auth:** Captain only

**Response 200:**
```json
{
  "id": "uuid",
  "status": "checked_in",
  "checkedInAt": "2026-02-20T07:45:00Z"
}
```

**Validações:**
- Reserva deve estar com status `confirmed`
- Pagamento deve estar `paid`

### **PATCH /bookings/:id/complete**

Marcar passageiro como completado

**Auth:** Captain only

**Response 200:**
```json
{
  "id": "uuid",
  "status": "completed"
}
```

---

## 5. ENCOMENDAS (SHIPMENTS)

### **GET /shipments**

Listar encomendas (com filtros)

**Auth:** Required

**Query Parameters:**
- `tripId` (opcional): UUID da viagem
- `status` (opcional): `paid`, `collected`, `in_transit`, `arrived`, `out_for_delivery`, `delivered`

**Example:**
```
GET /shipments?tripId=uuid&status=paid
GET /shipments?tripId=uuid&status=collected
```

**Response 200:**
```json
[
  {
    "id": "uuid",
    "senderId": "uuid",
    "sender": {
      "name": "João Silva",
      "phone": "+5592988888888"
    },
    "tripId": "uuid",
    "description": "Documentos importantes",
    "weight": 2.5,
    "weightKg": 2.5,
    "recipientName": "Maria Santos",
    "recipientPhone": "+5592977777777",
    "recipientAddress": "Rua X, 123 - Parintins",
    "totalPrice": 37.50,
    "trackingCode": "NJ2026000123",
    "validationCode": "123456",
    "qrCode": "base64_qr_code",
    "status": "paid",
    "collectionPhotoUrl": null,
    "collectedAt": null,
    "deliveryPhotoUrl": null,
    "deliveredAt": null,
    "createdAt": "2026-02-15T10:00:00Z"
  }
]
```

### **POST /shipments/:id/collect**

Coletar encomenda (capitão)

**Auth:** Captain only

**Body:**
```json
{
  "validationCode": "123456",
  "collectionPhotoUrl": "https://..."
}
```

**Response 200:**
```json
{
  "id": "uuid",
  "status": "collected",
  "collectedAt": "2026-02-20T07:30:00Z",
  "collectionPhotoUrl": "https://..."
}
```

**Validações:**
- Encomenda deve estar com status `paid`
- `validationCode` deve estar correto (6 dígitos)

### **POST /shipments/:id/out-for-delivery**

Marcar encomenda como "saiu para entrega"

**Auth:** Captain only

**Response 200:**
```json
{
  "id": "uuid",
  "status": "out_for_delivery"
}
```

**Validação:** Encomenda deve estar com status `arrived`

### **PATCH /shipments/:id/status**

Atualizar status da encomenda (genérico)

**Auth:** Captain only

**Body:**
```json
{
  "status": "delivered"
}
```

**Response 200:**
```json
{
  "id": "uuid",
  "status": "delivered",
  "deliveredAt": "2026-02-20T15:00:00Z"
}
```

---

## 6. CARGAS COMERCIAIS (CARGO)

### **GET /cargo/trip/:tripId**

Listar cargas de uma viagem

**Auth:** Captain only

**Response 200:**
```json
[
  {
    "id": "uuid",
    "tripId": "uuid",
    "senderId": "uuid",
    "sender": {
      "name": "José Silva",
      "phone": "+5592988888888"
    },
    "cargoType": "motorcycle",
    "description": "1 moto Honda CG 160 preta",
    "quantity": 1,
    "estimatedWeightKg": 120,
    "dimensions": "2m x 0.8m x 1.1m",
    "receiverName": "Francisco Mendes",
    "receiverPhone": "+5592977777777",
    "totalPrice": 150.00,
    "status": "pending_quote",
    "trackingCode": "CRG0001AM",
    "createdAt": "2026-02-15T10:00:00Z"
  }
]
```

### **PATCH /cargo/:id/quote**

Cotar preço de carga

**Auth:** Captain only

**Body:**
```json
{
  "totalPrice": 150.00
}
```

**Response 200:**
```json
{
  "id": "uuid",
  "totalPrice": 150.00,
  "status": "quoted"
}
```

**Validação:** Carga deve estar com status `pending_quote`

### **PATCH /cargo/:id/status**

Atualizar status da carga

**Auth:** Captain only

**Body:**
```json
{
  "status": "loaded"
}
```

**Response 200:**
```json
{
  "id": "uuid",
  "status": "loaded"
}
```

### **PATCH /cargo/:id/deliver**

Marcar carga como entregue

**Auth:** Captain only

**Body:** (opcional)
```json
{
  "deliveryPhotoUrl": "https://..."
}
```

**Response 200:**
```json
{
  "id": "uuid",
  "status": "delivered",
  "deliveredAt": "2026-02-20T15:00:00Z",
  "deliveryPhotoUrl": "https://..."
}
```

---

## 7. CLIMA (WEATHER)

### **GET /weather/regions**

Listar regiões disponíveis

**Auth:** Não requer

**Response 200:**
```json
[
  {
    "key": "manaus",
    "name": "Manaus",
    "latitude": -3.119,
    "longitude": -60.0217
  },
  {
    "key": "parintins",
    "name": "Parintins",
    "latitude": -2.6287,
    "longitude": -56.7358
  }
]
```

### **GET /weather/current**

Clima atual por coordenadas

**Auth:** Não requer

**Query Parameters:**
- `lat` (required): Latitude
- `lng` (required): Longitude
- `region` (optional): Nome da região

**Example:**
```
GET /weather/current?lat=-3.119&lng=-60.0217&region=Manaus
```

**Response 200:**
```json
{
  "region": "Manaus",
  "latitude": -3.119,
  "longitude": -60.0217,
  "temperature": 28.5,
  "feelsLike": 32.1,
  "humidity": 78,
  "windSpeed": 3.2,
  "windGust": null,
  "windDirection": 180,
  "condition": "Nublado",
  "description": "nuvens dispersas",
  "icon": "02d",
  "cloudiness": 40,
  "visibility": 10000,
  "rain": null,
  "pressure": 1013,
  "isSafeForNavigation": true,
  "safetyWarnings": [],
  "alerts": [],
  "recordedAt": "2026-02-20T08:00:00Z"
}
```

### **GET /weather/region/:regionKey**

Clima de região predefinida

**Auth:** Não requer

**Example:**
```
GET /weather/region/manaus
GET /weather/region/parintins
```

**Response 200:** (mesmo formato do /weather/current)

### **GET /weather/forecast**

Previsão de 5 dias

**Auth:** Não requer

**Query Parameters:**
- `lat` (required): Latitude
- `lng` (required): Longitude

**Response 200:**
```json
{
  "region": "Manaus",
  "forecast": [
    {
      "date": "2026-02-20",
      "tempMin": 24.0,
      "tempMax": 32.0,
      "condition": "Clouds",
      "description": "nuvens dispersas",
      "icon": "02d",
      "humidity": 75,
      "windSpeed": 3.5,
      "rain": 0,
      "chanceOfRain": 10
    }
  ]
}
```

### **GET /weather/navigation-safety** ⭐

Avaliação de segurança para navegação

**Auth:** Não requer

**Query Parameters:**
- `lat` (required): Latitude
- `lng` (required): Longitude

**Example:**
```
GET /weather/navigation-safety?lat=-3.119&lng=-60.0217
```

**Response 200:**
```json
{
  "isSafe": true,
  "score": 85,
  "warnings": [],
  "recommendations": [
    "Condições favoráveis para navegação"
  ],
  "weather": {
    "temperature": 28.5,
    "condition": "Nublado",
    "windSpeed": 3.2,
    "humidity": 78,
    "isSafeForNavigation": true,
    "safetyWarnings": []
  }
}
```

**Score de Segurança:**
- **0-49:** ❌ PERIGOSO - Backend bloqueia viagem
- **50-69:** ⚠️ MODERADO - Backend permite mas alerta
- **70-100:** ✅ SEGURO - Tudo OK

**Exemplo de resposta PERIGOSA:**
```json
{
  "isSafe": false,
  "score": 20,
  "warnings": [
    "Ventos fortes detectados",
    "Rajadas de vento perigosas",
    "ALERTA: Tempestade"
  ],
  "recommendations": [
    "Reduzir velocidade da embarcação",
    "Considere adiar a viagem",
    "NÃO navegue! Aguarde melhora das condições"
  ],
  "weather": {
    "temperature": 26.0,
    "condition": "Tempestade",
    "windSpeed": 18.5,
    "windGust": 25.0,
    "rain": 12.5,
    "isSafeForNavigation": false,
    "safetyWarnings": [
      "Ventos fortes",
      "TEMPESTADE - Não navegue!"
    ]
  }
}
```

**Critérios de Avaliação:**
- Vento > 10 m/s: -30 pontos
- Rajadas > 15 m/s: -40 pontos
- Chuva > 5 mm/h: -20 pontos
- Visibilidade < 1000m: -35 pontos
- Tempestade: -50 pontos

---

## 8. SEGURANÇA (SAFETY)

### **GET /safety/emergency-contacts**

Listar contatos de emergência

**Auth:** Não requer

**Query Parameters:**
- `region` (optional): Filtrar por região

**Response 200:**
```json
[
  {
    "id": "uuid",
    "type": "marinha",
    "name": "Marinha do Brasil - Emergências Marítimas",
    "phoneNumber": "185",
    "description": "Emergências em águas, naufrágios, acidentes marítimos",
    "region": "Nacional",
    "isActive": true,
    "createdAt": "2026-02-01T00:00:00Z"
  },
  {
    "id": "uuid",
    "type": "bombeiros",
    "name": "Corpo de Bombeiros Militar",
    "phoneNumber": "193",
    "description": "Incêndios, resgates, primeiros socorros",
    "region": "Nacional",
    "isActive": true,
    "createdAt": "2026-02-01T00:00:00Z"
  }
]
```

### **POST /safety/checklists**

Criar checklist de segurança

**Auth:** Captain only

**Body:**
```json
{
  "tripId": "uuid",
  "lifejacketsAvailable": true,
  "lifejacketsQuantity": 30,
  "fireExtinguisher": true,
  "weatherConditionsOk": true,
  "boatConditionGood": true,
  "emergencyEquipment": true,
  "navigationLights": true,
  "maxCapacityRespected": true,
  "notes": "Verificado nível de combustível, testado motor"
}
```

**Response 201:**
```json
{
  "id": "uuid",
  "tripId": "uuid",
  "lifejacketsAvailable": true,
  "lifejacketsQuantity": 30,
  "fireExtinguisher": true,
  "weatherConditionsOk": true,
  "boatConditionGood": true,
  "emergencyEquipment": true,
  "navigationLights": true,
  "maxCapacityRespected": true,
  "notes": "Verificado nível de combustível, testado motor",
  "completedAt": "2026-02-20T07:00:00Z",
  "createdAt": "2026-02-20T07:00:00Z"
}
```

### **PATCH /safety/checklists/:id**

Atualizar checklist

**Auth:** Captain only

**Body:** (campos opcionais)
```json
{
  "lifejacketsQuantity": 35,
  "notes": "Adicionado mais coletes"
}
```

### **GET /safety/checklists/trip/:tripId**

Buscar checklist de uma viagem

**Auth:** Captain only

**Response 200:**
```json
{
  "id": "uuid",
  "tripId": "uuid",
  "lifejacketsAvailable": true,
  "completedAt": "2026-02-20T07:00:00Z"
}
```

**Response 404:** (se não encontrado)
```json
{
  "statusCode": 404,
  "message": "Checklist não encontrado para esta viagem"
}
```

### **GET /safety/checklists/trip/:tripId/status**

Verificar se checklist está completo

**Auth:** Captain only

**Response 200:**
```json
{
  "complete": true
}
```

**Regra:** Checklist é considerado completo quando TODOS os campos booleanos estão `true`.

### **POST /safety/sos**

Criar alerta SOS

**Auth:** Required

**Body:**
```json
{
  "tripId": "uuid",
  "type": "emergency",
  "description": "Problema no motor, precisamos de ajuda",
  "latitude": -3.1800,
  "longitude": -60.2500
}
```

**Response 201:**
```json
{
  "id": "uuid",
  "userId": "uuid",
  "tripId": "uuid",
  "type": "emergency",
  "description": "Problema no motor, precisamos de ajuda",
  "latitude": -3.1800,
  "longitude": -60.2500,
  "status": "active",
  "createdAt": "2026-02-20T10:30:00Z"
}
```

### **GET /safety/sos/active**

Listar alertas SOS ativos

**Auth:** Admin/Captain

### **PATCH /safety/sos/:id/resolve**

Resolver alerta SOS

**Auth:** Admin/Captain

### **GET /safety/sos/my-alerts**

Meus alertas SOS

**Auth:** Required

---

## 9. AVALIAÇÕES (REVIEWS)

### **GET /reviews/captain/:id**

Ver avaliações do capitão

**Auth:** Não requer

**Response 200:**
```json
[
  {
    "id": "uuid",
    "tripId": "uuid",
    "trip": {
      "origin": "Manaus",
      "destination": "Parintins",
      "departureAt": "2026-02-15T08:00:00Z"
    },
    "reviewerId": "uuid",
    "reviewer": {
      "name": "João Silva"
    },
    "captainId": "uuid",
    "rating": 5,
    "comment": "Excelente viagem! Capitão muito profissional.",
    "createdAt": "2026-02-16T10:00:00Z"
  }
]
```

---

## 📝 EXEMPLOS DE INTEGRAÇÃO

### **Exemplo 1: Fluxo de Criação de Viagem**

```typescript
import {tripsApi} from '@api/endpoints/trips';

async function createTrip() {
  try {
    const tripData = {
      origin: 'Manaus',
      destination: 'Parintins',
      boatId: 'uuid-da-embarcacao',
      departureTime: '2026-02-20T08:00:00Z',
      arrivalTime: '2026-02-20T14:00:00Z',
      price: 75.00,
      totalSeats: 25,
      cargoPriceKg: 15.00,
    };

    const response = await tripsApi.create(tripData);
    console.log('Viagem criada:', response.data);

    // Navegar para detalhes
    navigation.navigate('TripDetails', {tripId: response.data.id});
  } catch (error) {
    Alert.alert('Erro', error.response?.data?.message);
  }
}
```

### **Exemplo 2: Checklist + Clima + Iniciar Viagem**

```typescript
import {weatherApi} from '@api/endpoints/weather';
import {safetyApi} from '@api/endpoints/safety';
import {tripsApi} from '@api/endpoints/trips';

async function startTrip(tripId: string) {
  // 1. Buscar clima
  const weatherSafety = await weatherApi.getNavigationSafety(-3.119, -60.0217);

  if (!weatherSafety.data.isSafe) {
    Alert.alert(
      'Clima Perigoso',
      `Score: ${weatherSafety.data.score}/100\n\n` +
      `Avisos: ${weatherSafety.data.warnings.join(', ')}\n\n` +
      `Recomendações: ${weatherSafety.data.recommendations.join(', ')}`,
      [{text: 'OK'}]
    );
    return;
  }

  // 2. Criar checklist
  await safetyApi.createChecklist({
    tripId,
    lifejacketsAvailable: true,
    lifejacketsQuantity: 30,
    fireExtinguisher: true,
    weatherConditionsOk: weatherSafety.data.isSafe,
    boatConditionGood: true,
    emergencyEquipment: true,
    navigationLights: true,
    maxCapacityRespected: true,
  });

  // 3. Iniciar viagem
  try {
    await tripsApi.updateStatus(tripId, 'in_progress');

    Alert.alert('Sucesso', 'Viagem iniciada! GPS tracking ativado.');

    // GPS tracking será iniciado automaticamente pelo hook useLocationTracking
  } catch (error) {
    if (error.response?.status === 400) {
      // Backend bloqueou por clima perigoso
      Alert.alert('Erro', error.response.data.message);
    }
  }
}
```

### **Exemplo 3: Check-in de Passageiro**

```typescript
import {bookingsApi} from '@api/endpoints/bookings';

async function checkInPassenger(bookingId: string) {
  try {
    await bookingsApi.checkIn(bookingId);
    Alert.alert('Sucesso', 'Check-in realizado!');

    // Atualizar lista
    loadPassengers();
  } catch (error) {
    Alert.alert('Erro', error.response?.data?.message);
  }
}
```

### **Exemplo 4: Coletar Encomenda**

```typescript
import {shipmentsApi} from '@api/endpoints/shipments';

async function collectShipment(shipmentId: string, validationCode: string, photoUrl: string) {
  try {
    await shipmentsApi.collect(shipmentId, {
      validationCode,
      collectionPhotoUrl: photoUrl,
    });

    Alert.alert('Sucesso', 'Encomenda coletada!');
  } catch (error) {
    if (error.response?.status === 400) {
      Alert.alert('Erro', 'PIN incorreto ou encomenda já coletada');
    }
  }
}
```

---

## 🔐 CÓDIGOS DE ERRO COMUNS

| Status | Descrição | Quando ocorre |
|--------|-----------|---------------|
| 400 | Bad Request | Dados inválidos, validações falharam |
| 401 | Unauthorized | Token inválido ou expirado |
| 403 | Forbidden | Usuário não tem permissão (role errado) |
| 404 | Not Found | Recurso não encontrado |
| 409 | Conflict | Conflito (ex: embarcação já tem viagem no horário) |
| 500 | Internal Server Error | Erro no servidor |

---

**Documento completo de DTOs e Endpoints - Captain App**
**Versão:** 1.0
**Data:** 16/02/2026
