import {
  CurrentWeatherDto,
  ForecastDayDto,
  RiverLevelDto,
  WeatherForecastDto,
} from './dto/weather-response.dto';
import {
  OpenMeteoCurrentResponse,
  OpenMeteoForecastResponse,
  OwmCurrentResponse,
  OwmForecastItem,
  OwmForecastResponse,
} from './weather.provider.types';

const OWM_CONDITION_MAP: Record<string, string> = {
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

export function mapOwmToCurrentWeather(
  data: OwmCurrentResponse,
  lat: number,
  lng: number,
  region?: string,
): CurrentWeatherDto {
  const weather = data.weather[0];
  const main = data.main;
  const wind = data.wind;
  const condition = OWM_CONDITION_MAP[weather.main] || weather.main;

  const dto: CurrentWeatherDto = {
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
    visibility: data.visibility ?? 10000,
    rain: data.rain?.['1h'] ?? null,
    pressure: main.pressure,
    sunrise: data.sys?.sunrise ? new Date(data.sys.sunrise * 1000) : null,
    sunset: data.sys?.sunset ? new Date(data.sys.sunset * 1000) : null,
    uvIndex: null,
    isSafeForNavigation: true,
    safetyWarnings: [],
    alerts: [],
    recordedAt: new Date(),
  };

  applySafetyFlags(dto);
  return dto;
}

export function mapOwmForecast(
  data: OwmForecastResponse,
  region?: string,
): WeatherForecastDto {
  const dailyData = new Map<string, OwmForecastItem[]>();
  data.list.forEach((item) => {
    const date = new Date(item.dt * 1000).toISOString().split('T')[0];
    if (!dailyData.has(date)) {
      dailyData.set(date, []);
    }
    dailyData.get(date)?.push(item);
  });

  const forecast: ForecastDayDto[] = Array.from(dailyData.entries())
    .slice(0, 7)
    .map(([dateStr, items]) => {
      const temps = items.map((item) => item.main.temp);
      const rains = items.map((item) => item.rain?.['3h'] ?? 0);
      const mainWeather = items[Math.floor(items.length / 2)].weather[0];

      return {
        date: new Date(dateStr),
        tempMin: Math.round(Math.min(...temps) * 10) / 10,
        tempMax: Math.round(Math.max(...temps) * 10) / 10,
        condition: mainWeather.main,
        description: mainWeather.description,
        icon: mainWeather.icon,
        humidity: Math.round(
          items.reduce((acc, item) => acc + item.main.humidity, 0) /
            items.length,
        ),
        windSpeed:
          Math.round(
            (items.reduce((acc, item) => acc + item.wind.speed, 0) /
              items.length) *
              10,
          ) / 10,
        rain: Math.max(...rains),
        chanceOfRain: Math.round(
          (items.filter((item) => item.rain).length / items.length) * 100,
        ),
      };
    });

  return { region: region || 'Coordenadas', forecast };
}

export function mapOpenMeteoToCurrentWeather(
  data: OpenMeteoCurrentResponse,
  lat: number,
  lng: number,
  region?: string,
): CurrentWeatherDto {
  const current = data.current;
  const daily = data.daily;
  const { condition, description, icon } = mapWmoCondition(
    current.weather_code,
  );

  const dto: CurrentWeatherDto = {
    region: region || `${lat}, ${lng}`,
    latitude: lat,
    longitude: lng,
    temperature: Math.round(current.temperature_2m * 10) / 10,
    feelsLike: Math.round(current.apparent_temperature * 10) / 10,
    humidity: current.relative_humidity_2m,
    windSpeed: Math.round(current.wind_speed_10m * 10) / 10,
    windGust: current.wind_gusts_10m
      ? Math.round(current.wind_gusts_10m * 10) / 10
      : null,
    windDirection: current.wind_direction_10m,
    condition,
    description,
    icon,
    cloudiness: current.cloud_cover,
    visibility: current.visibility > 0 ? current.visibility : 10000,
    rain: current.precipitation > 0 ? current.precipitation : null,
    pressure: current.surface_pressure,
    sunrise: daily?.sunrise?.[0] ? new Date(daily.sunrise[0]) : null,
    sunset: daily?.sunset?.[0] ? new Date(daily.sunset[0]) : null,
    uvIndex: daily?.uv_index_max?.[0] ?? null,
    isSafeForNavigation: true,
    safetyWarnings: [],
    alerts: [],
    recordedAt: new Date(),
  };

  applySafetyFlags(dto);
  return dto;
}

export function mapOpenMeteoForecast(
  data: OpenMeteoForecastResponse,
  region?: string,
): WeatherForecastDto {
  const daily = data.daily;
  const forecast: ForecastDayDto[] = daily.time.map((dateStr, index) => {
    const { condition, description, icon } = mapWmoCondition(
      daily.weather_code[index],
    );

    return {
      date: new Date(dateStr),
      tempMin: daily.temperature_2m_min[index],
      tempMax: daily.temperature_2m_max[index],
      condition,
      description,
      icon,
      humidity: 0,
      windSpeed: daily.wind_speed_10m_max[index],
      rain: daily.precipitation_sum[index],
      chanceOfRain: daily.precipitation_probability_max?.[index] ?? 0,
    };
  });

  return { region: region || 'Coordenadas', forecast };
}

export function classifyRiverLevel(
  stationCode: string,
  levelCm: number | null,
  riverThresholds: Record<
    string,
    { low: number; attention: number; alert: number; emergency: number }
  >,
): RiverLevelDto['levelStatus'] {
  if (levelCm === null) {
    return 'unknown';
  }

  const thresholds = riverThresholds[stationCode] ?? {
    low: 300,
    attention: 1500,
    alert: 1700,
    emergency: 1900,
  };

  if (levelCm >= thresholds.emergency) return 'emergency';
  if (levelCm >= thresholds.alert) return 'alert';
  if (levelCm >= thresholds.attention) return 'attention';
  if (levelCm < thresholds.low) return 'low';
  return 'normal';
}

function applySafetyFlags(dto: CurrentWeatherDto): void {
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

function mapWmoCondition(code: number): {
  condition: string;
  description: string;
  icon: string;
} {
  if (code === 0) {
    return { condition: 'Ensolarado', description: 'céu limpo', icon: '01d' };
  }
  if (code === 1) {
    return {
      condition: 'Ensolarado',
      description: 'predominantemente limpo',
      icon: '01d',
    };
  }
  if (code === 2) {
    return {
      condition: 'Parcialmente Nublado',
      description: 'parcialmente nublado',
      icon: '02d',
    };
  }
  if (code === 3) {
    return { condition: 'Nublado', description: 'nublado', icon: '04d' };
  }
  if (code >= 45 && code <= 48) {
    return { condition: 'Nevoeiro', description: 'nevoeiro', icon: '50d' };
  }
  if (code >= 51 && code <= 55) {
    return { condition: 'Garoa', description: 'garoa', icon: '09d' };
  }
  if (code >= 61 && code <= 65) {
    return { condition: 'Chuva', description: 'chuva', icon: '10d' };
  }
  if (code >= 71 && code <= 77) {
    return { condition: 'Neve', description: 'neve', icon: '13d' };
  }
  if (code >= 80 && code <= 82) {
    return {
      condition: 'Chuva',
      description: 'pancadas de chuva',
      icon: '09d',
    };
  }
  if (code >= 95 && code <= 99) {
    return {
      condition: 'Tempestade',
      description: 'tempestade',
      icon: '11d',
    };
  }

  return { condition: 'Nublado', description: 'nublado', icon: '04d' };
}
