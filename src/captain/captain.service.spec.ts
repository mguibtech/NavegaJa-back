import { Repository } from 'typeorm';
import { Booking, PaymentStatus } from '../bookings/booking.entity';
import { Trip, TripStatus } from '../trips/trip.entity';
import { User } from '../users/user.entity';
import { CaptainService } from './captain.service';

type QueryBuilderMock = {
  innerJoin: jest.Mock;
  select: jest.Mock;
  addSelect: jest.Mock;
  where: jest.Mock;
  andWhere: jest.Mock;
  groupBy: jest.Mock;
  having: jest.Mock;
  orderBy: jest.Mock;
  limit: jest.Mock;
  getRawOne: jest.Mock;
  getRawMany: jest.Mock;
};

const createQueryBuilder = (options?: {
  rawOne?: Record<string, string>;
  rawMany?: Array<Record<string, string | Date | null>>;
}): QueryBuilderMock => {
  const qb = {
    innerJoin: jest.fn(),
    select: jest.fn(),
    addSelect: jest.fn(),
    where: jest.fn(),
    andWhere: jest.fn(),
    groupBy: jest.fn(),
    having: jest.fn(),
    orderBy: jest.fn(),
    limit: jest.fn(),
    getRawOne: jest.fn().mockResolvedValue(options?.rawOne ?? {}),
    getRawMany: jest.fn().mockResolvedValue(options?.rawMany ?? []),
  } as QueryBuilderMock;

  qb.innerJoin.mockReturnValue(qb);
  qb.select.mockReturnValue(qb);
  qb.addSelect.mockReturnValue(qb);
  qb.where.mockReturnValue(qb);
  qb.andWhere.mockReturnValue(qb);
  qb.groupBy.mockReturnValue(qb);
  qb.having.mockReturnValue(qb);
  qb.orderBy.mockReturnValue(qb);
  qb.limit.mockReturnValue(qb);

  return qb;
};

describe('CaptainService', () => {
  const createService = () => {
    const usersRepo = {
      findOne: jest.fn(),
    };
    const tripsRepo = {
      count: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    const bookingsRepo = {
      createQueryBuilder: jest.fn(),
    };

    const service = new CaptainService(
      tripsRepo as unknown as Repository<Trip>,
      bookingsRepo as unknown as Repository<Booking>,
      usersRepo as unknown as Repository<User>,
    );

    return { service, usersRepo, tripsRepo, bookingsRepo };
  };

  it('rejects analytics for unknown captain', async () => {
    const { service, usersRepo } = createService();
    usersRepo.findOne.mockResolvedValue(null);

    await expect(service.getAnalytics('captain-1')).rejects.toMatchObject({
      response: { message: 'Capitão não encontrado' },
    });
  });

  it('returns analytics summary with parsed values', async () => {
    const { service, usersRepo, tripsRepo, bookingsRepo } = createService();
    const bookingsQb = createQueryBuilder({
      rawOne: { total: '1234.50', totalPassengers: '18' },
    });
    usersRepo.findOne.mockResolvedValue({
      id: 'captain-1',
      name: 'Marina',
      rating: '4.8',
      totalPoints: 4500,
      level: 6,
      totalTrips: 42,
    });
    tripsRepo.count
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(8)
      .mockResolvedValueOnce(2);
    bookingsRepo.createQueryBuilder.mockReturnValue(bookingsQb);

    const result = await service.getAnalytics('captain-1');

    expect(result).toEqual({
      captainName: 'Marina',
      rating: 4.8,
      level: 6,
      totalNavegaCoins: 4500,
      totalTrips: 10,
      completedTrips: 8,
      cancelledTrips: 2,
      completionRate: 80,
      totalRevenue: 1234.5,
      totalPassengers: 18,
    });
    expect(bookingsQb.andWhere).toHaveBeenCalledWith(
      'booking.payment_status = :status',
      { status: PaymentStatus.PAID },
    );
  });

  it('returns revenue series with typed number fields', async () => {
    const { service, bookingsRepo } = createService();
    const bookingsQb = createQueryBuilder({
      rawMany: [
        {
          date: new Date('2030-01-01T00:00:00.000Z'),
          amount: '150.25',
          bookings: '3',
        },
      ],
    });
    bookingsRepo.createQueryBuilder.mockReturnValue(bookingsQb);

    const result = await service.getRevenueSeries('captain-1', '7d');

    expect(result).toEqual([
      {
        date: new Date('2030-01-01T00:00:00.000Z'),
        amount: 150.25,
        bookings: 3,
      },
    ]);
  });

  it('returns top routes with numeric conversions', async () => {
    const { service, tripsRepo } = createService();
    const tripsQb = createQueryBuilder({
      rawMany: [
        {
          origin: 'Manaus',
          destination: 'Parintins',
          tripsCount: '9',
          totalRevenue: '4300.00',
          avgPrice: '477.78',
        },
      ],
    });
    tripsRepo.createQueryBuilder.mockReturnValue(tripsQb);

    const result = await service.getTopRoutes('captain-1');

    expect(result).toEqual([
      {
        origin: 'Manaus',
        destination: 'Parintins',
        tripsCount: 9,
        totalRevenue: 4300,
        avgPrice: 477.78,
      },
    ]);
    expect(tripsQb.andWhere).toHaveBeenCalledWith('trip.status = :status', {
      status: TripStatus.COMPLETED,
    });
  });

  it('returns recurring passengers with parsed rating and totals', async () => {
    const { service, bookingsRepo } = createService();
    const bookingsQb = createQueryBuilder({
      rawMany: [
        {
          passengerId: 'passenger-1',
          passengerName: 'Carlos',
          avatarUrl: 'https://cdn/avatar.jpg',
          passengerRating: '4.7',
          totalBookings: '5',
          totalSpent: '920.40',
          lastTrip: new Date('2030-02-01T00:00:00.000Z'),
        },
      ],
    });
    bookingsRepo.createQueryBuilder.mockReturnValue(bookingsQb);

    const result = await service.getRecurringPassengers('captain-1');

    expect(result).toEqual([
      {
        passengerId: 'passenger-1',
        passengerName: 'Carlos',
        avatarUrl: 'https://cdn/avatar.jpg',
        passengerRating: 4.7,
        totalBookings: 5,
        totalSpent: 920.4,
        lastTrip: new Date('2030-02-01T00:00:00.000Z'),
      },
    ]);
  });
});
