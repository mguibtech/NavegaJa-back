import { BadRequestException } from '@nestjs/common';
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

    await expect(service.cancel('booking-2', 'passenger-1')).rejects.toMatchObject(
      {
        response: {
          message:
            'Cancelamento não permitido: o passageiro já realizou check-in/embarque.',
        },
      },
    );
  });
});
