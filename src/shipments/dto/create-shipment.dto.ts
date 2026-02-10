import { IsString, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateShipmentDto {
  @ApiProperty({ description: 'ID da viagem' })
  @IsString()
  @IsNotEmpty()
  tripId: string;

  @ApiProperty({ example: 'Caixa com roupas e alimentos' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ example: 5.5, required: false })
  @IsNumber()
  @IsOptional()
  weightKg?: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  photoUrl?: string;

  @ApiProperty({ example: 'Maria Santos' })
  @IsString()
  @IsNotEmpty()
  receiverName: string;

  @ApiProperty({ example: '92998765432' })
  @IsString()
  @IsNotEmpty()
  receiverPhone: string;
}
