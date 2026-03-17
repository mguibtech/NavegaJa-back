import { BookingsService } from './bookings.service';
import { BookingStatus, PaymentMethod, PaymentStatus } from './booking.entity';
import type { Repository } from 'typeorm';
import type { Booking } from './booking.entity';
import type { Trip } from '../trips/trip.entity';
import type { User } from '../users/user.entity';
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
