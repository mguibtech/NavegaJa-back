import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LocationsService } from './locations.service';
import { SuggestLocationDto } from './dto/suggest-location.dto';
import { ReverseGeocodeResponseDto } from './dto/reverse-geocode-response.dto';

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
  @ApiParam({
    name: 'cep',
    example: '69037400',
    description: 'CEP com ou sem máscara',
  })
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
    description:
      'Lista todos os municípios do AM (padrão) ordenados alfabeticamente. Cache 24h.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de municípios',
    schema: {
      example: [
        { nome: 'Autazes', codigoIbge: '1300300' },
        { nome: 'Iranduba', codigoIbge: '1301852' },
        { nome: 'Manaus', codigoIbge: '1302603' },
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
  @ApiParam({
    name: 'uf',
    example: 'AM',
    description: 'Sigla do estado (2 letras)',
  })
  getCitiesByUF(@Param('uf') uf: string) {
    return this.service.getMunicipios(uf);
  }

  // ─── Reverse Geocoding ───────────────────────────────────────────────────────

  @Get('reverse-geocode')
  @Public()
  @ApiOperation({
    summary: 'Geocoding inverso (coordenadas → endereço)',
    description:
      'Converte latitude/longitude em endereço legível usando Nominatim (OpenStreetMap). Cache 30min. Retorna fallback gracioso se indisponível.',
  })
  @ApiQuery({
    name: 'lat',
    required: true,
    example: -3.119,
    description: 'Latitude',
  })
  @ApiQuery({
    name: 'lng',
    required: true,
    example: -60.0217,
    description: 'Longitude',
  })
  @ApiResponse({
    status: 200,
    description: 'Endereço encontrado ou fallback com coordenadas',
    type: ReverseGeocodeResponseDto,
  })
  reverseGeocode(@Query('lat') lat: string, @Query('lng') lng: string) {
    return this.service.reverseGeocode(parseFloat(lat), parseFloat(lng));
  }

  @Get('location-label')
  @Public()
  @ApiOperation({
    summary: 'Texto curto de localização para tracking',
    description:
      'Retorna texto compacto ex: "Próximo a Iranduba, AM". Usado no tracking da viagem.',
  })
  @ApiQuery({ name: 'lat', required: true, example: -3.28 })
  @ApiQuery({ name: 'lng', required: true, example: -60.19 })
  @ApiResponse({
    status: 200,
    schema: { example: { label: 'Próximo a Iranduba, AM' } },
  })
  async getLocationLabel(@Query('lat') lat: string, @Query('lng') lng: string) {
    const label = await this.service.getLocationLabel(
      parseFloat(lat),
      parseFloat(lng),
    );
    return { label };
  }

  // ─── Comunidades ribeirinhas ──────────────────────────────────────────────────

  @Get('search')
  @Public()
  @ApiOperation({
    summary: 'Autocomplete de localidades',
    description:
      'Busca unificada: lookup table estática + comunidades confirmadas. Usar com debounce 400ms no app.',
  })
  @ApiQuery({ name: 'q', required: true, example: 'Pesqueiro' })
  @ApiQuery({
    name: 'lat',
    required: false,
    example: -3.3,
    description: 'Latitude atual (ordena por proximidade)',
  })
  @ApiQuery({ name: 'lng', required: false, example: -60.6 })
  @ApiResponse({
    status: 200,
    schema: {
      example: [
        {
          name: 'Comunidade do Pesqueiro',
          lat: -3.41,
          lng: -60.65,
          municipio: 'Manacapuru',
          source: 'community',
        },
        {
          name: 'Pesqueiro',
          lat: -3.35,
          lng: -60.5,
          municipio: null,
          source: 'lookup',
        },
      ],
    },
  })
  searchLocations(
    @Query('q') q: string,
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
  ) {
    return this.service.searchLocations(
      q || '',
      lat ? parseFloat(lat) : undefined,
      lng ? parseFloat(lng) : undefined,
    );
  }

  @Post('suggest')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Sugerir nova comunidade/localidade',
    description:
      'Qualquer utilizador autenticado pode sugerir. Auto-confirma com 2+ sugestões no mesmo ponto (< 2km).',
  })
  suggestCommunity(
    @Body() dto: SuggestLocationDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.service.suggestCommunity(dto, req.user.sub);
  }
}
