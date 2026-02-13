import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEnum, IsNumber, IsOptional, IsBoolean, IsDateString, Min, Max } from 'class-validator';
import { CouponType } from '../coupon.entity';

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
