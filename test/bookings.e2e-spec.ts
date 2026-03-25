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
});
