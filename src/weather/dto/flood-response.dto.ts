/**
 * DTOs para a integração com Google Flood Hub (Flood Forecasting API)
 *
 * Quando FLOOD_HUB_API_KEY não está no .env, o FloodService retorna
 * mocks com severity = 'NO_FLOODING' e source = 'mock' — sem erros.
 */

export type FloodSeverity = 'NO_FLOODING' | 'ABOVE_NORMAL' | 'SEVERE' | 'EXTREME';
export type FloodTrend    = 'INCREASING' | 'STEADY' | 'DECREASING';
export type InundationRisk = 'HIGH' | 'MEDIUM' | 'LOW';

// ─── FloodStatus ─────────────────────────────────────────────────────────────

export class FloodGaugeStatusDto {
  gaugeId: string;
  river?: string;
  location?: { lat: number; lng: number };
  severity: FloodSeverity;
  trend: FloodTrend;
  forecastChange?: number;
  issuedTime: string;
  qualityVerified: boolean;
}

export class FloodStatusDto {
  /** Pior severity encontrada na área pesquisada */
  severity: FloodSeverity;
  trend: FloodTrend;
  gauges: FloodGaugeStatusDto[];
  issuedTime: string;
  source: 'flood_hub' | 'mock';
  lat: number;
  lng: number;
  radiusKm: number;
}

// ─── GaugeModel (limiares em metros) ─────────────────────────────────────────

export class GaugeModelThresholdsDto {
  /** Nível de alerta (metros) */
  warningLevel?: number;
  /** Nível de perigo (metros) */
  dangerLevel?: number;
  /** Nível de perigo extremo (metros) */
  extremeDangerLevel?: number;
}

export class GaugeModelDto {
  gaugeId: string;
  river?: string;
  thresholds: GaugeModelThresholdsDto;
  source: 'flood_hub' | 'mock';
}

// ─── Forecast (série temporal 7 dias) ────────────────────────────────────────

export class FloodForecastPointDto {
  timestamp: string;      // ISO 8601
  level?: number;         // metros
  severity: FloodSeverity;
}

export class FloodForecastDto {
  gaugeId: string;
  river?: string;
  forecast: FloodForecastPointDto[];
  source: 'flood_hub' | 'mock';
}

// ─── InundationMap (overlay KML + polígonos) ──────────────────────────────────

export class InundationPolygonDto {
  risk: InundationRisk;
  coordinates: Array<{ lat: number; lng: number }>;
}

export class InundationMapDto {
  polygons: InundationPolygonDto[];
  /** KML string para overlay em mapa — presente quando source = 'flood_hub' */
  kml?: string;
  source: 'flood_hub' | 'mock';
}

// ─── Events (eventos significativos / severos) ────────────────────────────────

export class FloodEventDto {
  id: string;
  type: 'significant' | 'severe';
  severity: FloodSeverity;
  affectedPopulation?: number;
  areaKm2?: number;
  countries: string[];
  startTime?: string;
  description?: string;
}
