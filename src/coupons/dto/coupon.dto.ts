import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEnum, IsNumber, IsOptional, IsBoolean, IsDateString, Min, Max } from 'class-validator';
import { CouponType, CouponApplicability } from '../coupon.entity';

export class CreateCouponDto {
  @ApiProperty({ example: 'NATAL2026', description: 'Código do cupom' })
  @IsString()
  code: string;

  @ApiProperty({ example: 'Promoção de Natal', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: CouponType, example: CouponType.PERCENTAGE })
  @IsEnum(CouponType)
  type: CouponType;

  @ApiProperty({ example: 15, description: 'Valor (porcentagem ou reais)' })
  @IsNumber()
  @Min(0)
  value: number;

  @ApiProperty({ example: 50, required: false, description: 'Valor mínimo de compra' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minPurchase?: number;

  @ApiProperty({ example: 100, required: false, description: 'Desconto máximo em reais' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxDiscount?: number;

  @ApiProperty({ example: 100, required: false, description: 'Limite de uso total' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  usageLimit?: number;

  @ApiProperty({ example: '2026-12-01', required: false })
  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @ApiProperty({ example: '2026-12-31', required: false })
  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ example: false, required: false })
  @IsOptional()
  @IsBoolean()
  firstPurchaseOnly?: boolean;

  @ApiProperty({ example: 'Manaus', required: false, description: 'Cidade de origem (null = todas)' })
  @IsOptional()
  @IsString()
  fromCity?: string;

  @ApiProperty({ example: 'Beruri', required: false, description: 'Cidade de destino (null = todas)' })
  @IsOptional()
  @IsString()
  toCity?: string;

  @ApiProperty({ example: 1.5, required: false, description: 'Peso mínimo em kg (para encomendas)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minWeight?: number;

  @ApiProperty({ example: 50, required: false, description: 'Peso máximo em kg (para encomendas)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxWeight?: number;

  @ApiProperty({
    enum: CouponApplicability,
    example: CouponApplicability.BOTH,
    required: false,
    description: 'Define se vale para viagens, encomendas ou ambos'
  })
  @IsOptional()
  @IsEnum(CouponApplicability)
  applicableTo?: CouponApplicability;
}

export class ValidateCouponDto {
  @ApiProperty({ example: 'NATAL2026' })
  @IsString()
  code: string;

  @ApiProperty({ example: 'trip-uuid' })
  @IsString()
  tripId: string;

  @ApiProperty({ example: 1 })
  @IsNumber()
  @Min(1)
  quantity: number;
}

export class CalculatePriceDto {
  @ApiProperty({ example: 'trip-uuid' })
  @IsString()
  tripId: string;

  @ApiProperty({ example: 1 })
  @IsNumber()
  @Min(1)
  quantity: number;

  @ApiProperty({ example: 'NATAL2026', required: false })
  @IsOptional()
  @IsString()
  couponCode?: string;
}
