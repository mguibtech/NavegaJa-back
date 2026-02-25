import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { LocationsService } from './locations.service';

@ApiTags('Locations')
@Controller('locations')
export class LocationsController {
  constructor(private readonly service: LocationsService) {}

  // ─── CEP ─────────────────────────────────────────────────────────────────────

  @Get('cep/:cep')
  @Public()
  @ApiOperation({
    summary: 'Buscar endereço por CEP',
    description: 'Consulta ViaCEP e retorna endereço completo. Cache 1h.',
  })
  @ApiParam({ name: 'cep', example: '69037400', description: 'CEP com ou sem máscara' })
  @ApiResponse({
    status: 200,
    description: 'Endereço encontrado',
    schema: {
      example: {
        cep: '69037-400',
        logradouro: 'Rua exemplo',
        complemento: '',
        bairro: 'São Raimundo',
        cidade: 'Manaus',
        uf: 'AM',
        estado: 'Amazonas',
        ddd: '92',
        ibge: '1302603',
      },
    },
  })
  getCep(@Param('cep') cep: string) {
    return this.service.getCep(cep);
  }

  // ─── Municípios ───────────────────────────────────────────────────────────────

  @Get('cities')
  @Public()
  @ApiOperation({
    summary: 'Municípios do Amazonas',
    description: 'Lista todos os municípios do AM (padrão) ordenados alfabeticamente. Cache 24h.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de municípios',
    schema: {
      example: [
        { nome: 'Autazes',   codigoIbge: '1300300' },
        { nome: 'Iranduba',  codigoIbge: '1301852' },
        { nome: 'Manaus',    codigoIbge: '1302603' },
        { nome: 'Parintins', codigoIbge: '1303403' },
      ],
    },
  })
  getCitiesAM() {
    return this.service.getMunicipios('AM');
  }

  @Get('cities/:uf')
  @Public()
  @ApiOperation({
    summary: 'Municípios por estado',
    description: 'Lista municípios de qualquer UF brasileira. Cache 24h.',
  })
  @ApiParam({ name: 'uf', example: 'AM', description: 'Sigla do estado (2 letras)' })
  getCitiesByUF(@Param('uf') uf: string) {
    return this.service.getMunicipios(uf);
  }

  // ─── Reverse Geocoding ───────────────────────────────────────────────────────

  @Get('reverse-geocode')
  @Public()
  @ApiOperation({
    summary: 'Geocoding inverso (coordenadas → endereço)',
    description: 'Converte latitude/longitude em endereço legível usando Nominatim (OpenStreetMap). Cache 30min. Retorna fallback gracioso se indisponível.',
  })
  @ApiQuery({ name: 'lat', required: true, example: -3.119,   description: 'Latitude' })
  @ApiQuery({ name: 'lng', required: true, example: -60.0217, description: 'Longitude' })
  @ApiResponse({
    status: 200,
    description: 'Endereço encontrado ou fallback com coordenadas',
    schema: {
      example: {
        display:   'Porto da Ceasa, São Raimundo, Manaus, Amazonas, Brasil',
        road:      'Porto da Ceasa',
        district:  'São Raimundo',
        city:      'Manaus',
        state:     'Amazonas',
        country:   'Brasil',
        latitude:  -3.119,
        longitude: -60.0217,
      },
    },
  })
  reverseGeocode(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
  ) {
    return this.service.reverseGeocode(parseFloat(lat), parseFloat(lng));
  }

  @Get('location-label')
  @Public()
  @ApiOperation({
    summary: 'Texto curto de localização para tracking',
    description: 'Retorna texto compacto ex: "Próximo a Iranduba, AM". Usado no tracking da viagem.',
  })
  @ApiQuery({ name: 'lat', required: true, example: -3.28 })
  @ApiQuery({ name: 'lng', required: true, example: -60.19 })
  @ApiResponse({
    status: 200,
    schema: { example: { label: 'Próximo a Iranduba, AM' } },
  })
  async getLocationLabel(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
  ) {
    const label = await this.service.getLocationLabel(parseFloat(lat), parseFloat(lng));
    return { label };
  }
}
