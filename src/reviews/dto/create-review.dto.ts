import { IsString, IsNotEmpty, IsNumber, IsOptional, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateReviewDto {
  @ApiProperty({ description: 'ID da viagem' })
  @IsString()
  @IsNotEmpty()
  tripId: string;

  @ApiProperty({ description: 'ID do capitão avaliado' })
  @IsString()
  @IsNotEmpty()
  captainId: string;

  @ApiProperty({ example: 5, description: 'Nota de 1 a 5' })
  @IsNumber()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiProperty({ required: false, example: 'Ótima viagem, muito pontual!' })
  @IsString()
  @IsOptional()
  comment?: string;
}
