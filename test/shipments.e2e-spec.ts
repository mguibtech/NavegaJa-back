import { UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import request from 'supertest';
import type { App } from 'supertest/types';
import { ShipmentsController } from '../src/shipments/shipments.controller';
import { ShipmentsService } from '../src/shipments/shipments.service';
import { ShipmentReview } from '../src/shipments/shipment-review.entity';
import { StorageService } from '../src/shipments/storage.service';
import { CouponsService } from '../src/coupons/coupons.service';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { RolesGuard } from '../src/common/roles.guard';

describe('ShipmentsController (e2e)', () => {
  let app: INestApplication<App>;
  let shipmentsService: {
    calculatePrice: jest.Mock;
    confirmPayment: jest.Mock;
    confirmPaymentByWebhook: jest.Mock;
    findBySender: jest.Mock;
    findByTrackingCode: jest.Mock;
    getTimeline: jest.Mock;
    cancel: jest.Mock;
    collectShipment: jest.Mock;
  };
  let allowAuth = true;
  let currentRole = 'passenger';
  let guardSpy: jest.SpiedFunction<JwtAuthGuard['canActivate']>;

  beforeEach(async () => {
    allowAuth = true;
    currentRole = 'passenger';
    shipmentsService = {
      calculatePrice: jest.fn().mockResolvedValue({
        basePrice: 55,
        totalDiscount: 5,
        finalPrice: 50,
      }),
      confirmPayment: jest.fn().mockResolvedValue({
        id: 'shipment-1',
        status: 'paid',
        totalPrice: 45,
        weightKg: 5.5,
        length: 30,
        width: 20,
        height: 10,
        photos: ['https://cdn.example.com/photo-1.jpg'],
        trip: {
          id: 'trip-1',
          route: {
            originName: 'Manaus',
            destinationName: 'Parintins',
          },
        },
      }),
      confirmPaymentByWebhook: jest.fn().mockResolvedValue(undefined),
      findBySender: jest.fn().mockResolvedValue([
        {
          id: 'shipment-1',
          status: 'paid',
          totalPrice: 45,
          weightKg: 5.5,
          photos: [],
          trip: {
            id: 'trip-1',
            route: {
              originName: 'Manaus',
              destinationName: 'Parintins',
            },
          },
        },
      ]),
      findByTrackingCode: jest.fn().mockResolvedValue({
        id: 'shipment-1',
        trackingCode: 'TRK-123',
        status: 'paid',
        totalPrice: 45,
        weightKg: 5.5,
        photos: [],
        trip: {
          id: 'trip-1',
          route: {
            originName: 'Manaus',
            destinationName: 'Parintins',
          },
        },
      }),
      getTimeline: jest.fn().mockResolvedValue([
        {
          id: 'timeline-1',
          status: 'paid',
          description: 'Pagamento confirmado',
          createdAt: '2026-03-25T12:00:00.000Z',
        },
      ]),
      cancel: jest.fn().mockResolvedValue({
        id: 'shipment-1',
        status: 'cancelled',
      }),
      collectShipment: jest.fn().mockResolvedValue({
        id: 'shipment-1',
        status: 'collected',
      }),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ShipmentsController],
      providers: [
        {
          provide: ShipmentsService,
          useValue: shipmentsService,
        },
        {
          provide: StorageService,
          useValue: {
            generatePresignedUrls: jest.fn(),
          },
        },
        {
          provide: CouponsService,
          useValue: {
            validateForShipment: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: string) => {
              if (key === 'PAYMENT_WEBHOOK_SECRET') {
                return 'test-secret';
              }
              if (key === 'BASE_URL') {
                return 'http://localhost:3000';
              }
              return defaultValue;
            }),
          },
        },
        {
          provide: getRepositoryToken(ShipmentReview),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
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

  it('rejects unauthenticated shipment price calculation', async () => {
    allowAuth = false;

    await request(app.getHttpServer())
      .post('/shipments/calculate-price')
      .send({
        tripId: 'trip-1',
        weight: 5.5,
      })
      .expect(401);

    expect(shipmentsService.calculatePrice).not.toHaveBeenCalled();
  });

  it('rejects invalid shipment price payloads before hitting the service', async () => {
    await request(app.getHttpServer())
      .post('/shipments/calculate-price')
      .send({ tripId: 'trip-1' })
      .expect(400);

    expect(shipmentsService.calculatePrice).not.toHaveBeenCalled();
  });

  it('calculates shipment price for authenticated users', async () => {
    await request(app.getHttpServer())
      .post('/shipments/calculate-price')
      .send({
        tripId: 'trip-1',
        weight: 5.5,
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body).toEqual({
          basePrice: 55,
          totalDiscount: 5,
          finalPrice: 50,
        });
      });

    expect(shipmentsService.calculatePrice).toHaveBeenCalledWith({
      tripId: 'trip-1',
      weight: 5.5,
    });
  });

  it('returns a serialized shipment after payment confirmation', async () => {
    await request(app.getHttpServer())
      .post('/shipments/shipment-1/confirm-payment')
      .expect(201)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          message:
            'Pagamento confirmado com sucesso! Aguardando coleta pelo capitão.',
          shipment: {
            id: 'shipment-1',
            status: 'paid',
            weight: 5.5,
            price: 45,
            photos: ['https://cdn.example.com/photo-1.jpg'],
            dimensions: {
              length: 30,
              width: 20,
              height: 10,
            },
            trip: {
              id: 'trip-1',
              origin: 'Manaus',
              destination: 'Parintins',
            },
          },
        });
      });

    expect(shipmentsService.confirmPayment).toHaveBeenCalledWith(
      'shipment-1',
      'user-1',
    );
  });

  it('rejects unauthenticated shipment payment confirmation', async () => {
    allowAuth = false;

    await request(app.getHttpServer())
      .post('/shipments/shipment-1/confirm-payment')
      .expect(401);

    expect(shipmentsService.confirmPayment).not.toHaveBeenCalled();
  });

  it('returns serialized shipments for the authenticated sender', async () => {
    await request(app.getHttpServer())
      .get('/shipments/my-shipments')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual([
          {
            id: 'shipment-1',
            status: 'paid',
            totalPrice: 45,
            weightKg: 5.5,
            photos: [],
            trip: {
              id: 'trip-1',
              route: {
                originName: 'Manaus',
                destinationName: 'Parintins',
              },
              origin: 'Manaus',
              destination: 'Parintins',
            },
            weight: 5.5,
            price: 45,
            dimensions: null,
          },
        ]);
      });

    expect(shipmentsService.findBySender).toHaveBeenCalledWith('user-1');
  });

  it('tracks shipments publicly and exposes timeline timestamps', async () => {
    await request(app.getHttpServer())
      .get('/shipments/track/TRK-123')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({
          shipment: {
            id: 'shipment-1',
            trackingCode: 'TRK-123',
            status: 'paid',
            totalPrice: 45,
            weightKg: 5.5,
            photos: [],
            trip: {
              id: 'trip-1',
              route: {
                originName: 'Manaus',
                destinationName: 'Parintins',
              },
              origin: 'Manaus',
              destination: 'Parintins',
            },
            weight: 5.5,
            price: 45,
            dimensions: null,
          },
          timeline: [
            {
              id: 'timeline-1',
              status: 'paid',
              description: 'Pagamento confirmado',
              createdAt: '2026-03-25T12:00:00.000Z',
              timestamp: '2026-03-25T12:00:00.000Z',
            },
          ],
        });
      });

    expect(shipmentsService.findByTrackingCode).toHaveBeenCalledWith('TRK-123');
    expect(shipmentsService.getTimeline).toHaveBeenCalledWith('shipment-1');
  });

  it('cancels shipments for the authenticated sender', async () => {
    await request(app.getHttpServer())
      .post('/shipments/shipment-1/cancel')
      .send({ reason: 'Mudança de plano' })
      .expect(201)
      .expect(({ body }) => {
        expect(body).toEqual({
          id: 'shipment-1',
          status: 'cancelled',
        });
      });

    expect(shipmentsService.cancel).toHaveBeenCalledWith(
      'shipment-1',
      'user-1',
      'Mudança de plano',
    );
  });

  it('blocks collection for users without the crew role', async () => {
    currentRole = 'passenger';

    await request(app.getHttpServer())
      .post('/shipments/shipment-1/collect')
      .send({ validationCode: '123456' })
      .expect(403);

    expect(shipmentsService.collectShipment).not.toHaveBeenCalled();
  });

  it('allows captains to collect shipments', async () => {
    currentRole = 'captain';

    await request(app.getHttpServer())
      .post('/shipments/shipment-1/collect')
      .send({
        validationCode: '123456',
        collectionPhotoUrl: 'https://cdn.example.com/collect.jpg',
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body).toEqual({
          id: 'shipment-1',
          status: 'collected',
        });
      });

    expect(shipmentsService.collectShipment).toHaveBeenCalledWith(
      'shipment-1',
      'user-1',
      '123456',
      'https://cdn.example.com/collect.jpg',
    );
  });

  it('rejects payment webhooks with the wrong shared secret', async () => {
    await request(app.getHttpServer())
      .post('/shipments/webhook/payment')
      .send({
        trackingCode: 'TRK-123',
        gatewayRef: 'gw-1',
        secret: 'wrong-secret',
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body).toEqual({
          received: false,
          error: 'Unauthorized',
        });
      });

    expect(shipmentsService.confirmPaymentByWebhook).not.toHaveBeenCalled();
  });

  it('accepts payment webhooks with the configured shared secret', async () => {
    await request(app.getHttpServer())
      .post('/shipments/webhook/payment')
      .send({
        trackingCode: 'TRK-123',
        gatewayRef: 'gw-1',
        secret: 'test-secret',
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body).toEqual({ received: true });
      });

    expect(shipmentsService.confirmPaymentByWebhook).toHaveBeenCalledWith(
      'TRK-123',
      'gw-1',
    );
  });
});
