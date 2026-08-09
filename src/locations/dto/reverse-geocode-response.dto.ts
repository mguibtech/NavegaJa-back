import { ApiProperty } from '@nestjs/swagger';

/**
 * Resposta de GET /locations/reverse-geocode.
 *
 * Era uma interface solta no service, e o contrato só existia como exemplo
 * escrito à mão no @ApiResponse do controller. Exemplo não gera schema: o
 * Swagger publicava o formato certo como texto, e nada impedia o app de
 * assumir outros nomes de campo — foi o que aconteceu, e o seletor de mapa
 * passou meses gravando coordenada no lugar do nome da comunidade.
 *
 * Como classe com @ApiProperty, o formato passa a sair no schema do OpenAPI e
 * pode ser gerado como tipo do lado do app.
 */
export class ReverseGeocodeResponseDto {
  @ApiProperty({
    example: 'Porto da Ceasa, São Raimundo, Manaus, Amazonas, Brasil',
    description:
      'Endereço completo do Nominatim. Quando o serviço não responde, traz as coordenadas formatadas — por isso não serve como nome de lugar.',
  })
  display: string;

  @ApiProperty({ example: 'Porto da Ceasa', nullable: true, type: String })
  road: string | null;

  @ApiProperty({
    example: 'São Raimundo',
    nullable: true,
    type: String,
    description: 'Bairro, vila ou povoado.',
  })
  district: string | null;

  @ApiProperty({ example: 'Manaus', nullable: true, type: String })
  city: string | null;

  @ApiProperty({ example: 'Amazonas', nullable: true, type: String })
  state: string | null;

  @ApiProperty({ example: 'Brasil' })
  country: string;

  @ApiProperty({ example: -3.119 })
  latitude: number;

  @ApiProperty({ example: -60.0217 })
  longitude: number;
}
