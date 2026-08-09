import { ApiProperty } from '@nestjs/swagger';

/**
 * Resposta de GET /trips/geocode — autocomplete de origem e destino.
 *
 * Mesmo caso do reverse-geocode: o formato vivia numa interface do service e
 * nunca chegou ao schema do OpenAPI. Como `name`, `lat` e `lng` batiam com o
 * que o app esperava, a busca funcionava e a divergência em `municipio` e
 * `source` passou despercebida — o município simplesmente não aparecia.
 */
export class LocationSuggestionResponseDto {
  @ApiProperty({ example: 'Comunidade Santo Antônio' })
  name: string;

  @ApiProperty({ example: -3.3689 })
  lat: number;

  @ApiProperty({ example: -64.7108 })
  lng: number;

  @ApiProperty({
    example: 'Tefé',
    nullable: true,
    type: String,
    description: 'Município a que a localidade pertence.',
  })
  municipio: string | null;

  @ApiProperty({
    example: 'community',
    enum: ['lookup', 'community'],
    description:
      '`lookup` vem da tabela de municípios; `community`, das comunidades ribeirinhas cadastradas.',
  })
  source: 'lookup' | 'community';
}
