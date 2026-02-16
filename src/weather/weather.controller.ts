import { Controller, Get, Query, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { WeatherService } from './weather.service';

@ApiTags('weather')
@Controller('weather')
export class WeatherController {
  constructor(private readonly weatherService: WeatherService) {}

  /**
   * Busca clima atual por coordenadas
   */
  @Get('current')
  @Public()
  @ApiOperation({
    summary: 'Clima atual por coordenadas',
    description: 'Retorna condições meteorológicas atuais de uma localização (cache 30min)',
  })
  @ApiQuery({ name: 'lat', required: true, example: -3.119, description: 'Latitude' })
  @ApiQuery({ name: 'lng', required: true, example: -60.0217, description: 'Longitude' })
  @ApiQuery({
    name: 'region',
    required: false,
    example: 'Manaus',
    description: 'Nome da região (opcional)',
  })
  @ApiResponse({
    status: 200,
    description: 'Dados meteorológicos obtidos com sucesso',
  })
  async getCurrentWeather(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('region') region?: string,
  ) {
    return this.weatherService.getCurrentWeather(parseFloat(lat), parseFloat(lng), region);
  }

  /**
   * Busca clima de uma região predefinida
   */
  @Get('region/:regionKey')
  @Public()
  @ApiOperation({
    summary: 'Clima de região predefinida',
    description: 'Clima de regiões principais: manaus, parintins, santarem, itacoatiara, manacapuru',
  })
  @ApiResponse({
    status: 200,
    description: 'Dados meteorológicos da região',
  })
  async getRegionWeather(@Param('regionKey') regionKey: string) {
    return this.weatherService.getRegionWeather(regionKey);
  }

  /**
   * Previsão de 5 dias
   */
  @Get('forecast')
  @Public()
  @ApiOperation({
    summary: 'Previsão de 5 dias',
    description: 'Previsão meteorológica dos próximos 5 dias',
  })
  @ApiQuery({ name: 'lat', required: true, example: -3.119 })
  @ApiQuery({ name: 'lng', required: true, example: -60.0217 })
  @ApiQuery({ name: 'region', required: false, example: 'Manaus' })
  @ApiResponse({
    status: 200,
    description: 'Previsão de 5 dias',
  })
  async getForecast(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('region') region?: string,
  ) {
    return this.weatherService.getForecast(parseFloat(lat), parseFloat(lng), region);
  }

  /**
   * Avaliação de segurança para navegação
   */
  @Get('navigation-safety')
  @Public()
  @ApiOperation({
    summary: 'Avaliação de segurança para navegação',
    description: 'Analisa condições climáticas e retorna se é seguro navegar (score 0-100)',
  })
  @ApiQuery({
    name: 'lat',
    required: true,
    example: -3.119,
    description: 'Latitude do ponto de partida',
  })
  @ApiQuery({
    name: 'lng',
    required: true,
    example: -60.0217,
    description: 'Longitude do ponto de partida',
  })
  @ApiResponse({
    status: 200,
    description: 'Avaliação de segurança com score e recomendações',
  })
  async evaluateNavigationSafety(@Query('lat') lat: string, @Query('lng') lng: string) {
    return this.weatherService.evaluateNavigationSafety(parseFloat(lat), parseFloat(lng));
  }

  /**
   * Lista regiões disponíveis
   */
  @Get('regions')
  @Public()
  @ApiOperation({
    summary: 'Listar regiões disponíveis',
    description: 'Retorna lista de regiões predefinidas com coordenadas',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de regiões',
  })
  getAvailableRegions() {
    return this.weatherService.getAvailableRegions();
  }
}
