import { BookingsService } from './bookings.service';
import { BookingStatus, PaymentMethod, PaymentStatus } from './booking.entity';
import type { Repository } from 'typeorm';
import type { Booking } from './booking.entity';
import type { Trip } from '../trips/trip.entity';
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
