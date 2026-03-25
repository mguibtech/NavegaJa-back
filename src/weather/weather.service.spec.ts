import { WeatherService } from './weather.service';

describe('WeatherService', () => {
  const createService = () => {
    const weatherRepo = {};
    const tripsRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
    };
    const bookingsRepo = {
      find: jest.fn(),
    };
    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'OPENWEATHER_API_KEY') {
          return 'owm-key';
        }
        return undefined;
      }),
    };
    const notificationsService = {
      sendToUser: jest.fn().mockResolvedValue(undefined),
    };
    const floodService = {
      getFloodStatus: jest.fn().mockResolvedValue({
        severity: 'NO_FLOODING',
      }),
    };
    const cacheManager = {
      get: jest.fn(),
      set: jest.fn(),
    };

    const service = new WeatherService(
      weatherRepo as never,
      tripsRepo as never,
      bookingsRepo as never,
      configService as never,
      notificationsService as never,
      floodService as never,
      cacheManager as never,
    );

    return {
      service,
      tripsRepo,
      bookingsRepo,
      configService,
      notificationsService,
      floodService,
      cacheManager,
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns cached current weather without calling external providers', async () => {
    const { service, cacheManager } = createService();
    const cachedWeather = {
      temperature: 29,
      condition: 'Sol',
      region: 'Manaus',
    };
    cacheManager.get.mockResolvedValue(cachedWeather);

    const fetchOWMCurrentSpy = jest.spyOn(
      service as never,
      'fetchOWMCurrent' as never,
    );
    const fetchOpenMeteoCurrentSpy = jest.spyOn(
      service as never,
      'fetchOpenMeteoCurrent' as never,
    );

    const result = await service.getCurrentWeather(-3.119, -60.0217, 'Manaus');

    expect(result).toBe(cachedWeather);
    expect(fetchOWMCurrentSpy).not.toHaveBeenCalled();
    expect(fetchOpenMeteoCurrentSpy).not.toHaveBeenCalled();
  });

  it('falls back to Open-Meteo when OpenWeatherMap fails', async () => {
    const { service, cacheManager } = createService();
    cacheManager.get.mockResolvedValue(null);

    const fetchOWMCurrentSpy = jest
      .spyOn(service as never, 'fetchOWMCurrent' as never)
      .mockRejectedValue(new Error('owm unavailable'));
    const fetchOpenMeteoCurrentSpy = jest
      .spyOn(service as never, 'fetchOpenMeteoCurrent' as never)
      .mockResolvedValue({
        temperature: 27,
        condition: 'Nublado',
        region: 'Manaus',
      });

    const result = await service.getCurrentWeather(-3.119, -60.0217, 'Manaus');

    expect(fetchOWMCurrentSpy).toHaveBeenCalled();
    expect(fetchOpenMeteoCurrentSpy).toHaveBeenCalledWith(
      -3.119,
      -60.0217,
      'Manaus',
      'weather:current:-3.119:-60.0217',
    );
    expect(result).toEqual({
      temperature: 27,
      condition: 'Nublado',
      region: 'Manaus',
    });
  });

  it('resolves partial region names when fetching weather by region', async () => {
    const { service } = createService();
    const getCurrentWeatherSpy = jest
      .spyOn(service, 'getCurrentWeather')
      .mockResolvedValue({
        temperature: 30,
        condition: 'Sol',
        region: 'Nova Olinda do Norte',
      } as never);

    await service.getRegionWeather('Nova Olinda');

    expect(getCurrentWeatherSpy).toHaveBeenCalledWith(
      -3.8908,
      -59.0936,
      'Nova Olinda do Norte',
    );
  });

  it('downgrades navigation safety when severe weather and flood risks are present', async () => {
    const { service, floodService } = createService();
    jest.spyOn(service, 'getCurrentWeather').mockResolvedValue({
      temperature: 26,
      condition: 'Tempestade severa',
      windSpeed: 18,
      windGust: 25,
      rain: 20,
      visibility: 400,
      region: 'Manaus',
    } as never);
    floodService.getFloodStatus.mockResolvedValue({
      severity: 'EXTREME',
    });

    const result = await service.evaluateNavigationSafety(-3.119, -60.0217);

    expect(result.isSafe).toBe(false);
    expect(result.score).toBe(0);
    expect(result.floodSeverity).toBe('EXTREME');
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        'Ventos fortes detectados',
        'Rajadas de vento perigosas',
        'Chuva torrencial',
        'Visibilidade criticamente reduzida',
        'ALERTA: Tempestade',
      ]),
    );
    expect(
      result.warnings.some((warning) => warning.includes('Cheia extrema')),
    ).toBe(true);
    expect(result.recommendations).toEqual(
      expect.arrayContaining(['Considere adiar a viagem']),
    );
    expect(
      result.recommendations.some((recommendation) =>
        recommendation.includes('Cheia extrema'),
      ),
    ).toBe(true);
  });
});
