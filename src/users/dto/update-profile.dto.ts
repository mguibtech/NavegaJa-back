import {
  IsString,
  IsOptional,
  IsEmail,
  IsUrl,
  Length,
  MaxLength,
  IsEnum,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Gender } from '../../users/user.entity';
import { IsCpfValid } from '../../common/validators/is-cpf-valid.validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'João Silva', description: 'Nome completo' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ example: 'joao@email.com', description: 'E-mail' })
  @IsOptional()
  @IsEmail({}, { message: 'E-mail inválido' })
  email?: string;

  @ApiPropertyOptional({
    example: 'https://cdn.navegaja.com/avatar.jpg',
    description: 'URL do avatar',
  })
  @IsOptional()
  @IsUrl({ require_tld: false }, { message: 'URL do avatar inválida' })
  avatarUrl?: string;

  @ApiPropertyOptional({
    example: '123.456.789-00',
    description: 'CPF do usuário (validado automaticamente)',
  })
  @IsOptional()
  @IsString({ message: 'O CPF deve ser um texto' })
  @IsCpfValid()
  cpf?: string;

  @ApiPropertyOptional({
    example: 'Parintins',
    description: 'Cidade (usada para notificações segmentadas)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional({ example: 'AM', description: 'Estado (UF, 2 letras)' })
  @IsOptional()
  @IsString()
  @Length(2, 2, { message: 'Estado deve ter 2 letras (ex: AM)' })
  state?: string;

  @ApiPropertyOptional({
    enum: Gender,
    example: 'M',
    description: 'Gênero (M, F ou other)',
  })
  @IsOptional()
  @IsEnum(Gender, { message: 'Gênero inválido. Use M, F ou other' })
  gender?: Gender;

  // ── Localização da comunidade (crowdsourcing) ─────────────────────────────

  @ApiPropertyOptional({
    example: 'Comunidade do Pesqueiro',
    description: 'Nome da comunidade/localidade onde mora',
  })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  homeCommunity?: string;

  @ApiPropertyOptional({
    example: 'Manacapuru',
    description: 'Município da comunidade',
  })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  homeMunicipio?: string;

  @ApiPropertyOptional({
    example: -3.41,
    description: 'Latitude da comunidade (confirmada no mapa)',
  })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  homeLat?: number;

  @ApiPropertyOptional({
    example: -60.65,
    description: 'Longitude da comunidade',
  })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  homeLng?: number;

  // ── Documentos do capitão (apenas capitães enviam estes campos) ────────────

  @ApiPropertyOptional({
    example:
      'https://storage.googleapis.com/navegaja.appspot.com/captains/uuid.jpg',
    description: 'Foto da habilitação de arrais / CNH náutica (capitão)',
  })
  @IsOptional()
  @IsUrl({ require_tld: false }, { message: 'URL da habilitação inválida' })
  licensePhotoUrl?: string;

  @ApiPropertyOptional({
    example:
      'https://storage.googleapis.com/navegaja.appspot.com/captains/uuid.jpg',
    description: 'Foto do certificado de segurança / habilitação (capitão)',
  })
  @IsOptional()
  @IsUrl({ require_tld: false }, { message: 'URL do certificado inválida' })
  certificatePhotoUrl?: string;
}
