import {
  IsUUID, IsInt, Min, Max, IsOptional, IsString, MaxLength, IsArray, IsUrl,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePassengerReviewDto {
  @ApiProperty({ description: 'ID da viagem concluída' })
  @IsUUID()
  tripId: string;

  @ApiProperty({ description: 'Avaliação do capitão (1 a 5 estrelas)', example: 5, minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  captainRating: number;

  @ApiPropertyOptional({ description: 'Comentário sobre o capitão', example: 'Muito atencioso e pontual!' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  captainComment?: string;

  @ApiPropertyOptional({ description: 'Pontualidade do capitão (1 a 5)', example: 5, minimum: 1, maximum: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  punctualityRating?: number;

  @ApiPropertyOptional({ description: 'Comunicação do capitão (1 a 5)', example: 5, minimum: 1, maximum: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  communicationRating?: number;

  @ApiPropertyOptional({ description: 'Avaliação do barco — opcional (1 a 5 estrelas)', example: 4, minimum: 1, maximum: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  boatRating?: number;

  @ApiPropertyOptional({ description: 'Comentário sobre o barco', example: 'Barco limpo e confortável.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  boatComment?: string;

  @ApiPropertyOptional({ description: 'Limpeza do barco (1 a 5)', example: 5, minimum: 1, maximum: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  cleanlinessRating?: number;

  @ApiPropertyOptional({ description: 'Conforto do barco (1 a 5)', example: 4, minimum: 1, maximum: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  comfortRating?: number;

  @ApiPropertyOptional({
    description: 'URLs de fotos do barco (já uploadadas via POST /upload/image)',
    type: [String],
    example: ['https://...jpg', 'https://...jpg'],
  })
  @IsOptional()
  @IsArray()
  @IsUrl({ require_tld: false }, { each: true })
  boatPhotos?: string[];
}

export class CreateCaptainReviewDto {
  @ApiProperty({ description: 'ID da viagem concluída' })
  @IsUUID()
  tripId: string;

  @ApiProperty({ description: 'ID do passageiro a avaliar' })
  @IsUUID()
  passengerId: string;

  @ApiProperty({ description: 'Avaliação do passageiro (1 a 5 estrelas)', example: 5, minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  passengerRating: number;

  @ApiPropertyOptional({ description: 'Comentário sobre o passageiro', example: 'Passageiro educado e pontual.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  passengerComment?: string;
}
