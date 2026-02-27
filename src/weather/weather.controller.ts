import { Controller, Get, Query, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { WeatherService } from './weather.service';
import { FloodService } from './flood.service';

@ApiTags('weather')
@Controller('weather')
export class WeatherController {
  constructor(
    private readonly weatherService: WeatherService,
    private readonly floodService: FloodService,
  ) {}

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

  @Get('region/:regionKey/forecast')
  @Public()
  @ApiOperation({
    summary: 'Previsão de 7 dias de região predefinida',
    description: 'Regiões disponíveis: manaus, parintins, santarem, itacoatiara, manacapuru',
  })
  @ApiParam({ name: 'regionKey', example: 'manaus' })
  @ApiQuery({ name: 'days', required: false, example: 5, description: 'Número de dias (máx 7, padrão 7)' })
  async getRegionForecast(@Param('regionKey') regionKey: string) {
    return this.weatherService.getRegionForecast(regionKey);
  }

  @Get('region/:regionKey/alerts')
  @Public()
  @ApiOperation({
    summary: 'Alertas climáticos de região predefinida',
    description: 'Retorna avisos de segurança para navegação na região',
  })
  @ApiParam({ name: 'regionKey', example: 'manaus' })
  async getRegionAlerts(@Param('regionKey') regionKey: string) {
    return this.weatherService.getRegionAlerts(regionKey);
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

  // ─── Flood Hub ─────────────────────────────────────────────────────────────

  @Get('flood/status')
  @Public()
  @ApiOperation({
    summary: 'Status de cheia por área',
    description:
      'Retorna severity (NO_FLOODING | ABOVE_NORMAL | SEVERE | EXTREME) e gauges na área. ' +
      'source="mock" quando FLOOD_HUB_API_KEY não está configurada. Cache 15 min.',
  })
  @ApiQuery({ name: 'lat',      required: true,  example: -3.119  })
  @ApiQuery({ name: 'lng',      required: true,  example: -60.0217 })
  @ApiQuery({ name: 'radiusKm', required: false, example: 50, description: 'Raio em km (padrão 50)' })
  async getFloodStatus(
    @Query('lat')      lat:      string,
    @Query('lng')      lng:      string,
    @Query('radiusKm') radiusKm?: string,
  ) {
    return this.floodService.getFloodStatus(
      parseFloat(lat),
      parseFloat(lng),
      radiusKm ? parseFloat(radiusKm) : 50,
    );
  }

  @Get('flood/gauge/:gaugeId/model')
  @Public()
  @ApiOperation({
    summary: 'Limiares de uma estação fluviométrica (metros)',
    description:
      'Retorna warningLevel, dangerLevel e extremeDangerLevel em metros. ' +
      'Útil para mostrar referência no RiverDetailModal do app. Cache 1h.',
  })
  @ApiParam({ name: 'gaugeId', description: 'ID da estação Flood Hub', example: 'hybas_1120584700' })
  async getGaugeModel(@Param('gaugeId') gaugeId: string) {
    return this.floodService.getGaugeModel(gaugeId);
  }

  @Get('flood/gauge/:gaugeId/forecast')
  @Public()
  @ApiOperation({
    summary: 'Previsão hidrológica 7 dias de uma estação',
    description:
      'Série temporal horária com nível (metros) e severity para os próximos dias. ' +
      'source="mock" com NO_FLOODING quando API não disponível. Cache 2h.',
  })
  @ApiParam({ name: 'gaugeId', description: 'ID da estação Flood Hub' })
  @ApiQuery({ name: 'days', required: false, example: 7, description: 'Número de dias (padrão 7, máx 7)' })
  async getGaugeForecast(
    @Param('gaugeId') gaugeId: string,
    @Query('days')    days?: string,
  ) {
    const daysNum = days ? Math.min(parseInt(days, 10) || 7, 7) : 7;
    return this.floodService.getGaugeForecast(gaugeId, daysNum);
  }

  @Get('flood/events')
  @Public()
  @ApiOperation({
    summary: 'Eventos de cheia significativos e severos na área',
    description:
      'Inclui população afectada e área em km². Retorna [] quando API não disponível. Cache 30 min.',
  })
  @ApiQuery({ name: 'lat',      required: true,  example: -3.119   })
  @ApiQuery({ name: 'lng',      required: true,  example: -60.0217  })
  @ApiQuery({ name: 'radiusKm', required: false, example: 500, description: 'Raio em km (padrão 500)' })
  async getFloodEvents(
    @Query('lat')      lat:      string,
    @Query('lng')      lng:      string,
    @Query('radiusKm') radiusKm?: string,
  ) {
    return this.floodService.getFloodEvents(
      parseFloat(lat),
      parseFloat(lng),
      radiusKm ? parseFloat(radiusKm) : 500,
    );
  }

  @Get('flood/inundation')
  @Public()
  @ApiOperation({
    summary: 'Mapa de inundação — polígonos HIGH/MEDIUM/LOW e KML',
    description:
      'Polígonos de risco de inundação para overlay no mapa de navegação. ' +
      'O campo kml é uma string KML pronta para sobrepor em MapView. Cache 30 min.',
  })
  @ApiQuery({ name: 'lat',      required: true,  example: -3.119   })
  @ApiQuery({ name: 'lng',      required: true,  example: -60.0217  })
  @ApiQuery({ name: 'radiusKm', required: false, example: 50 })
  async getInundationMap(
    @Query('lat')      lat:      string,
    @Query('lng')      lng:      string,
    @Query('radiusKm') radiusKm?: string,
  ) {
    return this.floodService.getInundationMap(
      parseFloat(lat),
      parseFloat(lng),
      radiusKm ? parseFloat(radiusKm) : 50,
    );
  }
}
