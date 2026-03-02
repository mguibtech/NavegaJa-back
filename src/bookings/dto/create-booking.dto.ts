import { IsString, IsNotEmpty, IsNumber, IsInt, IsOptional, IsArray, Min, Max, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PaymentMethod } from '../booking.entity';

export class CreateBookingDto {
  @ApiProperty({ description: 'ID da viagem' })
  @IsString()
  @IsNotEmpty()
  tripId: string;

  @ApiProperty({ example: 1, required: false, description: 'Número do assento (opcional)' })
  @IsNumber()
  @IsOptional()
  seatNumber?: number;

  @ApiProperty({ example: 2, description: 'Quantidade de assentos' })
  @IsNumber()
  @Min(1)
  quantity: number;

  @ApiProperty({ enum: PaymentMethod, example: PaymentMethod.PIX })
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @ApiProperty({ example: 'NATAL2026', required: false, description: 'Código do cupom promocional' })
  @IsOptional()
  @IsString()
  couponCode?: string;

  @ApiProperty({
    example: 1000,
    required: false,
    description: 'Km a resgatar como desconto (múltiplo de 500). Cada 500 km = R$25 de desconto.',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  redeemKm?: number;

  @ApiProperty({
    example: [7, 4],
    required: false,
    description: 'Idades das crianças incluídas na reserva. Crianças com até 9 anos não pagam (mas ocupam assento).',
    type: [Number],
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true, message: 'Cada idade deve ser um número inteiro.' })
  @Min(0, { each: true, message: 'Idade não pode ser negativa.' })
  @Max(17, { each: true, message: 'Use este campo apenas para menores de 18 anos.' })
  children?: number[];
}

export class CancelBookingDto {
  @ApiProperty({ required: false, description: 'Motivo do cancelamento' })
  @IsString()
  @IsOptional()
  reason?: string;
}
