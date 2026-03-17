import { RoutesService } from './routes.service';
import type { Repository } from 'typeorm';
import type { Route } from './route.entity';

describe('RoutesService.search', () => {
  it('matches origin and destination ignoring case and accents', async () => {
    const routesRepo = {
      find: jest.fn().mockResolvedValue([
        {
          id: 'route-1',
          originName: 'Maués',
          destinationName: 'Parintins',
        },
        {
          id: 'route-2',
          originName: 'Manaus',
          destinationName: 'Itacoatiara',
        },
      ] as Route[]),
    };

    const service = new RoutesService(
      routesRepo as unknown as Repository<Route>,
    );

    const results = await service.search('maues', 'PARINTINS');

    expect(results).toHaveLength(1);
    expect(results[0]?.originName).toBe('Maués');
    expect(results[0]?.destinationName).toBe('Parintins');
  });
});
