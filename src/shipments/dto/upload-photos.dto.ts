import { IsNumber, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class GeneratePresignedUrlsDto {
  @ApiProperty({
    example: 3,
    description: 'Quantidade de fotos que serão enviadas (1-5)',
    minimum: 1,
    maximum: 5
  })
  @IsNumber()
  @Min(1)
  @Max(5)
  @Type(() => Number)
  count: number;
}

export class PresignedUrlDto {
  @ApiProperty({ description: 'URL para upload (PUT request)' })
  uploadUrl: string;

  @ApiProperty({ description: 'URL pública para acessar a foto depois do upload' })
  publicUrl: string;

  @ApiProperty({ description: 'Key/caminho do arquivo no S3' })
  key: string;
}

export class GeneratePresignedUrlsResponseDto {
  @ApiProperty({ type: [PresignedUrlDto] })
  urls: PresignedUrlDto[];

  @ApiProperty({ description: 'Tempo de expiração das URLs em segundos', example: 300 })
  expiresIn: number;
}
