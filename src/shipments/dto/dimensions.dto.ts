import { IsNumber, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class DimensionsDto {
  @ApiProperty({ example: 30, description: 'Comprimento em cm (1-200cm)' })
  @IsNumber()
  @Min(1)
  @Max(200)
  @Type(() => Number)
  length: number;

  @ApiProperty({ example: 20, description: 'Largura em cm (1-200cm)' })
  @IsNumber()
  @Min(1)
  @Max(200)
  @Type(() => Number)
  width: number;

  @ApiProperty({ example: 15, description: 'Altura em cm (1-200cm)' })
  @IsNumber()
  @Min(1)
  @Max(200)
  @Type(() => Number)
  height: number;
}
