import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsInt,
  IsOptional,
  IsDateString,
  IsEnum,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TripStatus } from '../trip.entity';

export class CreateTripDto {
  @ApiProperty({ example: 'Manaus' })
  @IsString()
  @IsNotEmpty()
  origin: string;

  @ApiProperty({ example: 'Parintins' })
  @IsString()
  @IsNotEmpty()
  destination: string;

  @ApiProperty({ description: 'ID da embarcação' })
  @IsString()
  @IsNotEmpty()
  boatId: string;

  @ApiProperty({ example: '2026-02-15T08:00:00Z' })
  @IsDateString()
  departureTime: string;

  @ApiProperty({ example: '2026-02-15T14:00:00Z' })
  @IsDateString()
  arrivalTime: string;

  @ApiProperty({ example: 45.0 })
  @IsNumber()
  @Min(0.01, { message: 'Preço deve ser maior que zero.' })
  price: number;

  @ApiProperty({
    example: 0,
    description: 'Desconto em % (0-100)',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  discount?: number;

  @ApiProperty({ example: 20 })
  @IsInt({ message: 'Total de assentos deve ser um número inteiro.' })
  @Min(1, { message: 'Total de assentos deve ser pelo menos 1.' })
  totalSeats: number;

  @ApiProperty({
    example: 15.0,
    description: 'Preço por kg de carga (R$/kg)',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  cargoPriceKg?: number;

  @ApiProperty({
    example: 500,
    description: 'Capacidade total de carga em kg',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  cargoCapacityKg?: number;
}

export class TripShipmentPolicyDto {
  @ApiProperty({
    example: false,
    description:
      'Fonte unica de verdade para o app. true quando a viagem aceita encomendas.',
  })
  acceptsShipments: boolean;

  @ApiProperty({
    example: 15,
    nullable: true,
    description:
      'Preco por kg efetivamente aceito para encomendas. null quando a viagem nao aceita encomendas.',
  })
  shipmentPricePerKg: number | null;

  @ApiProperty({
    example: 500,
    nullable: true,
    description: 'Capacidade total de encomendas em kg.',
  })
  shipmentCapacityKg: number | null;

  @ApiProperty({
    example: 320,
    nullable: true,
    description: 'Capacidade de encomendas ainda disponivel em kg.',
  })
  availableShipmentCapacityKg: number | null;
}

export class TripResponseDto extends TripShipmentPolicyDto {
  @ApiProperty({
    example: '2b5b9cab-4a3d-4eb6-8e5c-fa11153f587d',
    description: 'UUID da viagem',
  })
  id: string;

  @ApiProperty({ example: 'captain-uuid' })
  captainId: string;

  @ApiProperty({ example: 'boat-uuid', nullable: true })
  boatId: string | null;

  @ApiProperty({ example: 'Manaus' })
  origin: string;

  @ApiProperty({ example: 'Parintins' })
  destination: string;

  @ApiProperty({ example: '2026-03-12T10:00:00.000Z' })
  departureAt: string;

  @ApiProperty({ example: '2026-03-12T16:00:00.000Z', nullable: true })
  estimatedArrivalAt: string | null;

  @ApiProperty({ example: 120 })
  price: number;

  @ApiProperty({
    example: null,
    nullable: true,
    description:
      'Campo legado exposto de forma normalizada. null quando a viagem nao aceita encomendas.',
  })
  cargoPriceKg: number | null;

  @ApiProperty({ example: 20 })
  totalSeats: number;

  @ApiProperty({ example: 12 })
  availableSeats: number;

  @ApiProperty({ enum: TripStatus, example: TripStatus.SCHEDULED })
  status: TripStatus;

  @ApiProperty({
    example: 'https://cdn.navegaja.com/boats/barco-1-cover.jpg',
    nullable: true,
    description: 'Imagem principal do barco para uso direto nos cards do app.',
  })
  boatImageUrl: string | null;

  @ApiProperty({
    example: [
      'https://cdn.navegaja.com/boats/barco-1-cover.jpg',
      'https://cdn.navegaja.com/boats/barco-1-inside.jpg',
    ],
    description: 'Lista normalizada das fotos do barco vinculadas a viagem.',
  })
  boatImages: string[];
}

export class ManagedTripPassengerDto {
  @ApiProperty({ example: 'booking-uuid' })
  bookingId: string;

  @ApiProperty({ example: 'confirmed' })
  status: string;

  @ApiProperty({ example: 'paid' })
  paymentStatus: string;

  @ApiProperty({ example: 2 })
  seats: number;

  @ApiProperty({ example: 14, nullable: true })
  seatNumber: number | null;

  @ApiProperty({ example: 240 })
  totalPrice: number;

  @ApiProperty({ example: '2026-03-11T11:00:00.000Z' })
  createdAt: string;
}

export class ManagedTripShipmentDto {
  @ApiProperty({ example: 'shipment-uuid' })
  id: string;

  @ApiProperty({ example: 'NJ2026000123' })
  trackingCode: string;

  @ApiProperty({ example: '123456', nullable: true })
  validationCode: string | null;

  @ApiProperty({ example: 'pending' })
  status: string;

  @ApiProperty({ example: 'Caixa de documentos', nullable: true })
  description: string | null;

  @ApiProperty({ example: 8.5 })
  weightKg: number;

  @ApiProperty({ example: 127.5 })
  totalPrice: number;

  @ApiProperty({ example: 'sender' })
  paidBy: string;

  @ApiProperty({ example: 'Maria Souza' })
  recipientName: string;

  @ApiProperty({ example: '+5592999999999' })
  recipientPhone: string;

  @ApiProperty({ example: 'Rua A, 123', nullable: true })
  recipientAddress: string | null;

  @ApiProperty({ example: null, nullable: true })
  collectionPhotoUrl: string | null;

  @ApiProperty({ example: null, nullable: true })
  deliveryPhotoUrl: string | null;

  @ApiProperty({ example: '2026-03-11T11:00:00.000Z' })
  createdAt: string;
}

export class TripManageResponseDto extends TripResponseDto {
  @ApiProperty({ type: [ManagedTripPassengerDto] })
  passageiros: ManagedTripPassengerDto[];

  @ApiProperty({ type: [ManagedTripShipmentDto] })
  encomendas: ManagedTripShipmentDto[];

  @ApiProperty({ example: 12 })
  totalPassageiros: number;

  @ApiProperty({ example: 4 })
  totalEncomendas: number;
}

export class UpdateTripStatusDto {
  @ApiProperty({ enum: TripStatus })
  @IsEnum(TripStatus)
  status: TripStatus;
}

export class UpdateLocationDto {
  @ApiProperty({ example: -3.119 })
  @IsNumber()
  lat: number;

  @ApiProperty({ example: -60.0217 })
  @IsNumber()
  lng: number;
}

// Popular Destinations Response DTOs
export class PopularCityDto {
  @ApiProperty({ example: 'Manaus' })
  city: string;

  @ApiProperty({ example: 15 })
  tripsCount: number;
}

export class PopularRouteDto {
  @ApiProperty({ example: 'Manaus' })
  origin: string;

  @ApiProperty({ example: 'Parintins' })
  destination: string;

  @ApiProperty({ example: 8 })
  tripsCount: number;

  @ApiProperty({ example: 45.0 })
  minPrice: number;

  @ApiProperty({ example: 52.5 })
  avgPrice: number;
}

export class PopularDestinationsResponseDto {
  @ApiProperty({ type: [PopularCityDto] })
  origins: PopularCityDto[];

  @ApiProperty({ type: [PopularCityDto] })
  destinations: PopularCityDto[];

  @ApiProperty({ type: [PopularRouteDto] })
  routes: PopularRouteDto[];
}
