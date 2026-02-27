import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import axios from 'axios';
import {
  FloodSeverity,
  FloodTrend,
  FloodStatusDto,
  FloodGaugeStatusDto,
  GaugeModelDto,
  FloodForecastDto,
  FloodForecastPointDto,
  InundationMapDto,
  FloodEventDto,
} from './dto/flood-response.dto';

@Injectable()
export class FloodService {
  private readonly logger    = new Logger(FloodService.name);
  private readonly apiKey:   string;
  private readonly isEnabled: boolean;
  private readonly baseUrl   = 'https://floodforecasting.googleapis.com/v1';

  constructor(
    private configService: ConfigService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {
    this.apiKey    = this.configService.get<string>('FLOOD_HUB_API_KEY') || '';
    this.isEnabled = !!this.apiKey;

    if (!this.isEnabled) {
      this.logger.warn('⚠️  FLOOD_HUB_API_KEY não configurada — Flood Hub desativado (mock: NO_FLOODING)');
    } else {
      this.logger.log('🌊 Flood Hub API ativada');
    }
  }

  // ─── Exposto para WeatherService (injeção de severidade no safety score) ─────

  /** Indica se a API real está disponível. Útil para o app mostrar disclaimer. */
  get enabled(): boolean {
    return this.isEnabled;
  }

  // ─── getFloodStatus ──────────────────────────────────────────────────────────

  /**
   * Retorna o status de cheia actual para uma área circular.
   * Cache: 15 min (a API actualiza várias vezes por dia).
   * Fallback: mock com severity = 'NO_FLOODING' se API não disponível.
   */
  async getFloodStatus(lat: number, lng: number, radiusKm = 50): Promise<FloodStatusDto> {
    const cacheKey = `flood:status:${lat}:${lng}:${radiusKm}`;
    const cached   = await this.cacheManager.get<FloodStatusDto>(cacheKey);
    if (cached) return cached;

    if (!this.isEnabled) return this.mockFloodStatus(lat, lng, radiusKm);

    try {
      const response = await axios.post(
        `${this.baseUrl}/floodStatus:searchLatestFloodStatusByArea`,
        {
          area: {
            circle: {
              center: { latitude: lat, longitude: lng },
              radius: radiusKm * 1000, // API espera metros
            },
          },
        },
        { headers: this.authHeaders, timeout: 10000 },
      );

      const statuses: any[] = response.data?.floodStatuses ?? [];

      const gauges: FloodGaugeStatusDto[] = statuses.map(s => ({
        gaugeId:        s.gaugeId,
        river:          s.river,
        location:       s.gaugeLocation
          ? { lat: s.gaugeLocation.latitude, lng: s.gaugeLocation.longitude }
          : undefined,
        severity:       this.normalizeSeverity(s.severity),
        trend:          this.normalizeTrend(s.forecastTrend),
        forecastChange: s.forecastChange,
        issuedTime:     s.issuedTime ?? new Date().toISOString(),
        qualityVerified: s.qualityVerified ?? false,
      }));

      const result: FloodStatusDto = {
        severity:   this.worstSeverity(gauges.map(g => g.severity)),
        trend:      this.dominantTrend(gauges.map(g => g.trend)),
        gauges,
        issuedTime: gauges[0]?.issuedTime ?? new Date().toISOString(),
        source:     'flood_hub',
        lat, lng, radiusKm,
      };

      await this.cacheManager.set(cacheKey, result, 15 * 60 * 1000);
      return result;
    } catch (err) {
      this.logger.error(`Flood Hub status falhou: ${err.message} — retornando mock`);
      return this.mockFloodStatus(lat, lng, radiusKm);
    }
  }

  // ─── getGaugeModel ───────────────────────────────────────────────────────────

  /**
   * Retorna os limiares (warning / danger / extreme) de uma estação em metros.
   * Cache: 1h (limiares raramente mudam).
   */
  async getGaugeModel(gaugeId: string): Promise<GaugeModelDto> {
    const cacheKey = `flood:gauge-model:${gaugeId}`;
    const cached   = await this.cacheManager.get<GaugeModelDto>(cacheKey);
    if (cached) return cached;

    if (!this.isEnabled) return this.mockGaugeModel(gaugeId);

    try {
      const response = await axios.get(
        `${this.baseUrl}/gaugeModels/${encodeURIComponent(gaugeId)}`,
        { headers: this.authHeaders, timeout: 10000 },
      );

      const data   = response.data;
      const result: GaugeModelDto = {
        gaugeId,
        river: data.river,
        thresholds: {
          warningLevel:      data.thresholds?.warningLevel,
          dangerLevel:       data.thresholds?.dangerLevel,
          extremeDangerLevel: data.thresholds?.extremeDangerLevel,
        },
        source: 'flood_hub',
      };

      await this.cacheManager.set(cacheKey, result, 60 * 60 * 1000);
      return result;
    } catch (err) {
      this.logger.error(`Flood Hub gauge model falhou (${gaugeId}): ${err.message}`);
      return this.mockGaugeModel(gaugeId);
    }
  }

  // ─── getGaugeForecast ────────────────────────────────────────────────────────

  /**
   * Previsão hidrológica de até 7 dias para uma estação específica.
   * Cache: 2h.
   */
  async getGaugeForecast(gaugeId: string, days = 7): Promise<FloodForecastDto> {
    const cacheKey = `flood:forecast:${gaugeId}:${days}`;
    const cached   = await this.cacheManager.get<FloodForecastDto>(cacheKey);
    if (cached) return cached;

    if (!this.isEnabled) return this.mockForecast(gaugeId, days);

    try {
      const response = await axios.get(
        `${this.baseUrl}/gauges/${encodeURIComponent(gaugeId)}:queryForecasts`,
        { headers: this.authHeaders, timeout: 10000 },
      );

      // A API retorna uma lista de forecasts emitidos; usamos o mais recente
      const forecasts: any[] = response.data?.forecasts ?? [];
      const latest           = forecasts[forecasts.length - 1];
      const levels: any[]    = latest?.levels ?? [];

      const forecast: FloodForecastPointDto[] = levels
        .slice(0, days * 24) // max 1 ponto/hora por 7 dias
        .map(l => ({
          timestamp: l.validTime,
          level:     l.level,
          severity:  this.normalizeSeverity(l.severity),
        }));

      const result: FloodForecastDto = {
        gaugeId,
        river:    response.data?.river,
        forecast,
        source:   'flood_hub',
      };

      await this.cacheManager.set(cacheKey, result, 2 * 60 * 60 * 1000);
      return result;
    } catch (err) {
      this.logger.error(`Flood Hub forecast falhou (${gaugeId}): ${err.message}`);
      return this.mockForecast(gaugeId, days);
    }
  }

  // ─── getFloodEvents ──────────────────────────────────────────────────────────

  /**
   * Eventos de cheia significativos e severos numa área.
   * Retorna [] quando API não disponível (sem mock — ausência de dados é correcta).
   * Cache: 30 min.
   */
  async getFloodEvents(lat: number, lng: number, radiusKm = 500): Promise<FloodEventDto[]> {
    const cacheKey = `flood:events:${lat}:${lng}:${radiusKm}`;
    const cached   = await this.cacheManager.get<FloodEventDto[]>(cacheKey);
    if (cached) return cached;

    if (!this.isEnabled) return [];

    try {
      const body = {
        area: {
          circle: {
            center: { latitude: lat, longitude: lng },
            radius: radiusKm * 1000,
          },
        },
      };

      const [sigRes, sevRes] = await Promise.allSettled([
        axios.post(`${this.baseUrl}/floodStatus:searchLatestSignificantEvents`, body, {
          headers: this.authHeaders, timeout: 10000,
        }),
        axios.post(`${this.baseUrl}/floodStatus:searchSevereEvents`, body, {
          headers: this.authHeaders, timeout: 10000,
        }),
      ]);

      const events: FloodEventDto[] = [];

      if (sigRes.status === 'fulfilled') {
        const items: any[] = sigRes.value.data?.events ?? [];
        items.forEach(e => events.push({
          id:                 e.id ?? `sig-${Date.now()}`,
          type:               'significant',
          severity:           this.normalizeSeverity(e.severity),
          affectedPopulation: e.affectedPopulation,
          areaKm2:            e.areaKm2,
          countries:          e.countries ?? [],
          startTime:          e.startTime,
          description:        e.description,
        }));
      }

      if (sevRes.status === 'fulfilled') {
        const items: any[] = sevRes.value.data?.events ?? [];
        items.forEach(e => events.push({
          id:                 e.id ?? `sev-${Date.now()}`,
          type:               'severe',
          severity:           this.normalizeSeverity(e.severity),
          affectedPopulation: e.affectedPopulation,
          areaKm2:            e.areaKm2,
          countries:          e.countries ?? [],
          startTime:          e.startTime,
          description:        e.description,
        }));
      }

      await this.cacheManager.set(cacheKey, events, 30 * 60 * 1000);
      return events;
    } catch (err) {
      this.logger.error(`Flood Hub events falhou: ${err.message}`);
      return [];
    }
  }

  // ─── getInundationMap ────────────────────────────────────────────────────────

  /**
   * Polígonos de inundação (HIGH/MEDIUM/LOW) e KML para overlay no mapa.
   * Cache: 30 min.
   */
  async getInundationMap(lat: number, lng: number, radiusKm = 50): Promise<InundationMapDto> {
    const cacheKey = `flood:inundation:${lat}:${lng}:${radiusKm}`;
    const cached   = await this.cacheManager.get<InundationMapDto>(cacheKey);
    if (cached) return cached;

    if (!this.isEnabled) return { polygons: [], source: 'mock' };

    try {
      const response = await axios.post(
        `${this.baseUrl}/inundationMaps:search`,
        {
          area: {
            circle: {
              center: { latitude: lat, longitude: lng },
              radius: radiusKm * 1000,
            },
          },
        },
        { headers: this.authHeaders, timeout: 10000 },
      );

      const maps: any[] = response.data?.inundationMaps ?? [];
      const polygons = maps.flatMap(m =>
        (m.inundationMapSet ?? []).map((s: any) => ({
          risk: (s.inundationLevel ?? 'LOW') as any,
          coordinates: (s.polygon?.coordinates ?? []).map((c: any) => ({
            lat: c.latitude,
            lng: c.longitude,
          })),
        })),
      );

      const result: InundationMapDto = {
        polygons,
        kml:    response.data?.kml,
        source: 'flood_hub',
      };

      await this.cacheManager.set(cacheKey, result, 30 * 60 * 1000);
      return result;
    } catch (err) {
      this.logger.error(`Flood Hub inundation falhou: ${err.message}`);
      return { polygons: [], source: 'mock' };
    }
  }

  // ─── Normalizers ──────────────────────────────────────────────────────────────

  /** Converte qualquer formato de severity (API real ou mock legado) para o tipo normalizado */
  normalizeSeverity(raw: string): FloodSeverity {
    const map: Record<string, FloodSeverity> = {
      NO_FLOODING:               'NO_FLOODING',
      ABOVE_NORMAL:              'ABOVE_NORMAL',
      SEVERE:                    'SEVERE',
      EXTREME:                   'EXTREME',
      FLOOD_SEVERITY_UNSPECIFIED: 'NO_FLOODING',
      // valores legados do mock anterior (app React Native)
      WATCH:                     'ABOVE_NORMAL',
      WARNING:                   'SEVERE',
      EMERGENCY:                 'EXTREME',
    };
    return map[raw] ?? 'NO_FLOODING';
  }

  private normalizeTrend(raw: string): FloodTrend {
    const map: Record<string, FloodTrend> = {
      INCREASING:               'INCREASING',
      STEADY:                   'STEADY',
      DECREASING:               'DECREASING',
      FORECAST_TREND_UNSPECIFIED: 'STEADY',
    };
    return map[raw] ?? 'STEADY';
  }

  private worstSeverity(severities: FloodSeverity[]): FloodSeverity {
    const order: FloodSeverity[] = ['NO_FLOODING', 'ABOVE_NORMAL', 'SEVERE', 'EXTREME'];
    return severities.reduce(
      (worst, s) => order.indexOf(s) > order.indexOf(worst) ? s : worst,
      'NO_FLOODING' as FloodSeverity,
    );
  }

  private dominantTrend(trends: FloodTrend[]): FloodTrend {
    const counts = { INCREASING: 0, STEADY: 0, DECREASING: 0 };
    trends.forEach(t => counts[t]++);
    if (counts.INCREASING >= counts.DECREASING && counts.INCREASING >= counts.STEADY) return 'INCREASING';
    if (counts.DECREASING > counts.INCREASING && counts.DECREASING >= counts.STEADY)  return 'DECREASING';
    return 'STEADY';
  }

  // ─── Mocks ────────────────────────────────────────────────────────────────────

  private mockFloodStatus(lat: number, lng: number, radiusKm: number): FloodStatusDto {
    return {
      severity:   'NO_FLOODING',
      trend:      'STEADY',
      gauges:     [],
      issuedTime: new Date().toISOString(),
      source:     'mock',
      lat, lng, radiusKm,
    };
  }

  private mockGaugeModel(gaugeId: string): GaugeModelDto {
    return {
      gaugeId,
      thresholds: {},
      source: 'mock',
    };
  }

  private mockForecast(gaugeId: string, days: number): FloodForecastDto {
    const now      = Date.now();
    const forecast = Array.from({ length: days }, (_, i) => ({
      timestamp: new Date(now + i * 86_400_000).toISOString(),
      level:     undefined,
      severity:  'NO_FLOODING' as FloodSeverity,
    }));
    return { gaugeId, forecast, source: 'mock' };
  }

  // ─── Helpers privados ─────────────────────────────────────────────────────────

  private get authHeaders() {
    return {
      'x-goog-api-key': this.apiKey,
      'Content-Type':   'application/json',
    };
  }
}
