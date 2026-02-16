/**
 * DTOs para respostas da API de Clima
 */

export class CurrentWeatherDto {
  region: string;
  latitude: number;
  longitude: number;
  temperature: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  windGust: number | null;
  windDirection: number;
  condition: string;
  description: string;
  icon: string;
  cloudiness: number;
  visibility: number;
  rain: number | null;
  pressure: number;
  isSafeForNavigation: boolean;
  safetyWarnings: string[];
  alerts: any[];
  recordedAt: Date;
}

export class ForecastDayDto {
  date: Date;
  tempMin: number;
  tempMax: number;
  condition: string;
  description: string;
  icon: string;
  humidity: number;
  windSpeed: number;
  rain: number | null;
  chanceOfRain: number;
}

export class WeatherForecastDto {
  region: string;
  forecast: ForecastDayDto[];
}

export class WeatherAlertDto {
  event: string;
  severity: 'minor' | 'moderate' | 'severe' | 'extreme';
  description: string;
  start: Date;
  end: Date;
  regions: string[];
}

export class NavigationSafetyDto {
  isSafe: boolean;
  score: number; // 0-100
  warnings: string[];
  recommendations: string[];
  weather: CurrentWeatherDto;
}
