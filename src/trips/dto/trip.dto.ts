import { IsString, IsNotEmpty, IsNumber, IsOptional, IsDateString, IsEnum, Min, Max } from 'class-validator';
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

  @ApiProperty({ example: 45.00 })
  @IsNumber()
  price: number;

  @ApiProperty({ example: 0, description: 'Desconto em % (0-100)', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  discount?: number;

  @ApiProperty({ example: 20 })
  @IsNumber()
  totalSeats: number;

  @ApiProperty({ example: 15.00, description: 'Preço por kg de carga (R$/kg)', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  cargoPriceKg?: number;

  @ApiProperty({ example: 500, description: 'Capacidade total de carga em kg', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  cargoCapacityKg?: number;
}

export class UpdateTripStatusDto {
  @ApiProperty({ enum: TripStatus })
  @IsEnum(TripStatus)
  status: TripStatus;
}

export class UpdateLocationDto {
  @ApiProperty({ example: -3.1190 })
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

  @ApiProperty({ example: 45.00 })
  minPrice: number;

  @ApiProperty({ example: 52.50 })
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
