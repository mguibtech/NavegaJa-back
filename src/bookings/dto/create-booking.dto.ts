import { IsString, IsNotEmpty, IsNumber, IsOptional, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateBookingDto {
  @ApiProperty({ description: 'ID da viagem' })
  @IsString()
  @IsNotEmpty()
  tripId: string;

  @ApiProperty({ example: 1, description: 'Quantidade de assentos' })
  @IsNumber()
  @Min(1)
  @IsOptional()
  seats?: number;

  @ApiProperty({ example: 'pix', required: false })
  @IsString()
  @IsOptional()
  paymentMethod?: string;
}
