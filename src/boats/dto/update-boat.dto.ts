import { IsString, IsOptional, IsNumber, IsArray, IsUrl, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateBoatDto {
  @ApiPropertyOptional({ example: 'Estrela do Rio' })
  @IsOptional() @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'lancha', description: 'lancha | voadeira | balsa | recreio' })
  @IsOptional() @IsString()
  type?: string;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional() @IsNumber() @Min(1)
  capacity?: number;

  @ApiPropertyOptional({ example: 'Mercury 150HP' })
  @IsOptional() @IsString()
  model?: string;

  @ApiPropertyOptional({ example: 2022 })
  @IsOptional() @IsNumber() @Min(1900) @Max(2100)
  year?: number;

  @ApiPropertyOptional({ example: 'https://storage.googleapis.com/navegaja.appspot.com/boats/uuid.jpg' })
  @IsOptional() @IsUrl({ require_tld: false }, { message: 'URL do avatar inválida' })
  photoUrl?: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['wifi', 'banheiro', 'colete', 'som', 'cobertura'],
    description: 'Comodidades do barco',
  })
  @IsOptional() @IsArray() @IsString({ each: true })
  amenities?: string[];

  @ApiPropertyOptional({
    type: [String],
    example: ['https://storage.googleapis.com/...foto1.jpg'],
    description: 'Fotos do barco (exterior, interior) — URLs do Firebase Storage',
  })
  @IsOptional() @IsArray() @IsUrl({ require_tld: false }, { each: true })
  photos?: string[];

  @ApiPropertyOptional({
    type: [String],
    example: ['https://storage.googleapis.com/...licenca.jpg', 'https://storage.googleapis.com/...vistoria.jpg'],
    description: 'Fotos de documentos do barco (licença de navegação, certificado de vistoria, etc.)',
  })
  @IsOptional() @IsArray() @IsUrl({ require_tld: false }, { each: true })
  documentPhotos?: string[];

  @ApiPropertyOptional({ example: 'AM-1234', description: 'Número de registro da embarcação' })
  @IsOptional() @IsString()
  registrationNum?: string;
}
