import { BoatsService } from './boats.service';
import { TripStatus } from '../trips/trip.entity';
import type { Repository } from 'typeorm';
import type { Boat } from './boat.entity';
import type { Review } from '../reviews/review.entity';
import type { Trip } from '../trips/trip.entity';
import type { User } from '../users/user.entity';
import type { Favorite } from '../favorites/favorite.entity';
import type { BoatStaff } from '../boat-staff/boat-staff.entity';
import type { NotificationsService } from '../notifications/notifications.service';

describe('BoatsService.delete', () => {
  it('removes boat favorites before deleting the boat', async () => {
    const boatsRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 'boat-1',
        ownerId: 'captain-1',
        name: 'Expresso Rio',
      }),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    const reviewsQueryBuilder = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue(undefined),
    };
    const reviewsRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(reviewsQueryBuilder),
    };
    const tripsRepo = {
      count: jest.fn().mockResolvedValue(0),
      manager: {
        query: jest.fn().mockResolvedValue(undefined),
      },
    };
    const usersRepo = {
      update: jest.fn().mockResolvedValue(undefined),
    };
    const favoritesRepo = {
      delete: jest.fn().mockResolvedValue(undefined),
    };
    const boatStaffRepo = {
      find: jest.fn().mockResolvedValue([]),
      delete: jest.fn().mockResolvedValue(undefined),
      count: jest.fn().mockResolvedValue(0),
    };
    const notificationsService = {
      sendToUser: jest.fn(),
    };

    const service = new BoatsService(
      boatsRepo as unknown as Repository<Boat>,
      reviewsRepo as unknown as Repository<Review>,
      tripsRepo as unknown as Repository<Trip>,
      usersRepo as unknown as Repository<User>,
      favoritesRepo as unknown as Repository<Favorite>,
      boatStaffRepo as unknown as Repository<BoatStaff>,
      notificationsService as unknown as NotificationsService,
    );

    await service.delete('boat-1', 'captain-1');

    expect(tripsRepo.count).toHaveBeenCalledWith({
      where: [
        { boatId: 'boat-1', status: TripStatus.SCHEDULED },
        { boatId: 'boat-1', status: TripStatus.IN_PROGRESS },
      ],
    });
    expect(favoritesRepo.delete).toHaveBeenCalledWith({ boatId: 'boat-1' });
    expect(boatsRepo.delete).toHaveBeenCalledWith('boat-1');
  });
});
