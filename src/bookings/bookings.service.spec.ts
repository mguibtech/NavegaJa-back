import { BadRequestException } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { BookingStatus, PaymentMethod, PaymentStatus } from './booking.entity';
import type { Repository } from 'typeorm';
import type { Booking } from './booking.entity';
import type { Trip } from '../trips/trip.entity';
import { TripStatus } from '../trips/trip.entity';
import { UserRole, type User } from '../users/user.entity';
import type { GamificationService } from '../gamification/gamification.service';

describe('BookingsService owner rewards', () => {
  it('awards boat owner points when a booking is completed', async () => {
    const booking = {
      id: 'booking-1',
      passengerId: 'passenger-1',
      tripId: 'trip-1',
      status: BookingStatus.CHECKED_IN,
      paymentMethod: PaymentMethod.PIX,
      paymentStatus: PaymentStatus.PAID,
      trip: {
        route: { distanceKm: 120 },
        boat: { ownerId: 'owner-1' },
      },
    } as unknown as Booking;

    const bookingsRepo = {
      findOne: jest.fn().mockResolvedValue(booking),
      save: jest.fn((value: Booking) => Promise.resolve(value)),
    };
    const gamificationService = {
      awardPoints: jest.fn().mockResolvedValue(undefined),
      checkFirstTripOfMonthBonus: jest.fn().mockResolvedValue(undefined),
      convertReferral: jest.fn().mockResolvedValue(undefined),
      awardBoatOwnerPassengerCompleted: jest.fn().mockResolvedValue(undefined),
      creditKm: jest.fn().mockResolvedValue(undefined),
    };

    const service = new BookingsService(
      bookingsRepo as unknown as Repository<Booking>,
      {} as Repository<Trip>,
      {} as Repository<User>,
      gamificationService as unknown as GamificationService,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await service.complete('booking-1');

    expect(
      gamificationService.awardBoatOwnerPassengerCompleted,
    ).toHaveBeenCalledWith('owner-1', 'booking-1');
  });
});

describe('BookingsService cancellation policy', () => {
  it('rejects cancellation after check-in', async () => {
    const booking = {
      id: 'booking-2',
      passengerId: 'passenger-1',
      tripId: 'trip-1',
      status: BookingStatus.CHECKED_IN,
      paymentStatus: PaymentStatus.PAID,
    } as unknown as Booking;

    const service = new BookingsService(
      {
        findOne: jest.fn().mockResolvedValue(booking),
      } as unknown as Repository<Booking>,
      {} as Repository<Trip>,
      {} as Repository<User>,
      {} as GamificationService,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.cancel('booking-2', 'passenger-1'),
    ).rejects.toMatchObject({
      response: {
        message:
          'Cancelamento não permitido: o passageiro já realizou check-in/embarque.',
      },
    });
  });

  it('marks paid bookings as refund_pending and restores seats', async () => {
    const booking = {
      id: 'booking-3',
      passengerId: 'passenger-1',
      tripId: 'trip-1',
      seats: 2,
      status: BookingStatus.CONFIRMED,
      paymentStatus: PaymentStatus.PAID,
      kmRedeemed: 500,
    } as unknown as Booking;
    const trip = {
      id: 'trip-1',
      availableSeats: 8,
    } as Trip;

    const bookingsRepo = {
      findOne: jest.fn().mockResolvedValue(booking),
      save: jest.fn((value: Booking) => Promise.resolve(value)),
    };
    const tripsRepo = {
      findOne: jest.fn().mockResolvedValue(trip),
      save: jest.fn((value: Trip) => Promise.resolve(value)),
    };
    const gamificationService = {
      refundKm: jest.fn().mockResolvedValue(undefined),
    };
    const notificationsService = {
      sendToUser: jest.fn().mockResolvedValue(undefined),
    };

    const service = new BookingsService(
      bookingsRepo as unknown as Repository<Booking>,
      tripsRepo as unknown as Repository<Trip>,
      {} as Repository<User>,
      gamificationService as unknown as GamificationService,
      {} as never,
      {} as never,
      notificationsService as never,
      {} as never,
      {} as never,
    );

    const saved = await service.cancel('booking-3', 'passenger-1');

    expect(saved.status).toBe(BookingStatus.CANCELLED);
    expect(saved.paymentStatus).toBe(PaymentStatus.REFUND_PENDING);
    expect(trip.availableSeats).toBe(10);
    expect(gamificationService.refundKm).toHaveBeenCalledWith(
      'passenger-1',
      500,
      'booking-3',
    );
    const [recipientId, notification] = notificationsService.sendToUser.mock
      .calls[0] as [string, { body: string }];
    expect(recipientId).toBe('passenger-1');
    expect(notification.body).toContain('reembolso manual');
  });
});

describe('BookingsService creation flows', () => {
  it('confirms cash bookings immediately with check-in QR and seat reservation', async () => {
    const trip = {
      id: 'trip-10',
      origin: 'Manaus',
      destination: 'Parintins',
      captainId: 'captain-10',
      availableSeats: 5,
    } as Trip;

    const bookingsRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((value: Partial<Booking>) => value),
      save: jest
        .fn()
        .mockImplementationOnce((value: Partial<Booking>) =>
          Promise.resolve({
            ...value,
            id: 'booking-10',
          }),
        )
        .mockImplementation((value: Booking) => Promise.resolve(value)),
    };
    const tripsRepo = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce(trip)
        .mockResolvedValueOnce(trip),
      save: jest.fn((value: Trip) => Promise.resolve(value)),
    };
    const notificationsService = {
      sendToUser: jest.fn().mockResolvedValue(undefined),
    };
    const floodService = {
      getFloodStatus: jest.fn().mockResolvedValue({ severity: 'NO_FLOODING' }),
    };

    const service = new BookingsService(
      bookingsRepo as unknown as Repository<Booking>,
      tripsRepo as unknown as Repository<Trip>,
      {} as Repository<User>,
      {} as GamificationService,
      {} as never,
      {} as never,
      notificationsService as never,
      {} as never,
      floodService as never,
    );

    jest.spyOn(service, 'calculatePrice').mockResolvedValue({
      finalPrice: 180,
      kmRedeemed: 0,
      kmDiscount: 0,
      freeChildrenCount: 0,
      children: [],
      couponDiscount: 0,
    });

    const saved = await service.create('passenger-10', {
      tripId: 'trip-10',
      quantity: 2,
      paymentMethod: PaymentMethod.CASH,
    } as never);

    expect(saved.status).toBe(BookingStatus.CONFIRMED);
    expect(saved.paymentStatus).toBe(PaymentStatus.PENDING);
    expect(saved.qrCodeCheckin).toBe('NVGJ-booking-10');
    expect(trip.availableSeats).toBe(3);
    expect(tripsRepo.save).toHaveBeenCalledWith(trip);
    expect(notificationsService.sendToUser).toHaveBeenCalledTimes(2);
  });
});

describe('BookingsService payment confirmation flows', () => {
  it('blocks captain payment confirmation when the captain is not verified', async () => {
    const usersRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 'captain-1',
        isVerified: false,
      }),
    };

    const service = new BookingsService(
      {} as Repository<Booking>,
      {} as Repository<Trip>,
      usersRepo as unknown as Repository<User>,
      {} as GamificationService,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.confirmPayment('booking-4', 'captain-1', UserRole.CAPTAIN),
    ).rejects.toMatchObject({
      response: {
        message: 'Conta não verificada. Aguarde a aprovação do NavegaJá.',
      },
    });
  });

  it('confirms payment, generates check-in QR and reduces available seats', async () => {
    const booking = {
      id: 'booking-5',
      passengerId: 'passenger-1',
      tripId: 'trip-1',
      seats: 3,
      status: BookingStatus.PENDING,
      paymentStatus: PaymentStatus.PENDING,
      paymentMethod: PaymentMethod.PIX,
      pixExpiresAt: new Date(Date.now() + 60_000),
    } as unknown as Booking;
    const trip = {
      id: 'trip-1',
      origin: 'Manaus',
      destination: 'Parintins',
      availableSeats: 12,
    } as Trip;

    const bookingsRepo = {
      findOne: jest.fn().mockResolvedValue(booking),
      save: jest.fn((value: Booking) => Promise.resolve(value)),
    };
    const tripsRepo = {
      findOne: jest.fn().mockResolvedValue(trip),
      save: jest.fn((value: Trip) => Promise.resolve(value)),
    };
    const pixService = {
      isExpired: jest.fn().mockReturnValue(false),
    };
    const notificationsService = {
      sendToUser: jest.fn().mockResolvedValue(undefined),
    };

    const service = new BookingsService(
      bookingsRepo as unknown as Repository<Booking>,
      tripsRepo as unknown as Repository<Trip>,
      {} as Repository<User>,
      {} as GamificationService,
      {} as never,
      pixService as never,
      notificationsService as never,
      {} as never,
      {} as never,
    );

    const saved = await service.confirmPayment('booking-5');

    expect(saved.paymentStatus).toBe(PaymentStatus.PAID);
    expect(saved.status).toBe(BookingStatus.CONFIRMED);
    expect(saved.qrCodeCheckin).toBe('NVGJ-booking-5');
    expect(trip.availableSeats).toBe(9);
    expect(bookingsRepo.save).toHaveBeenCalledTimes(2);
    expect(tripsRepo.save).toHaveBeenCalledWith(trip);
    expect(notificationsService.sendToUser).toHaveBeenCalledWith(
      'passenger-1',
      expect.objectContaining({
        data: { type: 'payment_confirmed', bookingId: 'booking-5' },
      }),
    );
  });

  it('confirms payment for already confirmed bookings without reducing seats twice', async () => {
    const booking = {
      id: 'booking-8',
      passengerId: 'passenger-1',
      tripId: 'trip-2',
      seats: 2,
      status: BookingStatus.CONFIRMED,
      paymentStatus: PaymentStatus.PENDING,
      paymentMethod: PaymentMethod.CASH,
      qrCodeCheckin: 'NVGJ-booking-8',
      trip: {
        id: 'trip-2',
        origin: 'Manaus',
        destination: 'Iranduba',
      },
    } as unknown as Booking;
    const trip = {
      id: 'trip-2',
      availableSeats: 10,
    } as Trip;

    const bookingsRepo = {
      findOne: jest.fn().mockResolvedValue(booking),
      save: jest.fn((value: Booking) => Promise.resolve(value)),
    };
    const tripsRepo = {
      findOne: jest.fn().mockResolvedValue(trip),
      save: jest.fn((value: Trip) => Promise.resolve(value)),
    };
    const pixService = {
      isExpired: jest.fn().mockReturnValue(false),
    };
    const notificationsService = {
      sendToUser: jest.fn().mockResolvedValue(undefined),
    };

    const service = new BookingsService(
      bookingsRepo as unknown as Repository<Booking>,
      tripsRepo as unknown as Repository<Trip>,
      {} as Repository<User>,
      {} as GamificationService,
      {} as never,
      pixService as never,
      notificationsService as never,
      {} as never,
      {} as never,
    );

    const saved = await service.confirmPayment('booking-8');

    expect(saved.paymentStatus).toBe(PaymentStatus.PAID);
    expect(saved.status).toBe(BookingStatus.CONFIRMED);
    expect(saved.qrCodeCheckin).toBe('NVGJ-booking-8');
    expect(trip.availableSeats).toBe(10);
    expect(bookingsRepo.save).toHaveBeenCalledTimes(1);
    expect(tripsRepo.save).not.toHaveBeenCalled();
    expect(notificationsService.sendToUser).toHaveBeenCalledWith(
      'passenger-1',
      expect.objectContaining({
        data: { type: 'payment_confirmed', bookingId: 'booking-8' },
      }),
    );
  });

  it('confirms payment without downgrading checked-in bookings', async () => {
    const booking = {
      id: 'booking-9',
      passengerId: 'passenger-2',
      tripId: 'trip-3',
      seats: 1,
      status: BookingStatus.CHECKED_IN,
      paymentStatus: PaymentStatus.PENDING,
      paymentMethod: PaymentMethod.CASH,
      qrCodeCheckin: 'NVGJ-booking-9',
      trip: {
        id: 'trip-3',
        origin: 'Careiro',
        destination: 'Manaus',
      },
    } as unknown as Booking;
    const trip = {
      id: 'trip-3',
      availableSeats: 7,
    } as Trip;

    const bookingsRepo = {
      findOne: jest.fn().mockResolvedValue(booking),
      save: jest.fn((value: Booking) => Promise.resolve(value)),
    };
    const tripsRepo = {
      findOne: jest.fn().mockResolvedValue(trip),
      save: jest.fn((value: Trip) => Promise.resolve(value)),
    };
    const pixService = {
      isExpired: jest.fn().mockReturnValue(false),
    };
    const notificationsService = {
      sendToUser: jest.fn().mockResolvedValue(undefined),
    };

    const service = new BookingsService(
      bookingsRepo as unknown as Repository<Booking>,
      tripsRepo as unknown as Repository<Trip>,
      {} as Repository<User>,
      {} as GamificationService,
      {} as never,
      pixService as never,
      notificationsService as never,
      {} as never,
      {} as never,
    );

    const saved = await service.confirmPayment('booking-9');

    expect(saved.paymentStatus).toBe(PaymentStatus.PAID);
    expect(saved.status).toBe(BookingStatus.CHECKED_IN);
    expect(trip.availableSeats).toBe(7);
    expect(bookingsRepo.save).toHaveBeenCalledTimes(1);
    expect(tripsRepo.save).not.toHaveBeenCalled();
    expect(notificationsService.sendToUser).toHaveBeenCalledWith(
      'passenger-2',
      expect.objectContaining({
        data: { type: 'payment_confirmed', bookingId: 'booking-9' },
      }),
    );
  });
});

describe('BookingsService PIX expiration job', () => {
  it('cancels all expired PIX bookings and returns the processed count', async () => {
    const expiredBookings = [
      {
        id: 'booking-6',
        status: BookingStatus.PENDING,
        paymentStatus: PaymentStatus.PENDING,
        paymentMethod: PaymentMethod.PIX,
      },
      {
        id: 'booking-7',
        status: BookingStatus.PENDING,
        paymentStatus: PaymentStatus.PENDING,
        paymentMethod: PaymentMethod.PIX,
      },
    ] as Booking[];

    const bookingsRepo = {
      find: jest.fn().mockResolvedValue(expiredBookings),
      save: jest.fn((value: Booking) => Promise.resolve(value)),
    };

    const service = new BookingsService(
      bookingsRepo as unknown as Repository<Booking>,
      {} as Repository<Trip>,
      {} as Repository<User>,
      {} as GamificationService,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    const result = await service.cancelExpiredPixPayments();

    expect(result).toEqual({ cancelled: 2 });
    expect(bookingsRepo.save).toHaveBeenCalledTimes(2);
    expect(expiredBookings[0]?.status).toBe(BookingStatus.CANCELLED);
    expect(expiredBookings[1]?.status).toBe(BookingStatus.CANCELLED);
  });
});

describe('BookingsService broader coverage', () => {
  const createHarness = () => {
    const bookingsRepo = {
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((value: Partial<Booking>) => value),
      save: jest.fn((value: Booking) => Promise.resolve(value)),
    };
    const tripsRepo = {
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn((value: Trip) => Promise.resolve(value)),
    };
    const usersRepo = {
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
    };
    const gamificationService = {
      getUserDiscount: jest.fn().mockResolvedValue(0),
      calcKmDiscount: jest.fn().mockReturnValue(0),
      deductKm: jest.fn().mockResolvedValue(undefined),
      refundKm: jest.fn().mockResolvedValue(undefined),
      awardPoints: jest.fn().mockResolvedValue(undefined),
      checkFirstTripOfMonthBonus: jest.fn().mockResolvedValue(undefined),
      convertReferral: jest.fn().mockResolvedValue(undefined),
      awardBoatOwnerPassengerCompleted: jest.fn().mockResolvedValue(undefined),
      creditKm: jest.fn().mockResolvedValue(undefined),
    };
    const couponsService = {
      validate: jest.fn().mockResolvedValue({ valid: false }),
      findByCode: jest.fn(),
      incrementUsage: jest.fn().mockResolvedValue(undefined),
    };
    const pixService = {
      isExpired: jest.fn().mockReturnValue(false),
      generatePixPayment: jest.fn(),
    };
    const notificationsService = {
      sendToUser: jest.fn().mockResolvedValue(undefined),
    };
    const pdfService = {
      createTicket: jest.fn().mockResolvedValue({
        filename: 'ticket.pdf',
        contentType: 'application/pdf',
        stream: Buffer.from('pdf'),
      }),
    };
    const floodService = {
      getFloodStatus: jest.fn().mockResolvedValue({ severity: 'NO_FLOODING' }),
    };

    const service = new BookingsService(
      bookingsRepo as unknown as Repository<Booking>,
      tripsRepo as unknown as Repository<Trip>,
      usersRepo as unknown as Repository<User>,
      gamificationService as unknown as GamificationService,
      couponsService as never,
      pixService as never,
      notificationsService as never,
      pdfService as never,
      floodService as never,
    );

    return {
      service,
      bookingsRepo,
      tripsRepo,
      usersRepo,
      gamificationService,
      couponsService,
      pixService,
      notificationsService,
      pdfService,
      floodService,
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calculates price with children, coupon, loyalty and km discounts', async () => {
    const {
      service,
      tripsRepo,
      usersRepo,
      couponsService,
      gamificationService,
    } = createHarness();
    tripsRepo.findOne.mockResolvedValue({
      id: 'trip-calc',
      price: 100,
      discount: 10,
    });
    usersRepo.findOne.mockResolvedValue({
      id: 'user-calc',
      level: 'Gold',
      redeemableKm: 1000,
    });
    couponsService.validate.mockResolvedValue({
      valid: true,
      discount: 20,
      coupon: { code: 'DESC20', description: 'Cupom Especial' },
    });
    gamificationService.getUserDiscount.mockResolvedValue(5);
    gamificationService.calcKmDiscount.mockReturnValue(25);

    const result = await service.calculatePrice(
      'user-calc',
      'trip-calc',
      2,
      'DESC20',
      500,
      [{ name: 'Criança', age: 8 }] as never,
    );

    expect(result.basePrice).toBe(200);
    expect(result.childrenDiscount).toBe(100);
    expect(result.couponDiscount).toBe(20);
    expect(result.loyaltyDiscount).toBeGreaterThan(0);
    expect(result.kmDiscount).toBe(25);
    expect(result.discountsApplied).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'children' }),
        expect.objectContaining({ type: 'coupon', code: 'DESC20' }),
        expect.objectContaining({ type: 'km' }),
      ]),
    );
  });

  it('validates children and km constraints in price calculation', async () => {
    const { service, tripsRepo, usersRepo, gamificationService } =
      createHarness();
    tripsRepo.findOne.mockResolvedValue({
      id: 'trip-calc-2',
      price: 80,
      discount: 0,
    });
    usersRepo.findOne.mockResolvedValue({
      id: 'user-calc-2',
      level: 'Silver',
      redeemableKm: 400,
    });
    gamificationService.getUserDiscount.mockResolvedValue(0);

    await expect(
      service.calculatePrice(
        'user-calc-2',
        'trip-calc-2',
        1,
        undefined,
        undefined,
        [{ age: 8 }, { age: 7 }] as never,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.calculatePrice(
        'user-calc-2',
        'trip-calc-2',
        4,
        undefined,
        undefined,
        [{ age: 8 }, { age: 7 }, { age: 6 }, { age: 5 }] as never,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.calculatePrice('user-calc-2', 'trip-calc-2', 1, undefined, 250),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.calculatePrice('user-calc-2', 'trip-calc-2', 1, undefined, 500),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates PIX booking, stores gateway data, deducts km and applies coupon usage', async () => {
    const {
      service,
      tripsRepo,
      bookingsRepo,
      pixService,
      couponsService,
      gamificationService,
      notificationsService,
      floodService,
    } = createHarness();
    const trip = {
      id: 'trip-create',
      origin: 'Manaus',
      destination: 'Parintins',
      captainId: 'captain-create',
      availableSeats: 10,
    } as Trip;
    tripsRepo.findOne.mockResolvedValue(trip);
    bookingsRepo.findOne.mockResolvedValue(null);
    bookingsRepo.save
      .mockImplementationOnce((value: Partial<Booking>) =>
        Promise.resolve({
          ...value,
          id: 'booking-create',
        }),
      )
      .mockImplementation((value: Booking) => Promise.resolve(value));
    pixService.generatePixPayment.mockResolvedValue({
      pixQrCode: 'pix-code',
      pixQrCodeImage: 'pix-image',
      pixTxid: 'tx-1',
      pixExpiresAt: new Date('2030-01-01T11:00:00.000Z'),
      pixKey: 'key-1',
    });
    couponsService.findByCode.mockResolvedValue({ id: 'coupon-1' });
    floodService.getFloodStatus.mockResolvedValue({ severity: 'SEVERE' });
    jest.spyOn(service, 'calculatePrice').mockResolvedValue({
      finalPrice: 150,
      kmRedeemed: 500,
      kmDiscount: 25,
      freeChildrenCount: 0,
      children: [],
      couponDiscount: 10,
    } as never);

    const created = await service.create('passenger-create', {
      tripId: 'trip-create',
      quantity: 1,
      paymentMethod: PaymentMethod.PIX,
      couponCode: 'DESC10',
      redeemKm: 500,
    } as never);

    expect(created.pixTxid).toBe('tx-1');
    expect(created.floodWarning).toBe(true);
    expect(created.floodSeverity).toBe('SEVERE');
    expect(pixService.generatePixPayment).toHaveBeenCalled();
    expect(gamificationService.deductKm).toHaveBeenCalledWith(
      'passenger-create',
      500,
      'booking-create',
    );
    expect(couponsService.incrementUsage).toHaveBeenCalledWith('coupon-1');
    expect(notificationsService.sendToUser).toHaveBeenCalledWith(
      'captain-create',
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'new_booking',
          tripId: 'trip-create',
        }),
      }),
    );
  });

  it('rejects create when extra passengers contain duplicate or main cpf', async () => {
    const { service, tripsRepo, bookingsRepo, usersRepo } = createHarness();
    tripsRepo.findOne.mockResolvedValue({
      id: 'trip-passengers',
      availableSeats: 10,
    });
    bookingsRepo.findOne.mockResolvedValue(null);
    jest.spyOn(service, 'calculatePrice').mockResolvedValue({
      finalPrice: 100,
      kmRedeemed: 0,
      kmDiscount: 0,
      freeChildrenCount: 0,
      children: [],
      couponDiscount: 0,
    } as never);

    await expect(
      service.create('passenger-dup', {
        tripId: 'trip-passengers',
        quantity: 1,
        paymentMethod: PaymentMethod.CASH,
        passengers: [
          { name: 'A', cpf: '111' },
          { name: 'B', cpf: '111' },
        ],
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);

    usersRepo.findOne.mockResolvedValue({ cpf: '123' });
    await expect(
      service.create('passenger-main', {
        tripId: 'trip-passengers',
        quantity: 1,
        paymentMethod: PaymentMethod.CASH,
        passengers: [{ name: 'A', cpf: '123' }],
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('filters findByPassenger by active/completed/cancelled status', async () => {
    const { service, bookingsRepo } = createHarness();
    bookingsRepo.find.mockResolvedValue([]);

    await service.findByPassenger('user-1', 'active');
    await service.findByPassenger('user-1', 'completed');
    await service.findByPassenger('user-1', 'cancelled');

    expect(bookingsRepo.find.mock.calls[0]?.[0]?.where.status).toBeDefined();
    expect(bookingsRepo.find.mock.calls[1]?.[0]?.where.status).toBe(
      BookingStatus.COMPLETED,
    );
    expect(bookingsRepo.find.mock.calls[2]?.[0]?.where.status).toBe(
      BookingStatus.CANCELLED,
    );
  });

  it('returns trip tracking progress and blocks unauthorized access', async () => {
    const { service, bookingsRepo } = createHarness();
    bookingsRepo.findOne.mockResolvedValue({
      id: 'booking-track',
      passengerId: 'user-track',
      status: BookingStatus.CONFIRMED,
      qrCodeCheckin: 'QR-1',
      trip: {
        id: 'trip-track',
        status: TripStatus.IN_PROGRESS,
        departureAt: new Date(Date.now() - 60 * 60 * 1000),
        estimatedArrivalAt: new Date(Date.now() + 60 * 60 * 1000),
        currentLat: -3.1,
        currentLng: -60.0,
        origin: 'Manaus',
        destination: 'Parintins',
        route: null,
        captain: {
          id: 'captain-track',
          name: 'Capitão',
          phone: '92999999999',
          rating: 4.9,
          avatarUrl: null,
        },
        boat: {
          id: 'boat-track',
          name: 'Barco',
          type: 'Lancha',
          photoUrl: null,
        },
      },
    });

    const tracking = await service.getTracking('booking-track', 'user-track');
    expect(tracking.progress).toBeGreaterThanOrEqual(20);
    expect(tracking.progress).toBeLessThanOrEqual(95);
    expect(tracking.route.originName).toBe('Manaus');

    await expect(
      service.getTracking('booking-track', 'other-user'),
    ).rejects.toMatchObject({
      response: { message: expect.stringContaining('Acesso') },
    });
  });

  it('checks in confirmed bookings and rejects invalid status', async () => {
    const { service, bookingsRepo } = createHarness();
    bookingsRepo.findOne
      .mockResolvedValueOnce({
        id: 'booking-checkin-1',
        status: BookingStatus.CONFIRMED,
      })
      .mockResolvedValueOnce({
        id: 'booking-checkin-2',
        status: BookingStatus.PENDING,
      });

    const checkedIn = await service.checkin('booking-checkin-1');
    expect(checkedIn.status).toBe(BookingStatus.CHECKED_IN);

    await expect(service.checkin('booking-checkin-2')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('covers confirmPayment validation branches and payment status polling', async () => {
    const { service, bookingsRepo, pixService } = createHarness();
    bookingsRepo.findOne
      .mockResolvedValueOnce({
        id: 'booking-cancelled',
        status: BookingStatus.CANCELLED,
        paymentStatus: PaymentStatus.PENDING,
      })
      .mockResolvedValueOnce({
        id: 'booking-expired',
        status: BookingStatus.PENDING,
        paymentStatus: PaymentStatus.PENDING,
        pixExpiresAt: new Date('2020-01-01T00:00:00.000Z'),
      })
      .mockResolvedValueOnce({
        id: 'booking-status',
        status: BookingStatus.PENDING,
        paymentStatus: PaymentStatus.PENDING,
        paymentMethod: PaymentMethod.PIX,
        totalPrice: 123,
        pixPaidAt: null,
        pixExpiresAt: new Date('2030-01-01T00:00:00.000Z'),
      });
    pixService.isExpired.mockReturnValue(true);

    await expect(
      service.confirmPayment('booking-cancelled'),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.confirmPayment('booking-expired'),
    ).rejects.toBeInstanceOf(BadRequestException);

    const status = await service.getPaymentStatus('booking-status');
    expect(status.isExpired).toBe(true);
  });

  it('auto-cancels and auto-completes bookings by trip', async () => {
    const { service, bookingsRepo } = createHarness();
    bookingsRepo.find
      .mockResolvedValueOnce([
        {
          id: 'booking-a',
          passengerId: 'p-a',
          status: BookingStatus.PENDING,
        },
        {
          id: 'booking-b',
          passengerId: 'p-b',
          status: BookingStatus.CONFIRMED,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'booking-c',
          status: BookingStatus.CONFIRMED,
          passengerId: 'p-c',
          trip: { route: { distanceKm: 120 }, boat: { ownerId: 'owner-c' } },
        },
      ]);

    const markSpy = jest
      .spyOn(service as never, 'markBookingCompleted' as never)
      .mockResolvedValue({} as never);

    const passengerIds = await service.autoCancelByTrip('trip-auto');
    await service.autoCompleteByTrip('trip-auto');

    expect(passengerIds).toEqual(['p-a', 'p-b']);
    expect(bookingsRepo.save).toHaveBeenCalledTimes(2);
    expect(markSpy).toHaveBeenCalledTimes(1);
  });

  it('enforces ticket access and generates ticket for admin', async () => {
    const { service, bookingsRepo, pdfService } = createHarness();
    bookingsRepo.findOne
      .mockResolvedValueOnce({
        id: 'booking-ticket-1',
        passengerId: 'passenger-ticket',
        trip: { captainId: 'captain-ticket' },
      })
      .mockResolvedValueOnce({
        id: 'booking-ticket-2',
        passengerId: 'passenger-ticket',
        seats: 2,
        totalPrice: 200,
        paymentStatus: PaymentStatus.PAID,
        qrCodeCheckin: 'QR-TICKET',
        createdAt: new Date('2030-01-01T10:00:00.000Z'),
        children: [],
        extraPassengers: [],
        trip: {
          captainId: 'captain-ticket',
          origin: 'Manaus',
          destination: 'Parintins',
          departureAt: new Date('2030-01-02T10:00:00.000Z'),
          estimatedArrivalAt: new Date('2030-01-02T14:00:00.000Z'),
          captain: { name: 'Capitão', rating: 4.9 },
          boat: { name: 'Barco', type: 'Lancha' },
        },
        passenger: {
          name: 'Passageiro',
        },
      });

    await expect(
      service.generateTicketPdf('booking-ticket-1', 'other', 'passenger'),
    ).rejects.toMatchObject({
      response: { message: expect.stringContaining('Acesso') },
    });

    const ticket = await service.generateTicketPdf(
      'booking-ticket-2',
      'admin',
      'admin',
    );

    expect(ticket.filename).toBe('ticket.pdf');
    expect(pdfService.createTicket).toHaveBeenCalled();
  });

  it('blocks create when seats are insufficient or user already has active booking', async () => {
    const { service, tripsRepo, bookingsRepo } = createHarness();
    tripsRepo.findOne.mockResolvedValue({
      id: 'trip-insufficient',
      availableSeats: 0,
    });

    await expect(
      service.create('passenger-1', {
        tripId: 'trip-insufficient',
        quantity: 1,
        paymentMethod: PaymentMethod.PIX,
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);

    tripsRepo.findOne.mockResolvedValue({
      id: 'trip-duplicate',
      availableSeats: 5,
    });
    bookingsRepo.findOne.mockResolvedValue({ id: 'existing-booking' });

    await expect(
      service.create('passenger-1', {
        tripId: 'trip-duplicate',
        quantity: 1,
        paymentMethod: PaymentMethod.PIX,
      } as never),
    ).rejects.toMatchObject({
      response: { message: expect.stringContaining('reserva ativa') },
    });
  });

  it('creates card bookings as confirmed and paid', async () => {
    const { service, tripsRepo, bookingsRepo, notificationsService } =
      createHarness();
    const trip = {
      id: 'trip-card',
      origin: 'Manaus',
      destination: 'Parintins',
      captainId: 'captain-card',
      availableSeats: 3,
    } as Trip;
    tripsRepo.findOne.mockResolvedValue(trip);
    bookingsRepo.findOne.mockResolvedValue(null);
    bookingsRepo.save
      .mockImplementationOnce((value: Partial<Booking>) =>
        Promise.resolve({
          ...value,
          id: 'booking-card',
        }),
      )
      .mockImplementation((value: Booking) => Promise.resolve(value));
    jest.spyOn(service, 'calculatePrice').mockResolvedValue({
      finalPrice: 90,
      kmRedeemed: 0,
      kmDiscount: 0,
      freeChildrenCount: 0,
      children: [],
      couponDiscount: 0,
    } as never);

    const created = await service.create('passenger-card', {
      tripId: 'trip-card',
      quantity: 1,
      paymentMethod: PaymentMethod.CREDIT_CARD,
    } as never);

    expect(created.status).toBe(BookingStatus.CONFIRMED);
    expect(created.paymentStatus).toBe(PaymentStatus.PAID);
    expect(notificationsService.sendToUser).toHaveBeenCalledWith(
      'passenger-card',
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'booking_confirmed',
        }),
      }),
    );
  });

  it('maps tracking timeline for scheduled, completed and cancelled trips', async () => {
    const { service, bookingsRepo } = createHarness();
    bookingsRepo.findOne
      .mockResolvedValueOnce({
        id: 'booking-track-s',
        passengerId: 'user-track',
        status: BookingStatus.CONFIRMED,
        qrCodeCheckin: 'QR-S',
        trip: {
          id: 'trip-s',
          status: TripStatus.SCHEDULED,
          departureAt: new Date('2030-01-01T10:00:00.000Z'),
          estimatedArrivalAt: new Date('2030-01-01T14:00:00.000Z'),
          currentLat: null,
          currentLng: null,
          origin: 'Manaus',
          destination: 'Parintins',
          route: null,
          captain: { id: 'c', name: 'Capitão', phone: '9', rating: 5 },
          boat: null,
        },
      })
      .mockResolvedValueOnce({
        id: 'booking-track-c',
        passengerId: 'user-track',
        status: BookingStatus.CONFIRMED,
        qrCodeCheckin: 'QR-C',
        trip: {
          id: 'trip-c',
          status: TripStatus.COMPLETED,
          departureAt: new Date('2030-01-01T10:00:00.000Z'),
          estimatedArrivalAt: new Date('2030-01-01T14:00:00.000Z'),
          currentLat: null,
          currentLng: null,
          origin: 'Manaus',
          destination: 'Parintins',
          route: null,
          captain: { id: 'c', name: 'Capitão', phone: '9', rating: 5 },
          boat: null,
        },
      })
      .mockResolvedValueOnce({
        id: 'booking-track-x',
        passengerId: 'user-track',
        status: BookingStatus.CONFIRMED,
        qrCodeCheckin: 'QR-X',
        trip: {
          id: 'trip-x',
          status: TripStatus.CANCELLED,
          departureAt: new Date('2030-01-01T10:00:00.000Z'),
          estimatedArrivalAt: new Date('2030-01-01T14:00:00.000Z'),
          currentLat: null,
          currentLng: null,
          origin: 'Manaus',
          destination: 'Parintins',
          route: null,
          captain: { id: 'c', name: 'Capitão', phone: '9', rating: 5 },
          boat: null,
        },
      });

    const scheduled = await service.getTracking('booking-track-s', 'user-track');
    const completed = await service.getTracking('booking-track-c', 'user-track');
    const cancelled = await service.getTracking('booking-track-x', 'user-track');

    expect(scheduled.progress).toBe(0);
    expect(completed.progress).toBe(100);
    expect(cancelled.timeline[0].status).toBe('cancelled');
  });

  it('rejects cancel when booking is already cancelled or completed', async () => {
    const { service, bookingsRepo } = createHarness();
    bookingsRepo.findOne
      .mockResolvedValueOnce({
        id: 'booking-can-1',
        passengerId: 'p1',
        tripId: 't1',
        status: BookingStatus.CANCELLED,
        paymentStatus: PaymentStatus.PENDING,
      })
      .mockResolvedValueOnce({
        id: 'booking-can-2',
        passengerId: 'p1',
        tripId: 't1',
        status: BookingStatus.COMPLETED,
        paymentStatus: PaymentStatus.PAID,
      });

    await expect(service.cancel('booking-can-1', 'p1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.cancel('booking-can-2', 'p1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('cancels confirmed booking even when trip lookup returns null', async () => {
    const { service, bookingsRepo, tripsRepo } = createHarness();
    bookingsRepo.findOne.mockResolvedValue({
      id: 'booking-null-trip',
      passengerId: 'p-null',
      tripId: 'trip-null',
      status: BookingStatus.CONFIRMED,
      seats: 1,
      paymentStatus: PaymentStatus.PENDING,
      kmRedeemed: 0,
    });
    tripsRepo.findOne.mockResolvedValue(null);

    const cancelled = await service.cancel('booking-null-trip', 'p-null');

    expect(cancelled.status).toBe(BookingStatus.CANCELLED);
  });

  it('throws not found when fetching booking by id', async () => {
    const { service, bookingsRepo } = createHarness();
    bookingsRepo.findOne.mockResolvedValue(null);

    await expect(service.findById('missing-booking')).rejects.toMatchObject({
      response: { message: expect.stringContaining('Reserva') },
    });
  });
});
