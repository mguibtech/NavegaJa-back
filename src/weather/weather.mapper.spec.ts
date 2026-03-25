import {
  classifyRiverLevel,
  mapOpenMeteoForecast,
  mapOpenMeteoToCurrentWeather,
  mapOwmForecast,
  mapOwmToCurrentWeather,
} from './weather.mapper';

describe('weather.mapper', () => {
  it('maps OWM current weather and applies safety flags', () => {
    const result = mapOwmToCurrentWeather(
      {
        weather: [
          {
            main: 'Thunderstorm',
            description: 'tempestade forte',
            icon: '11d',
          },
        ],
        main: {
          temp: 31.567,
          feels_like: 34.52,
          humidity: 88,
          pressure: 1008,
        },
        wind: {
          speed: 18.23,
          gust: 24.9,
          deg: 280,
        },
        clouds: { all: 80 },
        visibility: 5000,
        rain: { '1h': 20.2 },
        sys: {
          sunrise: 1_700_000_000,
          sunset: 1_700_040_000,
        },
      },
      -3.1,
      -60.0,
      'Manaus',
    );

    expect(result.region).toBe('Manaus');
    expect(result.temperature).toBe(31.6);
    expect(result.windGust).toBe(24.9);
    expect(result.isSafeForNavigation).toBe(false);
    expect(result.safetyWarnings).toEqual(
      expect.arrayContaining(['Ventos fortes', 'Chuva torrencial']),
    );
    expect(
      result.safetyWarnings.some((warning) =>
        warning.toLowerCase().includes('tempestade'),
      ),
    ).toBe(true);
  });

  it('groups OWM forecast by date and computes aggregate metrics', () => {
    const result = mapOwmForecast(
      {
        list: [
          {
            dt: 1_735_689_600,
            main: { temp: 28, humidity: 80 },
            weather: [{ main: 'Rain', description: 'chuva', icon: '10d' }],
            wind: { speed: 10 },
            rain: { '3h': 2 },
          },
          {
            dt: 1_735_700_400,
            main: { temp: 31, humidity: 70 },
            weather: [{ main: 'Clouds', description: 'nublado', icon: '04d' }],
            wind: { speed: 8 },
          },
        ],
      },
      'Parintins',
    );

    expect(result.region).toBe('Parintins');
    expect(result.forecast).toHaveLength(1);
    expect(result.forecast[0]).toMatchObject({
      tempMin: 28,
      tempMax: 31,
      humidity: 75,
      windSpeed: 9,
      rain: 2,
      chanceOfRain: 50,
    });
  });

  it('maps Open-Meteo current weather and keeps default region fallback', () => {
    const result = mapOpenMeteoToCurrentWeather(
      {
        current: {
          temperature_2m: 27.4,
          relative_humidity_2m: 79,
          apparent_temperature: 28.8,
          precipitation: 0,
          weather_code: 0,
          cloud_cover: 5,
          wind_speed_10m: 6.6,
          wind_gusts_10m: 0,
          wind_direction_10m: 120,
          surface_pressure: 1012,
          visibility: 0,
        },
        daily: {
          sunrise: ['2030-01-01T10:00:00.000Z'],
          sunset: ['2030-01-01T22:00:00.000Z'],
          uv_index_max: [8.2],
        },
      },
      -2.5,
      -58.7,
    );

    expect(result.region).toBe('-2.5, -58.7');
    expect(result.visibility).toBe(10000);
    expect(result.condition).toBe('Ensolarado');
    expect(result.uvIndex).toBe(8.2);
  });

  it('maps Open-Meteo forecast for all WMO condition branches', () => {
    const codes = [0, 1, 2, 3, 45, 51, 61, 71, 80, 95, 999];
    const result = mapOpenMeteoForecast({
      daily: {
        time: codes.map((_, i) => `2030-01-${String(i + 1).padStart(2, '0')}`),
        weather_code: codes,
        temperature_2m_min: codes.map(() => 23),
        temperature_2m_max: codes.map(() => 31),
        precipitation_sum: codes.map((_, i) => i),
        precipitation_probability_max: codes.map((_, i) => i * 10),
        wind_speed_10m_max: codes.map(() => 12),
      },
    });

    expect(result.region).toBe('Coordenadas');
    expect(result.forecast).toHaveLength(codes.length);
    expect(result.forecast[0].condition).toBe('Ensolarado');
    expect(result.forecast[4].condition).toBe('Nevoeiro');
    expect(result.forecast[9].condition).toBe('Tempestade');
    expect(result.forecast[10].condition).toBe('Nublado');
  });

  it('classifies river level with default and custom thresholds', () => {
    const thresholds = {
      AM001: {
        low: 250,
        attention: 1400,
        alert: 1600,
        emergency: 1800,
      },
    };

    expect(classifyRiverLevel('AM001', null, thresholds)).toBe('unknown');
    expect(classifyRiverLevel('AM001', 200, thresholds)).toBe('low');
    expect(classifyRiverLevel('AM001', 1450, thresholds)).toBe('attention');
    expect(classifyRiverLevel('AM001', 1650, thresholds)).toBe('alert');
    expect(classifyRiverLevel('AM001', 1900, thresholds)).toBe('emergency');
    expect(classifyRiverLevel('UNKNOWN', 1000, thresholds)).toBe('normal');
  });
});
