import { Repository } from 'typeorm';
import { FavoritesService } from './favorites.service';
import { Favorite, FavoriteType } from './favorite.entity';

type QueryBuilderMock = {
  where: jest.Mock;
  andWhere: jest.Mock;
  getOne: jest.Mock;
};

const createQueryBuilder = (result: Favorite | null): QueryBuilderMock => {
  const qb = {
    where: jest.fn(),
    andWhere: jest.fn(),
    getOne: jest.fn().mockResolvedValue(result),
  } as QueryBuilderMock;
  qb.where.mockReturnValue(qb);
  qb.andWhere.mockReturnValue(qb);
  return qb;
};

describe('FavoritesService', () => {
  const createRepo = (qbResult: Favorite | null = null) => {
    const qb = createQueryBuilder(qbResult);
    return {
      create: jest.fn((value: Partial<Favorite>) => value as Favorite),
      save: jest.fn((value: Favorite) =>
        Promise.resolve({ id: 'fav-1', ...value }),
      ),
      find: jest.fn(),
      findOne: jest.fn(),
      remove: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(qb),
      __qb: qb,
    };
  };

  it('creates a destination favorite when it does not exist yet', async () => {
    const repo = createRepo(null);
    const service = new FavoritesService(
      repo as unknown as Repository<Favorite>,
    );

    const saved = await service.create('user-1', {
      type: FavoriteType.DESTINATION,
      destination: 'Parintins',
      origin: 'Manaus',
    } as never);

    expect(saved).toMatchObject({
      id: 'fav-1',
      userId: 'user-1',
      destination: 'Parintins',
      origin: 'Manaus',
    });
    expect(repo.__qb.andWhere).toHaveBeenCalledWith(
      'favorite.destination = :destination',
      { destination: 'Parintins' },
    );
  });

  it('rejects destination favorites without destination field', async () => {
    const repo = createRepo();
    const service = new FavoritesService(
      repo as unknown as Repository<Favorite>,
    );

    await expect(
      service.create('user-1', {
        type: FavoriteType.DESTINATION,
      } as never),
    ).rejects.toMatchObject({
      response: {
        message: 'Campo "destination" é obrigatório para favoritos de destino',
      },
    });
  });

  it('rejects duplicated favorites', async () => {
    const repo = createRepo({
      id: 'fav-dup',
      userId: 'user-1',
      type: FavoriteType.BOAT,
    } as Favorite);
    const service = new FavoritesService(
      repo as unknown as Repository<Favorite>,
    );

    await expect(
      service.create('user-1', {
        type: FavoriteType.BOAT,
        boatId: 'boat-1',
      } as never),
    ).rejects.toMatchObject({
      response: { message: 'Este item já está nos favoritos' },
    });
  });

  it('lists favorites with optional type filter', async () => {
    const repo = createRepo();
    repo.find.mockResolvedValue([{ id: 'fav-1' }]);
    const service = new FavoritesService(
      repo as unknown as Repository<Favorite>,
    );

    const withoutFilter = await service.findAll('user-1');
    const withFilter = await service.findAll('user-1', FavoriteType.CAPTAIN);

    expect(withoutFilter).toEqual([{ id: 'fav-1' }]);
    expect(repo.find).toHaveBeenNthCalledWith(1, {
      where: { userId: 'user-1' },
      relations: ['boat', 'captain'],
      order: { createdAt: 'DESC' },
    });
    expect(withFilter).toEqual([{ id: 'fav-1' }]);
    expect(repo.find).toHaveBeenNthCalledWith(2, {
      where: { userId: 'user-1', type: FavoriteType.CAPTAIN },
      relations: ['boat', 'captain'],
      order: { createdAt: 'DESC' },
    });
  });

  it('removes an existing favorite and rejects missing ones', async () => {
    const repo = createRepo();
    repo.findOne
      .mockResolvedValueOnce({
        id: 'fav-1',
        userId: 'user-1',
      })
      .mockResolvedValueOnce(null);
    const service = new FavoritesService(
      repo as unknown as Repository<Favorite>,
    );

    await service.remove('user-1', 'fav-1');
    expect(repo.remove).toHaveBeenCalledWith({
      id: 'fav-1',
      userId: 'user-1',
    });

    await expect(service.remove('user-1', 'missing')).rejects.toMatchObject({
      response: { message: 'Favorito não encontrado' },
    });
  });

  it('checks favorite existence and returns favorite id when present', async () => {
    const repo = createRepo({
      id: 'fav-check',
      userId: 'user-1',
      type: FavoriteType.CAPTAIN,
      captainId: 'captain-1',
    } as Favorite);
    const service = new FavoritesService(
      repo as unknown as Repository<Favorite>,
    );

    const result = await service.check('user-1', {
      type: FavoriteType.CAPTAIN,
      captainId: 'captain-1',
    } as never);

    expect(result).toEqual({ isFavorite: true, favoriteId: 'fav-check' });
  });

  it('toggles favorite by removing when it already exists', async () => {
    const existing = {
      id: 'fav-1',
      userId: 'user-1',
      type: FavoriteType.BOAT,
      boatId: 'boat-1',
    } as Favorite;
    const repo = createRepo(existing);
    const service = new FavoritesService(
      repo as unknown as Repository<Favorite>,
    );

    const result = await service.toggleFavorite('user-1', {
      type: FavoriteType.BOAT,
      boatId: 'boat-1',
    } as never);

    expect(result).toEqual({ action: 'removed' });
    expect(repo.remove).toHaveBeenCalledWith(existing);
  });

  it('toggles favorite by creating when not present', async () => {
    const repo = createRepo(null);
    const service = new FavoritesService(
      repo as unknown as Repository<Favorite>,
    );

    const result = await service.toggleFavorite('user-1', {
      type: FavoriteType.CAPTAIN,
      captainId: 'captain-1',
    } as never);

    expect(result.action).toBe('added');
    expect(result.favorite).toMatchObject({
      userId: 'user-1',
      captainId: 'captain-1',
    });
  });
});
