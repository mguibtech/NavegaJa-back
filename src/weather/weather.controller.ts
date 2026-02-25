import { Controller, Get, Query, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { WeatherService } from './weather.service';

@ApiTags('weather')
@Controller('weather')
export class WeatherController {
  constructor(private readonly weatherService: WeatherService) {}

  @Get('current')
  @Public()
  @ApiOperation({
    summary: 'Clima atual por coordenadas',
    description: 'Retorna condições meteorológicas atuais incluindo nascer/pôr do sol (cache 30min)',
  })
  @ApiQuery({ name: 'lat', required: true, example: -3.119 })
  @ApiQuery({ name: 'lng', required: true, example: -60.0217 })
  @ApiQuery({ name: 'region', required: false, example: 'Manaus' })
  async getCurrentWeather(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('region') region?: string,
  ) {
    return this.weatherService.getCurrentWeather(parseFloat(lat), parseFloat(lng), region);
  }

  @Get('region/:regionKey')
  @Public()
  @ApiOperation({
    summary: 'Clima de região predefinida',
    description: 'Regiões disponíveis: manaus, parintins, santarem, itacoatiara, manacapuru',
  })
  @ApiParam({ name: 'regionKey', example: 'manaus' })
  async getRegionWeather(@Param('regionKey') regionKey: string) {
    return this.weatherService.getRegionWeather(regionKey);
  }

  @Get('forecast')
  @Public()
  @ApiOperation({ summary: 'Previsão de 5 dias' })
  @ApiQuery({ name: 'lat', required: true, example: -3.119 })
  @ApiQuery({ name: 'lng', required: true, example: -60.0217 })
  @ApiQuery({ name: 'region', required: false, example: 'Manaus' })
  async getForecast(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('region') region?: string,
  ) {
    return this.weatherService.getForecast(parseFloat(lat), parseFloat(lng), region);
  }

  @Get('navigation-safety')
  @Public()
  @ApiOperation({
    summary: 'Avaliação de segurança para navegação',
    description: 'Analisa condições climáticas e retorna score 0-100 com avisos e recomendações',
  })
  @ApiQuery({ name: 'lat', required: true, example: -3.119 })
  @ApiQuery({ name: 'lng', required: true, example: -60.0217 })
  async evaluateNavigationSafety(@Query('lat') lat: string, @Query('lng') lng: string) {
    return this.weatherService.evaluateNavigationSafety(parseFloat(lat), parseFloat(lng));
  }

  @Get('trip/:tripId')
  @Public()
  @ApiOperation({
    summary: 'Clima da viagem',
    description: 'Retorna clima actual, score de segurança e avisos para a origem da viagem',
  })
  @ApiParam({ name: 'tripId', description: 'UUID da viagem' })
  @ApiResponse({
    status: 200,
    description: 'Clima e segurança de navegação para a viagem',
    schema: {
      example: {
        tripId: 'uuid',
        origin: 'Manaus (Porto da Ceasa)',
        destination: 'Parintins',
        departureAt: '2026-02-26T12:00:00.000Z',
        weather: { temperature: 29.5, condition: 'Nublado', windSpeed: 4.2, sunrise: '2026-02-26T09:45:00.000Z', sunset: '2026-02-26T21:52:00.000Z' },
        isSafeForNavigation: true,
        safetyScore: 100,
        warnings: [],
        recommendations: ['Condições favoráveis para navegação'],
      },
    },
  })
  async getTripWeather(@Param('tripId') tripId: string) {
    return this.weatherService.getTripWeather(tripId);
  }

  @Get('river-levels')
  @Public()
  @ApiOperation({
    summary: 'Nível de todos os rios monitorados',
    description: 'Retorna nível actual (cm) dos rios nas principais cidades — fonte: ANA (cache 1h)',
  })
  @ApiResponse({
    status: 200,
    description: 'Níveis fluviométricos',
    schema: {
      example: [{
        station: 'Manaus',
        stationCode: '14100000',
        river: 'Rio Negro',
        levelCm: 1856,
        levelStatus: 'normal',
        recordedAt: '25/02/2026 06:00:00',
        source: 'ANA',
      }],
    },
  })
  async getAllRiverLevels() {
    return this.weatherService.getAllRiverLevels();
  }

  @Get('river-level/:stationCode')
  @Public()
  @ApiOperation({
    summary: 'Nível do rio por estação',
    description: 'Estações: 14100000 (Manaus), 13850001 (Parintins), 14320000 (Itacoatiara), 14110000 (Manacapuru)',
  })
  @ApiParam({ name: 'stationCode', example: '14100000' })
  async getRiverLevel(@Param('stationCode') stationCode: string) {
    return this.weatherService.getRiverLevel(stationCode);
  }

  @Get('regions')
  @Public()
  @ApiOperation({ summary: 'Listar regiões predefinidas disponíveis' })
  getAvailableRegions() {
    return this.weatherService.getAvailableRegions();
  }
}
