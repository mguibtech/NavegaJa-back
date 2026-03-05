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
import { FloodService } from './flood.service';
import {
  CurrentWeatherDto,
  ForecastDayDto,
  WeatherForecastDto,
  NavigationSafetyDto,
  RiverLevelDto,
  TripWeatherDto,
} from './dto/weather-response.dto';

@Injectable()
export class WeatherService {
  private readonly logger = new Logger(WeatherService.name);
  private readonly apiKey: string;
  private readonly owmUrl   = 'https://api.openweathermap.org/data/2.5';
  private readonly cacheTime = 1800; // 30 min

  private readonly regions = {
    manaus:      { lat: -3.119,  lng: -60.0217, name: 'Manaus' },
    parintins:   { lat: -2.6287, lng: -56.7358, name: 'Parintins' },
    santarem:    { lat: -2.4419, lng: -54.7082, name: 'Santarém' },
    itacoatiara: { lat: -3.1430, lng: -58.4444, name: 'Itacoatiara' },
    manacapuru:  { lat: -3.2999, lng: -60.6203, name: 'Manacapuru' },
  };

  private readonly riverStations = {
    manaus:      { code: '14100000', name: 'Manaus',      river: 'Rio Negro' },
    parintins:   { code: '13850001', name: 'Parintins',   river: 'Rio Amazonas' },
    itacoatiara: { code: '14320000', name: 'Itacoatiara', river: 'Rio Amazonas' },
    manacapuru:  { code: '14110000', name: 'Manacapuru',  river: 'Rio Solimões' },
  };

  private readonly riverThresholds: Record<string, { low: number; attention: number; alert: number; emergency: number }> = {
    '14100000': { low: 700,  attention: 2700, alert: 2900, emergency: 3000 },
    '13850001': { low: 200,  attention: 1000, alert: 1100, emergency: 1200 },
    '14320000': { low: 200,  attention: 1100, alert: 1200, emergency: 1300 },
    '14110000': { low: 200,  attention: 1400, alert: 1500, emergency: 1600 },
  };

  private readonly anaProxyUrl: string;

  constructor(
    @InjectRepository(WeatherData) private weatherRepo: Repository<WeatherData>,
    @InjectRepository(Trip)        private tripsRepo: Repository<Trip>,
    @InjectRepository(Booking)     private bookingsRepo: Repository<Booking>,
    private configService: ConfigService,
    private notificationsService: NotificationsService,
    private floodService: FloodService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {
    this.apiKey = this.configService.get<string>('OPENWEATHER_API_KEY') || '';
    if (!this.apiKey) {
      this.logger.warn('⚠️  OPENWEATHER_API_KEY não configurada — usando Open-Meteo como provider principal.');
    }
    // ANA_PROXY_URL: Cloudflare Worker proxy (opcional). Se não configurado, tenta ANA direto.
    this.anaProxyUrl = this.configService.get<string>('ANA_PROXY_URL') || 'https://telemetria.ana.gov.br/Share/DadosHidrometeorologicos.aspx';
    if (this.configService.get<string>('ANA_PROXY_URL')) {
      this.logger.log('🌊 ANA: usando proxy Cloudflare Worker');
    }
  }

  // ─── API pública ─────────────────────────────────────────────────────────────

  async getCurrentWeather(lat: number, lng: number, region?: string): Promise<CurrentWeatherDto> {
    const cacheKey = `weather:current:${lat}:${lng}`;

    const cached = await this.cacheManager.get<CurrentWeatherDto>(cacheKey);
    if (cached) return cached;

    // Tenta OpenWeatherMap se tiver key; fallback para Open-Meteo
    if (this.apiKey) {
      try {
        return await this.fetchOWMCurrent(lat, lng, region, cacheKey);
      } catch (err) {
        this.logger.warn(`⚠️ OpenWeatherMap falhou, usando Open-Meteo: ${err.message}`);
      }
    }

    return this.fetchOpenMeteoCurrent(lat, lng, region, cacheKey);
  }

  async getRegionWeather(regionKey: string): Promise<CurrentWeatherDto> {
    const region = this.regions[regionKey.toLowerCase() as keyof typeof this.regions];
    if (!region) throw new Error(`Região "${regionKey}" não encontrada`);
    return this.getCurrentWeather(region.lat, region.lng, region.name);
  }

  async getRegionForecast(regionKey: string): Promise<WeatherForecastDto> {
    const region = this.regions[regionKey.toLowerCase() as keyof typeof this.regions];
    if (!region) throw new Error(`Região "${regionKey}" não encontrada`);
    return this.getForecast(region.lat, region.lng, region.name);
  }

  async getRegionAlerts(regionKey: string): Promise<{ region: string; alerts: string[]; isSafe: boolean; safetyScore: number; recommendations: string[] }> {
    const region = this.regions[regionKey.toLowerCase() as keyof typeof this.regions];
    if (!region) throw new Error(`Região "${regionKey}" não encontrada`);
    const safety = await this.evaluateNavigationSafety(region.lat, region.lng);
    return {
      region: region.name,
      alerts: safety.warnings,
      isSafe: safety.isSafe,
      safetyScore: safety.score,
      recommendations: safety.recommendations,
    };
  }

  async getForecast(lat: number, lng: number, region?: string): Promise<WeatherForecastDto> {
    const cacheKey = `weather:forecast:${lat}:${lng}`;

    const cached = await this.cacheManager.get<WeatherForecastDto>(cacheKey);
    if (cached) return cached;

    if (this.apiKey) {
      try {
        return await this.fetchOWMForecast(lat, lng, region, cacheKey);
      } catch (err) {
        this.logger.warn(`⚠️ OWM forecast falhou, usando Open-Meteo: ${err.message}`);
      }
    }

    return this.fetchOpenMeteoForecast(lat, lng, region, cacheKey);
  }

  async evaluateNavigationSafety(lat: number, lng: number): Promise<NavigationSafetyDto> {
    const [weather, floodStatus] = await Promise.all([
      this.getCurrentWeather(lat, lng),
      this.floodService.getFloodStatus(lat, lng),
    ]);

    const warnings: string[] = [];
    const recommendations: string[] = [];
    let score = 100;

    // ── Condições meteorológicas ──────────────────────────────────────────────
    // Thresholds calibrados para o contexto do Amazonas (período chuvoso intenso)
    if (weather.windSpeed > 15) {
      warnings.push('Ventos fortes detectados');
      score -= 30;
      recommendations.push('Reduzir velocidade da embarcação');
    }
    if (weather.windGust && weather.windGust > 20) {
      warnings.push('Rajadas de vento perigosas');
      score -= 40;
      recommendations.push('Considere adiar a viagem');
    }
    if (weather.rain && weather.rain > 15) {
      warnings.push('Chuva torrencial');
      score -= 20;
      recommendations.push('Tenha equipamentos de segurança prontos');
    }
    if (weather.visibility < 500) {
      warnings.push('Visibilidade criticamente reduzida');
      score -= 35;
      recommendations.push('Use luzes de navegação');
    }
    if (weather.condition.toLowerCase().includes('tempestade')) {
      warnings.push('ALERTA: Tempestade');
      score -= 50;
      recommendations.push('NÃO navegue! Aguarde melhora das condições');
    }

    // ── Risco de cheias (Flood Hub) ───────────────────────────────────────────
    const floodSeverity  = floodStatus.severity;
    const hasFloodRisk   = floodSeverity !== 'NO_FLOODING';

    if (floodSeverity === 'ABOVE_NORMAL') {
      warnings.push('Nível fluvial acima do normal');
      score -= 15;
      recommendations.push('Atenção redobrada — rio em nível de atenção');
    } else if (floodSeverity === 'SEVERE') {
      warnings.push('ALERTA: Cheia severa na área');
      score -= 30;
      recommendations.push('Avalie a rota com cuidado — risco de cheia severa');
    } else if (floodSeverity === 'EXTREME') {
      warnings.push('PERIGO: Cheia extrema — risco muito alto');
      score -= 50;
      recommendations.push('NÃO navegue! Cheia extrema registada na área');
    }

    const isSafe = score >= 60;
    if (isSafe && warnings.length === 0) {
      recommendations.push('Condições favoráveis para navegação');
    }

    return {
      isSafe,
      score: Math.max(0, score),
      warnings,
      recommendations,
      weather,
      floodSeverity,
      hasFloodRisk,
    };
  }

  async getTripWeather(tripId: string): Promise<TripWeatherDto> {
    const trip = await this.tripsRepo.findOne({ where: { id: tripId }, relations: ['route'] });
    if (!trip) throw new NotFoundException('Viagem não encontrada');

    const lat = Number(trip.route?.originLat ?? this.regions.manaus.lat);
    const lng = Number(trip.route?.originLng ?? this.regions.manaus.lng);

    const safety = await this.evaluateNavigationSafety(lat, lng);
    safety.weather.region = trip.origin || 'Manaus';

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

  getAvailableRegions() {
    return Object.entries(this.regions).map(([key, value]) => ({
      key, name: value.name, latitude: value.lat, longitude: value.lng,
    }));
  }

  // ─── Cron: alertas climáticos (06h Manaus) ───────────────────────────────────

  @Cron('0 10 * * *', { timeZone: 'America/Manaus' })
  async checkScheduledTripsWeather(): Promise<void> {
    this.logger.log('🌦️  Verificando clima das viagens agendadas para hoje...');

    const now        = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay   = new Date(startOfDay.getTime() + 86400000);

    const trips = await this.tripsRepo.find({
      where: { status: TripStatus.SCHEDULED, departureAt: Between(startOfDay, endOfDay) },
      relations: ['route'],
    });

    this.logger.log(`  → ${trips.length} viagem(ns) agendadas hoje`);

    for (const trip of trips) {
      try {
        const lat    = Number(trip.route?.originLat ?? this.regions.manaus.lat);
        const lng    = Number(trip.route?.originLng ?? this.regions.manaus.lng);
        const safety = await this.evaluateNavigationSafety(lat, lng);

        if (!safety.isSafe) {
          const route       = `${trip.origin} → ${trip.destination}`;
          const warningText = safety.warnings.join(', ');

          await this.notificationsService.sendToUser(trip.captainId, {
            title: '⚠️ Alerta de clima na sua viagem',
            body:  `${route}: ${warningText}. Verifique as condições antes de partir.`,
            data:  { type: 'weather_alert', tripId: trip.id },
          });

          const bookings = await this.bookingsRepo.find({
            where: { tripId: trip.id, status: In([BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN]) },
          });

          for (const booking of bookings) {
            await this.notificationsService.sendToUser(booking.passengerId, {
              title: '⚠️ Alerta de clima na sua viagem',
              body:  `Viagem ${route}: condições adversas previstas. Fique atento.`,
              data:  { type: 'weather_alert', tripId: trip.id, bookingId: booking.id },
            });
          }

          this.logger.warn(`  ⚠️  ${trip.id} (${route}): adverso — ${bookings.length} passageiro(s) notificado(s)`);
        }
      } catch (err) {
        this.logger.error(`Erro ao verificar clima da viagem ${trip.id}: ${err.message}`);
      }
    }
  }

  // ─── Nível dos rios (ANA) ────────────────────────────────────────────────────

  // Estimativas sazonais (cm) para fallback quando ANA está indisponível.
  // Baseado em médias históricas por mês — estação chuvosa nov-jun, seca jul-out.
  private readonly seasonalEstimates: Record<string, number[]> = {
    // Rio Negro — Manaus: mês 1=jan ... 12=dez
    '14100000': [2050, 2200, 2350, 2500, 2600, 2550, 2300, 1800, 1200,  900,  950, 1600],
    // Rio Amazonas — Parintins
    '13850001': [ 750,  820,  870,  900,  920,  880,  800,  650,  400,  280,  380,  620],
    // Rio Amazonas — Itacoatiara
    '14320000': [ 820,  890,  940,  970,  990,  950,  870,  700,  450,  320,  420,  680],
    // Rio Solimões — Manacapuru
    '14110000': [1200, 1300, 1400, 1480, 1500, 1450, 1300, 1050,  700,  500,  650, 1000],
  };

  async getRiverLevel(stationCode: string): Promise<RiverLevelDto> {
    const cacheKey   = `river:level:${stationCode}`;
    const cached     = await this.cacheManager.get<RiverLevelDto>(cacheKey);
    if (cached) return cached;

    const stationInfo = Object.values(this.riverStations).find(s => s.code === stationCode);

    // Tenta os últimos 3 dias (ANA publica com atraso de 1-2 dias)
    for (let daysBack = 0; daysBack <= 3; daysBack++) {
      try {
        const date    = new Date();
        date.setDate(date.getDate() - daysBack);
        const dateStr = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;

        const response = await axios.get(
          this.anaProxyUrl,
          {
            params: { CodEstacao: stationCode, DataInicio: dateStr, DataFim: dateStr, tipoDados: 3, nivelConsistencia: 1 },
            timeout: 8000,
            responseType: 'text',
            headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/xml, text/xml' },
          },
        );

        const xml          = response.data as string;
        const levelMatches = xml.match(/<Nivel>([\d.]+)<\/Nivel>/g) ?? [];
        const dateMatches  = xml.match(/<DataHora>([^<]+)<\/DataHora>/g) ?? [];

        const lastLevel = levelMatches.length
          ? parseFloat(levelMatches[levelMatches.length - 1].replace(/<\/?Nivel>/g, ''))
          : null;
        const lastDate = dateMatches.length
          ? dateMatches[dateMatches.length - 1].replace(/<\/?DataHora>/g, '')
          : null;

        if (lastLevel === null) continue; // tenta o dia anterior

        const result: RiverLevelDto = {
          station:     stationInfo?.name ?? stationCode,
          stationCode,
          river:       stationInfo?.river ?? 'Rio',
          levelCm:     lastLevel,
          levelStatus: this.classifyRiverLevel(stationCode, lastLevel),
          recordedAt:  lastDate,
          source:      'ANA',
        };

        await this.cacheManager.set(cacheKey, result, 3600 * 1000);
        return result;
      } catch (_err) {
        // silencioso — tenta próximo dia
      }
    }

    // Fallback: usa estimativa sazonal quando ANA está indisponível
    this.logger.warn(`⚠️ ANA indisponível para estação ${stationCode} — usando estimativa sazonal`);
    const month      = new Date().getMonth(); // 0-based
    const estimates  = this.seasonalEstimates[stationCode];
    const levelCm    = estimates ? estimates[month] : null;
    const now        = new Date();
    const recordedAt = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} (estimativa)`;

    const result: RiverLevelDto = {
      station:     stationInfo?.name ?? stationCode,
      stationCode,
      river:       stationInfo?.river ?? 'Rio',
      levelCm,
      levelStatus: this.classifyRiverLevel(stationCode, levelCm),
      recordedAt,
      source:      'estimate',
    };

    await this.cacheManager.set(cacheKey, result, 3600 * 1000);
    return result;
  }

  async getAllRiverLevels(): Promise<RiverLevelDto[]> {
    const results = await Promise.allSettled(
      Object.values(this.riverStations).map(s => this.getRiverLevel(s.code)),
    );
    return results
      .filter((r): r is PromiseFulfilledResult<RiverLevelDto> => r.status === 'fulfilled')
      .map(r => r.value);
  }

  // ─── OpenWeatherMap ──────────────────────────────────────────────────────────

  private async fetchOWMCurrent(
    lat: number, lng: number, region: string | undefined, cacheKey: string,
  ): Promise<CurrentWeatherDto> {
    const response = await axios.get(`${this.owmUrl}/weather`, {
      params: { lat, lon: lng, appid: this.apiKey, units: 'metric', lang: 'pt_br' },
    });

    const weather = this.mapOWMToCurrentWeather(response.data, lat, lng, region);
    await this.cacheManager.set(cacheKey, weather, this.cacheTime * 1000);
    this.saveWeatherHistory(weather).catch(err => this.logger.error('Erro ao salvar histórico:', err));
    return weather;
  }

  private async fetchOWMForecast(
    lat: number, lng: number, region: string | undefined, cacheKey: string,
  ): Promise<WeatherForecastDto> {
    const response = await axios.get(`${this.owmUrl}/forecast`, {
      params: { lat, lon: lng, appid: this.apiKey, units: 'metric', lang: 'pt_br' },
    });

    const forecast = this.mapOWMForecast(response.data, region);
    await this.cacheManager.set(cacheKey, forecast, this.cacheTime * 1000);
    return forecast;
  }

  // ─── Open-Meteo (fallback gratuito, sem API key) ─────────────────────────────

  private async fetchOpenMeteoCurrent(
    lat: number, lng: number, region: string | undefined, cacheKey: string,
  ): Promise<CurrentWeatherDto> {
    this.logger.log(`🌤  Open-Meteo: buscando clima em ${region || `${lat},${lng}`}...`);

    const response = await axios.get('https://api.open-meteo.com/v1/forecast', {
      params: {
        latitude:  lat,
        longitude: lng,
        current: [
          'temperature_2m', 'relative_humidity_2m', 'apparent_temperature',
          'precipitation', 'weather_code', 'cloud_cover',
          'wind_speed_10m', 'wind_gusts_10m', 'wind_direction_10m',
          'surface_pressure', 'visibility',
        ].join(','),
        daily:        'sunrise,sunset,uv_index_max',
        timezone:     'America/Manaus',
        forecast_days: 1,
      },
      timeout: 10000,
    });

    const weather = this.mapOpenMeteoToCurrentWeather(response.data, lat, lng, region);
    await this.cacheManager.set(cacheKey, weather, this.cacheTime * 1000);
    this.saveWeatherHistory(weather).catch(err => this.logger.error('Erro ao salvar histórico:', err));
    return weather;
  }

  private async fetchOpenMeteoForecast(
    lat: number, lng: number, region: string | undefined, cacheKey: string,
  ): Promise<WeatherForecastDto> {
    this.logger.log(`📅 Open-Meteo: buscando previsão para ${region || `${lat},${lng}`}...`);

    const response = await axios.get('https://api.open-meteo.com/v1/forecast', {
      params: {
        latitude:  lat,
        longitude: lng,
        daily: [
          'weather_code', 'temperature_2m_max', 'temperature_2m_min',
          'precipitation_sum', 'precipitation_probability_max',
          'wind_speed_10m_max',
        ].join(','),
        timezone:      'America/Manaus',
        forecast_days: 7,
      },
      timeout: 10000,
    });

    const forecast = this.mapOpenMeteoForecast(response.data, region);
    await this.cacheManager.set(cacheKey, forecast, this.cacheTime * 1000);
    return forecast;
  }

  // ─── Mappers OWM ─────────────────────────────────────────────────────────────

  private mapOWMToCurrentWeather(data: any, lat: number, lng: number, region?: string): CurrentWeatherDto {
    const w    = data.weather[0];
    const main = data.main;
    const wind = data.wind;

    const conditionMap: Record<string, string> = {
      Clear: 'Ensolarado', Clouds: 'Nublado', Rain: 'Chuva',
      Drizzle: 'Garoa', Thunderstorm: 'Tempestade', Snow: 'Neve',
      Mist: 'Névoa', Smoke: 'Fumaça', Haze: 'Neblina',
      Dust: 'Poeira', Fog: 'Nevoeiro', Sand: 'Areia',
      Ash: 'Cinzas', Squall: 'Rajada', Tornado: 'Tornado',
    };

    const condition = conditionMap[w.main] || w.main;
    const dto: CurrentWeatherDto = {
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
      description:  w.description,
      icon:         w.icon,
      cloudiness:   data.clouds.all,
      visibility:   data.visibility,
      rain:         data.rain ? data.rain['1h'] : null,
      pressure:     main.pressure,
      sunrise:      data.sys?.sunrise ? new Date(data.sys.sunrise * 1000) : null,
      sunset:       data.sys?.sunset  ? new Date(data.sys.sunset  * 1000) : null,
      uvIndex:      null, // OWM free não fornece UV
      isSafeForNavigation: true,
      safetyWarnings: [],
      alerts:       [],
      recordedAt:   new Date(),
    };

    this.applySafetyFlags(dto);
    return dto;
  }

  private mapOWMForecast(data: any, region?: string): WeatherForecastDto {
    const dailyData = new Map<string, any[]>();
    data.list.forEach((item: any) => {
      const date = new Date(item.dt * 1000).toISOString().split('T')[0];
      if (!dailyData.has(date)) dailyData.set(date, []);
      dailyData.get(date)!.push(item);
    });

    const forecast: ForecastDayDto[] = Array.from(dailyData.entries())
      .slice(0, 7)
      .map(([dateStr, items]) => {
        const temps       = items.map(i => i.main.temp);
        const rains       = items.map(i => i.rain ? i.rain['3h'] : 0);
        const mainWeather = items[Math.floor(items.length / 2)].weather[0];

        return {
          date:         new Date(dateStr),
          tempMin:      Math.round(Math.min(...temps) * 10) / 10,
          tempMax:      Math.round(Math.max(...temps) * 10) / 10,
          condition:    mainWeather.main,
          description:  mainWeather.description,
          icon:         mainWeather.icon,
          humidity:     Math.round(items.reduce((a, i) => a + i.main.humidity, 0) / items.length),
          windSpeed:    Math.round(items.reduce((a, i) => a + i.wind.speed, 0) / items.length * 10) / 10,
          rain:         Math.max(...rains),
          chanceOfRain: Math.round(items.filter(i => i.rain).length / items.length * 100),
        };
      });

    return { region: region || 'Coordenadas', forecast };
  }

  // ─── Mappers Open-Meteo ───────────────────────────────────────────────────────

  private mapOpenMeteoToCurrentWeather(data: any, lat: number, lng: number, region?: string): CurrentWeatherDto {
    const cur  = data.current;
    const daily = data.daily;

    const { condition, description, icon } = this.wmoToCondition(cur.weather_code);

    const dto: CurrentWeatherDto = {
      region:       region || `${lat}, ${lng}`,
      latitude:     lat,
      longitude:    lng,
      temperature:  Math.round(cur.temperature_2m * 10) / 10,
      feelsLike:    Math.round(cur.apparent_temperature * 10) / 10,
      humidity:     cur.relative_humidity_2m,
      windSpeed:    Math.round(cur.wind_speed_10m * 10) / 10,
      windGust:     cur.wind_gusts_10m ? Math.round(cur.wind_gusts_10m * 10) / 10 : null,
      windDirection: cur.wind_direction_10m,
      condition,
      description,
      icon,
      cloudiness:   cur.cloud_cover,
      visibility:   cur.visibility > 0 ? cur.visibility : 10000,
      rain:         cur.precipitation > 0 ? cur.precipitation : null,
      pressure:     cur.surface_pressure,
      sunrise:      daily?.sunrise?.[0] ? new Date(daily.sunrise[0]) : null,
      sunset:       daily?.sunset?.[0]  ? new Date(daily.sunset[0])  : null,
      uvIndex:      daily?.uv_index_max?.[0] ?? null,
      isSafeForNavigation: true,
      safetyWarnings: [],
      alerts:       [],
      recordedAt:   new Date(),
    };

    this.applySafetyFlags(dto);
    return dto;
  }

  private mapOpenMeteoForecast(data: any, region?: string): WeatherForecastDto {
    const d = data.daily;
    const forecast: ForecastDayDto[] = (d.time as string[]).map((dateStr, i) => {
      const { condition, description, icon } = this.wmoToCondition(d.weather_code[i]);
      return {
        date:         new Date(dateStr),
        tempMin:      d.temperature_2m_min[i],
        tempMax:      d.temperature_2m_max[i],
        condition,
        description,
        icon,
        humidity:     0, // não disponível no endpoint daily básico
        windSpeed:    d.wind_speed_10m_max[i],
        rain:         d.precipitation_sum[i],
        chanceOfRain: d.precipitation_probability_max[i] ?? 0,
      };
    });

    return { region: region || 'Coordenadas', forecast };
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private applySafetyFlags(dto: CurrentWeatherDto): void {
    if (dto.windSpeed > 15 || (dto.windGust && dto.windGust > 20)) {
      dto.isSafeForNavigation = false;
      dto.safetyWarnings.push('Ventos fortes');
    }
    if (dto.rain && dto.rain > 15) {
      dto.safetyWarnings.push('Chuva torrencial');
    }
    if (dto.condition.toLowerCase().includes('tempestade')) {
      dto.isSafeForNavigation = false;
      dto.safetyWarnings.push('TEMPESTADE - Não navegue!');
    }
  }

  /** Mapeia WMO weather codes (Open-Meteo) para português */
  private wmoToCondition(code: number): { condition: string; description: string; icon: string } {
    if (code === 0)                      return { condition: 'Ensolarado',          description: 'céu limpo',               icon: '01d' };
    if (code === 1)                      return { condition: 'Ensolarado',          description: 'predominantemente limpo',  icon: '01d' };
    if (code === 2)                      return { condition: 'Parcialmente Nublado',description: 'parcialmente nublado',     icon: '02d' };
    if (code === 3)                      return { condition: 'Nublado',             description: 'nublado',                  icon: '04d' };
    if (code >= 45 && code <= 48)        return { condition: 'Nevoeiro',            description: 'nevoeiro',                 icon: '50d' };
    if (code >= 51 && code <= 55)        return { condition: 'Garoa',               description: 'garoa',                    icon: '09d' };
    if (code >= 61 && code <= 65)        return { condition: 'Chuva',               description: 'chuva',                    icon: '10d' };
    if (code >= 71 && code <= 77)        return { condition: 'Neve',                description: 'neve',                     icon: '13d' };
    if (code >= 80 && code <= 82)        return { condition: 'Chuva',               description: 'pancadas de chuva',        icon: '09d' };
    if (code >= 95 && code <= 99)        return { condition: 'Tempestade',          description: 'tempestade',               icon: '11d' };
    return                                      { condition: 'Nublado',             description: 'nublado',                  icon: '04d' };
  }

  private classifyRiverLevel(stationCode: string, levelCm: number | null): RiverLevelDto['levelStatus'] {
    if (levelCm === null) return 'unknown';
    const t = this.riverThresholds[stationCode] ?? { low: 300, attention: 1500, alert: 1700, emergency: 1900 };
    if (levelCm >= t.emergency) return 'emergency';
    if (levelCm >= t.alert)     return 'alert';
    if (levelCm >= t.attention) return 'attention';
    if (levelCm < t.low)        return 'low';
    return 'normal';
  }

  private async saveWeatherHistory(weather: CurrentWeatherDto): Promise<void> {
    const data = this.weatherRepo.create({
      region:              weather.region,
      latitude:            weather.latitude,
      longitude:           weather.longitude,
      temperature:         weather.temperature,
      feelsLike:           weather.feelsLike,
      humidity:            weather.humidity,
      windSpeed:           weather.windSpeed,
      windGust:            weather.windGust,
      windDeg:             weather.windDirection,
      condition:           weather.condition,
      description:         weather.description,
      icon:                weather.icon,
      cloudiness:          weather.cloudiness,
      visibility:          weather.visibility,
      rain:                weather.rain,
      pressure:            weather.pressure,
      isSafeForNavigation: weather.isSafeForNavigation,
      alerts:              weather.alerts.length > 0 ? JSON.stringify(weather.alerts) : null,
    });
    await this.weatherRepo.save(data);
  }
}
