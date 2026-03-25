import { UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import request from 'supertest';
import type { App } from 'supertest/types';
import { BookingsController } from '../src/bookings/bookings.controller';
import { BookingsService } from '../src/bookings/bookings.service';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { RolesGuard } from '../src/common/roles.guard';

describe('BookingsController (e2e)', () => {
  let app: INestApplication<App>;
  let bookingsService: {
    create: jest.Mock;
    confirmPayment: jest.Mock;
    findByPassenger: jest.Mock;
    calculatePrice: jest.Mock;
    cancel: jest.Mock;
    checkin: jest.Mock;
    complete: jest.Mock;
  };
  let allowAuth = true;
  let currentRole = 'passenger';
  let guardSpy: jest.SpiedFunction<JwtAuthGuard['canActivate']>;

  beforeEach(async () => {
    allowAuth = true;
    currentRole = 'passenger';
    bookingsService = {
      create: jest.fn().mockResolvedValue({
        id: 'booking-1',
        tripId: 'trip-1',
        passengerId: 'user-1',
        quantity: 2,
        paymentMethod: 'pix',
      }),
      confirmPayment: jest.fn().mockResolvedValue({
        id: 'booking-1',
        paymentStatus: 'paid',
      }),
      findByPassenger: jest.fn().mockResolvedValue([
        {
          id: 'booking-1',
          status: 'confirmed',
        },
      ]),
      calculatePrice: jest.fn().mockResolvedValue({
        subtotal: 200,
        discount: 20,
        total: 180,
      }),
      cancel: jest.fn().mockResolvedValue({
        id: 'booking-1',
        status: 'cancelled',
      }),
      checkin: jest.fn().mockResolvedValue({
        id: 'booking-1',
        status: 'checked_in',
      }),
      complete: jest.fn().mockResolvedValue({
        id: 'booking-1',
        status: 'completed',
      }),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [BookingsController],
      providers: [
        {
          provide: BookingsService,
          useValue: bookingsService,
        },
        JwtAuthGuard,
        RolesGuard,
        Reflector,
      ],
    }).compile();

    guardSpy = jest
      .spyOn(JwtAuthGuard.prototype, 'canActivate')
      .mockImplementation((context) => {
        if (!allowAuth) {
          throw new UnauthorizedException();
        }

        const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
        req.user = {
          sub: 'user-1',
          phone: '92991234567',
          role: currentRole,
        };
        return true;
      });

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    guardSpy.mockRestore();
    await app.close();
  });

  it('rejects unauthenticated booking creation', async () => {
    allowAuth = false;

    await request(app.getHttpServer())
      .post('/bookings')
      .send({
        tripId: 'trip-1',
        quantity: 2,
        paymentMethod: 'pix',
      })
      .expect(401);

    expect(bookingsService.create).not.toHaveBeenCalled();
  });

  it('rejects invalid booking payloads before hitting the service', async () => {
    await request(app.getHttpServer())
      .post('/bookings')
      .send({
        tripId: 'trip-1',
        paymentMethod: 'pix',
      })
      .expect(400);

    expect(bookingsService.create).not.toHaveBeenCalled();
  });

  it('creates a booking for the authenticated passenger', async () => {
    await request(app.getHttpServer())
      .post('/bookings')
      .send({
        tripId: 'trip-1',
        quantity: 2,
        paymentMethod: 'pix',
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          id: 'booking-1',
          tripId: 'trip-1',
          passengerId: 'user-1',
        });
      });

    expect(bookingsService.create).toHaveBeenCalledWith('user-1', {
      tripId: 'trip-1',
      quantity: 2,
      paymentMethod: 'pix',
    });
  });

  it('returns the authenticated passenger bookings with the requested filter', async () => {
    await request(app.getHttpServer())
      .get('/bookings/my-bookings?status=confirmed')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual([
          {
            id: 'booking-1',
            status: 'confirmed',
          },
        ]);
      });

    expect(bookingsService.findByPassenger).toHaveBeenCalledWith(
      'user-1',
      'confirmed',
    );
  });

  it('calculates booking price for the authenticated passenger', async () => {
    await request(app.getHttpServer())
      .post('/bookings/calculate-price')
      .send({
        tripId: 'trip-1',
        quantity: 2,
        couponCode: 'AMAZON10',
        redeemKm: 100,
        children: [{ age: 8 }],
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body).toEqual({
          subtotal: 200,
          discount: 20,
          total: 180,
        });
      });

    expect(bookingsService.calculatePrice).toHaveBeenCalledWith(
      'user-1',
      'trip-1',
      2,
      'AMAZON10',
      100,
      [{ age: 8 }],
    );
  });

  it('cancels a booking for the authenticated passenger', async () => {
    await request(app.getHttpServer())
      .post('/bookings/booking-1/cancel')
      .expect(201)
      .expect(({ body }) => {
        expect(body).toEqual({
          id: 'booking-1',
          status: 'cancelled',
        });
      });

    expect(bookingsService.cancel).toHaveBeenCalledWith('booking-1', 'user-1');
  });

  it('blocks payment confirmation for users without the required role', async () => {
    currentRole = 'passenger';

    await request(app.getHttpServer())
      .post('/bookings/booking-1/confirm-payment')
      .expect(403);

    expect(bookingsService.confirmPayment).not.toHaveBeenCalled();
  });

  it('allows captains to confirm booking payments', async () => {
    currentRole = 'captain';

    await request(app.getHttpServer())
      .post('/bookings/booking-1/confirm-payment')
      .expect(201)
      .expect(({ body }) => {
        expect(body).toEqual({
          id: 'booking-1',
          paymentStatus: 'paid',
        });
      });

    expect(bookingsService.confirmPayment).toHaveBeenCalledWith(
      'booking-1',
      'user-1',
      'captain',
    );
  });

  it('blocks check-in for users without the required role', async () => {
    currentRole = 'passenger';

    await request(app.getHttpServer())
      .post('/bookings/booking-1/checkin')
      .expect(403);

    expect(bookingsService.checkin).not.toHaveBeenCalled();
  });

  it('allows boat managers to check in bookings', async () => {
    currentRole = 'boat_manager';

    await request(app.getHttpServer())
      .post('/bookings/booking-1/checkin')
      .expect(201)
      .expect(({ body }) => {
        expect(body).toEqual({
          id: 'booking-1',
          status: 'checked_in',
        });
      });

    expect(bookingsService.checkin).toHaveBeenCalledWith('booking-1');
  });

  it('allows boat managers to complete bookings', async () => {
    currentRole = 'boat_manager';

    await request(app.getHttpServer())
      .patch('/bookings/booking-1/complete')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({
          id: 'booking-1',
          status: 'completed',
        });
      });

    expect(bookingsService.complete).toHaveBeenCalledWith('booking-1');
  });
});
