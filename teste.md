MAPEAMENTO COMPLETO - Endpoints e DTOs do Capitão
Aqui está o mapeamento completo de tudo que já está implementado no backend:

📦 1. MÓDULO DE EMBARCAÇÕES (Boats)
Endpoints do Capitão
Método	Endpoint	Role	DTO Request	Resposta	Descrição
POST	/boats	captain	CreateBoatDto	Boat	Cadastrar nova embarcação
GET	/boats/my-boats	autenticado	-	Boat[]	Listar minhas embarcações
GET	/boats/:id	público	-	Boat	Detalhes da embarcação
DTOs Existentes
CreateBoatDto (src/boats/dto/create-boat.dto.ts)


{
  name: string;              // Obrigatório
  type: string;              // lancha | voadeira | balsa | recreio
  capacity: number;          // Obrigatório
  model?: string;
  year?: number;
  photoUrl?: string;
  amenities?: string[];
  photos?: string[];
  registrationNum?: string;
}
🚢 2. MÓDULO DE VIAGENS (Trips)
Endpoints do Capitão
Método	Endpoint	Role	DTO Request	Resposta	Descrição
GET	/trips/captain/my-trips	captain	-	Trip[]	Minhas viagens
POST	/trips	captain	CreateTripDto	Trip	Criar viagem
PUT	/trips/:id	captain	CreateTripDto	Trip	Atualizar viagem
DELETE	/trips/:id	captain	-	void	Deletar viagem
PATCH	/trips/:id/status	captain	UpdateTripStatusDto	Trip	Atualizar status
PATCH	/trips/:id/location	captain	UpdateLocationDto	Trip	Atualizar localização GPS
DTOs Existentes
CreateTripDto (src/trips/dto/trip.dto.ts)


{
  origin: string;            // Obrigatório - ex: "Manaus"
  destination: string;       // Obrigatório - ex: "Parintins"
  boatId: string;           // Obrigatório - UUID da embarcação
  departureTime: string;    // Obrigatório - ISO 8601
  arrivalTime: string;      // Obrigatório - ISO 8601
  price: number;            // Obrigatório - preço por assento
  discount?: number;        // 0-100 (porcentagem)
  totalSeats: number;       // Obrigatório
  cargoPriceKg?: number;    // R$/kg para cargas
  cargoCapacityKg?: number; // Capacidade máxima em kg
}
UpdateTripStatusDto (src/trips/dto/trip.dto.ts)


{
  status: TripStatus; // scheduled | in_progress | completed | cancelled
}
UpdateLocationDto (src/trips/dto/trip.dto.ts)


{
  lat: number;  // Obrigatório - latitude
  lng: number;  // Obrigatório - longitude
}
📦 3. MÓDULO DE CARGAS COMERCIAIS (Cargo)
Endpoints do Capitão
Método	Endpoint	Role	DTO Request	Resposta	Descrição
GET	/cargo/trip/:tripId	captain	-	CargoShipment[]	Cargas de uma viagem
PATCH	/cargo/:id/quote	captain	QuoteCargoDto	CargoShipment	Definir preço da carga
PATCH	/cargo/:id/status	captain	UpdateCargoStatusDto	CargoShipment	Atualizar status
PATCH	/cargo/:id/deliver	captain	{ deliveryPhotoUrl?: string }	CargoShipment	Marcar como entregue
DTOs Existentes
QuoteCargoDto (src/cargo/dto/cargo.dto.ts)


{
  totalPrice: number; // Obrigatório, min: 0 (em R$)
}
UpdateCargoStatusDto (src/cargo/dto/cargo.dto.ts)


{
  status: CargoStatus; 
  // pending_quote | quoted | confirmed | loaded | in_transit | delivered | cancelled
}
👥 4. MÓDULO DE RESERVAS/PASSAGEIROS (Bookings)
Endpoints do Capitão
Método	Endpoint	Role	DTO Request	Resposta	Descrição
GET	/bookings/trip/:tripId	captain	-	Booking[]	Passageiros da viagem
POST	/bookings/:id/checkin	captain	-	Booking	Fazer check-in do passageiro
PATCH	/bookings/:id/complete	captain	-	Booking	Completar viagem do passageiro
Nota: Não há DTOs específicos para esses endpoints, apenas o ID na URL.

📮 5. MÓDULO DE ENCOMENDAS (Shipments)
Endpoints do Capitão
Método	Endpoint	Role	DTO Request	Resposta	Descrição
POST	/shipments/:id/collect	captain	{ validationCode: string, collectionPhotoUrl?: string }	Shipment	Coletar encomenda
POST	/shipments/:id/out-for-delivery	captain	-	Shipment	Marcar "saiu para entrega"
PATCH	/shipments/:id/status	captain	{ status: ShipmentStatus }	Shipment	Atualizar status
PATCH	/shipments/:id/deliver	captain	{ deliveryPhotoUrl?: string }	Shipment	Confirmar entrega
DTOs Existentes (usados pelo remetente, mas relevantes para o capitão)
CreateShipmentDto (src/shipments/dto/create-shipment.dto.ts)


{
  tripId: string;           // Obrigatório - UUID da viagem
  description: string;      // Obrigatório
  weight: number;           // Obrigatório - 0.1 a 50 kg
  dimensions?: {            // Objeto (RECOMENDADO)
    length: number;         // 1-200 cm
    width: number;          // 1-200 cm
    height: number;         // 1-200 cm
  };
  length?: number;          // DEPRECATED - usar dimensions
  width?: number;           // DEPRECATED - usar dimensions
  height?: number;          // DEPRECATED - usar dimensions
  photos?: string[];        // Até 5 URLs
  recipientName: string;    // Obrigatório
  recipientPhone: string;   // Obrigatório
  recipientAddress: string; // Obrigatório
  paymentMethod?: PaymentMethod; // pix | credit_card | debit_card | cash
  couponCode?: string;
}
CalculatePriceDto (src/shipments/dto/calculate-price.dto.ts)


{
  tripId: string;        // Obrigatório
  weight: number;        // Obrigatório - 0.1 a 50 kg
  dimensions?: {         // Objeto (RECOMENDADO)
    length: number;
    width: number;
    height: number;
  };
  couponCode?: string;
}
CalculatePriceResponseDto (response)


{
  basePrice: number;
  volumetricWeight?: number;
  actualWeight: number;
  chargedWeight: number;
  weightCharge: number;
  pricePerKg: number;
  couponDiscount?: number;
  couponCode?: string;
  totalDiscount: number;
  finalPrice: number;
}
📊 ENTIDADES DE RESPOSTA
Trip Entity (resposta)

{
  id: string;
  captainId: string;
  boatId: string;
  origin: string;
  destination: string;
  departureAt: Date;
  estimatedArrivalAt?: Date;
  price: Decimal;
  discount: number;
  cargoPriceKg: Decimal;
  cargoCapacityKg?: Decimal;    // ✅ NOVO - capacidade total
  availableCargoKg?: Decimal;   // ✅ NOVO - disponível
  totalSeats: number;
  availableSeats: number;
  status: TripStatus;
  currentLat?: Decimal;
  currentLng?: Decimal;
  createdAt: Date;
  updatedAt: Date;
}
Booking Entity (resposta)

{
  id: string;
  passengerId: string;
  tripId: string;
  seatNumber?: number;
  seats: number;
  totalPrice: Decimal;
  status: BookingStatus; // pending | confirmed | checked_in | completed | cancelled
  qrCode?: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus; // pending | paid | refunded
  checkedInAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
Shipment Entity (resposta)

{
  id: string;
  senderId: string;
  tripId: string;
  description: string;
  weight: Decimal;              // ✅ NOVO nome (antes weightKg)
  weightKg: Decimal;            // ✅ MANTIDO backward compatibility
  dimensions?: {                // ✅ NOVO - objeto
    length: number;
    width: number;
    height: number;
  };
  photos?: string[];
  recipientName: string;
  recipientPhone: string;
  recipientAddress: string;
  totalPrice: Decimal;
  paymentMethod: PaymentMethod; // ✅ ATUALIZADO enum (+ debit_card)
  status: ShipmentStatus;       // pending | paid | collected | in_transit | arrived | out_for_delivery | delivered | cancelled
  trackingCode: string;
  validationCode: string;       // 6 caracteres
  collectionPhotoUrl?: string;
  deliveryPhotoUrl?: string;
  collectedAt?: Date;
  deliveredAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
CargoShipment Entity (resposta)

{
  id: string;
  senderId: string;
  tripId: string;
  cargoType: CargoType; // motorcycle | car | pickup_truck | rancho | construction | fuel | livestock | electronics | general
  description: string;
  quantity: number;
  estimatedWeightKg?: Decimal;
  dimensions?: string;
  photoUrl?: string;
  receiverName: string;
  receiverPhone: string;
  totalPrice: Decimal;
  status: CargoStatus; // pending_quote | quoted | confirmed | loaded | in_transit | delivered | cancelled
  trackingCode: string;
  deliveryPhotoUrl?: string;
  deliveredAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
🔐 ENUMS

enum PaymentMethod {
  PIX = 'pix',
  CREDIT_CARD = 'credit_card',
  DEBIT_CARD = 'debit_card',  // ✅ NOVO
  CASH = 'cash'
}

enum TripStatus {
  SCHEDULED = 'scheduled',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

enum BookingStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  CHECKED_IN = 'checked_in',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

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

enum CargoStatus {
  PENDING_QUOTE = 'pending_quote',
  QUOTED = 'quoted',
  CONFIRMED = 'confirmed',
  LOADED = 'loaded',
  IN_TRANSIT = 'in_transit',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled'
}
📊 RESUMO
Total de Endpoints para Capitão: 18 endpoints
Módulos com recursos do Capitão: 5 módulos
Total de DTOs: 14+ DTOs
React Native: CLI (não Expo) ✅
Autenticação: JWT + RolesGuard (@Roles('captain'))
Campos Novos (DIA 1): ✅ weight, dimensions, debit_card, cargoCapacityKg, availableCargoKg
Todos os endpoints e DTOs estão prontos e funcionando! 🚀