/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
import { BoatsService } from './boats.service';
import { TripStatus } from '../trips/trip.entity';
import type { Repository } from 'typeorm';
import type { Boat } from './boat.entity';
import type { Review } from '../reviews/review.entity';
import type { Trip } from '../trips/trip.entity';
import { UserRole } from '../users/user.entity';
import type { User } from '../users/user.entity';
import type { Favorite } from '../favorites/favorite.entity';
import type { BoatStaff } from '../boat-staff/boat-staff.entity';
import type { NotificationsService } from '../notifications/notifications.service';

describe('BoatsService', () => {
  const createService = () => {
    const boatsRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn((data) => ({ id: 'boat-created', ...data })),
      save: jest.fn((data) => Promise.resolve(data)),
      update: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    const reviewsQueryBuilder = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue(undefined),
    };
    const reviewsRepo = {
      find: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(reviewsQueryBuilder),
    };
    const tripsRepo = {
      count: jest.fn(),
      manager: {
        query: jest.fn().mockResolvedValue(undefined),
      },
    };
    const usersRepo = {
      findOne: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const favoritesRepo = {
      delete: jest.fn().mockResolvedValue(undefined),
    };
    const boatStaffRepo = {
      find: jest.fn(),
      delete: jest.fn().mockResolvedValue(undefined),
      count: jest.fn(),
    };
    const notificationsService = {
      sendToUser: jest.fn().mockResolvedValue(undefined),
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

    return {
      service,
      boatsRepo,
      reviewsRepo,
      reviewsQueryBuilder,
      tripsRepo,
      usersRepo,
      favoritesRepo,
      boatStaffRepo,
      notificationsService,
    };
  };

  it('creates boat only for verified captains', async () => {
    const { service, usersRepo, boatsRepo } = createService();
    usersRepo.findOne
      .mockResolvedValueOnce({ id: 'captain-1', isVerified: false })
      .mockResolvedValueOnce({ id: 'captain-1', isVerified: true });

    await expect(
      service.create('captain-1', { name: 'Barco A' } as never),
    ).rejects.toMatchObject({
      response: {
        message: expect.stringMatching(/documenta/i),
      },
    });

    const created = await service.create('captain-1', {
      name: 'Barco B',
      type: 'Lancha',
    } as never);

    expect(boatsRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: 'captain-1', name: 'Barco B' }),
    );
    expect(created).toMatchObject({ ownerId: 'captain-1', name: 'Barco B' });
  });

  it('updates boat and resets verification when new document photos are sent', async () => {
    const { service, boatsRepo, reviewsRepo, tripsRepo } = createService();
    boatsRepo.findOne.mockResolvedValue({
      id: 'boat-1',
      ownerId: 'captain-1',
      isVerified: true,
      rejectionReason: 'old',
      verifiedAt: new Date('2025-01-01T00:00:00.000Z'),
    });
    boatsRepo.update.mockResolvedValue(undefined);
    boatsRepo.findOne.mockResolvedValueOnce({
      id: 'boat-1',
      ownerId: 'captain-1',
      isVerified: true,
      rejectionReason: 'old',
      verifiedAt: new Date('2025-01-01T00:00:00.000Z'),
    });
    boatsRepo.findOne.mockResolvedValueOnce({
      id: 'boat-1',
      ownerId: 'captain-1',
      owner: null,
    });
    reviewsRepo.find.mockResolvedValue([]);
    tripsRepo.count.mockResolvedValue(0);

    await service.update('boat-1', 'captain-1', {
      documentPhotos: ['https://cdn/doc.jpg'],
    } as never);

    expect(boatsRepo.update).toHaveBeenCalledWith(
      'boat-1',
      expect.objectContaining({
        documentPhotos: ['https://cdn/doc.jpg'],
        isVerified: false,
        rejectionReason: null,
        verifiedAt: null,
      }),
    );
  });

  it('returns accessible boats by role', async () => {
    const { service, boatStaffRepo, boatsRepo } = createService();
    boatStaffRepo.find.mockResolvedValue([
      {
        boat: { id: 'boat-1', name: 'Barco Gestor' },
      },
      {
        boat: null,
      },
    ]);
    boatsRepo.find.mockResolvedValue([{ id: 'boat-2', name: 'Barco Capitao' }]);

    const managerBoats = await service.findAccessibleBoats(
      'user-1',
      'boat_manager',
    );
    const captainBoats = await service.findAccessibleBoats('user-2', 'captain');

    expect(managerBoats).toEqual([{ id: 'boat-1', name: 'Barco Gestor' }]);
    expect(captainBoats).toEqual([{ id: 'boat-2', name: 'Barco Capitao' }]);
  });

  it('returns boat detail with mapped owner, reviews and rating stats', async () => {
    const { service, boatsRepo, reviewsRepo, tripsRepo } = createService();
    boatsRepo.findOne.mockResolvedValue({
      id: 'boat-1',
      ownerId: 'captain-1',
      name: 'Amazon Star',
      owner: {
        id: 'captain-1',
        name: 'Capitao',
        avatarUrl: 'https://cdn/avatar.jpg',
        rating: 4.9,
        totalTrips: 20,
      },
    });
    reviewsRepo.find.mockResolvedValue([
      {
        id: 'rev-1',
        boatRating: 5,
        boatComment: 'Excelente',
        captainRating: 5,
        captainComment: 'Top',
        createdAt: new Date('2030-01-01T00:00:00.000Z'),
        reviewer: { id: 'u-1', name: 'Ana', avatarUrl: 'https://cdn/a.jpg' },
        trip: {
          id: 'trip-1',
          origin: 'Manaus',
          destination: 'Parintins',
          departureAt: new Date('2030-01-02T00:00:00.000Z'),
        },
      },
      {
        id: 'rev-2',
        boatRating: 3,
        boatComment: 'Bom',
        captainRating: 4,
        captainComment: 'ok',
        createdAt: new Date('2030-01-03T00:00:00.000Z'),
        reviewer: null,
        trip: null,
      },
      {
        id: 'rev-3',
        boatRating: null,
      },
    ]);
    tripsRepo.count.mockResolvedValue(12);

    const result = await service.findById('boat-1');

    expect(result.owner).toEqual({
      id: 'captain-1',
      name: 'Capitao',
      avatarUrl: 'https://cdn/avatar.jpg',
      rating: 4.9,
      totalTrips: 20,
    });
    expect(result.tripsCount).toBe(12);
    expect(result.reviewCount).toBe(2);
    expect(result.ratingStats).toEqual({
      total: 2,
      average: 4,
      distribution: { 1: 0, 2: 0, 3: 1, 4: 0, 5: 1 },
    });
    expect(result.recentReviews).toHaveLength(3);
  });

  it('rejects delete when boat has active trips', async () => {
    const { service, boatsRepo, tripsRepo } = createService();
    boatsRepo.findOne.mockResolvedValue({
      id: 'boat-1',
      ownerId: 'captain-1',
      name: 'Barco',
    });
    tripsRepo.count.mockResolvedValue(1);

    await expect(service.delete('boat-1', 'captain-1')).rejects.toMatchObject({
      response: {
        message: expect.stringMatching(/viagens activas/i),
      },
    });
  });

  it('removes boat favorites before deleting the boat', async () => {
    const {
      service,
      boatsRepo,
      tripsRepo,
      favoritesRepo,
      boatStaffRepo,
      usersRepo,
      notificationsService,
    } = createService();
    boatsRepo.findOne.mockResolvedValue({
      id: 'boat-1',
      ownerId: 'captain-1',
      name: 'Expresso Rio',
    });
    tripsRepo.count.mockResolvedValue(0);
    boatStaffRepo.find.mockResolvedValue([{ userId: 'manager-1' }]);
    boatStaffRepo.count.mockResolvedValue(0);

    await service.delete('boat-1', 'captain-1');

    expect(tripsRepo.count).toHaveBeenCalledWith({
      where: [
        { boatId: 'boat-1', status: TripStatus.SCHEDULED },
        { boatId: 'boat-1', status: TripStatus.IN_PROGRESS },
      ],
    });
    expect(usersRepo.update).toHaveBeenCalledWith('manager-1', {
      role: UserRole.PASSENGER,
    });
    expect(notificationsService.sendToUser).toHaveBeenCalledWith(
      'manager-1',
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'boat_deleted',
          boatId: 'boat-1',
        }),
      }),
    );
    expect(favoritesRepo.delete).toHaveBeenCalledWith({ boatId: 'boat-1' });
    expect(boatsRepo.delete).toHaveBeenCalledWith('boat-1');
  });
});
