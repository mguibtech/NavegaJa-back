import { IsString, IsNotEmpty, IsNumber, IsOptional, IsArray, Min, IsEnum, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { PaymentMethod } from '../booking.entity';
import { ChildPassengerDto, ExtraPassengerDto } from './passenger.dto';

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
    required: false,
    description: 'Crianças incluídas na reserva (nome opcional + idade). Crianças com até 9 anos não pagam (mas ocupam assento).',
    type: [ChildPassengerDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChildPassengerDto)
  children?: ChildPassengerDto[];

  @ApiProperty({
    required: false,
    description: 'Passageiros adultos adicionais (além do passageiro principal). Cada um com nome e CPF.',
    type: [ExtraPassengerDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExtraPassengerDto)
  passengers?: ExtraPassengerDto[];
}

export class CancelBookingDto {
  @ApiProperty({ required: false, description: 'Motivo do cancelamento' })
  @IsString()
  @IsOptional()
  reason?: string;
}
