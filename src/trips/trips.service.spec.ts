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
      totalSeats: 20,
      availableSeats: 17,
      cargoCapacityKg: 100,
      availableCargoKg: 82,
      boat: { ownerId: 'owner1' },
    } as Trip;

    const bookings = [
      {
        id: 'b1',
        passengerId: 'p1',
        tripId: 'trip1',
        status: BookingStatus.CONFIRMED,
        seats: 3,
        paymentStatus: PaymentStatus.PAID,
        kmRedeemed: 500,
      },
      {
        id: 'b2',
        passengerId: 'p2',
        tripId: 'trip1',
        status: BookingStatus.PENDING,
        seats: 1,
        paymentStatus: PaymentStatus.PENDING,
        kmRedeemed: 0,
      },
    ] as Booking[];

    const shipments = [
      {
        id: 's1',
        senderId: 's1u',
        trackingCode: 'TRK1',
        paidBy: 'sender',
        status: ShipmentStatus.PENDING,
        weight: 10,
      },
      {
        id: 's2',
        senderId: 's2u',
        trackingCode: 'TRK2',
        paidBy: 'sender',
        status: ShipmentStatus.CANCELLED,
      },
      {
        id: 's3',
        senderId: 's3u',
        trackingCode: 'TRK3',
        paidBy: 'sender',
        status: ShipmentStatus.COLLECTED,
        weight: 8,
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
    expect(bookings[0].paymentStatus).toBe(PaymentStatus.REFUND_PENDING);
    expect(trip.availableSeats).toBe(20);
    expect(trip.availableCargoKg).toBe(92);
    expect(shipmentRepoTx.save).toHaveBeenCalledTimes(1);
    expect(timelineRepoTx.save).toHaveBeenCalledTimes(2);
    expect(shipments[2].status).toBe(ShipmentStatus.COLLECTED);

    const [passengerIds, passengerNotification] = notificationsService
      .sendToUsers.mock.calls[0] as [string[], { body: string }];
    expect(passengerIds).toEqual(expect.arrayContaining(['p1', 'p2']));
    expect(passengerNotification.body).toContain('reembolso manual');
    expect(gamificationService.refundKm).toHaveBeenCalledWith('p1', 500, 'b1');
    expect(notificationsService.sendToUser).toHaveBeenCalledWith(
      's1u',
      expect.any(Object),
    );
    const userNotificationCalls = notificationsService.sendToUser.mock
      .calls as Array<[string, { data?: { type?: string } }]>;
    const shipmentNotificationCall = userNotificationCalls.find(
      ([recipientId]) => recipientId === 's3u',
    );
    expect(shipmentNotificationCall).toBeDefined();
    expect(shipmentNotificationCall?.[1].data.type).toBe(
      'shipment_manual_resolution_required',
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
    tripForUpdate?: Trip | null;
  }) => {
    const conflictCount = overrides?.conflictCount ?? 0;
    const ownedBoats = overrides?.ownedBoats ?? [{ id: 'boat-1' }];
    const trips = overrides?.trips ?? [];
    const tripForUpdate = overrides?.tripForUpdate ?? null;

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
      findOne: jest.fn().mockResolvedValue(tripForUpdate),
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
      departureAt: new Date('2030-03-11T10:00:00.000Z'),
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
      departureTime: '2030-03-12T10:00:00.000Z',
      arrivalTime: '2030-03-12T14:00:00.000Z',
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
        newDepartureAt: new Date('2030-03-12T10:00:00.000Z'),
        newArrivalAt: new Date('2030-03-12T14:00:00.000Z'),
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
      departureTime: '2030-03-12T10:00:00.000Z',
      arrivalTime: '2030-03-14T14:00:00.000Z',
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

  it('returns a disabled shipment policy when the trip has no cargo price', async () => {
    const { service } = createService({
      conflictCount: 0,
    });

    const result = await service.create('captain-1', {
      origin: 'Manaus',
      destination: 'Itacoatiara',
      departureTime: '2030-03-12T10:00:00.000Z',
      arrivalTime: '2030-03-14T14:00:00.000Z',
      price: 250,
      totalSeats: 20,
      boatId: 'boat-1',
    });

    expect(result.cargoPriceKg).toBeNull();
    expect(result.acceptsShipments).toBe(false);
    expect(result.shipmentPricePerKg).toBeNull();
  });

  it('blocks creation when another active trip already occupies the boat time slot', async () => {
    const { service, tripsRepo } = createService({ conflictCount: 1 });

    await expect(
      service.create('captain-1', {
        origin: 'Manaus',
        destination: 'Parintins',
        departureTime: '2030-03-12T10:00:00.000Z',
        arrivalTime: '2030-03-12T14:00:00.000Z',
        price: 100,
        totalSeats: 10,
        boatId: 'boat-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(tripsRepo.save).not.toHaveBeenCalled();
  });

  it('blocks reducing total seats below the number of booked seats', async () => {
    const tripForUpdate = {
      id: 'trip-update-1',
      captainId: 'captain-1',
      boatId: 'boat-1',
      origin: 'Manaus',
      destination: 'Parintins',
      departureAt: new Date('2030-03-12T10:00:00.000Z'),
      estimatedArrivalAt: new Date('2030-03-12T14:00:00.000Z'),
      price: 100,
      totalSeats: 20,
      availableSeats: 17,
      status: TripStatus.SCHEDULED,
      cargoCapacityKg: 100,
      availableCargoKg: 90,
    } as Trip;
    const { service, tripsRepo } = createService({ tripForUpdate });

    await expect(
      service.update('trip-update-1', 'captain-1', {
        origin: 'Manaus',
        destination: 'Parintins',
        departureTime: '2030-03-12T10:00:00.000Z',
        arrivalTime: '2030-03-12T14:00:00.000Z',
        price: 100,
        totalSeats: 2,
        boatId: 'boat-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(tripsRepo.save).not.toHaveBeenCalled();
  });

  it('blocks reducing cargo capacity below currently used cargo', async () => {
    const tripForUpdate = {
      id: 'trip-update-2',
      captainId: 'captain-1',
      boatId: 'boat-1',
      origin: 'Manaus',
      destination: 'Parintins',
      departureAt: new Date('2030-03-12T10:00:00.000Z'),
      estimatedArrivalAt: new Date('2030-03-12T14:00:00.000Z'),
      price: 100,
      totalSeats: 20,
      availableSeats: 19,
      status: TripStatus.SCHEDULED,
      cargoCapacityKg: 100,
      availableCargoKg: 70,
    } as Trip;
    const { service, tripsRepo } = createService({ tripForUpdate });

    await expect(
      service.update('trip-update-2', 'captain-1', {
        origin: 'Manaus',
        destination: 'Parintins',
        departureTime: '2030-03-12T10:00:00.000Z',
        arrivalTime: '2030-03-12T14:00:00.000Z',
        price: 100,
        totalSeats: 20,
        boatId: 'boat-1',
        cargoCapacityKg: 20,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(tripsRepo.save).not.toHaveBeenCalled();
  });
});

describe('TripsService broader behaviors', () => {
  const createQb = () => {
    const qb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(0),
      getMany: jest.fn().mockResolvedValue([]),
      getOne: jest.fn().mockResolvedValue(null),
      getRawMany: jest.fn().mockResolvedValue([]),
    };

    return qb;
  };

  const createService = () => {
    const defaultTrip = {
      id: 'trip-x',
      captainId: 'captain-1',
      boatId: 'boat-1',
      status: TripStatus.SCHEDULED,
      origin: 'Manaus',
      destination: 'Parintins',
      departureAt: new Date('2030-01-01T10:00:00.000Z'),
      estimatedArrivalAt: new Date('2030-01-01T14:00:00.000Z'),
      originLat: -3.119,
      originLng: -60.0217,
      currentLat: null,
      currentLng: null,
      lastLocationAt: null,
      boat: { ownerId: 'owner-1', name: 'Barco 1' },
      captain: { name: 'CapitÃ£o 1' },
    } as Trip;

    const tripsRepoQb = createQb();
    const bookingsQb = createQb();

    const tripsRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(tripsRepoQb),
      manager: {
        createQueryBuilder: jest.fn().mockReturnValue(bookingsQb),
      },
      findOne: jest.fn().mockResolvedValue(defaultTrip),
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn((value: Trip) => Promise.resolve(value)),
      update: jest.fn().mockResolvedValue(undefined),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    const boatsRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 'boat-1',
        ownerId: 'captain-1',
        capacity: 20,
        isVerified: true,
      }),
      find: jest.fn().mockResolvedValue([{ id: 'boat-1' }]),
    };
    const usersRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 'captain-1',
        isVerified: true,
      }),
      find: jest.fn().mockResolvedValue([]),
    };
    const shipmentsRepo = {
      find: jest.fn().mockResolvedValue([]),
    };
    const favoritesRepo = {
      find: jest.fn().mockResolvedValue([]),
    };
    const shipmentsService = {
      updateShipmentsByTrip: jest.fn().mockResolvedValue(undefined),
    };
    const safetyService = {
      isChecklistComplete: jest.fn().mockResolvedValue(true),
    };
    const weatherService = {
      evaluateNavigationSafety: jest.fn().mockResolvedValue({
        score: 85,
        warnings: [],
        recommendations: [],
      }),
    };
    const floodService = {
      getFloodStatus: jest.fn().mockResolvedValue({ severity: 'NO_FLOODING' }),
    };
    const notificationsService = {
      sendToUsers: jest.fn().mockResolvedValue(undefined),
      sendToUser: jest.fn().mockResolvedValue(undefined),
      sendToTripPassengers: jest.fn().mockResolvedValue(undefined),
    };
    const bookingsService = {
      autoCompleteByTrip: jest.fn().mockResolvedValue(undefined),
    };
    const gamificationService = {
      awardBoatOwnerTripCompleted: jest.fn().mockResolvedValue(undefined),
    };
    const pdfService = {
      createCargoManifest: jest.fn().mockResolvedValue({
        filename: 'manifest.pdf',
        contentType: 'application/pdf',
        stream: Buffer.from('pdf'),
      }),
    };
    const boatStaffService = {
      getAssignedBoatIds: jest.fn().mockResolvedValue(['boat-1']),
      canManageBoat: jest.fn().mockResolvedValue({ canCreateTrips: true }),
    };
    const locationsService = {
      findConfirmedByName: jest.fn().mockResolvedValue(null),
    };

    const service = new TripsService(
      tripsRepo as unknown as Repository<Trip>,
      boatsRepo as unknown as Repository<Boat>,
      usersRepo as unknown as Repository<User>,
      shipmentsRepo as unknown as Repository<Shipment>,
      favoritesRepo as unknown as Repository<Favorite>,
      shipmentsService as unknown as ShipmentsService,
      safetyService as unknown as SafetyService,
      weatherService as unknown as WeatherService,
      floodService as unknown as FloodService,
      notificationsService as unknown as NotificationsService,
      bookingsService as unknown as BookingsService,
      gamificationService as unknown as GamificationService,
      pdfService as unknown as PdfService,
      boatStaffService as unknown as BoatStaffService,
      locationsService as unknown as LocationsService,
    );

    return {
      service,
      tripsRepo,
      tripsRepoQb,
      bookingsQb,
      shipmentsRepo,
      shipmentsService,
      safetyService,
      weatherService,
      notificationsService,
      bookingsService,
      gamificationService,
      pdfService,
      boatStaffService,
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('filters available trips by route and day', async () => {
    const { service, tripsRepo } = createService();
    tripsRepo.find.mockResolvedValue([
      {
        id: 'trip-1',
        status: TripStatus.SCHEDULED,
        departureAt: new Date('2030-01-02T10:00:00.000Z'),
      },
    ]);

    const result = await service.findAvailable('route-1', '2030-01-02');

    expect(result).toHaveLength(1);
    expect(tripsRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: TripStatus.SCHEDULED,
          routeId: 'route-1',
          departureAt: expect.any(Object),
        }),
      }),
    );
  });

  it('validates search numeric and date parameters', async () => {
    const { service } = createService();

    await expect(
      service.search(undefined, undefined, undefined, Number.NaN),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.search(undefined, undefined, 'invalid-date'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('builds search query with time window and rating filters', async () => {
    const { service, tripsRepoQb } = createService();
    tripsRepoQb.getMany.mockResolvedValue([
      {
        id: 'trip-2',
        status: TripStatus.SCHEDULED,
        boat: {
          photoUrl: 'https://cdn.example/boats/cover.jpg',
          photos: ['https://cdn.example/boats/gallery-1.jpg'],
        },
      },
    ]);

    const result = await service.search(
      'Manaus',
      'Parintins',
      '2030-01-02',
      50,
      300,
      'night',
      4,
      'route-2',
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      boatImageUrl: 'https://cdn.example/boats/cover.jpg',
      boatImages: ['https://cdn.example/boats/gallery-1.jpg'],
    });
    expect(tripsRepoQb.andWhere).toHaveBeenCalledWith(
      'trip.route_id = :routeId',
      { routeId: 'route-2' },
    );
    expect(tripsRepoQb.andWhere).toHaveBeenCalledWith(
      'EXTRACT(HOUR FROM trip.departure_at) >= 18 OR EXTRACT(HOUR FROM trip.departure_at) < 6',
    );
    expect(tripsRepoQb.andWhere).toHaveBeenCalledWith(
      'CAST(captain.rating AS DECIMAL) >= :minRating',
      { minRating: 4 },
    );
  });

  it('throws not found when fetching trip by id without result', async () => {
    const { service, tripsRepoQb } = createService();
    tripsRepoQb.getOne.mockResolvedValue(null);

    await expect(service.findById('missing')).rejects.toMatchObject({
      response: {
        message: expect.stringContaining('encontrada'),
      },
    });
  });

  it('returns captain management payload with passengers and shipments', async () => {
    const { service, tripsRepo, bookingsQb, shipmentsRepo } = createService();
    tripsRepo.findOne.mockResolvedValue({
      id: 'trip-3',
      captainId: 'captain-1',
      boatId: 'boat-1',
      status: TripStatus.SCHEDULED,
      origin: 'Manaus',
      destination: 'Parintins',
      departureAt: new Date('2030-01-02T10:00:00.000Z'),
      boat: { ownerId: 'owner-3' },
    });
    bookingsQb.getMany.mockResolvedValue([
      {
        id: 'booking-3',
        status: BookingStatus.CONFIRMED,
        paymentStatus: PaymentStatus.PAID,
        seats: 2,
        seatNumber: 8,
        totalPrice: 200,
        createdAt: new Date('2030-01-01T10:00:00.000Z'),
        passenger: {
          id: 'passenger-3',
          name: 'Maria',
          phone: '92999999999',
          avatarUrl: null,
          passengerRating: 4.8,
        },
      },
    ]);
    shipmentsRepo.find.mockResolvedValue([
      {
        id: 'shipment-3',
        trackingCode: 'NJ2030000003',
        validationCode: '123456',
        status: ShipmentStatus.PAID,
        description: 'Caixa',
        weightKg: 4,
        totalPrice: 45,
        paidBy: 'sender',
        recipientName: 'Jose',
        recipientPhone: '92988888888',
        recipientAddress: 'Rua A',
        collectionPhotoUrl: null,
        deliveryPhotoUrl: null,
        createdAt: new Date('2030-01-01T10:00:00.000Z'),
      },
    ]);

    const result = await service.findByIdForCaptain(
      'trip-3',
      'captain-1',
      'captain',
    );

    expect(result.totalPassageiros).toBe(1);
    expect(result.totalEncomendas).toBe(1);
    expect(result.passageiros[0].passenger?.id).toBe('passenger-3');
    expect(result.encomendas[0].trackingCode).toBe('NJ2030000003');
  });

  it('blocks start when checklist is not complete', async () => {
    const { service, tripsRepoQb, safetyService } = createService();
    tripsRepoQb.getOne.mockResolvedValue({
      id: 'trip-4',
      captainId: 'captain-1',
      status: TripStatus.SCHEDULED,
      origin: 'Manaus',
      destination: 'Parintins',
      boat: { ownerId: 'owner-4' },
    });
    safetyService.isChecklistComplete.mockResolvedValue(false);

    await expect(
      service.updateStatus(
        'trip-4',
        'captain-1',
        { status: TripStatus.IN_PROGRESS },
        'captain',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('starts trip with weather warning and notifies passengers', async () => {
    const {
      service,
      tripsRepoQb,
      weatherService,
      shipmentsService,
      notificationsService,
    } = createService();
    tripsRepoQb.getOne.mockResolvedValue({
      id: 'trip-5',
      captainId: 'captain-1',
      status: TripStatus.SCHEDULED,
      origin: 'Manaus',
      destination: 'Parintins',
      boat: { ownerId: 'owner-5' },
    });
    weatherService.evaluateNavigationSafety.mockResolvedValue({
      score: 65,
      warnings: ['Chuva moderada'],
      recommendations: ['Atenção na navegação'],
    });

    const result = await service.updateStatus(
      'trip-5',
      'captain-1',
      { status: TripStatus.IN_PROGRESS },
      'captain',
    );

    expect(result.status).toBe(TripStatus.IN_PROGRESS);
    expect(result.weatherWarning?.score).toBe(65);
    expect(shipmentsService.updateShipmentsByTrip).toHaveBeenCalledWith(
      'trip-5',
      ShipmentStatus.IN_TRANSIT,
    );
    expect(notificationsService.sendToTripPassengers).toHaveBeenCalledWith(
      'trip-5',
      expect.objectContaining({
        data: { type: 'trip_started', tripId: 'trip-5' },
      }),
    );
  });

  it('completes trip and triggers completion side effects', async () => {
    const {
      service,
      tripsRepoQb,
      shipmentsService,
      bookingsService,
      gamificationService,
      notificationsService,
    } = createService();
    tripsRepoQb.getOne.mockResolvedValue({
      id: 'trip-6',
      captainId: 'captain-1',
      status: TripStatus.IN_PROGRESS,
      origin: 'Manaus',
      destination: 'Parintins',
      boat: { ownerId: 'owner-6' },
    });

    const result = await service.updateStatus(
      'trip-6',
      'captain-1',
      { status: TripStatus.COMPLETED },
      'captain',
    );

    expect(result.status).toBe(TripStatus.COMPLETED);
    expect(notificationsService.sendToTripPassengers).toHaveBeenCalledWith(
      'trip-6',
      expect.objectContaining({
        data: { type: 'trip_completed', tripId: 'trip-6' },
      }),
    );
    expect(bookingsService.autoCompleteByTrip).toHaveBeenCalledWith('trip-6');
    expect(shipmentsService.updateShipmentsByTrip).toHaveBeenCalledWith(
      'trip-6',
      ShipmentStatus.ARRIVED,
    );
    expect(gamificationService.awardBoatOwnerTripCompleted).toHaveBeenCalledWith(
      'owner-6',
      'trip-6',
    );
  });

  it('updates and retrieves location snapshots by trip status', async () => {
    const { service, tripsRepo } = createService();

    tripsRepo.findOne
      .mockResolvedValueOnce({
        id: 'trip-7',
        captainId: 'captain-1',
        status: TripStatus.IN_PROGRESS,
      })
      .mockResolvedValueOnce({
        id: 'trip-7a',
        status: TripStatus.SCHEDULED,
        origin: 'Manaus',
        route: { originLat: -3.2, originLng: -60.1 },
      })
      .mockResolvedValueOnce({
        id: 'trip-7b',
        status: TripStatus.COMPLETED,
        route: { destinationLat: -2.6, destinationLng: -56.7 },
        lastLocationAt: new Date('2030-01-01T12:00:00.000Z'),
      })
      .mockResolvedValueOnce({
        id: 'trip-7c',
        status: TripStatus.IN_PROGRESS,
        origin: 'Manaus',
        originLat: -3.1,
        originLng: -60.0,
        currentLat: null,
        currentLng: null,
        lastLocationAt: null,
      });

    const updated = await service.updateLocation(
      'trip-7',
      'captain-1',
      { lat: -3.11, lng: -60.05 },
      'captain',
    );
    const scheduledLocation = await service.getLocation('trip-7a');
    const completedLocation = await service.getLocation('trip-7b');
    const fallbackLocation = await service.getLocation('trip-7c');

    expect(updated.lat).toBe(-3.11);
    expect(tripsRepo.update).toHaveBeenCalledWith(
      'trip-7',
      expect.objectContaining({
        currentLat: -3.11,
        currentLng: -60.05,
      }),
    );
    expect(scheduledLocation).toMatchObject({
      lat: -3.2,
      lng: -60.1,
      status: TripStatus.SCHEDULED,
    });
    expect(completedLocation).toMatchObject({
      lat: -2.6,
      lng: -56.7,
      status: TripStatus.COMPLETED,
    });
    expect(fallbackLocation).toMatchObject({
      lat: -3.1,
      lng: -60,
      status: TripStatus.IN_PROGRESS,
    });
  });

  it('enforces cargo manifest permissions and generates manifest for admin', async () => {
    const { service, tripsRepo, boatStaffService, shipmentsRepo, pdfService } =
      createService();
    tripsRepo.findOne
      .mockResolvedValueOnce({
        id: 'trip-8',
        captainId: 'captain-1',
        boatId: 'boat-1',
        origin: 'Manaus',
        destination: 'Parintins',
        departureAt: new Date('2030-01-01T10:00:00.000Z'),
        captain: { name: 'Capitão' },
        boat: { name: 'Barco 8' },
      })
      .mockResolvedValueOnce({
        id: 'trip-9',
        captainId: 'captain-1',
        boatId: 'boat-1',
        origin: 'Manaus',
        destination: 'Parintins',
        departureAt: new Date('2030-01-01T10:00:00.000Z'),
        captain: { name: 'Capitão' },
        boat: { name: 'Barco 9' },
      });
    boatStaffService.canManageBoat.mockResolvedValueOnce(null);
    shipmentsRepo.find.mockResolvedValueOnce([
      {
        trackingCode: 'NJ2030000009',
        description: 'Remetente caixa',
        recipientName: 'Jose',
        recipientAddress: 'Rua B',
        weight: 8,
        status: ShipmentStatus.PAID,
        totalPrice: 60,
      },
    ]);

    await expect(
      service.generateCargoManifestPdf('trip-8', 'manager-1', 'boat_manager'),
    ).rejects.toMatchObject({
      response: {
        message: expect.stringContaining('permissão'),
      },
    });

    const stream = await service.generateCargoManifestPdf(
      'trip-9',
      'admin-1',
      'admin',
    );

    expect(stream.filename).toBe('manifest.pdf');
    expect(pdfService.createCargoManifest).toHaveBeenCalled();
  });

  it('maps popular destinations and auto-cancels expired trips', async () => {
    const { service, tripsRepo } = createService();
    const originsQb = createQb();
    const destinationsQb = createQb();
    const routesQb = createQb();
    originsQb.getRawMany.mockResolvedValue([{ city: 'Manaus', count: '3' }]);
    destinationsQb.getRawMany.mockResolvedValue([
      { city: 'Parintins', count: '2' },
    ]);
    routesQb.getRawMany.mockResolvedValue([
      {
        routeId: 'route-10',
        origin: 'Manaus',
        destination: 'Parintins',
        count: '2',
        minPrice: '90',
        avgPrice: '120',
      },
    ]);
    tripsRepo.createQueryBuilder
      .mockReturnValueOnce(originsQb)
      .mockReturnValueOnce(destinationsQb)
      .mockReturnValueOnce(routesQb);

    const popular = await service.getPopularDestinations();

    expect(popular.origins[0]).toEqual({ city: 'Manaus', tripsCount: 3 });
    expect(popular.destinations[0]).toEqual({
      city: 'Parintins',
      tripsCount: 2,
    });
    expect(popular.routes[0]).toEqual(
      expect.objectContaining({
        routeId: 'route-10',
        minPrice: 90,
        avgPrice: 120,
      }),
    );

    tripsRepo.find.mockResolvedValue([
      {
        id: 'trip-expired-1',
        departureAt: new Date('2029-01-01T08:00:00.000Z'),
      },
      {
        id: 'trip-expired-2',
        departureAt: new Date('2029-01-01T09:00:00.000Z'),
      },
    ]);
    const cancelSpy = jest
      .spyOn(service, 'cancelTripWithPropagation')
      .mockResolvedValue({ id: 'x' } as never);

    await service.autoCancelExpiredTrips();

    expect(cancelSpy).toHaveBeenCalledTimes(2);
    expect(cancelSpy).toHaveBeenCalledWith('trip-expired-1');
    expect(cancelSpy).toHaveBeenCalledWith('trip-expired-2');
  });

  it('uses future departure filter when available date is not provided', async () => {
    const { service, tripsRepo } = createService();
    tripsRepo.find.mockResolvedValue([]);

    await service.findAvailable('route-future');

    expect(tripsRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          routeId: 'route-future',
          departureAt: expect.any(Object),
        }),
      }),
    );
  });

  it('falls back to the first boat gallery image when there is no cover image', async () => {
    const { service, tripsRepo } = createService();
    tripsRepo.find.mockResolvedValue([
      {
        id: 'trip-boat-image',
        status: TripStatus.SCHEDULED,
        boat: {
          photoUrl: null,
          photos: [
            'https://cdn.example/boats/gallery-1.jpg',
            'https://cdn.example/boats/gallery-2.jpg',
          ],
        },
      },
    ]);

    const result = await service.findAvailable();

    expect(result[0]).toMatchObject({
      boatImageUrl: 'https://cdn.example/boats/gallery-1.jpg',
      boatImages: [
        'https://cdn.example/boats/gallery-1.jpg',
        'https://cdn.example/boats/gallery-2.jpg',
      ],
    });
  });

  it('validates maxPrice and minRating search parameters', async () => {
    const { service } = createService();

    await expect(
      service.search(undefined, undefined, undefined, undefined, Number.NaN),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.search(
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        Number.NaN,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('applies morning and afternoon departure windows during search', async () => {
    const { service, tripsRepoQb } = createService();
    tripsRepoQb.getMany.mockResolvedValue([]);

    await service.search('Manaus', 'Parintins', '2030-01-03', 10, 100, 'morning');
    await service.search(
      'Manaus',
      'Parintins',
      '2030-01-03',
      10,
      100,
      'afternoon',
    );

    expect(tripsRepoQb.andWhere).toHaveBeenCalledWith(
      'EXTRACT(HOUR FROM trip.departure_at) >= 6 AND EXTRACT(HOUR FROM trip.departure_at) < 12',
    );
    expect(tripsRepoQb.andWhere).toHaveBeenCalledWith(
      'EXTRACT(HOUR FROM trip.departure_at) >= 12 AND EXTRACT(HOUR FROM trip.departure_at) < 18',
    );
  });

  it('blocks boat manager access to captain payload without boat assignment', async () => {
    const { service, tripsRepo, boatStaffService } = createService();
    tripsRepo.findOne.mockResolvedValue({
      id: 'trip-denied',
      captainId: 'captain-1',
      boatId: 'boat-1',
      status: TripStatus.SCHEDULED,
    });
    boatStaffService.canManageBoat.mockResolvedValueOnce(null);

    await expect(
      service.findByIdForCaptain('trip-denied', 'manager-1', 'boat_manager'),
    ).rejects.toMatchObject({
      response: { message: expect.stringContaining('permiss') },
    });
  });

  it('delegates to cancellation propagation when status is already cancelled', async () => {
    const { service, tripsRepoQb } = createService();
    tripsRepoQb.getOne.mockResolvedValue({
      id: 'trip-cancelled',
      captainId: 'captain-1',
      boatId: 'boat-1',
      status: TripStatus.CANCELLED,
      origin: 'Manaus',
      destination: 'Parintins',
      boat: { ownerId: 'owner-c' },
    });
    const cancelSpy = jest
      .spyOn(service, 'cancelTripWithPropagation')
      .mockResolvedValue({ id: 'trip-cancelled' } as never);

    await service.updateStatus(
      'trip-cancelled',
      'captain-1',
      { status: TripStatus.CANCELLED },
      'captain',
    );

    expect(cancelSpy).toHaveBeenCalledWith('trip-cancelled', {
      userId: 'captain-1',
      role: 'captain',
      notifyBoatOwner: false,
    });
  });
});
