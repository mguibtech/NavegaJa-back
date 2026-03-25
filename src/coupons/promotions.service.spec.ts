import type { Repository } from 'typeorm';
import { Trip, TripStatus } from '../trips/trip.entity';
import { CouponType } from './coupon.entity';
import { Promotion } from './promotion.entity';
import { PromotionsService } from './promotions.service';

type PromotionsQbMock = {
  leftJoinAndSelect: jest.Mock;
  where: jest.Mock;
  andWhere: jest.Mock;
  orderBy: jest.Mock;
  addOrderBy: jest.Mock;
  take: jest.Mock;
  getMany: jest.Mock;
};

type TripsQbMock = {
  where: jest.Mock;
  andWhere: jest.Mock;
  orderBy: jest.Mock;
  take: jest.Mock;
  getMany: jest.Mock;
};

const createPromotionsQb = (result: Promotion[] = []): PromotionsQbMock => {
  const qb = {
    leftJoinAndSelect: jest.fn(),
    where: jest.fn(),
    andWhere: jest.fn(),
    orderBy: jest.fn(),
    addOrderBy: jest.fn(),
    take: jest.fn(),
    getMany: jest.fn().mockResolvedValue(result),
  } as PromotionsQbMock;
  qb.leftJoinAndSelect.mockReturnValue(qb);
  qb.where.mockReturnValue(qb);
  qb.andWhere.mockReturnValue(qb);
  qb.orderBy.mockReturnValue(qb);
  qb.addOrderBy.mockReturnValue(qb);
  qb.take.mockReturnValue(qb);
  return qb;
};

const createTripsQb = (result: Trip[] = []): TripsQbMock => {
  const qb = {
    where: jest.fn(),
    andWhere: jest.fn(),
    orderBy: jest.fn(),
    take: jest.fn(),
    getMany: jest.fn().mockResolvedValue(result),
  } as TripsQbMock;
  qb.where.mockReturnValue(qb);
  qb.andWhere.mockReturnValue(qb);
  qb.orderBy.mockReturnValue(qb);
  qb.take.mockReturnValue(qb);
  return qb;
};

describe('PromotionsService', () => {
  const createService = () => {
    const promotionsRepo = {
      create: jest.fn((value: Partial<Promotion>) => value as Promotion),
      save: jest.fn((value: Promotion) => Promise.resolve(value)),
      find: jest.fn(),
      findOne: jest.fn(),
      delete: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    const tripsRepo = {
      createQueryBuilder: jest.fn(),
    };
    const service = new PromotionsService(
      promotionsRepo as unknown as Repository<Promotion>,
      tripsRepo as unknown as Repository<Trip>,
    );

    return { service, promotionsRepo, tripsRepo };
  };

  it('creates promotions converting date strings to Date objects', async () => {
    const { service, promotionsRepo } = createService();

    const saved = await service.create({
      title: 'Promo',
      startDate: '2030-01-01T00:00:00.000Z',
      endDate: '2030-01-10T00:00:00.000Z',
    } as never);

    expect(promotionsRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Promo',
        startDate: new Date('2030-01-01T00:00:00.000Z'),
        endDate: new Date('2030-01-10T00:00:00.000Z'),
      }),
    );
    expect(saved.title).toBe('Promo');
  });

  it('lists promotions and active promotions using expected ordering', async () => {
    const { service, promotionsRepo } = createService();
    promotionsRepo.find.mockResolvedValue([{ id: 'p1' }]);
    const promotionsQb = createPromotionsQb([{ id: 'p2' } as Promotion]);
    promotionsRepo.createQueryBuilder.mockReturnValue(promotionsQb);

    const all = await service.findAll();
    const active = await service.findActive();

    expect(all).toEqual([{ id: 'p1' }]);
    expect(promotionsRepo.find).toHaveBeenCalledWith({
      order: { priority: 'DESC', createdAt: 'DESC' },
    });
    expect(active).toEqual([{ id: 'p2' }]);
    expect(promotionsQb.leftJoinAndSelect).toHaveBeenCalledWith(
      'promotion.coupon',
      'coupon',
    );
    expect(promotionsQb.take).toHaveBeenCalledWith(10);
  });

  it('returns sample trips without coupon discount', async () => {
    const { service, tripsRepo } = createService();
    const trips = [
      {
        id: 'trip-1',
        origin: 'Manaus',
        destination: 'Parintins',
        departureAt: new Date('2030-01-01T00:00:00.000Z'),
        price: 120,
      } as Trip,
    ];
    const tripsQb = createTripsQb(trips);
    tripsRepo.createQueryBuilder.mockReturnValue(tripsQb);

    const result = await service.getSampleTripsForPromotion(
      {
        id: 'promo-1',
        fromCity: 'manaus',
        toCity: 'pari',
        coupon: null,
      } as Promotion,
      3,
    );

    expect(result).toEqual([
      {
        id: 'trip-1',
        from: 'Manaus',
        to: 'Parintins',
        departureDate: new Date('2030-01-01T00:00:00.000Z'),
        originalPrice: 120,
        discountedPrice: 120,
        savedAmount: 0,
      },
    ]);
    expect(tripsQb.andWhere).toHaveBeenCalledWith('trip.status = :status', {
      status: TripStatus.SCHEDULED,
    });
  });

  it('applies percentage/fixed coupon discount when sampling trips', async () => {
    const { service, tripsRepo } = createService();
    const trips = [
      {
        id: 'trip-2',
        origin: 'Manaus',
        destination: 'Iranduba',
        departureAt: new Date('2030-02-01T00:00:00.000Z'),
        price: 200,
      } as Trip,
    ];
    const tripsQb = createTripsQb(trips);
    tripsRepo.createQueryBuilder.mockReturnValue(tripsQb);

    const percentageResult = await service.getSampleTripsForPromotion({
      id: 'promo-2',
      coupon: {
        type: CouponType.PERCENTAGE,
        value: 40,
        maxDiscount: 50,
      },
    } as never);
    expect(percentageResult[0]?.discountedPrice).toBe(150);
    expect(percentageResult[0]?.savedAmount).toBe(50);

    const fixedResult = await service.getSampleTripsForPromotion({
      id: 'promo-3',
      coupon: {
        type: CouponType.FIXED,
        value: 25,
      },
    } as never);
    expect(fixedResult[0]?.discountedPrice).toBe(175);
    expect(fixedResult[0]?.savedAmount).toBe(25);
  });

  it('finds, updates, deletes and toggles promotions', async () => {
    const { service, promotionsRepo } = createService();
    const existing = {
      id: 'promo-x',
      title: 'Atual',
      isActive: true,
      startDate: new Date('2030-01-01T00:00:00.000Z'),
      endDate: new Date('2030-01-02T00:00:00.000Z'),
    } as Promotion;

    promotionsRepo.findOne
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce(existing);
    promotionsRepo.delete
      .mockResolvedValueOnce({ affected: 1 })
      .mockResolvedValueOnce({ affected: 0 });

    await expect(service.findOne('promo-x')).resolves.toMatchObject({
      id: 'promo-x',
    });

    const updated = await service.update('promo-x', {
      title: 'Novo titulo',
      startDate: '2030-03-10T00:00:00.000Z',
    } as never);
    expect(updated.title).toBe('Novo titulo');
    expect(updated.startDate).toEqual(new Date('2030-03-10T00:00:00.000Z'));

    await expect(service.delete('promo-x')).resolves.toBeUndefined();
    await expect(service.delete('missing')).rejects.toMatchObject({
      response: { message: 'Promoção não encontrada' },
    });

    const toggled = await service.toggleActive('promo-x');
    expect(toggled.isActive).toBe(false);
  });
});
