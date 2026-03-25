import { UnauthorizedException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Reflector } from '@nestjs/core';
import request from 'supertest';
import type { App } from 'supertest/types';
import { PaymentsController } from '../src/payments/payments.controller';
import { PixService } from '../src/payments/pix.service';
import { Booking } from '../src/bookings/booking.entity';
import { Shipment } from '../src/shipments/shipment.entity';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';

describe('PaymentsController (e2e)', () => {
  let app: INestApplication<App>;
  let pixService: {
    generatePixPayment: jest.Mock;
  };
  let bookingsRepo: {
    findOne: jest.Mock;
  };
  let shipmentsRepo: {
    findOne: jest.Mock;
  };
  let allowAuth = true;
  let guardSpy: jest.SpiedFunction<JwtAuthGuard['canActivate']>;

  beforeEach(async () => {
    allowAuth = true;
    pixService = {
      generatePixPayment: jest.fn().mockResolvedValue({
        pixQrCode: 'pix-code',
        pixQrCodeImage: 'data:image/png;base64,pix-image',
        pixTxid: 'pix-txid',
        pixExpiresAt: '2026-03-25T12:00:00.000Z',
        pixKey: 'pix-key',
      }),
    };
    bookingsRepo = {
      findOne: jest.fn(),
    };
    shipmentsRepo = {
      findOne: jest.fn(),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [
        {
          provide: PixService,
          useValue: pixService,
        },
        {
          provide: getRepositoryToken(Booking),
          useValue: bookingsRepo,
        },
        {
          provide: getRepositoryToken(Shipment),
          useValue: shipmentsRepo,
        },
        JwtAuthGuard,
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
          role: 'passenger',
        };
        return true;
      });

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    guardSpy.mockRestore();
    await app.close();
  });

  it('returns 404 when the booking does not exist', async () => {
    bookingsRepo.findOne.mockResolvedValue(null);

    await request(app.getHttpServer())
      .post('/payments/pix/booking/booking-404')
      .expect(404);

    expect(pixService.generatePixPayment).not.toHaveBeenCalled();
  });

  it('returns 403 when the booking belongs to another passenger', async () => {
    bookingsRepo.findOne.mockResolvedValue({
      id: 'booking-1',
      passengerId: 'other-user',
      totalPrice: 120.5,
      trip: {
        origin: 'Manaus',
        destination: 'Parintins',
      },
    });

    await request(app.getHttpServer())
      .post('/payments/pix/booking/booking-1')
      .expect(403);

    expect(pixService.generatePixPayment).not.toHaveBeenCalled();
  });

  it('generates PIX data for the booking owner', async () => {
    bookingsRepo.findOne.mockResolvedValue({
      id: 'booking-1',
      passengerId: 'user-1',
      totalPrice: 120.5,
      trip: {
        origin: 'Manaus',
        destination: 'Parintins',
      },
    });

    await request(app.getHttpServer())
      .post('/payments/pix/booking/booking-1')
      .expect(201)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          pixQrCode: 'pix-code',
          pixTxid: 'pix-txid',
          amount: 120.5,
          description: 'NavegaJá — Reserva Manaus → Parintins',
        });
      });

    expect(pixService.generatePixPayment).toHaveBeenCalledWith(
      'booking-1',
      120.5,
      'NavegaJá — Reserva Manaus → Parintins',
    );
  });

  it('generates PIX data for the shipment sender', async () => {
    shipmentsRepo.findOne.mockResolvedValue({
      id: 'shipment-1',
      senderId: 'user-1',
      totalPrice: 45,
      trackingCode: 'TRK-ABC123',
    });

    await request(app.getHttpServer())
      .post('/payments/pix/shipment/shipment-1')
      .expect(201)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          pixQrCode: 'pix-code',
          pixTxid: 'pix-txid',
          amount: 45,
          description: 'NavegaJá — Encomenda TRK-ABC123',
        });
      });

    expect(pixService.generatePixPayment).toHaveBeenCalledWith(
      'shipment-1',
      45,
      'NavegaJá — Encomenda TRK-ABC123',
    );
  });
});
