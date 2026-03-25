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
import { geocodeCity } from '../trips/city-coords';
import {
  CurrentWeatherDto,
  WeatherForecastDto,
  NavigationSafetyDto,
  RiverLevelDto,
  TripWeatherDto,
} from './dto/weather-response.dto';
import {
  classifyRiverLevel,
  mapOpenMeteoForecast,
  mapOpenMeteoToCurrentWeather,
  mapOwmForecast,
  mapOwmToCurrentWeather,
} from './weather.mapper';
import {
  OpenMeteoCurrentResponse,
  OpenMeteoForecastResponse,
  OwmCurrentResponse,
  OwmForecastResponse,
} from './weather.provider.types';

@Injectable()
export class WeatherService {
  private readonly logger = new Logger(WeatherService.name);
  private readonly apiKey: string;
  private readonly owmUrl = 'https://api.openweathermap.org/data/2.5';
  private readonly cacheTime = 1800; // 30 min

  private readonly regions: Record<
    string,
    { lat: number; lng: number; name: string }
  > = {
    manaus: { lat: -3.119, lng: -60.0217, name: 'Manaus' },
    parintins: { lat: -2.6287, lng: -56.7358, name: 'Parintins' },
    santarem: { lat: -2.4419, lng: -54.7082, name: 'SantarÃ©m' },
    itacoatiara: { lat: -3.143, lng: -58.4444, name: 'Itacoatiara' },
    manacapuru: { lat: -3.2999, lng: -60.6203, name: 'Manacapuru' },
    manaquiri: { lat: -3.4381, lng: -60.4547, name: 'Manaquiri' },
    iranduba: { lat: -3.2833, lng: -60.1833, name: 'Iranduba' },
    careiro: { lat: -3.7333, lng: -60.3833, name: 'Careiro' },
    autazes: { lat: -3.5781, lng: -59.13, name: 'Autazes' },
    borba: { lat: -4.3881, lng: -59.5942, name: 'Borba' },
    manicore: { lat: -5.8167, lng: -61.3, name: 'ManicorÃ©' },
    tefe: { lat: -3.3667, lng: -64.7167, name: 'TefÃ©' },
    coari: { lat: -4.0861, lng: -63.1408, name: 'Coari' },
    codajas: { lat: -3.8383, lng: -62.0597, name: 'CodajÃ¡s' },
    anori: { lat: -3.7667, lng: -61.65, name: 'Anori' },
    alvaraes: { lat: -3.2167, lng: -64.8, name: 'AlvarÃ£es' },
    fonte_boa: { lat: -2.5108, lng: -66.0919, name: 'Fonte Boa' },
    jutai: { lat: -2.7472, lng: -66.7717, name: 'Jutal' },
    labrea: { lat: -7.2594, lng: -64.7969, name: 'LÃ¡brea' },
    novo_aripuana: { lat: -5.1206, lng: -60.3783, name: 'Novo AripuanÃ£' },
    apui: { lat: -7.1897, lng: -59.8894, name: 'ApuÃ­' },
    boca_do_acre: { lat: -8.7508, lng: -67.3983, name: 'Boca do Acre' },
    benjamin_constant: {
      lat: -4.3778,
      lng: -70.0294,
      name: 'Benjamin Constant',
    },
    tabatinga: { lat: -4.2561, lng: -69.9394, name: 'Tabatinga' },
    sao_gabriel: {
      lat: -0.1303,
      lng: -67.0892,
      name: 'SÃ£o Gabriel da Cachoeira',
    },
    barcelos: { lat: -0.9769, lng: -62.9236, name: 'Barcelos' },
    novo_airao: { lat: -2.6167, lng: -60.9333, name: 'Novo AirÃ£o' },
    presidente_figueiredo: {
      lat: -2.0231,
      lng: -60.0244,
      name: 'Presidente Figueiredo',
    },
    maues: { lat: -3.3833, lng: -57.7167, name: 'MauÃ©s' },
    barreirinha: { lat: -2.7878, lng: -57.0556, name: 'Barreirinha' },
    nhamunda: { lat: -2.1839, lng: -56.7133, name: 'NhamundÃ¡' },
    urucara: { lat: -2.5319, lng: -57.7536, name: 'UrucarÃ¡' },
    nova_olinda: { lat: -3.8908, lng: -59.0936, name: 'Nova Olinda do Norte' },
    rio_preto: { lat: -0.8819, lng: -59.9906, name: 'Rio Preto da Eva' },
    carauari: { lat: -4.8822, lng: -66.8967, name: 'Carauari' },
    eirunepe: { lat: -6.6597, lng: -69.8742, name: 'EirunepÃ©' },
    envira: { lat: -7.4428, lng: -70.0253, name: 'Envira' },
    ipixuna: { lat: -7.0458, lng: -71.6997, name: 'Ipixuna' },
  };

  private readonly riverStations = {
    manaus: { code: '14100000', name: 'Manaus', river: 'Rio Negro' },
    parintins: { code: '13850001', name: 'Parintins', river: 'Rio Amazonas' },
    itacoatiara: {
      code: '14320000',
      name: 'Itacoatiara',
      river: 'Rio Amazonas',
    },
    manacapuru: {
      code: '14110000',
      name: 'Manacapuru',
      river: 'Rio SolimÃµes',
    },
  };

  private readonly riverThresholds: Record<
    string,
    { low: number; attention: number; alert: number; emergency: number }
  > = {
    '14100000': { low: 700, attention: 2700, alert: 2900, emergency: 3000 },
    '13850001': { low: 200, attention: 1000, alert: 1100, emergency: 1200 },
    '14320000': { low: 200, attention: 1100, alert: 1200, emergency: 1300 },
    '14110000': { low: 200, attention: 1400, alert: 1500, emergency: 1600 },
  };

  private readonly anaProxyUrl: string;

  constructor(
    @InjectRepository(WeatherData) private weatherRepo: Repository<WeatherData>,
    @InjectRepository(Trip) private tripsRepo: Repository<Trip>,
    @InjectRepository(Booking) private bookingsRepo: Repository<Booking>,
    private configService: ConfigService,
    private notificationsService: NotificationsService,
    private floodService: FloodService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {
    this.apiKey = this.configService.get<string>('OPENWEATHER_API_KEY') || '';
    if (!this.apiKey) {
      this.logger.warn(
        'âš ï¸  OPENWEATHER_API_KEY nÃ£o configurada â€” usando Open-Meteo como provider principal.',
      );
    }
    // ANA_PROXY_URL: Cloudflare Worker proxy (opcional). Se nÃ£o configurado, tenta ANA direto.
    this.anaProxyUrl =
      this.configService.get<string>('ANA_PROXY_URL') ||
      'https://telemetria.ana.gov.br/Share/DadosHidrometeorologicos.aspx';
    if (this.configService.get<string>('ANA_PROXY_URL')) {
      this.logger.log('ðŸŒŠ ANA: usando proxy Cloudflare Worker');
    }
  }

  private formatError(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }

  // â”€â”€â”€ API pÃºblica â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async getCurrentWeather(
    lat: number,
    lng: number,
    region?: string,
  ): Promise<CurrentWeatherDto> {
    const cacheKey = `weather:current:${lat}:${lng}`;

    const cached = await this.cacheManager.get<CurrentWeatherDto>(cacheKey);
    if (cached) return cached;

    // Tenta OpenWeatherMap se tiver key; fallback para Open-Meteo
    if (this.apiKey) {
      try {
        return await this.fetchOWMCurrent(lat, lng, region, cacheKey);
      } catch (err) {
        this.logger.warn(
          `OpenWeatherMap falhou, usando Open-Meteo: ${this.formatError(err)}`,
        );
      }
    }

    return this.fetchOpenMeteoCurrent(lat, lng, region, cacheKey);
  }

  private resolveRegion(regionKey: string): {
    lat: number;
    lng: number;
    name: string;
  } {
    const key = regionKey.toLowerCase().trim().replace(/\s+/g, '_');
    if (this.regions[key]) return this.regions[key];

    // Busca parcial (ex: "nova olinda" encontra "nova_olinda")
    const partial = Object.entries(this.regions).find(
      ([k]) => k.includes(key) || key.includes(k),
    );
    if (partial) return partial[1];

    // Fallback: geocodificar pelo nome usando lookup de cidades/comunidades do Amazonas
    const coords = geocodeCity(regionKey);
    if (coords) return { lat: coords.lat, lng: coords.lng, name: regionKey };

    // Ãšltimo recurso: Manaus (regiÃ£o central do Amazonas)
    this.logger.warn(
      `RegiÃ£o "${regionKey}" nÃ£o mapeada â€” usando Manaus como fallback`,
    );
    return {
      ...this.regions['manaus'],
      name: `${regionKey} (regiÃ£o de Manaus)`,
    };
  }

  async getRegionWeather(regionKey: string): Promise<CurrentWeatherDto> {
    const region = this.resolveRegion(regionKey);
    return this.getCurrentWeather(region.lat, region.lng, region.name);
  }

  async getRegionForecast(regionKey: string): Promise<WeatherForecastDto> {
    const region = this.resolveRegion(regionKey);
    return this.getForecast(region.lat, region.lng, region.name);
  }

  async getRegionAlerts(regionKey: string): Promise<{
    region: string;
    alerts: string[];
    isSafe: boolean;
    safetyScore: number;
    recommendations: string[];
  }> {
    const region = this.resolveRegion(regionKey);
    const safety = await this.evaluateNavigationSafety(region.lat, region.lng);
    return {
      region: region.name,
      alerts: safety.warnings,
      isSafe: safety.isSafe,
      safetyScore: safety.score,
      recommendations: safety.recommendations,
    };
  }

  async getForecast(
    lat: number,
    lng: number,
    region?: string,
  ): Promise<WeatherForecastDto> {
    const cacheKey = `weather:forecast:${lat}:${lng}`;

    const cached = await this.cacheManager.get<WeatherForecastDto>(cacheKey);
    if (cached) return cached;

    if (this.apiKey) {
      try {
        return await this.fetchOWMForecast(lat, lng, region, cacheKey);
      } catch (err) {
        this.logger.warn(
          `OWM forecast falhou, usando Open-Meteo: ${this.formatError(err)}`,
        );
      }
    }

    return this.fetchOpenMeteoForecast(lat, lng, region, cacheKey);
  }

  async evaluateNavigationSafety(
    lat: number,
    lng: number,
  ): Promise<NavigationSafetyDto> {
    const [weather, floodStatus] = await Promise.all([
      this.getCurrentWeather(lat, lng),
      this.floodService.getFloodStatus(lat, lng),
    ]);

    const warnings: string[] = [];
    const recommendations: string[] = [];
    let score = 100;

    // â”€â”€ CondiÃ§Ãµes meteorolÃ³gicas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Thresholds calibrados para o contexto do Amazonas (perÃ­odo chuvoso intenso)
    if (weather.windSpeed > 15) {
      warnings.push('Ventos fortes detectados');
      score -= 30;
      recommendations.push('Reduzir velocidade da embarcaÃ§Ã£o');
    }
    if (weather.windGust && weather.windGust > 20) {
      warnings.push('Rajadas de vento perigosas');
      score -= 40;
      recommendations.push('Considere adiar a viagem');
    }
    if (weather.rain && weather.rain > 15) {
      warnings.push('Chuva torrencial');
      score -= 20;
      recommendations.push('Tenha equipamentos de seguranÃ§a prontos');
    }
    if (weather.visibility < 500) {
      warnings.push('Visibilidade criticamente reduzida');
      score -= 35;
      recommendations.push('Use luzes de navegaÃ§Ã£o');
    }
    if (weather.condition.toLowerCase().includes('tempestade')) {
      warnings.push('ALERTA: Tempestade');
      score -= 50;
      recommendations.push('NÃƒO navegue! Aguarde melhora das condiÃ§Ãµes');
    }

    // â”€â”€ Risco de cheias (Flood Hub) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const floodSeverity = floodStatus.severity;
    const hasFloodRisk = floodSeverity !== 'NO_FLOODING';

    if (floodSeverity === 'ABOVE_NORMAL') {
      warnings.push('NÃ­vel fluvial acima do normal');
      score -= 15;
      recommendations.push(
        'AtenÃ§Ã£o redobrada â€” rio em nÃ­vel de atenÃ§Ã£o',
      );
    } else if (floodSeverity === 'SEVERE') {
      warnings.push('ALERTA: Cheia severa na Ã¡rea');
      score -= 30;
      recommendations.push(
        'Avalie a rota com cuidado â€” risco de cheia severa',
      );
    } else if (floodSeverity === 'EXTREME') {
      warnings.push('PERIGO: Cheia extrema â€” risco muito alto');
      score -= 50;
      recommendations.push('NÃƒO navegue! Cheia extrema registada na Ã¡rea');
    }

    const isSafe = score >= 60;
    if (isSafe && warnings.length === 0) {
      recommendations.push('CondiÃ§Ãµes favorÃ¡veis para navegaÃ§Ã£o');
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
    const trip = await this.tripsRepo.findOne({
      where: { id: tripId },
      relations: ['route'],
    });
    if (!trip) throw new NotFoundException('Viagem nÃ£o encontrada');

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
      key,
      name: value.name,
      latitude: value.lat,
      longitude: value.lng,
    }));
  }

  // â”€â”€â”€ Cron: alertas climÃ¡ticos (06h Manaus) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  @Cron('0 10 * * *', { timeZone: 'America/Manaus' })
  async checkScheduledTripsWeather(): Promise<void> {
    this.logger.log(
      'ðŸŒ¦ï¸  Verificando clima das viagens agendadas para hoje...',
    );

    const now = new Date();
    const startOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const endOfDay = new Date(startOfDay.getTime() + 86400000);

    const trips = await this.tripsRepo.find({
      where: {
        status: TripStatus.SCHEDULED,
        departureAt: Between(startOfDay, endOfDay),
      },
      relations: ['route'],
    });

    this.logger.log(`  â†’ ${trips.length} viagem(ns) agendadas hoje`);

    for (const trip of trips) {
      try {
        const lat = Number(trip.route?.originLat ?? this.regions.manaus.lat);
        const lng = Number(trip.route?.originLng ?? this.regions.manaus.lng);
        const safety = await this.evaluateNavigationSafety(lat, lng);

        if (!safety.isSafe) {
          const route = `${trip.origin} â†’ ${trip.destination}`;
          const warningText = safety.warnings.join(', ');

          await this.notificationsService.sendToUser(trip.captainId, {
            title: 'âš ï¸ Alerta de clima na sua viagem',
            body: `${route}: ${warningText}. Verifique as condiÃ§Ãµes antes de partir.`,
            data: { type: 'weather_alert', tripId: trip.id },
          });

          const bookings = await this.bookingsRepo.find({
            where: {
              tripId: trip.id,
              status: In([BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN]),
            },
          });

          for (const booking of bookings) {
            await this.notificationsService.sendToUser(booking.passengerId, {
              title: 'âš ï¸ Alerta de clima na sua viagem',
              body: `Viagem ${route}: condiÃ§Ãµes adversas previstas. Fique atento.`,
              data: {
                type: 'weather_alert',
                tripId: trip.id,
                bookingId: booking.id,
              },
            });
          }

          this.logger.warn(
            `${trip.id} (${route}): adverso - ${bookings.length} passageiro(s) notificado(s)`,
          );
        }
      } catch (err) {
        this.logger.error(
          `Erro ao verificar clima da viagem ${trip.id}: ${this.formatError(err)}`,
        );
      }
    }
  }

  // â”€â”€â”€ NÃ­vel dos rios (ANA) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  // Estimativas sazonais (cm) para fallback quando ANA estÃ¡ indisponÃ­vel.
  // Baseado em mÃ©dias histÃ³ricas por mÃªs â€” estaÃ§Ã£o chuvosa nov-jun, seca jul-out.
  private readonly seasonalEstimates: Record<string, number[]> = {
    // Rio Negro â€” Manaus: mÃªs 1=jan ... 12=dez
    '14100000': [
      2050, 2200, 2350, 2500, 2600, 2550, 2300, 1800, 1200, 900, 950, 1600,
    ],
    // Rio Amazonas â€” Parintins
    '13850001': [750, 820, 870, 900, 920, 880, 800, 650, 400, 280, 380, 620],
    // Rio Amazonas â€” Itacoatiara
    '14320000': [820, 890, 940, 970, 990, 950, 870, 700, 450, 320, 420, 680],
    // Rio SolimÃµes â€” Manacapuru
    '14110000': [
      1200, 1300, 1400, 1480, 1500, 1450, 1300, 1050, 700, 500, 650, 1000,
    ],
  };

  async getRiverLevel(stationCode: string): Promise<RiverLevelDto> {
    const cacheKey = `river:level:${stationCode}`;
    const cached = await this.cacheManager.get<RiverLevelDto>(cacheKey);
    if (cached) return cached;

    const stationInfo = Object.values(this.riverStations).find(
      (s) => s.code === stationCode,
    );

    // Tenta os Ãºltimos 2 dias (ANA publica com atraso de 1-2 dias)
    // Timeout curto (3s) para nÃ£o bloquear o cliente â€” cai rapidamente no fallback sazonal
    for (let daysBack = 0; daysBack <= 2; daysBack++) {
      try {
        const date = new Date();
        date.setDate(date.getDate() - daysBack);
        const dateStr = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;

        const response = await axios.get<string>(this.anaProxyUrl, {
          params: {
            CodEstacao: stationCode,
            DataInicio: dateStr,
            DataFim: dateStr,
            tipoDados: 3,
            nivelConsistencia: 1,
          },
          timeout: 3000,
          responseType: 'text',
          headers: {
            'User-Agent': 'Mozilla/5.0',
            Accept: 'application/xml, text/xml',
          },
        });

        const xml = response.data;
        const levelMatches = xml.match(/<Nivel>([\d.]+)<\/Nivel>/g) ?? [];
        const dateMatches = xml.match(/<DataHora>([^<]+)<\/DataHora>/g) ?? [];

        const lastLevel = levelMatches.length
          ? parseFloat(
              levelMatches[levelMatches.length - 1].replace(/<\/?Nivel>/g, ''),
            )
          : null;
        const lastDate = dateMatches.length
          ? dateMatches[dateMatches.length - 1].replace(/<\/?DataHora>/g, '')
          : null;

        if (lastLevel === null) continue; // tenta o dia anterior

        const result: RiverLevelDto = {
          station: stationInfo?.name ?? stationCode,
          stationCode,
          river: stationInfo?.river ?? 'Rio',
          levelCm: lastLevel,
          levelStatus: classifyRiverLevel(
            stationCode,
            lastLevel,
            this.riverThresholds,
          ),
          recordedAt: lastDate,
          source: 'ANA',
        };

        await this.cacheManager.set(cacheKey, result, 3600 * 1000);
        return result;
      } catch {
        // silencioso â€” tenta prÃ³ximo dia
      }
    }

    // Fallback: usa estimativa sazonal quando ANA estÃ¡ indisponÃ­vel
    this.logger.warn(
      `ANA indisponivel para estacao ${stationCode} - usando estimativa sazonal`,
    );
    const month = new Date().getMonth(); // 0-based
    const estimates = this.seasonalEstimates[stationCode];
    const levelCm = estimates ? estimates[month] : null;
    const now = new Date();
    const recordedAt = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} (estimativa)`;

    const result: RiverLevelDto = {
      station: stationInfo?.name ?? stationCode,
      stationCode,
      river: stationInfo?.river ?? 'Rio',
      levelCm,
      levelStatus: classifyRiverLevel(
        stationCode,
        levelCm,
        this.riverThresholds,
      ),
      recordedAt,
      source: 'estimate',
    };

    await this.cacheManager.set(cacheKey, result, 3600 * 1000);
    return result;
  }

  async getAllRiverLevels(): Promise<RiverLevelDto[]> {
    const timeout = <T>(ms: number, fallback: T): Promise<T> =>
      new Promise((resolve) => setTimeout(() => resolve(fallback), ms));

    const results = await Promise.all(
      Object.values(this.riverStations).map(async (s) => {
        try {
          // Garante que uma estaÃ§Ã£o nunca trava o endpoint por mais de 12s
          const level = await Promise.race([
            this.getRiverLevel(s.code),
            timeout<RiverLevelDto | null>(12000, null),
          ]);
          return level;
        } catch {
          return null;
        }
      }),
    );

    return results.filter((r): r is RiverLevelDto => r !== null);
  }

  // â”€â”€â”€ OpenWeatherMap â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  private async fetchOWMCurrent(
    lat: number,
    lng: number,
    region: string | undefined,
    cacheKey: string,
  ): Promise<CurrentWeatherDto> {
    const response = await axios.get<OwmCurrentResponse>(
      `${this.owmUrl}/weather`,
      {
        params: {
          lat,
          lon: lng,
          appid: this.apiKey,
          units: 'metric',
          lang: 'pt_br',
        },
      },
    );

    const weather = mapOwmToCurrentWeather(response.data, lat, lng, region);
    await this.cacheManager.set(cacheKey, weather, this.cacheTime * 1000);
    this.saveWeatherHistory(weather).catch((err) =>
      this.logger.error('Erro ao salvar histÃ³rico:', err),
    );
    return weather;
  }

  private async fetchOWMForecast(
    lat: number,
    lng: number,
    region: string | undefined,
    cacheKey: string,
  ): Promise<WeatherForecastDto> {
    const response = await axios.get<OwmForecastResponse>(
      `${this.owmUrl}/forecast`,
      {
        params: {
          lat,
          lon: lng,
          appid: this.apiKey,
          units: 'metric',
          lang: 'pt_br',
        },
      },
    );

    const forecast = mapOwmForecast(response.data, region);
    await this.cacheManager.set(cacheKey, forecast, this.cacheTime * 1000);
    return forecast;
  }

  // â”€â”€â”€ Open-Meteo (fallback gratuito, sem API key) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  private async fetchOpenMeteoCurrent(
    lat: number,
    lng: number,
    region: string | undefined,
    cacheKey: string,
  ): Promise<CurrentWeatherDto> {
    this.logger.log(
      `ðŸŒ¤  Open-Meteo: buscando clima em ${region || `${lat},${lng}`}...`,
    );

    const response = await axios.get<OpenMeteoCurrentResponse>(
      'https://api.open-meteo.com/v1/forecast',
      {
        params: {
          latitude: lat,
          longitude: lng,
          current: [
            'temperature_2m',
            'relative_humidity_2m',
            'apparent_temperature',
            'precipitation',
            'weather_code',
            'cloud_cover',
            'wind_speed_10m',
            'wind_gusts_10m',
            'wind_direction_10m',
            'surface_pressure',
            'visibility',
          ].join(','),
          daily: 'sunrise,sunset,uv_index_max',
          timezone: 'America/Manaus',
          forecast_days: 1,
        },
        timeout: 10000,
      },
    );

    const weather = mapOpenMeteoToCurrentWeather(
      response.data,
      lat,
      lng,
      region,
    );
    await this.cacheManager.set(cacheKey, weather, this.cacheTime * 1000);
    this.saveWeatherHistory(weather).catch((err) =>
      this.logger.error('Erro ao salvar histÃ³rico:', err),
    );
    return weather;
  }

  private async fetchOpenMeteoForecast(
    lat: number,
    lng: number,
    region: string | undefined,
    cacheKey: string,
  ): Promise<WeatherForecastDto> {
    this.logger.log(
      `ðŸ“… Open-Meteo: buscando previsÃ£o para ${region || `${lat},${lng}`}...`,
    );

    const response = await axios.get<OpenMeteoForecastResponse>(
      'https://api.open-meteo.com/v1/forecast',
      {
        params: {
          latitude: lat,
          longitude: lng,
          daily: [
            'weather_code',
            'temperature_2m_max',
            'temperature_2m_min',
            'precipitation_sum',
            'precipitation_probability_max',
            'wind_speed_10m_max',
          ].join(','),
          timezone: 'America/Manaus',
          forecast_days: 7,
        },
        timeout: 10000,
      },
    );

    const forecast = mapOpenMeteoForecast(response.data, region);
    await this.cacheManager.set(cacheKey, forecast, this.cacheTime * 1000);
    return forecast;
  }

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
  }
}
