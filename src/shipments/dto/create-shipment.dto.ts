import { IsString, IsNotEmpty, IsNumber, IsOptional, IsArray, Min, Max, IsEnum, ValidateNested } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { DimensionsDto } from './dimensions.dto';
import { PaymentMethod } from '../../common/enums/payment-method.enum';

export class CreateShipmentDto {
  @ApiProperty({ description: 'ID da viagem' })
  @IsString()
  @IsNotEmpty()
  tripId: string;

  @ApiProperty({ example: 'Caixa com roupas e alimentos' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ example: 5.5, description: 'Peso em kg (0.1 a 50kg)' })
  @IsNumber()
  @Min(0.1)
  @Max(50)
  @Type(() => Number)
  weight: number;

  // Opção 1: Enviar dimensions como objeto (RECOMENDADO)
  @ApiProperty({
    type: DimensionsDto,
    required: false,
    description: 'Dimensões da encomenda (objeto)',
    example: { length: 30, width: 20, height: 15 }
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => DimensionsDto)
  dimensions?: DimensionsDto;

  // Opção 2: Enviar campos separados (BACKWARD COMPATIBILITY)
  @ApiProperty({ example: 30, description: 'Comprimento em cm (usar dimensions ao invés)', required: false, deprecated: true })
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(200)
  @Type(() => Number)
  length?: number;

  @ApiProperty({ example: 20, description: 'Largura em cm (usar dimensions ao invés)', required: false, deprecated: true })
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(200)
  @Type(() => Number)
  width?: number;

  @ApiProperty({ example: 15, description: 'Altura em cm (usar dimensions ao invés)', required: false, deprecated: true })
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(200)
  @Type(() => Number)
  height?: number;

  // Array de URLs de fotos (máximo 5)
  @ApiProperty({
    type: [String],
    example: ['https://cdn.example.com/photo1.jpg', 'https://cdn.example.com/photo2.jpg'],
    required: false,
    description: 'Array de URLs de fotos (máximo 5)'
  })
  @IsArray()
  @IsOptional()
  photos?: string[];

  @ApiProperty({ example: 'Maria Santos' })
  @IsString()
  @IsNotEmpty()
  recipientName: string;

  @ApiProperty({ example: '92998765432' })
  @IsString()
  @IsNotEmpty()
  recipientPhone: string;

  @ApiProperty({ example: 'Rua das Flores, 123 - Centro, Parintins-AM' })
  @IsString()
  @IsNotEmpty()
  recipientAddress: string;

  @ApiProperty({
    enum: PaymentMethod,
    example: PaymentMethod.PIX,
    default: PaymentMethod.PIX,
    required: false,
    description: 'Método de pagamento (pix, credit_card, debit_card, cash)'
  })
  @IsEnum(PaymentMethod)
  @IsOptional()
  paymentMethod?: PaymentMethod;

  @ApiProperty({ example: 'PROMO10', required: false, description: 'Código de cupom de desconto' })
  @IsString()
  @IsOptional()
  couponCode?: string;
}

