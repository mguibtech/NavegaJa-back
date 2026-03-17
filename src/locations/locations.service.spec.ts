import { LocationsService } from './locations.service';
import {
  CommunityLocationStatus,
  type CommunityLocation,
} from './community-location.entity';
import { normalizeLocationText } from './location-text';
import type { Repository } from 'typeorm';

describe('LocationsService.searchLocations', () => {
  it('normalizes accents and avoids logical duplicates while preserving canonical display', async () => {
    const communityRepo = {
      find: jest.fn().mockResolvedValue([
        {
          id: 'community-1',
          name: 'Maues',
          normalizedName: 'maues',
          lat: -3.3833,
          lng: -57.7167,
          municipio: 'Maués',
          status: CommunityLocationStatus.CONFIRMED,
          confirmedCount: 3,
        } as CommunityLocation,
      ]),
    };

    const service = new LocationsService(
      communityRepo as unknown as Repository<CommunityLocation>,
      {} as never,
    );

    const resultsWithoutAccent = await service.searchLocations('Mau');
    const resultsWithAccent = await service.searchLocations('Maués');

    const normalizedWithoutAccent = resultsWithoutAccent.filter(
      (item) => normalizeLocationText(item.name) === 'maues',
    );
    const normalizedWithAccent = resultsWithAccent.filter(
      (item) => normalizeLocationText(item.name) === 'maues',
    );

    expect(normalizedWithoutAccent).toHaveLength(1);
    expect(normalizedWithAccent).toHaveLength(1);
    expect(normalizedWithoutAccent[0]?.name).toBe('Maués');
    expect(normalizedWithAccent[0]?.name).toBe('Maués');
  });
});
