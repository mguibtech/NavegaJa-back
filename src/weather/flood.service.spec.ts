import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import type { Cache } from 'cache-manager';
import { FloodService } from './flood.service';

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

type AxiosMock = {
  get: jest.Mock;
  post: jest.Mock;
};

describe('FloodService', () => {
  const axiosMock = axios as unknown as AxiosMock;

  const createService = (apiKey = 'flood-key') => {
    const configService = {
      get: jest.fn((key: string) =>
        key === 'FLOOD_HUB_API_KEY' ? apiKey : undefined,
      ),
    };
    const cacheManager = {
      get: jest.fn(),
      set: jest.fn(),
    };

    const service = new FloodService(
      configService as unknown as ConfigService,
      cacheManager as unknown as Cache,
    );

    return { service, configService, cacheManager };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns mock flood status when API key is missing', async () => {
    const { service, cacheManager } = createService('');
    cacheManager.get.mockResolvedValue(null);

    const result = await service.getFloodStatus(-3.1, -60.0, 25);

    expect(service.enabled).toBe(false);
    expect(result).toMatchObject({
      severity: 'NO_FLOODING',
      trend: 'STEADY',
      source: 'mock',
      lat: -3.1,
      lng: -60.0,
      radiusKm: 25,
    });
  });

  it('returns cached flood status without hitting remote API', async () => {
    const { service, cacheManager } = createService('flood-key');
    const cached = {
      severity: 'SEVERE',
      trend: 'INCREASING',
      gauges: [],
      issuedTime: '2030-01-01T00:00:00.000Z',
      source: 'flood_hub',
      lat: -3.1,
      lng: -60.0,
      radiusKm: 50,
    };
    cacheManager.get.mockResolvedValue(cached);

    const result = await service.getFloodStatus(-3.1, -60.0);

    expect(result).toBe(cached);
    expect(axiosMock.post).not.toHaveBeenCalled();
  });

  it('maps status response and persists it to cache', async () => {
    const { service, cacheManager } = createService('flood-key');
    cacheManager.get.mockResolvedValue(null);
    axiosMock.post.mockResolvedValue({
      data: {
        floodStatuses: [
          {
            gaugeId: 'g-1',
            river: 'Rio Negro',
            gaugeLocation: { latitude: -3.1, longitude: -60.0 },
            severity: 'ABOVE_NORMAL',
            forecastTrend: 'INCREASING',
            forecastChange: 0.4,
            issuedTime: '2030-01-01T00:00:00.000Z',
            qualityVerified: true,
          },
          {
            gaugeId: 'g-2',
            severity: 'SEVERE',
            forecastTrend: 'DECREASING',
            issuedTime: '2030-01-01T01:00:00.000Z',
          },
        ],
      },
    });

    const result = await service.getFloodStatus(-3.1, -60.0);

    expect(result.severity).toBe('SEVERE');
    expect(result.trend).toBe('INCREASING');
    expect(result.gauges).toHaveLength(2);
    expect(cacheManager.set).toHaveBeenCalled();
  });

  it('returns mapped gauge model and falls back to mock on failure', async () => {
    const { service, cacheManager } = createService('flood-key');
    cacheManager.get.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    axiosMock.get
      .mockResolvedValueOnce({
        data: {
          river: 'Amazonas',
          thresholds: {
            warningLevel: 11,
            dangerLevel: 13,
            extremeDangerLevel: 15,
          },
        },
      })
      .mockRejectedValueOnce(new Error('upstream down'));

    const success = await service.getGaugeModel('gauge-1');
    const fallback = await service.getGaugeModel('gauge-2');

    expect(success).toEqual({
      gaugeId: 'gauge-1',
      river: 'Amazonas',
      thresholds: {
        warningLevel: 11,
        dangerLevel: 13,
        extremeDangerLevel: 15,
      },
      source: 'flood_hub',
    });
    expect(fallback).toEqual({
      gaugeId: 'gauge-2',
      thresholds: {},
      source: 'mock',
    });
  });

  it('maps gauge forecast and uses fallback when provider fails', async () => {
    const { service, cacheManager } = createService('flood-key');
    cacheManager.get.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    axiosMock.get
      .mockResolvedValueOnce({
        data: {
          river: 'Rio Negro',
          forecasts: [
            {
              levels: [
                {
                  validTime: '2030-01-01T00:00:00.000Z',
                  level: 10.2,
                  severity: 'ABOVE_NORMAL',
                },
                {
                  validTime: '2030-01-01T01:00:00.000Z',
                  level: 11.1,
                  severity: 'SEVERE',
                },
              ],
            },
          ],
        },
      })
      .mockRejectedValueOnce(new Error('forecast failed'));

    const success = await service.getGaugeForecast('gauge-1', 1);
    const fallback = await service.getGaugeForecast('gauge-2', 2);

    expect(success.source).toBe('flood_hub');
    expect(success.forecast).toEqual([
      {
        timestamp: '2030-01-01T00:00:00.000Z',
        level: 10.2,
        severity: 'ABOVE_NORMAL',
      },
      {
        timestamp: '2030-01-01T01:00:00.000Z',
        level: 11.1,
        severity: 'SEVERE',
      },
    ]);
    expect(fallback.source).toBe('mock');
    expect(fallback.forecast).toHaveLength(2);
  });

  it('merges significant and severe flood events', async () => {
    const { service, cacheManager } = createService('flood-key');
    cacheManager.get.mockResolvedValue(null);
    axiosMock.post
      .mockResolvedValueOnce({
        data: {
          events: [
            {
              id: 'sig-1',
              severity: 'ABOVE_NORMAL',
              countries: ['BR'],
              description: 'Evento significativo',
            },
          ],
        },
      })
      .mockResolvedValueOnce({
        data: {
          events: [
            {
              id: 'sev-1',
              severity: 'SEVERE',
              countries: ['BR'],
              description: 'Evento severo',
            },
          ],
        },
      });

    const result = await service.getFloodEvents(-3.1, -60.0, 200);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ type: 'significant' });
    expect(result[1]).toMatchObject({ type: 'severe' });
    expect(cacheManager.set).toHaveBeenCalled();
  });

  it('maps inundation polygons and falls back to empty payload on error', async () => {
    const { service, cacheManager } = createService('flood-key');
    cacheManager.get.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    axiosMock.post
      .mockResolvedValueOnce({
        data: {
          inundationMaps: [
            {
              inundationMapSet: [
                {
                  inundationLevel: 'HIGH',
                  polygon: {
                    coordinates: [{ latitude: -3.2, longitude: -60.1 }],
                  },
                },
              ],
            },
          ],
          kml: '<kml />',
        },
      })
      .mockRejectedValueOnce(new Error('inundation failed'));

    const success = await service.getInundationMap(-3.1, -60.0, 50);
    const fallback = await service.getInundationMap(-3.1, -60.0, 80);

    expect(success).toEqual({
      polygons: [{ risk: 'HIGH', coordinates: [{ lat: -3.2, lng: -60.1 }] }],
      kml: '<kml />',
      source: 'flood_hub',
    });
    expect(fallback).toEqual({ polygons: [], source: 'mock' });
  });

  it('normalizes severity including legacy values', () => {
    const { service } = createService('flood-key');

    expect(service.normalizeSeverity('WATCH')).toBe('ABOVE_NORMAL');
    expect(service.normalizeSeverity('WARNING')).toBe('SEVERE');
    expect(service.normalizeSeverity('EMERGENCY')).toBe('EXTREME');
    expect(service.normalizeSeverity('UNKNOWN')).toBe('NO_FLOODING');
  });
});
