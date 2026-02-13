import { IsString, IsNotEmpty, IsNumber, IsOptional, Min, IsEnum } from 'class-validator';
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
}

export class CancelBookingDto {
  @ApiProperty({ required: false, description: 'Motivo do cancelamento' })
  @IsString()
  @IsOptional()
  reason?: string;
}
