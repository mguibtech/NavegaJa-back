import { Injectable, Logger, Inject, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Cron } from '@nestjs/schedule';
import axios from 'axios';
import { WeatherData } from './weather-data.entity';
import { Trip, TripStatus } from '../trips/trip.entity';
import { Booking, BookingStatus } from '../bookings/booking.entity';
import { NotificationsService } from '../notifications/notifications.service';
import {
  CurrentWeatherDto,
  ForecastDayDto,
  WeatherForecastDto,
  NavigationSafetyDto,
  RiverLevelDto,
  TripWeatherDto,
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
    manaus:      { lat: -3.119,  lng: -60.0217, name: 'Manaus' },
    parintins:   { lat: -2.6287, lng: -56.7358, name: 'Parintins' },
    santarem:    { lat: -2.4419, lng: -54.7082, name: 'Santarém' },
    itacoatiara: { lat: -3.1430, lng: -58.4444, name: 'Itacoatiara' },
    manacapuru:  { lat: -3.2999, lng: -60.6203, name: 'Manacapuru' },
  };

  // Estações fluviométricas da ANA (Agência Nacional de Águas)
  private readonly riverStations = {
    manaus:      { code: '14100000', name: 'Manaus',      river: 'Rio Negro' },
    parintins:   { code: '13850001', name: 'Parintins',   river: 'Rio Amazonas' },
    itacoatiara: { code: '14320000', name: 'Itacoatiara', river: 'Rio Amazonas' },
    manacapuru:  { code: '14110000', name: 'Manacapuru',  river: 'Rio Solimões' },
  };

  // Cotas de referência por estação (cm) — fonte: COBRADE/Defesa Civil AM
  private readonly riverThresholds: Record<string, { low: number; attention: number; alert: number; emergency: number }> = {
    '14100000': { low: 700,  attention: 2700, alert: 2900, emergency: 3000 }, // Manaus
    '13850001': { low: 200,  attention: 1000, alert: 1100, emergency: 1200 }, // Parintins
    '14320000': { low: 200,  attention: 1100, alert: 1200, emergency: 1300 }, // Itacoatiara
    '14110000': { low: 200,  attention: 1400, alert: 1500, emergency: 1600 }, // Manacapuru
  };

  constructor(
    @InjectRepository(WeatherData)
    private weatherRepo: Repository<WeatherData>,
    @InjectRepository(Trip)
    private tripsRepo: Repository<Trip>,
    @InjectRepository(Booking)
    private bookingsRepo: Repository<Booking>,
    private configService: ConfigService,
    private notificationsService: NotificationsService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {
    this.apiKey = this.configService.get<string>('OPENWEATHER_API_KEY') || '';
    if (!this.apiKey) {
      this.logger.warn('⚠️  OPENWEATHER_API_KEY não configurada! API de clima não funcionará.');
    }
  }

  // ─── OpenWeatherMap ──────────────────────────────────────────────────────────

  async getCurrentWeather(lat: number, lng: number, region?: string): Promise<CurrentWeatherDto> {
    const cacheKey = `weather:current:${lat}:${lng}`;

    const cached = await this.cacheManager.get<CurrentWeatherDto>(cacheKey);
    if (cached) {
      this.logger.debug(`✅ Cache hit: ${cacheKey}`);
      return cached;
    }

    this.logger.log(`🌦️  Buscando clima de ${region || 'coordenadas'} na OpenWeatherMap...`);

    try {
      const response = await axios.get(`${this.apiUrl}/weather`, {
        params: { lat, lon: lng, appid: this.apiKey, units: 'metric', lang: 'pt_br' },
      });

      const data = response.data;
      const weather = this.mapToCurrentWeather(data, lat, lng, region);

      await this.cacheManager.set(cacheKey, weather, this.cacheTime * 1000);

      this.saveWeatherHistory(weather).catch((err) =>
        this.logger.error('Erro ao salvar histórico de clima:', err),
      );

      return weather;
    } catch (error) {
      this.logger.error('❌ Erro ao buscar clima:', error.message);
      throw new Error('Não foi possível obter dados meteorológicos');
    }
  }

  async getRegionWeather(regionKey: string): Promise<CurrentWeatherDto> {
    const region = this.regions[regionKey.toLowerCase() as keyof typeof this.regions];
    if (!region) {
      throw new Error(`Região "${regionKey}" não encontrada`);
    }
    return this.getCurrentWeather(region.lat, region.lng, region.name);
  }

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
        params: { lat, lon: lng, appid: this.apiKey, units: 'metric', lang: 'pt_br' },
      });

      const forecast = this.mapToForecast(response.data, region);
      await this.cacheManager.set(cacheKey, forecast, this.cacheTime * 1000);
      return forecast;
    } catch (error) {
      this.logger.error('❌ Erro ao buscar previsão:', error.message);
      throw new Error('Não foi possível obter previsão do tempo');
    }
  }

  async evaluateNavigationSafety(lat: number, lng: number): Promise<NavigationSafetyDto> {
    const weather = await this.getCurrentWeather(lat, lng);

    const warnings: string[] = [];
    const recommendations: string[] = [];
    let score = 100;

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

    const isSafe = score >= 60;

    if (isSafe && warnings.length === 0) {
      recommendations.push('Condições favoráveis para navegação');
    }

    return { isSafe, score: Math.max(0, score), warnings, recommendations, weather };
  }

  // ─── Clima por viagem ────────────────────────────────────────────────────────

  async getTripWeather(tripId: string): Promise<TripWeatherDto> {
    const trip = await this.tripsRepo.findOne({
      where: { id: tripId },
      relations: ['route'],
    });
    if (!trip) throw new NotFoundException('Viagem não encontrada');

    // Coordenadas da origem: usa a rota ou fallback para Manaus
    const lat = trip.route?.originLat ?? this.regions.manaus.lat;
    const lng = trip.route?.originLng ?? this.regions.manaus.lng;
    const regionName = trip.origin || 'Manaus';

    const safety = await this.evaluateNavigationSafety(
      Number(lat),
      Number(lng),
    );

    // Enriquecer a região no weather
    safety.weather.region = regionName;

    return {
      tripId: trip.id,
      origin: trip.origin,
      destination: trip.destination,
      departureAt: trip.departureAt,
      weather: safety.weather,
      isSafeForNavigation: safety.isSafe,
      safetyScore: safety.score,
      warnings: safety.warnings,
      recommendations: safety.recommendations,
    };
  }

  // ─── Alertas automáticos (cron 6h Manaus = 10h UTC) ─────────────────────────

  @Cron('0 10 * * *', { timeZone: 'America/Manaus' })
  async checkScheduledTripsWeather(): Promise<void> {
    this.logger.log('🌦️  Verificando clima das viagens agendadas para hoje...');

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay   = new Date(startOfDay.getTime() + 86400000);

    const trips = await this.tripsRepo.find({
      where: { status: TripStatus.SCHEDULED, departureAt: Between(startOfDay, endOfDay) },
      relations: ['route'],
    });

    this.logger.log(`  → ${trips.length} viagem(ns) agendadas hoje`);

    for (const trip of trips) {
      try {
        const lat = Number(trip.route?.originLat ?? this.regions.manaus.lat);
        const lng = Number(trip.route?.originLng ?? this.regions.manaus.lng);
        const safety = await this.evaluateNavigationSafety(lat, lng);

        if (!safety.isSafe) {
          const route = `${trip.origin} → ${trip.destination}`;
          const warningText = safety.warnings.join(', ');

          // Notificar capitão
          await this.notificationsService.sendToUser(trip.captainId, {
            title: '⚠️ Alerta de clima na sua viagem',
            body: `${route}: ${warningText}. Verifique as condições antes de partir.`,
            data: { type: 'weather_alert', tripId: trip.id },
          });

          // Notificar passageiros com reserva activa
          const bookings = await this.bookingsRepo.find({
            where: {
              tripId: trip.id,
              status: In([BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN]),
            },
          });

          for (const booking of bookings) {
            await this.notificationsService.sendToUser(booking.passengerId, {
              title: '⚠️ Alerta de clima na sua viagem',
              body: `Viagem ${route}: condições adversas previstas. Fique atento.`,
              data: { type: 'weather_alert', tripId: trip.id, bookingId: booking.id },
            });
          }

          this.logger.warn(`  ⚠️  Viagem ${trip.id} (${route}): clima adverso — ${bookings.length} passageiro(s) notificado(s)`);
        }
      } catch (err) {
        this.logger.error(`Erro ao verificar clima da viagem ${trip.id}:`, err.message);
      }
    }
  }

  // ─── Nível dos rios (ANA) ────────────────────────────────────────────────────

  async getRiverLevel(stationCode: string): Promise<RiverLevelDto> {
    const cacheKey = `river:level:${stationCode}`;
    const cached = await this.cacheManager.get<RiverLevelDto>(cacheKey);
    if (cached) return cached;

    const stationInfo = Object.values(this.riverStations).find(s => s.code === stationCode);

    try {
      const today   = new Date();
      const dateStr = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;

      const response = await axios.get(
        'https://telemetria.ana.gov.br/Share/DadosHidrometeorologicos.aspx',
        {
          params: { CodEstacao: stationCode, DataInicio: dateStr, DataFim: dateStr, tipoDados: 3, nivelConsistencia: 1 },
          timeout: 10000,
          responseType: 'text',
        },
      );

      const xml = response.data as string;

      // Extrai última leitura do XML
      const levelMatches = xml.match(/<Nivel>([\d.]+)<\/Nivel>/g) ?? [];
      const dateMatches  = xml.match(/<DataHora>([^<]+)<\/DataHora>/g) ?? [];

      const lastLevel = levelMatches.length
        ? parseFloat(levelMatches[levelMatches.length - 1].replace(/<\/?Nivel>/g, ''))
        : null;
      const lastDate = dateMatches.length
        ? dateMatches[dateMatches.length - 1].replace(/<\/?DataHora>/g, '')
        : null;

      const result: RiverLevelDto = {
        station:     stationInfo?.name ?? stationCode,
        stationCode,
        river:       stationInfo?.river ?? 'Rio',
        levelCm:     lastLevel,
        levelStatus: this.classifyRiverLevel(stationCode, lastLevel),
        recordedAt:  lastDate,
        source:      'ANA',
      };

      await this.cacheManager.set(cacheKey, result, 3600 * 1000); // cache 1 hora
      return result;
    } catch (err) {
      this.logger.warn(`⚠️ Não foi possível obter nível do rio para estação ${stationCode}: ${err.message}`);
      return {
        station:     stationInfo?.name ?? stationCode,
        stationCode,
        river:       stationInfo?.river ?? 'Rio',
        levelCm:     null,
        levelStatus: 'unknown',
        recordedAt:  null,
        source:      'ANA',
      };
    }
  }

  async getAllRiverLevels(): Promise<RiverLevelDto[]> {
    const results = await Promise.allSettled(
      Object.values(this.riverStations).map(s => this.getRiverLevel(s.code)),
    );
    return results
      .filter((r): r is PromiseFulfilledResult<RiverLevelDto> => r.status === 'fulfilled')
      .map(r => r.value);
  }

  // ─── Misc ────────────────────────────────────────────────────────────────────

  getAvailableRegions() {
    return Object.entries(this.regions).map(([key, value]) => ({
      key,
      name: value.name,
      latitude: value.lat,
      longitude: value.lng,
    }));
  }

  async getUserDiscount(userId: string): Promise<number> {
    return 0; // placeholder — desconto de gamificação gerido pelo GamificationService
  }

  // ─── Helpers privados ────────────────────────────────────────────────────────

  private classifyRiverLevel(
    stationCode: string,
    levelCm: number | null,
  ): RiverLevelDto['levelStatus'] {
    if (levelCm === null) return 'unknown';
    const t = this.riverThresholds[stationCode] ?? { low: 300, attention: 1500, alert: 1700, emergency: 1900 };

    if (levelCm >= t.emergency) return 'emergency';
    if (levelCm >= t.alert)     return 'alert';
    if (levelCm >= t.attention) return 'attention';
    if (levelCm < t.low)        return 'low';
    return 'normal';
  }

  private mapToCurrentWeather(data: any, lat: number, lng: number, region?: string): CurrentWeatherDto {
    const weather = data.weather[0];
    const main    = data.main;
    const wind    = data.wind;

    const conditionMap: Record<string, string> = {
      Clear: 'Ensolarado', Clouds: 'Nublado', Rain: 'Chuva',
      Drizzle: 'Garoa', Thunderstorm: 'Tempestade', Snow: 'Neve',
      Mist: 'Névoa', Smoke: 'Fumaça', Haze: 'Neblina',
      Dust: 'Poeira', Fog: 'Nevoeiro', Sand: 'Areia',
      Ash: 'Cinzas', Squall: 'Rajada', Tornado: 'Tornado',
    };

    const condition = conditionMap[weather.main] || weather.main;

    const currentWeather: CurrentWeatherDto = {
      region:       region || `${lat}, ${lng}`,
      latitude:     lat,
      longitude:    lng,
      temperature:  Math.round(main.temp * 10) / 10,
      feelsLike:    Math.round(main.feels_like * 10) / 10,
      humidity:     main.humidity,
      windSpeed:    Math.round(wind.speed * 10) / 10,
      windGust:     wind.gust ? Math.round(wind.gust * 10) / 10 : null,
      windDirection: wind.deg,
      condition,
      description:  weather.description,
      icon:         weather.icon,
      cloudiness:   data.clouds.all,
      visibility:   data.visibility,
      rain:         data.rain ? data.rain['1h'] : null,
      pressure:     main.pressure,
      sunrise:      data.sys?.sunrise ? new Date(data.sys.sunrise * 1000) : null,
      sunset:       data.sys?.sunset  ? new Date(data.sys.sunset  * 1000) : null,
      isSafeForNavigation: true,
      safetyWarnings: [],
      alerts:       [],
      recordedAt:   new Date(),
    };

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

  private mapToForecast(data: any, region?: string): WeatherForecastDto {
    const dailyData = new Map<string, any[]>();

    data.list.forEach((item: any) => {
      const date = new Date(item.dt * 1000).toISOString().split('T')[0];
      if (!dailyData.has(date)) dailyData.set(date, []);
      dailyData.get(date)!.push(item);
    });

    const forecast: ForecastDayDto[] = Array.from(dailyData.entries())
      .slice(0, 5)
      .map(([dateStr, items]) => {
        const temps      = items.map((i) => i.main.temp);
        const rains      = items.map((i) => (i.rain ? i.rain['3h'] : 0));
        const mainWeather = items[Math.floor(items.length / 2)].weather[0];

        return {
          date:         new Date(dateStr),
          tempMin:      Math.round(Math.min(...temps) * 10) / 10,
          tempMax:      Math.round(Math.max(...temps) * 10) / 10,
          condition:    mainWeather.main,
          description:  mainWeather.description,
          icon:         mainWeather.icon,
          humidity:     Math.round(items.reduce((acc, i) => acc + i.main.humidity, 0) / items.length),
          windSpeed:    Math.round(items.reduce((acc, i) => acc + i.wind.speed, 0) / items.length * 10) / 10,
          rain:         Math.max(...rains),
          chanceOfRain: Math.round((items.filter((i) => i.rain).length / items.length) * 100),
        };
      });

    return { region: region || 'Coordenadas', forecast };
  }

  private async saveWeatherHistory(weather: CurrentWeatherDto): Promise<void> {
    const data = this.weatherRepo.create({
      region:             weather.region,
      latitude:           weather.latitude,
      longitude:          weather.longitude,
      temperature:        weather.temperature,
      feelsLike:          weather.feelsLike,
      humidity:           weather.humidity,
      windSpeed:          weather.windSpeed,
      windGust:           weather.windGust,
      windDeg:            weather.windDirection,
      condition:          weather.condition,
      description:        weather.description,
      icon:               weather.icon,
      cloudiness:         weather.cloudiness,
      visibility:         weather.visibility,
      rain:               weather.rain,
      pressure:           weather.pressure,
      isSafeForNavigation: weather.isSafeForNavigation,
      alerts:             weather.alerts.length > 0 ? JSON.stringify(weather.alerts) : null,
    });

    await this.weatherRepo.save(data);
    this.logger.debug(`💾 Histórico salvo: ${weather.region}`);
  }
}
