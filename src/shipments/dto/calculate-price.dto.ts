import { IsString, IsNotEmpty, IsNumber, IsOptional, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CalculatePriceDto {
  @ApiProperty({ description: 'ID da viagem' })
  @IsString()
  @IsNotEmpty()
  tripId: string;

  @ApiProperty({ example: 5.5, description: 'Peso em kg (0.1 a 50kg)' })
  @IsNumber()
  @Min(0.1)
  @Max(50)
  @Type(() => Number)
  weightKg: number;

  @ApiProperty({ example: 30, description: 'Comprimento em cm', required: false })
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(200)
  @Type(() => Number)
  length?: number;

  @ApiProperty({ example: 20, description: 'Largura em cm', required: false })
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(200)
  @Type(() => Number)
  width?: number;

  @ApiProperty({ example: 15, description: 'Altura em cm', required: false })
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(200)
  @Type(() => Number)
  height?: number;

  @ApiProperty({ example: 'PROMO10', required: false, description: 'Código de cupom de desconto' })
  @IsString()
  @IsOptional()
  couponCode?: string;
}

export class CalculatePriceResponseDto {
  @ApiProperty({ example: 55.00, description: 'Preço base (peso cobrado × preço/kg)' })
  basePrice: number;

  @ApiProperty({ example: 6.0, description: 'Peso volumétrico calculado (length × width × height / 6000)', required: false })
  volumetricWeight?: number;

  @ApiProperty({ example: 5.5, description: 'Peso real em kg' })
  actualWeight: number;

  @ApiProperty({ example: 6.0, description: 'Peso cobrado (maior entre real e volumétrico)' })
  chargedWeight: number;

  @ApiProperty({ example: 60.00, description: 'Valor da cobrança por peso (chargedWeight × pricePerKg)' })
  weightCharge: number;

  @ApiProperty({ example: 10.00, description: 'Preço por kg da viagem' })
  pricePerKg: number;

  @ApiProperty({ example: 5.00, description: 'Desconto do cupom aplicado', required: false })
  couponDiscount?: number;

  @ApiProperty({ example: 'PROMO10', description: 'Código do cupom aplicado', required: false })
  couponCode?: string;

  @ApiProperty({ example: 5.00, description: 'Total de desconto' })
  totalDiscount: number;

  @ApiProperty({ example: 55.00, description: 'Preço final após descontos' })
  finalPrice: number;
}
