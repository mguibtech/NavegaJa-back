import axios from 'axios';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { LocationsService } from './locations.service';
import {
  CommunityLocationSource,
  CommunityLocationStatus,
  type CommunityLocation,
} from './community-location.entity';
import { normalizeLocationText } from './location-text';
import type { Repository } from 'typeorm';

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
  },
}));

type AxiosMock = {
  get: jest.Mock;
};

type CommunityQueryBuilder = {
  where: jest.Mock;
  andWhere: jest.Mock;
  getMany: jest.Mock;
};

const createCommunityQb = (): CommunityQueryBuilder => {
  const qb = {
    where: jest.fn(),
    andWhere: jest.fn(),
    getMany: jest.fn(),
  } as CommunityQueryBuilder;
  qb.where.mockReturnValue(qb);
  qb.andWhere.mockReturnValue(qb);
  return qb;
};

describe('LocationsService', () => {
  const axiosMock = axios as unknown as AxiosMock;

  const createService = () => {
    const communityQb = createCommunityQb();
    const communityRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      findOneOrFail: jest.fn(),
      save: jest.fn((entry) => Promise.resolve(entry)),
      create: jest.fn((entry) => ({ id: 'community-new', ...entry })),
      createQueryBuilder: jest.fn(() => communityQb),
    };
    const cacheManager = {
      get: jest.fn(),
      set: jest.fn(),
    };
    const service = new LocationsService(
      communityRepo as unknown as Repository<CommunityLocation>,
      cacheManager as never,
    );

    return { service, communityRepo, cacheManager, communityQb };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns empty search results for short queries', async () => {
    const { service, communityRepo } = createService();

    const result = await service.searchLocations(' a ');

    expect(result).toEqual([]);
    expect(communityRepo.find).not.toHaveBeenCalled();
  });

  it('normalizes accents and avoids duplicate lookup/community suggestions', async () => {
    const { service, communityRepo } = createService();
    communityRepo.find.mockResolvedValue([
      {
        id: 'community-1',
        name: 'Maues',
        normalizedName: 'maues',
        lat: -3.3833,
        lng: -57.7167,
        municipio: 'MauÃ©s',
        status: CommunityLocationStatus.CONFIRMED,
        confirmedCount: 3,
      },
    ]);

    const withoutAccent = await service.searchLocations('Mau');
    const withAccent = await service.searchLocations('MauÃ©s');

    const normalizedWithout = withoutAccent.filter(
      (item) => normalizeLocationText(item.name) === 'maues',
    );
    const normalizedWith = withAccent.filter(
      (item) => normalizeLocationText(item.name) === 'maues',
    );

    expect(normalizedWithout).toHaveLength(1);
    expect(normalizedWith).toHaveLength(1);
  });

  it('returns cached cep when available', async () => {
    const { service, cacheManager } = createService();
    cacheManager.get.mockResolvedValue({
      cep: '69000000',
      logradouro: 'Rua X',
      complemento: '',
      bairro: 'Centro',
      cidade: 'Manaus',
      uf: 'AM',
      estado: 'Amazonas',
      ddd: '92',
      ibge: '1302603',
    });

    const result = await service.getCep('69000-000');

    expect(result.cidade).toBe('Manaus');
    expect(axiosMock.get).not.toHaveBeenCalled();
  });

  it('validates CEP format and throws bad request for invalid input', async () => {
    const { service } = createService();

    await expect(service.getCep('123')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('maps ViaCEP response and caches normalized fields', async () => {
    const { service, cacheManager } = createService();
    cacheManager.get.mockResolvedValue(null);
    axiosMock.get.mockResolvedValue({
      data: {
        cep: '69000-000',
        logradouro: 'Rua A',
        bairro: 'Centro',
        localidade: 'Manaus',
        uf: 'AM',
        estado: 'Amazonas',
        ddd: '92',
        ibge: '1302603',
      },
    });

    const result = await service.getCep('69000-000');

    expect(result).toEqual({
      cep: '69000-000',
      logradouro: 'Rua A',
      complemento: '',
      bairro: 'Centro',
      cidade: 'Manaus',
      uf: 'AM',
      estado: 'Amazonas',
      ddd: '92',
      ibge: '1302603',
    });
    expect(cacheManager.set).toHaveBeenCalledWith(
      'cep:69000000',
      result,
      3600 * 1000,
    );
  });

  it('rethrows not-found CEP responses', async () => {
    const { service, cacheManager } = createService();
    cacheManager.get.mockResolvedValue(null);
    axiosMock.get.mockResolvedValue({ data: { erro: true } });

    await expect(service.getCep('69000000')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('loads and sorts municipios from brasil api', async () => {
    const { service, cacheManager } = createService();
    cacheManager.get.mockResolvedValue(null);
    axiosMock.get.mockResolvedValue({
      data: [
        { nome: 'TefÃ©', codigo_ibge: 1304203 },
        { nome: 'Manaus', codigo_ibge: 1302603 },
      ],
    });

    const result = await service.getMunicipios('am');

    expect(result).toEqual([
      { nome: 'Manaus', codigoIbge: '1302603' },
      { nome: 'TefÃ©', codigoIbge: '1304203' },
    ]);
    expect(cacheManager.set).toHaveBeenCalledWith(
      'municipios:AM',
      result,
      24 * 3600 * 1000,
    );
  });

  it('uses reverse geocoding fallback when nominatim fails', async () => {
    const { service, cacheManager } = createService();
    cacheManager.get.mockResolvedValue(null);
    axiosMock.get.mockRejectedValue(new Error('nominatim down'));

    const result = await service.reverseGeocode(-3.12345, -60.98765);

    expect(result).toEqual({
      display: '-3.1235, -60.9877',
      road: null,
      district: null,
      city: null,
      state: null,
      country: 'Brasil',
      latitude: -3.12345,
      longitude: -60.98765,
    });
  });

  it('increments existing nearby suggestion and auto-confirms pending entries', async () => {
    const { service, communityRepo, communityQb } = createService();
    communityRepo.find.mockResolvedValue([
      {
        id: 'community-1',
        name: 'Comunidade X',
        normalizedName: 'comunidade x',
        lat: -3.1,
        lng: -60.0,
        municipio: 'Manaus',
        status: CommunityLocationStatus.PENDING,
        confirmedCount: 1,
      },
    ]);
    communityQb.getMany.mockResolvedValue([]);

    const result = await service.suggestCommunity(
      {
        name: 'Comunidade X',
        lat: -3.1005,
        lng: -60.0004,
        municipio: 'Manaus',
      } as never,
      'user-1',
    );

    expect(result.status).toBe(CommunityLocationStatus.CONFIRMED);
    expect(result.confirmedCount).toBe(2);
    expect(communityRepo.save).toHaveBeenCalled();
  });

  it('creates a new community suggestion when there is no nearby match', async () => {
    const { service, communityRepo, communityQb } = createService();
    communityRepo.find.mockResolvedValue([]);
    communityQb.getMany.mockResolvedValue([]);

    const result = await service.suggestCommunity(
      {
        name: 'Nova Comunidade',
        lat: -2.8,
        lng: -58.4,
        municipio: 'Parintins',
        state: 'AM',
      } as never,
      'user-1',
      CommunityLocationSource.USER_SUGGESTION,
    );

    expect(communityRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Nova Comunidade',
        normalizedName: 'nova comunidade',
        confirmedCount: 1,
      }),
    );
    expect(result).toMatchObject({
      id: 'community-new',
      name: 'Nova Comunidade',
      status: CommunityLocationStatus.PENDING,
    });
  });

  it('approves, rejects and lists community suggestions for admin', async () => {
    const { service, communityRepo } = createService();
    communityRepo.findOneOrFail
      .mockResolvedValueOnce({
        id: 'loc-1',
        status: CommunityLocationStatus.PENDING,
      })
      .mockResolvedValueOnce({
        id: 'loc-2',
        status: CommunityLocationStatus.PENDING,
      });
    communityRepo.find.mockResolvedValue([{ id: 'loc-3' }]);

    const approved = await service.approveLocation('loc-1');
    const rejected = await service.rejectLocation('loc-2', 'duplicado');
    const listed = await service.listForAdmin(
      CommunityLocationStatus.CONFIRMED,
    );

    expect(approved.status).toBe(CommunityLocationStatus.CONFIRMED);
    expect(rejected.status).toBe(CommunityLocationStatus.REJECTED);
    expect(rejected.rejectionReason).toBe('duplicado');
    expect(listed).toEqual([{ id: 'loc-3' }]);
  });

  it('finds confirmed locations with exact and fuzzy lookup and formats label', async () => {
    const { service, communityRepo } = createService();
    communityRepo.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ lat: -3.02, lng: -60.05 });

    const fuzzy = await service.findConfirmedByName('Comunidade Y');
    const reverseSpy = jest.spyOn(service, 'reverseGeocode').mockResolvedValue({
      display: 'Manaus, Amazonas',
      road: null,
      district: null,
      city: 'Manaus',
      state: 'AM',
      country: 'Brasil',
      latitude: -3.1,
      longitude: -60.0,
    });
    const label = await service.getLocationLabel(-3.1, -60.0);

    expect(fuzzy).toEqual({ lat: -3.02, lng: -60.05 });
    expect(reverseSpy).toHaveBeenCalledWith(-3.1, -60.0);
    expect(label).toContain('Manaus, AM');
  });
});
