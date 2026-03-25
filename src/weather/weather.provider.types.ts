export interface OwmWeather {
  main: string;
  description: string;
  icon: string;
}

export interface OwmMain {
  temp: number;
  feels_like: number;
  humidity: number;
  pressure: number;
}

export interface OwmWind {
  speed: number;
  gust?: number;
  deg: number;
}

export interface OwmClouds {
  all: number;
}

export interface OwmSys {
  sunrise?: number;
  sunset?: number;
}

export interface OwmCurrentResponse {
  weather: OwmWeather[];
  main: OwmMain;
  wind: OwmWind;
  clouds: OwmClouds;
  visibility?: number;
  rain?: { '1h'?: number };
  sys?: OwmSys;
}

export interface OwmForecastItem {
  dt: number;
  main: { temp: number; humidity: number };
  weather: OwmWeather[];
  wind: { speed: number };
  rain?: { '3h'?: number };
}

export interface OwmForecastResponse {
  list: OwmForecastItem[];
}

export interface OpenMeteoCurrent {
  temperature_2m: number;
  relative_humidity_2m: number;
  apparent_temperature: number;
  precipitation: number;
  weather_code: number;
  cloud_cover: number;
  wind_speed_10m: number;
  wind_gusts_10m?: number;
  wind_direction_10m: number;
  surface_pressure: number;
  visibility: number;
}

export interface OpenMeteoCurrentResponse {
  current: OpenMeteoCurrent;
  daily?: {
    sunrise?: string[];
    sunset?: string[];
    uv_index_max?: number[];
  };
}

export interface OpenMeteoForecastResponse {
  daily: {
    time: string[];
    weather_code: number[];
    temperature_2m_min: number[];
    temperature_2m_max: number[];
    precipitation_sum: number[];
    precipitation_probability_max?: number[];
    wind_speed_10m_max: number[];
  };
}
