import { Repository } from 'typeorm';
import { GamificationService } from '../gamification/gamification.service';
import { PointAction } from '../gamification/point-transaction.entity';
import { StopReview } from './stop-review.entity';
import { StopReviewsService } from './stop-reviews.service';

type QueryBuilderMock = {
  leftJoin: jest.Mock;
  addSelect: jest.Mock;
  where: jest.Mock;
  orderBy: jest.Mock;
  skip: jest.Mock;
  take: jest.Mock;
  getManyAndCount: jest.Mock;
  select: jest.Mock;
  groupBy: jest.Mock;
  having: jest.Mock;
  addOrderBy: jest.Mock;
  limit: jest.Mock;
  getRawMany: jest.Mock;
};

const createQueryBuilder = (options?: {
  manyAndCount?: [StopReview[], number];
  rawMany?: Array<{
    locationName: string;
    avgRating: string;
    reviewCount: string;
    lat: string | null;
    lng: string | null;
  }>;
}): QueryBuilderMock => {
  const qb = {
    leftJoin: jest.fn(),
    addSelect: jest.fn(),
    where: jest.fn(),
    orderBy: jest.fn(),
    skip: jest.fn(),
    take: jest.fn(),
    getManyAndCount: jest
      .fn()
      .mockResolvedValue(options?.manyAndCount ?? [[], 0]),
    select: jest.fn(),
    groupBy: jest.fn(),
    having: jest.fn(),
    addOrderBy: jest.fn(),
    limit: jest.fn(),
    getRawMany: jest.fn().mockResolvedValue(options?.rawMany ?? []),
  } as QueryBuilderMock;

  qb.leftJoin.mockReturnValue(qb);
  qb.addSelect.mockReturnValue(qb);
  qb.where.mockReturnValue(qb);
  qb.orderBy.mockReturnValue(qb);
  qb.skip.mockReturnValue(qb);
  qb.take.mockReturnValue(qb);
  qb.select.mockReturnValue(qb);
  qb.groupBy.mockReturnValue(qb);
  qb.having.mockReturnValue(qb);
  qb.addOrderBy.mockReturnValue(qb);
  qb.limit.mockReturnValue(qb);

  return qb;
};

describe('StopReviewsService', () => {
  const createRepo = (qb: QueryBuilderMock) => ({
    create: jest.fn((value: Partial<StopReview>) => value as StopReview),
    save: jest.fn((value: StopReview) =>
      Promise.resolve({ id: 'review-1', ...value }),
    ),
    createQueryBuilder: jest.fn().mockReturnValue(qb),
    findAndCount: jest.fn(),
  });

  it('rejects invalid rating range', async () => {
    const qb = createQueryBuilder();
    const repo = createRepo(qb);
    const gamificationService = {
      awardPoints: jest.fn(),
    };
    const service = new StopReviewsService(
      repo as unknown as Repository<StopReview>,
      gamificationService as unknown as GamificationService,
    );

    await expect(
      service.create('user-1', {
        locationName: 'Porto',
        rating: 0,
      }),
    ).rejects.toMatchObject({
      response: { message: 'rating deve ser um inteiro de 1 a 5' },
    });
  });

  it('creates a review, normalizes optional fields and awards points', async () => {
    const qb = createQueryBuilder();
    const repo = createRepo(qb);
    const gamificationService = {
      awardPoints: jest.fn().mockResolvedValue(undefined),
    };
    const service = new StopReviewsService(
      repo as unknown as Repository<StopReview>,
      gamificationService as unknown as GamificationService,
    );

    const saved = await service.create('user-1', {
      locationName: 'Porto de Manaus',
      rating: 5,
      comment: '',
      photos: [],
    });

    expect(saved).toMatchObject({
      id: 'review-1',
      userId: 'user-1',
      locationName: 'Porto de Manaus',
      comment: null,
      photos: null,
      tripId: null,
      lat: null,
      lng: null,
    });
    expect(gamificationService.awardPoints).toHaveBeenCalledWith(
      'user-1',
      PointAction.REVIEW_CREATED,
      'review-1',
    );
  });

  it('finds reviews by location with pagination metadata', async () => {
    const qb = createQueryBuilder({
      manyAndCount: [[{ id: 'review-1' } as StopReview], 21],
    });
    const repo = createRepo(qb);
    const service = new StopReviewsService(
      repo as unknown as Repository<StopReview>,
      { awardPoints: jest.fn() } as unknown as GamificationService,
    );

    const result = await service.findByLocation('Manaus', 2, 10);

    expect(result).toEqual({
      data: [{ id: 'review-1' }],
      total: 21,
      page: 2,
      lastPage: 3,
    });
    expect(qb.skip).toHaveBeenCalledWith(10);
    expect(qb.take).toHaveBeenCalledWith(10);
  });

  it('returns top locations with numeric conversions', async () => {
    const qb = createQueryBuilder({
      rawMany: [
        {
          locationName: 'Parintins',
          avgRating: '4.8',
          reviewCount: '14',
          lat: '-2.62',
          lng: '-56.73',
        },
        {
          locationName: 'Iranduba',
          avgRating: '4.2',
          reviewCount: '5',
          lat: null,
          lng: null,
        },
      ],
    });
    const repo = createRepo(qb);
    const service = new StopReviewsService(
      repo as unknown as Repository<StopReview>,
      { awardPoints: jest.fn() } as unknown as GamificationService,
    );

    const result = await service.getTopLocations(2);

    expect(result).toEqual([
      {
        locationName: 'Parintins',
        avgRating: 4.8,
        reviewCount: 14,
        lat: -2.62,
        lng: -56.73,
      },
      {
        locationName: 'Iranduba',
        avgRating: 4.2,
        reviewCount: 5,
        lat: null,
        lng: null,
      },
    ]);
    expect(qb.limit).toHaveBeenCalledWith(2);
  });

  it('returns user reviews with pagination metadata', async () => {
    const qb = createQueryBuilder();
    const repo = createRepo(qb);
    repo.findAndCount.mockResolvedValue([[{ id: 'review-2' }], 11]);
    const service = new StopReviewsService(
      repo as unknown as Repository<StopReview>,
      { awardPoints: jest.fn() } as unknown as GamificationService,
    );

    const result = await service.findMyReviews('user-1', 2, 5);

    expect(result).toEqual({
      data: [{ id: 'review-2' }],
      total: 11,
      page: 2,
      lastPage: 3,
    });
    expect(repo.findAndCount).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      order: { createdAt: 'DESC' },
      skip: 5,
      take: 5,
    });
  });
});
