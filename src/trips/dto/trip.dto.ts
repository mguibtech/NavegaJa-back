import { IsString, IsNotEmpty, IsNumber, IsOptional, IsDateString, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TripStatus } from '../trip.entity';

export class CreateTripDto {
  @ApiProperty({ description: 'ID da rota' })
  @IsString()
  @IsNotEmpty()
  routeId: string;

  @ApiProperty({ description: 'ID da embarcação' })
  @IsString()
  @IsNotEmpty()
  boatId: string;

  @ApiProperty({ example: '2026-02-15T08:00:00Z' })
  @IsDateString()
  departureAt: string;

  @ApiProperty({ example: 45.00 })
  @IsNumber()
  price: number;

  @ApiProperty({ example: 5.00, required: false })
  @IsNumber()
  @IsOptional()
  cargoPriceKg?: number;

  @ApiProperty({ example: 20 })
  @IsNumber()
  totalSeats: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  notes?: string;
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
