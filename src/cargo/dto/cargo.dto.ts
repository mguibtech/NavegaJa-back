import { IsString, IsNotEmpty, IsEnum, IsOptional, IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CargoType, CargoStatus } from '../cargo.entity';

export class CreateCargoDto {
  @ApiProperty({ example: 'uuid-da-viagem' })
  @IsString()
  @IsNotEmpty()
  tripId: string;

  @ApiProperty({ enum: CargoType, example: CargoType.MOTORCYCLE })
  @IsEnum(CargoType)
  cargoType: CargoType;

  @ApiProperty({ example: '1 moto Honda CG 160 vermelha' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ example: 1 })
  @IsNumber()
  @Min(1)
  @IsOptional()
  quantity?: number;

  @ApiProperty({ example: 120, required: false })
  @IsNumber()
  @IsOptional()
  estimatedWeightKg?: number;

  @ApiProperty({ example: '2m x 0.8m x 1.1m', required: false })
  @IsString()
  @IsOptional()
  dimensions?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  photoUrl?: string;

  @ApiProperty({ example: 'José da Silva' })
  @IsString()
  @IsNotEmpty()
  receiverName: string;

  @ApiProperty({ example: '92993001010' })
  @IsString()
  @IsNotEmpty()
  receiverPhone: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateCargoStatusDto {
  @ApiProperty({ enum: CargoStatus, example: CargoStatus.LOADED })
  @IsEnum(CargoStatus)
  status: CargoStatus;
}

export class QuoteCargoDto {
  @ApiProperty({ example: 150.00 })
  @IsNumber()
  @Min(0)
  totalPrice: number;
}
