import { GamificationService } from './gamification.service';
import { PointAction } from './point-transaction.entity';
import type { Repository } from 'typeorm';
import type { PointTransaction } from './point-transaction.entity';
import type { User } from '../users/user.entity';
import type { Referral } from './referral.entity';
import type { KmTransaction } from './km-transaction.entity';

describe('GamificationService owner rewards', () => {
  it('awards boat owner trip points only once per trip', async () => {
    const pointsRepo = {
      findOne: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({
        id: 'tx-existing',
        userId: 'owner-1',
        action: PointAction.BOAT_OWNER_TRIP_COMPLETED,
        referenceId: 'trip-1',
      }),
      create: jest.fn((value: Partial<PointTransaction>) => value),
      save: jest.fn((value: Partial<PointTransaction>) =>
        Promise.resolve({ id: 'tx-1', ...value }),
      ),
    };
    const usersRepo = {
      increment: jest.fn().mockResolvedValue(undefined),
      findOne: jest.fn().mockResolvedValue({
        id: 'owner-1',
        totalPoints: 20,
        level: 'Marinheiro',
      }),
      update: jest.fn().mockResolvedValue(undefined),
    };

    const service = new GamificationService(
      pointsRepo as unknown as Repository<PointTransaction>,
      usersRepo as unknown as Repository<User>,
      {} as Repository<Referral>,
      {} as Repository<KmTransaction>,
    );

    const first = await service.awardBoatOwnerTripCompleted(
      'owner-1',
      'trip-1',
    );
    const second = await service.awardBoatOwnerTripCompleted(
      'owner-1',
      'trip-1',
    );

    expect(first).toEqual(
      expect.objectContaining({
        action: PointAction.BOAT_OWNER_TRIP_COMPLETED,
        points: 20,
        referenceId: 'trip-1',
      }),
    );
    expect(second).toBeNull();
    expect(pointsRepo.save).toHaveBeenCalledTimes(1);
    expect(usersRepo.increment).toHaveBeenCalledWith(
      { id: 'owner-1' },
      'totalPoints',
      20,
    );
  });
});
