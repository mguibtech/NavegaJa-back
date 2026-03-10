import { BadRequestException } from '@nestjs/common';
import { TripsService } from './trips.service';
import { Trip, TripStatus } from './trip.entity';
import { Shipment, ShipmentStatus } from '../shipments/shipment.entity';
import {
  Booking,
  BookingStatus,
  PaymentStatus,
} from '../bookings/booking.entity';
import { ShipmentTimeline } from '../shipments/shipment-timeline.entity';
import type { Repository } from 'typeorm';
import type { Boat } from '../boats/boat.entity';
import type { User } from '../users/user.entity';
import type { Favorite } from '../favorites/favorite.entity';
import type { ShipmentsService } from '../shipments/shipments.service';
import type { SafetyService } from '../safety/safety.service';
import type { WeatherService } from '../weather/weather.service';
import type { FloodService } from '../weather/flood.service';
import type { NotificationsService } from '../notifications/notifications.service';
import type { BookingsService } from '../bookings/bookings.service';
import type { GamificationService } from '../gamification/gamification.service';
import type { PdfService } from '../pdf/pdf.service';
import type { BoatStaffService } from '../boat-staff/boat-staff.service';
import type { LocationsService } from '../locations/locations.service';

type TransactionManager = {
  getRepository: (entity: unknown) => unknown;
};
type TransactionCallback<T> = (manager: TransactionManager) => Promise<T> | T;

describe('TripsService.cancelTripWithPropagation', () => {
  let service: TripsService;
  let notificationsService: { sendToUsers: jest.Mock; sendToUser: jest.Mock };
  let gamificationService: { refundKm: jest.Mock };
  let tripsRepo: { manager: { transaction: jest.Mock } };

  beforeEach(() => {
    notificationsService = {
      sendToUsers: jest.fn(),
      sendToUser: jest.fn(),
    };
    gamificationService = {
      refundKm: jest.fn(),
    };

    tripsRepo = {
      manager: {
        transaction: jest.fn(),
      },
    };

    service = new TripsService(
      tripsRepo as unknown as Repository<Trip>,
      {} as Repository<Boat>,
      {} as Repository<User>,
      {} as Repository<Shipment>,
      {} as Repository<Favorite>,
      {} as ShipmentsService,
      {} as SafetyService,
      {} as WeatherService,
      {} as FloodService,
      notificationsService as unknown as NotificationsService,
      {} as BookingsService,
      gamificationService as unknown as GamificationService,
      {} as PdfService,
      {} as BoatStaffService,
      {} as LocationsService,
    );
  });

  it('cancels trip, bookings, shipments and notifies', async () => {
    const trip = {
      id: 'trip1',
      status: TripStatus.SCHEDULED,
      origin: 'Manaus',
      destination: 'Parintins',
      boat: { ownerId: 'owner1' },
    } as Trip;

    const bookings = [
      {
        id: 'b1',
        passengerId: 'p1',
        tripId: 'trip1',
        status: BookingStatus.CONFIRMED,
        paymentStatus: PaymentStatus.PAID,
        kmRedeemed: 500,
      },
      {
        id: 'b2',
        passengerId: 'p2',
        tripId: 'trip1',
        status: BookingStatus.PENDING,
        paymentStatus: PaymentStatus.PENDING,
        kmRedeemed: 0,
      },
    ] as Booking[];

    const shipments = [
      {
        id: 's1',
        senderId: 's1u',
        trackingCode: 'TRK1',
        status: ShipmentStatus.PENDING,
      },
      {
        id: 's2',
        senderId: 's2u',
        trackingCode: 'TRK2',
        status: ShipmentStatus.CANCELLED,
      },
    ] as Shipment[];

    const tripRepoTx = {
      findOne: jest.fn().mockResolvedValue(trip),
      save: jest.fn((value: Trip) => Promise.resolve(value)),
    };
    const bookingRepoTx = {
      find: jest.fn().mockResolvedValue(bookings),
      save: jest.fn((value: Booking) => Promise.resolve(value)),
    };
    const shipmentRepoTx = {
      find: jest.fn().mockResolvedValue(shipments),
      save: jest.fn((value: Shipment) => Promise.resolve(value)),
    };
    const timelineRepoTx = {
      create: jest.fn((value: ShipmentTimeline) => value),
      save: jest.fn((value: ShipmentTimeline) => Promise.resolve(value)),
    };

    const manager: TransactionManager = {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === Trip) return tripRepoTx;
        if (entity === Booking) return bookingRepoTx;
        if (entity === Shipment) return shipmentRepoTx;
        if (entity === ShipmentTimeline) return timelineRepoTx;
        throw new Error('unexpected repository');
      }),
    };

    tripsRepo.manager.transaction.mockImplementation(
      (cb: TransactionCallback<Trip>) => Promise.resolve(cb(manager)),
    );

    const result = await service.cancelTripWithPropagation('trip1', {
      userId: 'manager1',
      role: 'boat_manager',
      notifyBoatOwner: true,
    });

    expect(result.status).toBe(TripStatus.CANCELLED);
    expect(tripRepoTx.save).toHaveBeenCalledTimes(1);
    expect(bookingRepoTx.save).toHaveBeenCalledTimes(2);
    expect(bookings[0].status).toBe(BookingStatus.CANCELLED);
    expect(bookings[0].paymentStatus).toBe(PaymentStatus.REFUNDED);
    expect(shipmentRepoTx.save).toHaveBeenCalledTimes(1);
    expect(timelineRepoTx.save).toHaveBeenCalledTimes(1);

    expect(notificationsService.sendToUsers).toHaveBeenCalledWith(
      expect.arrayContaining(['p1', 'p2']),
      expect.any(Object),
    );
    expect(gamificationService.refundKm).toHaveBeenCalledWith('p1', 500, 'b1');
    expect(notificationsService.sendToUser).toHaveBeenCalledWith(
      's1u',
      expect.any(Object),
    );
    expect(notificationsService.sendToUser).toHaveBeenCalledWith(
      'owner1',
      expect.any(Object),
    );
  });

  it('is idempotent when already cancelled', async () => {
    const trip = {
      id: 'trip1',
      status: TripStatus.CANCELLED,
      origin: 'Manaus',
      destination: 'Parintins',
      boat: { ownerId: 'owner1' },
    } as Trip;

    const tripRepoTx = {
      findOne: jest.fn().mockResolvedValue(trip),
      save: jest.fn((value: Trip) => Promise.resolve(value)),
    };
    const bookingRepoTx = {
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn((value: Booking) => Promise.resolve(value)),
    };
    const shipmentRepoTx = {
      find: jest.fn().mockResolvedValue([
        { id: 's1', status: ShipmentStatus.CANCELLED },
        { id: 's2', status: ShipmentStatus.DELIVERED },
      ]),
      save: jest.fn((value: Shipment) => Promise.resolve(value)),
    };
    const timelineRepoTx = {
      create: jest.fn((value: ShipmentTimeline) => value),
      save: jest.fn((value: ShipmentTimeline) => Promise.resolve(value)),
    };

    const manager: TransactionManager = {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === Trip) return tripRepoTx;
        if (entity === Booking) return bookingRepoTx;
        if (entity === Shipment) return shipmentRepoTx;
        if (entity === ShipmentTimeline) return timelineRepoTx;
        throw new Error('unexpected repository');
      }),
    };

    tripsRepo.manager.transaction.mockImplementation(
      (cb: TransactionCallback<Trip>) => Promise.resolve(cb(manager)),
    );

    const result = await service.cancelTripWithPropagation('trip1');

    expect(result.status).toBe(TripStatus.CANCELLED);
    expect(tripRepoTx.save).not.toHaveBeenCalled();
    expect(bookingRepoTx.save).not.toHaveBeenCalled();
    expect(shipmentRepoTx.save).not.toHaveBeenCalled();
    expect(timelineRepoTx.save).not.toHaveBeenCalled();
    expect(notificationsService.sendToUsers).not.toHaveBeenCalled();
    expect(notificationsService.sendToUser).not.toHaveBeenCalled();
    expect(gamificationService.refundKm).not.toHaveBeenCalled();
  });
});

describe('TripsService trip ownership and conflict rules', () => {
  const createService = (overrides?: {
    conflictCount?: number;
    ownedBoats?: Array<{ id: string }>;
    trips?: Trip[];
  }) => {
    const conflictCount = overrides?.conflictCount ?? 0;
    const ownedBoats = overrides?.ownedBoats ?? [{ id: 'boat-1' }];
    const trips = overrides?.trips ?? [];

    const conflictQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(conflictCount),
    };

    const tripsRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(conflictQueryBuilder),
      create: jest.fn((value: Partial<Trip>) => value as Trip),
      save: jest.fn((value: Trip) =>
        Promise.resolve({
          id: 'trip-new',
          status: TripStatus.SCHEDULED,
          ...value,
        } as Trip),
      ),
      find: jest.fn().mockResolvedValue(trips),
    };

    const usersRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 'captain-1',
        isVerified: true,
        name: 'Captain',
      }),
    };

    const boatsRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 'boat-1',
        ownerId: 'captain-1',
        capacity: 20,
        isVerified: true,
        name: 'Barco Teste',
      }),
      find: jest.fn().mockResolvedValue(ownedBoats),
    };

    const favoritesRepo = {
      find: jest.fn().mockResolvedValue([]),
    };

    const floodService = {
      getFloodStatus: jest.fn().mockResolvedValue({
        severity: 'NO_FLOODING',
      }),
    };

    const service = new TripsService(
      tripsRepo as unknown as Repository<Trip>,
      boatsRepo as unknown as Repository<Boat>,
      usersRepo as unknown as Repository<User>,
      {} as Repository<Shipment>,
      favoritesRepo as unknown as Repository<Favorite>,
      {} as ShipmentsService,
      {} as SafetyService,
      {} as WeatherService,
      floodService as unknown as FloodService,
      {
        sendToUsers: jest.fn(),
        sendToUser: jest.fn(),
        sendToTripPassengers: jest.fn(),
      } as unknown as NotificationsService,
      {} as BookingsService,
      {} as GamificationService,
      {} as PdfService,
      {
        getAssignedBoatIds: jest.fn().mockResolvedValue(['boat-1']),
        canManageBoat: jest.fn().mockResolvedValue({
          canCreateTrips: true,
        }),
      } as unknown as BoatStaffService,
      {
        findConfirmedByName: jest.fn().mockResolvedValue(null),
      } as unknown as LocationsService,
    );

    return {
      service,
      tripsRepo,
      conflictQueryBuilder,
    };
  };

  it('lists trips from boats owned by the captain even when another user created them', async () => {
    const managerTrip = {
      id: 'trip-manager',
      captainId: 'manager-1',
      boatId: 'boat-1',
      status: TripStatus.SCHEDULED,
      departureAt: new Date('2026-03-11T10:00:00.000Z'),
    } as Trip;

    const { service } = createService({
      trips: [managerTrip],
    });

    const result = await service.findByCaptain('captain-1');

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('trip-manager');
    expect(result[0].boatId).toBe('boat-1');
  });

  it('only treats scheduled and in-progress trips as blocking conflicts', async () => {
    const { service, conflictQueryBuilder } = createService();

    await service.create('captain-1', {
      origin: 'Manaus',
      destination: 'Parintins',
      departureTime: '2026-03-12T10:00:00.000Z',
      arrivalTime: '2026-03-12T14:00:00.000Z',
      price: 100,
      totalSeats: 10,
      boatId: 'boat-1',
    });

    expect(conflictQueryBuilder.andWhere).toHaveBeenCalledWith(
      'trip.status IN (:...statuses)',
      {
        statuses: [TripStatus.SCHEDULED, TripStatus.IN_PROGRESS],
      },
    );
    expect(conflictQueryBuilder.where).toHaveBeenCalledWith(
      'trip.boat_id = :boatId',
      { boatId: 'boat-1' },
    );
    expect(conflictQueryBuilder.andWhere).toHaveBeenCalledWith(
      'trip.departure_at < :newArrivalAt AND COALESCE(trip.estimated_arrival_at, trip.departure_at) > :newDepartureAt',
      expect.objectContaining({
        newDepartureAt: new Date('2026-03-12T10:00:00.000Z'),
        newArrivalAt: new Date('2026-03-12T14:00:00.000Z'),
      }),
    );
  });

  it('allows creation when overlapping trips are only cancelled or completed', async () => {
    const { service, tripsRepo, conflictQueryBuilder } = createService({
      conflictCount: 0,
    });

    const result = await service.create('captain-1', {
      origin: 'Manaus',
      destination: 'Itacoatiara',
      departureTime: '2026-03-12T10:00:00.000Z',
      arrivalTime: '2026-03-14T14:00:00.000Z',
      price: 250,
      cargoPriceKg: 35,
      totalSeats: 20,
      boatId: 'boat-1',
    });

    expect(conflictQueryBuilder.andWhere).toHaveBeenCalledWith(
      'trip.status IN (:...statuses)',
      {
        statuses: [TripStatus.SCHEDULED, TripStatus.IN_PROGRESS],
      },
    );
    expect(tripsRepo.save).toHaveBeenCalledTimes(1);
    expect(result.id).toBe('trip-new');
  });

  it('blocks creation when another active trip already occupies the boat time slot', async () => {
    const { service, tripsRepo } = createService({ conflictCount: 1 });

    await expect(
      service.create('captain-1', {
        origin: 'Manaus',
        destination: 'Parintins',
        departureTime: '2026-03-12T10:00:00.000Z',
        arrivalTime: '2026-03-12T14:00:00.000Z',
        price: 100,
        totalSeats: 10,
        boatId: 'boat-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(tripsRepo.save).not.toHaveBeenCalled();
  });
});
