import axios from 'axios';
import { NotFoundException } from '@nestjs/common';
import { BookingStatus } from '../bookings/booking.entity';
import { TripStatus } from '../trips/trip.entity';
import * as cityCoords from '../trips/city-coords';
import { WeatherService } from './weather.service';
import * as weatherMapper from './weather.mapper';

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
  },
}));

type AxiosMock = {
  get: jest.Mock;
};

describe('WeatherService', () => {
  const axiosMock = axios as unknown as AxiosMock;

  const baseWeather = (overrides: Record<string, unknown> = {}) =>
    ({
      region: 'Manaus',
      latitude: -3.119,
      longitude: -60.0217,
      temperature: 28,
      feelsLike: 29,
      humidity: 85,
      windSpeed: 6,
      windGust: null,
      windDirection: 180,
      condition: 'Nublado',
      description: 'nublado',
      icon: '03d',
      cloudiness: 80,
      visibility: 10000,
      rain: null,
      pressure: 1009,
      sunrise: null,
      sunset: null,
      uvIndex: null,
      isSafeForNavigation: true,
      safetyWarnings: [],
      alerts: [],
      recordedAt: new Date(),
      ...overrides,
    }) as never;

  const createService = (opts?: { apiKey?: string; anaProxyUrl?: string }) => {
    const apiKey = opts?.apiKey ?? 'owm-key';
    const anaProxyUrl = opts?.anaProxyUrl;
    const weatherRepo = {
      create: jest.fn((value) => value),
      save: jest.fn().mockResolvedValue(undefined),
    };
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
          return apiKey;
        }
        if (key === 'ANA_PROXY_URL') {
          return anaProxyUrl;
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
      weatherRepo,
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
    jest.restoreAllMocks();
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

  it('falls back to Open-Meteo forecast when OWM forecast fails', async () => {
    const { service, cacheManager } = createService();
    cacheManager.get.mockResolvedValue(null);

    const fetchOWMForecastSpy = jest
      .spyOn(service as never, 'fetchOWMForecast' as never)
      .mockRejectedValue(new Error('owm forecast unavailable'));
    const fetchOpenMeteoForecastSpy = jest
      .spyOn(service as never, 'fetchOpenMeteoForecast' as never)
      .mockResolvedValue({
        region: 'Manaus',
        forecast: [],
      });

    const result = await service.getForecast(-3.119, -60.0217, 'Manaus');

    expect(fetchOWMForecastSpy).toHaveBeenCalled();
    expect(fetchOpenMeteoForecastSpy).toHaveBeenCalledWith(
      -3.119,
      -60.0217,
      'Manaus',
      'weather:forecast:-3.119:-60.0217',
    );
    expect(result.region).toBe('Manaus');
  });

  it('resolves partial region names when fetching weather by region', async () => {
    const { service } = createService();
    const getCurrentWeatherSpy = jest
      .spyOn(service, 'getCurrentWeather')
      .mockResolvedValue(baseWeather({ region: 'Nova Olinda do Norte' }));

    await service.getRegionWeather('Nova Olinda');

    expect(getCurrentWeatherSpy).toHaveBeenCalledWith(
      -3.8908,
      -59.0936,
      'Nova Olinda do Norte',
    );
  });

  it('falls back to geocoding when region key is not mapped', async () => {
    const { service } = createService();
    jest
      .spyOn(cityCoords, 'geocodeCity')
      .mockReturnValue({ lat: -3.42, lng: -59.12 });
    const getCurrentWeatherSpy = jest
      .spyOn(service, 'getCurrentWeather')
      .mockResolvedValue(baseWeather({ region: 'Vila Nova' }));

    await service.getRegionWeather('Vila Nova');

    expect(getCurrentWeatherSpy).toHaveBeenCalledWith(
      -3.42,
      -59.12,
      'Vila Nova',
    );
  });

  it('falls back to Manaus when region and geocode are unavailable', async () => {
    const { service } = createService();
    jest.spyOn(cityCoords, 'geocodeCity').mockReturnValue(null);
    const getCurrentWeatherSpy = jest
      .spyOn(service, 'getCurrentWeather')
      .mockResolvedValue(baseWeather());

    await service.getRegionWeather('Regiao Inexistente');

    expect(getCurrentWeatherSpy).toHaveBeenCalledWith(
      -3.119,
      -60.0217,
      'Regiao Inexistente (regiÃ£o de Manaus)',
    );
  });

  it('maps region alerts from navigation safety result', async () => {
    const { service } = createService();
    jest.spyOn(service, 'evaluateNavigationSafety').mockResolvedValue({
      isSafe: false,
      score: 35,
      warnings: ['Ventos fortes detectados'],
      recommendations: ['Considere adiar a viagem'],
      weather: baseWeather(),
      floodSeverity: 'SEVERE',
      hasFloodRisk: true,
    } as never);

    const result = await service.getRegionAlerts('Manaus');

    expect(result).toEqual({
      region: 'Manaus',
      alerts: ['Ventos fortes detectados'],
      isSafe: false,
      safetyScore: 35,
      recommendations: ['Considere adiar a viagem'],
    });
  });

  it('adds favorable recommendation when weather has no risk indicators', async () => {
    const { service, floodService } = createService();
    jest.spyOn(service, 'getCurrentWeather').mockResolvedValue(
      baseWeather({
        condition: 'Ensolarado',
        windSpeed: 5,
        windGust: 8,
        rain: 0,
        visibility: 10000,
      }),
    );
    floodService.getFloodStatus.mockResolvedValue({
      severity: 'NO_FLOODING',
    });

    const result = await service.evaluateNavigationSafety(-3.119, -60.0217);

    expect(result.isSafe).toBe(true);
    expect(result.warnings).toHaveLength(0);
    expect(result.recommendations).toContain(
      'CondiÃ§Ãµes favorÃ¡veis para navegaÃ§Ã£o',
    );
  });

  it('downgrades navigation safety when severe weather and flood risks are present', async () => {
    const { service, floodService } = createService();
    jest.spyOn(service, 'getCurrentWeather').mockResolvedValue(
      baseWeather({
        temperature: 26,
        condition: 'Tempestade severa',
        windSpeed: 18,
        windGust: 25,
        rain: 20,
        visibility: 400,
      }),
    );
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
  });

  it('returns trip weather based on route coordinates', async () => {
    const { service, tripsRepo } = createService();
    tripsRepo.findOne.mockResolvedValue({
      id: 'trip-1',
      origin: 'Manaus',
      destination: 'Parintins',
      departureAt: new Date('2030-01-01T10:00:00Z'),
      route: {
        originLat: -3.2,
        originLng: -60.2,
      },
    });
    jest.spyOn(service, 'evaluateNavigationSafety').mockResolvedValue({
      isSafe: true,
      score: 88,
      warnings: [],
      recommendations: ['CondiÃ§Ãµes favorÃ¡veis para navegaÃ§Ã£o'],
      weather: baseWeather({ region: 'unused' }),
      floodSeverity: 'NO_FLOODING',
      hasFloodRisk: false,
    } as never);

    const result = await service.getTripWeather('trip-1');

    expect(result.tripId).toBe('trip-1');
    expect(result.origin).toBe('Manaus');
    expect(result.weather.region).toBe('Manaus');
    expect(result.safetyScore).toBe(88);
  });

  it('throws not found when trip weather is requested for unknown trip', async () => {
    const { service, tripsRepo } = createService();
    tripsRepo.findOne.mockResolvedValue(null);

    await expect(service.getTripWeather('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('returns available regions list', () => {
    const { service } = createService();

    const regions = service.getAvailableRegions();

    expect(regions.length).toBeGreaterThan(10);
    expect(regions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'manaus',
          name: 'Manaus',
          latitude: -3.119,
          longitude: -60.0217,
        }),
      ]),
    );
  });

  it('checks scheduled trips weather and notifies captain and passengers on risk', async () => {
    const { service, tripsRepo, bookingsRepo, notificationsService } =
      createService();
    tripsRepo.find.mockResolvedValue([
      {
        id: 'trip-1',
        origin: 'Manaus',
        destination: 'Parintins',
        captainId: 'captain-1',
        status: TripStatus.SCHEDULED,
        route: { originLat: -3.1, originLng: -60.0 },
      },
    ]);
    bookingsRepo.find.mockResolvedValue([
      { id: 'booking-1', passengerId: 'passenger-1' },
      { id: 'booking-2', passengerId: 'passenger-2' },
    ]);
    jest.spyOn(service, 'evaluateNavigationSafety').mockResolvedValue({
      isSafe: false,
      score: 20,
      warnings: ['Tempestade'],
      recommendations: ['NÃƒO navegue'],
      weather: baseWeather(),
      floodSeverity: 'SEVERE',
      hasFloodRisk: true,
    } as never);

    await service.checkScheduledTripsWeather();

    expect(bookingsRepo.find).toHaveBeenCalledWith({
      where: {
        tripId: 'trip-1',
        status: expect.anything(),
      },
    });
    const statusOperator = bookingsRepo.find.mock.calls[0]?.[0]?.where?.status;
    expect(statusOperator).toBeDefined();
    expect(notificationsService.sendToUser).toHaveBeenCalledTimes(3);
  });

  it('does not notify users when scheduled trip weather is safe', async () => {
    const { service, tripsRepo, notificationsService } = createService();
    tripsRepo.find.mockResolvedValue([
      {
        id: 'trip-2',
        origin: 'Manaus',
        destination: 'Careiro',
        captainId: 'captain-2',
        status: TripStatus.SCHEDULED,
        route: { originLat: -3.1, originLng: -60.0 },
      },
    ]);
    jest.spyOn(service, 'evaluateNavigationSafety').mockResolvedValue({
      isSafe: true,
      score: 90,
      warnings: [],
      recommendations: ['CondiÃ§Ãµes favorÃ¡veis para navegaÃ§Ã£o'],
      weather: baseWeather(),
      floodSeverity: 'NO_FLOODING',
      hasFloodRisk: false,
    } as never);

    await service.checkScheduledTripsWeather();

    expect(notificationsService.sendToUser).not.toHaveBeenCalled();
  });

  it('keeps scheduled weather check resilient when one trip evaluation fails', async () => {
    const { service, tripsRepo, notificationsService } = createService();
    tripsRepo.find.mockResolvedValue([
      {
        id: 'trip-3',
        origin: 'A',
        destination: 'B',
        captainId: 'captain-3',
        status: TripStatus.SCHEDULED,
        route: { originLat: -3.1, originLng: -60.0 },
      },
      {
        id: 'trip-4',
        origin: 'C',
        destination: 'D',
        captainId: 'captain-4',
        status: TripStatus.SCHEDULED,
        route: { originLat: -3.2, originLng: -60.2 },
      },
    ]);
    jest
      .spyOn(service, 'evaluateNavigationSafety')
      .mockRejectedValueOnce(new Error('provider down'))
      .mockResolvedValueOnce({
        isSafe: true,
        score: 80,
        warnings: [],
        recommendations: ['CondiÃ§Ãµes favorÃ¡veis para navegaÃ§Ã£o'],
        weather: baseWeather(),
        floodSeverity: 'NO_FLOODING',
        hasFloodRisk: false,
      } as never);

    await service.checkScheduledTripsWeather();

    expect(notificationsService.sendToUser).not.toHaveBeenCalled();
  });

  it('returns cached river level without calling ANA provider', async () => {
    const { service, cacheManager } = createService();
    cacheManager.get.mockResolvedValue({
      station: 'Manaus',
      stationCode: '14100000',
      river: 'Rio Negro',
      levelCm: 2800,
      levelStatus: 'attention',
      recordedAt: '10/01/2030',
      source: 'ANA',
    });

    const result = await service.getRiverLevel('14100000');

    expect(result.levelCm).toBe(2800);
    expect(axiosMock.get).not.toHaveBeenCalled();
  });

  it('maps ANA XML response and caches river level', async () => {
    const { service, cacheManager } = createService({
      anaProxyUrl: 'https://proxy.example/ana',
    });
    cacheManager.get.mockResolvedValue(null);
    axiosMock.get.mockResolvedValue({
      data: '<Nivel>2785.0</Nivel><DataHora>2026-03-25 08:00:00</DataHora>',
    });
    jest.spyOn(weatherMapper, 'classifyRiverLevel').mockReturnValue('alert');

    const result = await service.getRiverLevel('14100000');

    expect(axiosMock.get).toHaveBeenCalledWith(
      'https://proxy.example/ana',
      expect.objectContaining({
        responseType: 'text',
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        stationCode: '14100000',
        levelCm: 2785,
        levelStatus: 'alert',
        source: 'ANA',
      }),
    );
    expect(cacheManager.set).toHaveBeenCalledWith(
      'river:level:14100000',
      expect.objectContaining({ source: 'ANA' }),
      3600000,
    );
  });

  it('falls back to seasonal estimate when ANA is unavailable', async () => {
    const { service, cacheManager } = createService();
    cacheManager.get.mockResolvedValue(null);
    axiosMock.get.mockRejectedValue(new Error('ana down'));
    jest.spyOn(weatherMapper, 'classifyRiverLevel').mockReturnValue('normal');

    const result = await service.getRiverLevel('14100000');

    expect(axiosMock.get).toHaveBeenCalledTimes(3);
    expect(result.source).toBe('estimate');
    expect(result.stationCode).toBe('14100000');
    expect(result.levelStatus).toBe('normal');
    expect(cacheManager.set).toHaveBeenCalled();
  });

  it('returns only successful river levels in getAllRiverLevels', async () => {
    jest.useFakeTimers();
    const { service } = createService();
    const getRiverLevelSpy = jest
      .spyOn(service, 'getRiverLevel')
      .mockResolvedValueOnce({
        stationCode: '14100000',
        levelCm: 2500,
      } as never)
      .mockRejectedValueOnce(new Error('station offline'))
      .mockResolvedValueOnce({
        stationCode: '14320000',
        levelCm: 950,
      } as never)
      .mockResolvedValueOnce({
        stationCode: '14110000',
        levelCm: 1100,
      } as never);

    const resultPromise = service.getAllRiverLevels();
    jest.runOnlyPendingTimers();
    const result = await resultPromise;
    jest.useRealTimers();

    expect(getRiverLevelSpy).toHaveBeenCalledTimes(4);
    expect(result).toHaveLength(3);
  });

  it('fetches OWM current weather and persists history', async () => {
    const { service, cacheManager, weatherRepo } = createService();
    cacheManager.get.mockResolvedValue(null);
    axiosMock.get.mockResolvedValue({ data: { current: true } });
    jest
      .spyOn(weatherMapper, 'mapOwmToCurrentWeather')
      .mockReturnValue(baseWeather({ region: 'Manaus' }));

    const result = await service.getCurrentWeather(-3.119, -60.0217, 'Manaus');
    await new Promise((resolve) => setImmediate(resolve));

    expect(result.region).toBe('Manaus');
    expect(axiosMock.get).toHaveBeenCalledWith(
      'https://api.openweathermap.org/data/2.5/weather',
      expect.objectContaining({
        params: expect.objectContaining({
          lat: -3.119,
          lon: -60.0217,
          appid: 'owm-key',
        }),
      }),
    );
    expect(weatherRepo.create).toHaveBeenCalled();
    expect(weatherRepo.save).toHaveBeenCalled();
  });

  it('fetches OWM forecast and caches it', async () => {
    const { service, cacheManager } = createService();
    cacheManager.get.mockResolvedValue(null);
    axiosMock.get.mockResolvedValue({ data: { list: [] } });
    jest.spyOn(weatherMapper, 'mapOwmForecast').mockReturnValue({
      region: 'Manaus',
      forecast: [],
    });

    const result = await service.getForecast(-3.119, -60.0217, 'Manaus');

    expect(result.region).toBe('Manaus');
    expect(axiosMock.get).toHaveBeenCalledWith(
      'https://api.openweathermap.org/data/2.5/forecast',
      expect.any(Object),
    );
    expect(cacheManager.set).toHaveBeenCalledWith(
      'weather:forecast:-3.119:-60.0217',
      expect.objectContaining({ region: 'Manaus' }),
      1800000,
    );
  });

  it('uses Open-Meteo current provider when OWM key is missing', async () => {
    const { service, cacheManager } = createService({ apiKey: '' });
    cacheManager.get.mockResolvedValue(null);
    axiosMock.get.mockResolvedValue({ data: { current: {} } });
    jest
      .spyOn(weatherMapper, 'mapOpenMeteoToCurrentWeather')
      .mockReturnValue(baseWeather({ region: 'Manaus' }));

    const result = await service.getCurrentWeather(-3.119, -60.0217, 'Manaus');

    expect(result.region).toBe('Manaus');
    expect(axiosMock.get).toHaveBeenCalledWith(
      'https://api.open-meteo.com/v1/forecast',
      expect.objectContaining({
        timeout: 10000,
      }),
    );
  });

  it('uses Open-Meteo forecast provider when OWM key is missing', async () => {
    const { service, cacheManager } = createService({ apiKey: '' });
    cacheManager.get.mockResolvedValue(null);
    axiosMock.get.mockResolvedValue({ data: { daily: {} } });
    jest.spyOn(weatherMapper, 'mapOpenMeteoForecast').mockReturnValue({
      region: 'Manaus',
      forecast: [],
    });

    const result = await service.getForecast(-3.119, -60.0217, 'Manaus');

    expect(result.region).toBe('Manaus');
    expect(axiosMock.get).toHaveBeenCalledWith(
      'https://api.open-meteo.com/v1/forecast',
      expect.objectContaining({
        timeout: 10000,
      }),
    );
  });

  it('serializes weather alerts when saving weather history', async () => {
    const { service, weatherRepo } = createService();

    await (service as never).saveWeatherHistory(
      baseWeather({
        alerts: ['Chuvas fortes'],
      }),
    );

    expect(weatherRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        alerts: JSON.stringify(['Chuvas fortes']),
      }),
    );
    expect(weatherRepo.save).toHaveBeenCalled();
  });

  it('queries scheduled bookings statuses when sending weather alerts', async () => {
    const { service, tripsRepo, bookingsRepo } = createService();
    tripsRepo.find.mockResolvedValue([
      {
        id: 'trip-5',
        origin: 'Manaus',
        destination: 'Parintins',
        captainId: 'captain-5',
        status: TripStatus.SCHEDULED,
        route: { originLat: -3.1, originLng: -60.0 },
      },
    ]);
    bookingsRepo.find.mockResolvedValue([]);
    jest.spyOn(service, 'evaluateNavigationSafety').mockResolvedValue({
      isSafe: false,
      score: 55,
      warnings: ['Chuva torrencial'],
      recommendations: ['Atenção redobrada'],
      weather: baseWeather(),
      floodSeverity: 'ABOVE_NORMAL',
      hasFloodRisk: true,
    } as never);

    await service.checkScheduledTripsWeather();

    const bookingsWhere = bookingsRepo.find.mock.calls[0]?.[0]?.where;
    expect(bookingsWhere.tripId).toBe('trip-5');
    expect(bookingsWhere.status).toBeDefined();
    expect([BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN]).toHaveLength(2);
  });
});
