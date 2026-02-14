import { IsString, IsNotEmpty, IsNumber, IsOptional, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateShipmentReviewDto {
  @ApiProperty({ description: 'ID da encomenda' })
  @IsString()
  @IsNotEmpty()
  shipmentId: string;

  @ApiProperty({ example: 5, description: 'Rating geral (1-5 estrelas)' })
  @IsNumber()
  @Min(1)
  @Max(5)
  @Type(() => Number)
  rating: number;

  @ApiProperty({ example: 5, description: 'Qualidade da entrega (1-5)' })
  @IsNumber()
  @Min(1)
  @Max(5)
  @Type(() => Number)
  deliveryQuality: number;

  @ApiProperty({ example: 4, description: 'Pontualidade (1-5)' })
  @IsNumber()
  @Min(1)
  @Max(5)
  @Type(() => Number)
  timeliness: number;

  @ApiProperty({ example: 'Entrega rápida e bem cuidadosa!', required: false })
  @IsString()
  @IsOptional()
  comment?: string;
}
