import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import axios from 'axios';
import { WeatherData } from './weather-data.entity';
import {
  CurrentWeatherDto,
  ForecastDayDto,
  WeatherForecastDto,
  NavigationSafetyDto,
} from './dto/weather-response.dto';

/**
 * Serviço de Clima usando OpenWeatherMap API (FREE)
 * Limite: 1.000 chamadas/dia grátis
 * Cache: 30 minutos para economizar chamadas
 */
@Injectable()
export class WeatherService {
  private readonly logger = new Logger(WeatherService.name);
  private readonly apiKey: string;
  private readonly apiUrl = 'https://api.openweathermap.org/data/2.5';
  private readonly cacheTime = 1800; // 30 minutos em segundos

  // Regiões principais do Amazonas com coordenadas
  private readonly regions = {
    manaus: { lat: -3.119, lng: -60.0217, name: 'Manaus' },
    parintins: { lat: -2.6287, lng: -56.7358, name: 'Parintins' },
    santarem: { lat: -2.4419, lng: -54.7082, name: 'Santarém' },
    itacoatiara: { lat: -3.1430, lng: -58.4444, name: 'Itacoatiara' },
    manacapuru: { lat: -3.2999, lng: -60.6203, name: 'Manacapuru' },
  };

  constructor(
    @InjectRepository(WeatherData)
    private weatherRepo: Repository<WeatherData>,
    private configService: ConfigService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {
    this.apiKey = this.configService.get<string>('OPENWEATHER_API_KEY') || '';
    if (!this.apiKey) {
      this.logger.warn('⚠️  OPENWEATHER_API_KEY não configurada! API de clima não funcionará.');
    }
  }

  /**
   * Busca clima atual por coordenadas
   */
  async getCurrentWeather(lat: number, lng: number, region?: string): Promise<CurrentWeatherDto> {
    const cacheKey = `weather:current:${lat}:${lng}`;

    // Verificar cache primeiro
    const cached = await this.cacheManager.get<CurrentWeatherDto>(cacheKey);
    if (cached) {
      this.logger.debug(`✅ Cache hit: ${cacheKey}`);
      return cached;
    }

    this.logger.log(`🌦️  Buscando clima de ${region || 'coordenadas'} na OpenWeatherMap...`);

    try {
      const response = await axios.get(`${this.apiUrl}/weather`, {
        params: {
          lat,
          lon: lng,
          appid: this.apiKey,
          units: 'metric', // Celsius
          lang: 'pt_br',
        },
      });

      const data = response.data;
      const weather = this.mapToCurrentWeather(data, lat, lng, region);

      // Salvar no cache
      await this.cacheManager.set(cacheKey, weather, this.cacheTime * 1000);

      // Salvar histórico no banco (async, não bloqueia resposta)
      this.saveWeatherHistory(weather).catch((err) =>
        this.logger.error('Erro ao salvar histórico de clima:', err),
      );

      return weather;
    } catch (error) {
      this.logger.error('❌ Erro ao buscar clima:', error.message);
      throw new Error('Não foi possível obter dados meteorológicos');
    }
  }

  /**
   * Busca clima de uma região predefinida
   */
  async getRegionWeather(regionKey: string): Promise<CurrentWeatherDto> {
    const region = this.regions[regionKey.toLowerCase() as keyof typeof this.regions];
    if (!region) {
      throw new Error(`Região "${regionKey}" não encontrada`);
    }

    return this.getCurrentWeather(region.lat, region.lng, region.name);
  }

  /**
   * Busca previsão de 5 dias
   */
  async getForecast(lat: number, lng: number, region?: string): Promise<WeatherForecastDto> {
    const cacheKey = `weather:forecast:${lat}:${lng}`;

    const cached = await this.cacheManager.get<WeatherForecastDto>(cacheKey);
    if (cached) {
      this.logger.debug(`✅ Cache hit: ${cacheKey}`);
      return cached;
    }

    this.logger.log(`📅 Buscando previsão de ${region || 'coordenadas'}...`);

    try {
      const response = await axios.get(`${this.apiUrl}/forecast`, {
        params: {
          lat,
          lon: lng,
          appid: this.apiKey,
          units: 'metric',
          lang: 'pt_br',
        },
      });

      const forecast = this.mapToForecast(response.data, region);

      await this.cacheManager.set(cacheKey, forecast, this.cacheTime * 1000);

      return forecast;
    } catch (error) {
      this.logger.error('❌ Erro ao buscar previsão:', error.message);
      throw new Error('Não foi possível obter previsão do tempo');
    }
  }

  /**
   * Avalia se condições climáticas são seguras para navegação
   */
  async evaluateNavigationSafety(lat: number, lng: number): Promise<NavigationSafetyDto> {
    const weather = await this.getCurrentWeather(lat, lng);

    const warnings: string[] = [];
    const recommendations: string[] = [];
    let score = 100;

    // Critérios de segurança
    if (weather.windSpeed > 10) {
      warnings.push('Ventos fortes detectados');
      score -= 30;
      recommendations.push('Reduzir velocidade da embarcação');
    }

    if (weather.windGust && weather.windGust > 15) {
      warnings.push('Rajadas de vento perigosas');
      score -= 40;
      recommendations.push('Considere adiar a viagem');
    }

    if (weather.rain && weather.rain > 5) {
      warnings.push('Chuva forte');
      score -= 20;
      recommendations.push('Tenha equipamentos de segurança prontos');
    }

    if (weather.visibility < 1000) {
      warnings.push('Visibilidade reduzida');
      score -= 35;
      recommendations.push('Use luzes de navegação');
    }

    if (weather.condition.toLowerCase().includes('tempestade')) {
      warnings.push('ALERTA: Tempestade');
      score -= 50;
      recommendations.push('NÃO navegue! Aguarde melhora das condições');
    }

    const isSafe = score >= 60; // Score mínimo para navegação segura

    if (isSafe && warnings.length === 0) {
      recommendations.push('Condições favoráveis para navegação');
    }

    return {
      isSafe,
      score: Math.max(0, score),
      warnings,
      recommendations,
      weather,
    };
  }

  /**
   * Lista todas as regiões disponíveis
   */
  getAvailableRegions() {
    return Object.entries(this.regions).map(([key, value]) => ({
      key,
      name: value.name,
      latitude: value.lat,
      longitude: value.lng,
    }));
  }

  /**
   * Mapeia resposta da API para DTO
   */
  private mapToCurrentWeather(
    data: any,
    lat: number,
    lng: number,
    region?: string,
  ): CurrentWeatherDto {
    const weather = data.weather[0];
    const main = data.main;
    const wind = data.wind;

    // Traduzir condições para português
    const conditionMap: Record<string, string> = {
      Clear: 'Ensolarado',
      Clouds: 'Nublado',
      Rain: 'Chuva',
      Drizzle: 'Garoa',
      Thunderstorm: 'Tempestade',
      Snow: 'Neve',
      Mist: 'Névoa',
      Smoke: 'Fumaça',
      Haze: 'Neblina',
      Dust: 'Poeira',
      Fog: 'Nevoeiro',
      Sand: 'Areia',
      Ash: 'Cinzas',
      Squall: 'Rajada',
      Tornado: 'Tornado',
    };

    const condition = conditionMap[weather.main] || weather.main;

    const currentWeather: CurrentWeatherDto = {
      region: region || `${lat}, ${lng}`,
      latitude: lat,
      longitude: lng,
      temperature: Math.round(main.temp * 10) / 10,
      feelsLike: Math.round(main.feels_like * 10) / 10,
      humidity: main.humidity,
      windSpeed: Math.round(wind.speed * 10) / 10,
      windGust: wind.gust ? Math.round(wind.gust * 10) / 10 : null,
      windDirection: wind.deg,
      condition,
      description: weather.description,
      icon: weather.icon,
      cloudiness: data.clouds.all,
      visibility: data.visibility,
      rain: data.rain ? data.rain['1h'] : null,
      pressure: main.pressure,
      isSafeForNavigation: true, // Será calculado
      safetyWarnings: [],
      alerts: [],
      recordedAt: new Date(),
    };

    // Calcular segurança
    if (wind.speed > 10 || (wind.gust && wind.gust > 15)) {
      currentWeather.isSafeForNavigation = false;
      currentWeather.safetyWarnings.push('Ventos fortes');
    }

    if (currentWeather.rain && currentWeather.rain > 5) {
      currentWeather.safetyWarnings.push('Chuva intensa');
    }

    if (weather.main === 'Thunderstorm') {
      currentWeather.isSafeForNavigation = false;
      currentWeather.safetyWarnings.push('TEMPESTADE - Não navegue!');
    }

    return currentWeather;
  }

  /**
   * Mapeia previsão da API
   */
  private mapToForecast(data: any, region?: string): WeatherForecastDto {
    const dailyData = new Map<string, any[]>();

    // Agrupar por dia
    data.list.forEach((item: any) => {
      const date = new Date(item.dt * 1000).toISOString().split('T')[0];
      if (!dailyData.has(date)) {
        dailyData.set(date, []);
      }
      dailyData.get(date)!.push(item);
    });

    // Processar cada dia
    const forecast: ForecastDayDto[] = Array.from(dailyData.entries())
      .slice(0, 5) // Próximos 5 dias
      .map(([dateStr, items]) => {
        const temps = items.map((i) => i.main.temp);
        const rains = items.map((i) => (i.rain ? i.rain['3h'] : 0));
        const mainWeather = items[Math.floor(items.length / 2)].weather[0]; // Pegar do meio do dia

        return {
          date: new Date(dateStr),
          tempMin: Math.round(Math.min(...temps) * 10) / 10,
          tempMax: Math.round(Math.max(...temps) * 10) / 10,
          condition: mainWeather.main,
          description: mainWeather.description,
          icon: mainWeather.icon,
          humidity: Math.round(items.reduce((acc, i) => acc + i.main.humidity, 0) / items.length),
          windSpeed:
            Math.round(items.reduce((acc, i) => acc + i.wind.speed, 0) / items.length * 10) / 10,
          rain: Math.max(...rains),
          chanceOfRain: Math.round((items.filter((i) => i.rain).length / items.length) * 100),
        };
      });

    return {
      region: region || 'Coordenadas',
      forecast,
    };
  }

  /**
   * Salva dados no histórico
   */
  private async saveWeatherHistory(weather: CurrentWeatherDto): Promise<void> {
    const data = this.weatherRepo.create({
      region: weather.region,
      latitude: weather.latitude,
      longitude: weather.longitude,
      temperature: weather.temperature,
      feelsLike: weather.feelsLike,
      humidity: weather.humidity,
      windSpeed: weather.windSpeed,
      windGust: weather.windGust,
      windDeg: weather.windDirection,
      condition: weather.condition,
      description: weather.description,
      icon: weather.icon,
      cloudiness: weather.cloudiness,
      visibility: weather.visibility,
      rain: weather.rain,
      pressure: weather.pressure,
      isSafeForNavigation: weather.isSafeForNavigation,
      alerts: weather.alerts.length > 0 ? JSON.stringify(weather.alerts) : null,
    });

    await this.weatherRepo.save(data);
    this.logger.debug(`💾 Histórico salvo: ${weather.region}`);
  }
}
