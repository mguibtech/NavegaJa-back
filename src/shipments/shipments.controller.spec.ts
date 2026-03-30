import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Repository } from 'typeorm';
import { CouponsService } from '../coupons/coupons.service';
import { ShipmentReview } from './shipment-review.entity';
import { ShipmentStatus } from './shipment.entity';
import { ShipmentsController } from './shipments.controller';
import { ShipmentsService } from './shipments.service';
import { StorageService } from './storage.service';

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'uuid-test'),
}));

describe('ShipmentsController', () => {
  const shipmentsService = {
    calculatePrice: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    findBySender: jest.fn(),
    findByTrackingCode: jest.fn(),
    getTimeline: jest.fn(),
    confirmPayment: jest.fn(),
    confirmPaymentByWebhook: jest.fn(),
    collectShipment: jest.fn(),
    outForDelivery: jest.fn(),
    validateDelivery: jest.fn(),
    cancel: jest.fn(),
    updateStatus: jest.fn(),
    deliver: jest.fn(),
  };
  const storageService = {
    generatePresignedUrls: jest.fn(),
    buildFileUrl: jest.fn((folder: string, filename: string) => {
      return `https://app.example.com/upload/files/${folder}/${filename}`;
    }),
  };
  const couponsService = {
    validateForShipment: jest.fn(),
  };
  const configService = {
    get: jest.fn(),
  };
  const reviewsRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const controller = new ShipmentsController(
    shipmentsService as unknown as ShipmentsService,
    storageService as unknown as StorageService,
    couponsService as unknown as CouponsService,
    configService as unknown as ConfigService,
    reviewsRepo as unknown as Repository<ShipmentReview>,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    configService.get.mockImplementation(
      (key: string, defaultValue?: string): string | undefined => {
        if (key === 'BASE_URL') return undefined;
        if (key === 'APP_URL') return 'https://app.example.com';
        if (key === 'PAYMENT_WEBHOOK_SECRET') return 'shared-secret';
        return defaultValue;
      },
    );
  });

  it('delegates calculatePrice to service', async () => {
    shipmentsService.calculatePrice.mockResolvedValue({ totalPrice: 100 });

    await expect(controller.calculatePrice({} as never)).resolves.toEqual({
      totalPrice: 100,
    });
    expect(shipmentsService.calculatePrice).toHaveBeenCalledWith({});
  });

  it('validateCoupon returns invalid response from coupon service', async () => {
    couponsService.validateForShipment.mockResolvedValue({
      valid: false,
      message: 'cupom inválido',
    });

    await expect(
      controller.validateCoupon(createReq(), 'ABC', 'shipment-1'),
    ).resolves.toEqual({
      valid: false,
      message: 'cupom inválido',
    });
  });

  it('validateCoupon guards against malformed success payload', async () => {
    couponsService.validateForShipment.mockResolvedValue({
      valid: true,
      coupon: null,
      discount: undefined,
    });

    await expect(
      controller.validateCoupon(createReq(), 'ABC', 'shipment-1'),
    ).resolves.toEqual({
      valid: false,
      message: 'Erro ao validar cupom',
    });
  });

  it('validateCoupon returns calculated pricing data when valid', async () => {
    couponsService.validateForShipment.mockResolvedValue({
      valid: true,
      coupon: { code: 'PROMO10', type: 'percentage', value: '10' },
      discount: 12.5,
    });
    shipmentsService.findById.mockResolvedValue({
      id: 'shipment-1',
      totalPrice: '100',
    });

    await expect(
      controller.validateCoupon(createReq(), 'PROMO10', 'shipment-1'),
    ).resolves.toEqual({
      valid: true,
      coupon: { code: 'PROMO10', type: 'percentage', value: 10 },
      originalPrice: 100,
      discount: 12.5,
      finalPrice: 87.5,
      savedAmount: 12.5,
    });
  });

  it('generates presigned upload urls', async () => {
    storageService.generatePresignedUrls.mockResolvedValue(['url-1', 'url-2']);

    await expect(
      controller.generatePresignedUrls({ count: 2 }),
    ).resolves.toEqual({
      urls: ['url-1', 'url-2'],
      expiresIn: 300,
    });
    expect(storageService.generatePresignedUrls).toHaveBeenCalledWith(2);
  });

  it('create normalizes payload, merges photos and serializes output', async () => {
    const dto = {
      tripId: 'trip-1',
      description: 'Caixa',
      weight: '5.5',
      dimensions: JSON.stringify({ length: '30', width: '20', height: '10' }),
      photos: 'https://cdn/input-photo.jpg',
    };
    const files = [{ filename: 'upload-a.jpg' }, { filename: 'upload-b.jpg' }];
    shipmentsService.create.mockResolvedValue(makeShipment());

    await controller.create(createReq(), dto as never, files as never);

    expect(shipmentsService.create).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        tripId: 'trip-1',
        description: 'Caixa',
        weight: 5.5,
        length: 30,
        width: 20,
        height: 10,
        photos: [
          'https://cdn/input-photo.jpg',
          'https://app.example.com/upload/files/shipments/upload-a.jpg',
          'https://app.example.com/upload/files/shipments/upload-b.jpg',
        ],
      }),
    );
  });

  it('create throws when weight is missing or not parseable', async () => {
    await expect(
      controller.create(createReq(), {
        tripId: 'trip-1',
        description: 'Sem peso',
        weight: '',
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('lists sender shipments with frontend aliases', async () => {
    shipmentsService.findBySender.mockResolvedValue([makeShipment()]);

    const response = await controller.myShipments(createReq());

    expect(response[0]).toEqual(
      expect.objectContaining({
        weight: 2.5,
        price: 120,
      }),
    );
  });

  it('tracks shipment and maps timeline timestamp field', async () => {
    const shipment = makeShipment();
    const now = new Date('2030-01-01T10:00:00.000Z');
    shipmentsService.findByTrackingCode.mockResolvedValue(shipment);
    shipmentsService.getTimeline.mockResolvedValue([
      { id: 't-1', status: 'pending', createdAt: now },
    ]);

    await expect(controller.track('TRK123')).resolves.toEqual({
      shipment: expect.objectContaining({ id: 'shipment-1' }),
      timeline: [
        {
          id: 't-1',
          status: 'pending',
          createdAt: now,
          timestamp: now,
        },
      ],
    });
  });

  it('findById delegates to service with authenticated user', async () => {
    shipmentsService.findById.mockResolvedValue(makeShipment());

    await expect(
      controller.findById('shipment-1', createReq()),
    ).resolves.toEqual(expect.objectContaining({ id: 'shipment-1' }));
    expect(shipmentsService.findById).toHaveBeenCalledWith(
      'shipment-1',
      'user-1',
    );
  });

  it('getTimeline adds timestamp aliases', async () => {
    const createdAt = new Date('2030-01-01T12:00:00.000Z');
    shipmentsService.findById.mockResolvedValue(makeShipment());
    shipmentsService.getTimeline.mockResolvedValue([{ id: 'x', createdAt }]);

    await expect(
      controller.getTimeline('shipment-1', createReq()),
    ).resolves.toEqual([{ id: 'x', createdAt, timestamp: createdAt }]);
  });

  it('confirmPayment returns shipment payload plus success message', async () => {
    shipmentsService.confirmPayment.mockResolvedValue(makeShipment());

    const result = await controller.confirmPayment('shipment-1', createReq());

    expect(result.shipment).toEqual(
      expect.objectContaining({ id: 'shipment-1' }),
    );
    expect(result.message).toContain('Pagamento confirmado');
  });

  it('paymentWebhook rejects unauthorized secrets', async () => {
    await expect(
      controller.paymentWebhook('TRK123', 'gateway-ref', 'wrong-secret'),
    ).resolves.toEqual({
      received: false,
      error: 'Unauthorized',
    });
    expect(shipmentsService.confirmPaymentByWebhook).not.toHaveBeenCalled();
  });

  it('paymentWebhook accepts valid secret and confirms payment', async () => {
    await expect(
      controller.paymentWebhook('TRK123', 'gateway-ref', 'shared-secret'),
    ).resolves.toEqual({ received: true });
    expect(shipmentsService.confirmPaymentByWebhook).toHaveBeenCalledWith(
      'TRK123',
      'gateway-ref',
    );
  });

  it('delegates collect and out-for-delivery flows', async () => {
    shipmentsService.collectShipment.mockResolvedValue({ id: 'shipment-1' });
    shipmentsService.outForDelivery.mockResolvedValue({ id: 'shipment-1' });

    await controller.collectShipment(
      'shipment-1',
      createReq('captain'),
      '123456',
      'photo-url',
    );
    await controller.outForDelivery('shipment-1', createReq('captain'));

    expect(shipmentsService.collectShipment).toHaveBeenCalledWith(
      'shipment-1',
      'user-1',
      '123456',
      'photo-url',
    );
    expect(shipmentsService.outForDelivery).toHaveBeenCalledWith(
      'shipment-1',
      'user-1',
    );
  });

  it('delegates delivery validation/cancel/status update/deliver', async () => {
    shipmentsService.validateDelivery.mockResolvedValue({ ok: true });
    shipmentsService.cancel.mockResolvedValue({ id: 'shipment-1' });
    shipmentsService.updateStatus.mockResolvedValue({ id: 'shipment-1' });
    shipmentsService.deliver.mockResolvedValue({ id: 'shipment-1' });

    await controller.validateDelivery('TRK123', '111111', 'photo-delivery');
    await controller.cancel('shipment-1', createReq(), 'motivo');
    await controller.updateStatus(
      'shipment-1',
      ShipmentStatus.IN_TRANSIT,
      createReq('captain'),
    );
    await controller.deliver(
      'shipment-1',
      createReq('captain'),
      'photo-delivery',
    );

    expect(shipmentsService.validateDelivery).toHaveBeenCalledWith(
      'TRK123',
      '111111',
      'photo-delivery',
    );
    expect(shipmentsService.cancel).toHaveBeenCalledWith(
      'shipment-1',
      'user-1',
      'motivo',
    );
    expect(shipmentsService.updateStatus).toHaveBeenCalledWith(
      'shipment-1',
      ShipmentStatus.IN_TRANSIT,
      'user-1',
    );
    expect(shipmentsService.deliver).toHaveBeenCalledWith(
      'shipment-1',
      'photo-delivery',
      'user-1',
    );
  });

  it('createReview only allows delivered shipments', async () => {
    shipmentsService.findById.mockResolvedValue({
      id: 'shipment-1',
      senderId: 'user-1',
      status: ShipmentStatus.PAID,
    });

    await expect(
      controller.createReview(createReq(), {
        shipmentId: 'shipment-1',
      } as never),
    ).rejects.toThrow('avaliar');
  });

  it('createReview blocks duplicate review submissions', async () => {
    shipmentsService.findById.mockResolvedValue({
      id: 'shipment-1',
      senderId: 'user-1',
      status: ShipmentStatus.DELIVERED,
    });
    reviewsRepo.findOne.mockResolvedValue({ id: 'existing-review' });

    await expect(
      controller.createReview(createReq(), {
        shipmentId: 'shipment-1',
      } as never),
    ).rejects.toThrow('avaliada');
  });

  it('createReview persists sender-bound review when valid', async () => {
    shipmentsService.findById.mockResolvedValue({
      id: 'shipment-1',
      senderId: 'user-1',
      status: ShipmentStatus.DELIVERED,
    });
    reviewsRepo.findOne.mockResolvedValue(null);
    reviewsRepo.create.mockImplementation((payload: unknown) => payload);
    reviewsRepo.save.mockImplementation(async (payload: unknown) => payload);

    await expect(
      controller.createReview(createReq(), {
        shipmentId: 'shipment-1',
        rating: 5,
        comment: 'entrega excelente',
      } as never),
    ).resolves.toEqual(
      expect.objectContaining({
        shipmentId: 'shipment-1',
        senderId: 'user-1',
      }),
    );
  });

  it('loads review with sender relation after access check', async () => {
    shipmentsService.findById.mockResolvedValue(makeShipment());
    reviewsRepo.findOne.mockResolvedValue({ id: 'review-1' });

    await expect(
      controller.getReview('shipment-1', createReq()),
    ).resolves.toEqual({
      id: 'review-1',
    });
    expect(shipmentsService.findById).toHaveBeenCalledWith(
      'shipment-1',
      'user-1',
    );
    expect(reviewsRepo.findOne).toHaveBeenCalledWith({
      where: { shipmentId: 'shipment-1' },
      relations: ['sender'],
    });
  });

  it('normalizes DTO with object dimensions and array photos', () => {
    const normalized = (
      controller as unknown as {
        normalizeCreateShipmentDto: (dto: Record<string, unknown>) => {
          weight: number;
          length?: number;
          width?: number;
          height?: number;
          photos?: string[];
        };
      }
    ).normalizeCreateShipmentDto({
      weightKg: '4',
      dimensions: { length: '11', width: '12', height: '13' },
      photos: ['a.jpg', '', 123],
    });

    expect(normalized).toEqual(
      expect.objectContaining({
        weight: 4,
        length: 11,
        width: 12,
        height: 13,
        photos: ['a.jpg'],
      }),
    );
  });

  it('normalizes DTO with invalid dimensions JSON fallback', () => {
    const normalized = (
      controller as unknown as {
        normalizeCreateShipmentDto: (dto: Record<string, unknown>) => {
          length?: number;
          width?: number;
          height?: number;
          photos?: string[];
        };
      }
    ).normalizeCreateShipmentDto({
      weight: '3',
      dimensions: '{invalid-json',
      photos: 'single-photo.jpg',
      length: '8',
      width: '9',
      height: '10',
    });

    expect(normalized).toEqual(
      expect.objectContaining({
        length: 8,
        width: 9,
        height: 10,
        photos: ['single-photo.jpg'],
      }),
    );
  });

  it('serializes shipment with fallback trip origin/destination and dimensions', () => {
    const serialized = (
      controller as unknown as {
        serializeShipment: (shipment: ReturnType<typeof makeShipment>) => {
          trip?: { origin: string; destination: string };
          dimensions: {
            length: number | null;
            width: number | null;
            height: number | null;
          } | null;
          photos: string[];
          weight: number | null;
          price: number | null;
        };
      }
    ).serializeShipment(makeShipment());

    expect(serialized).toEqual(
      expect.objectContaining({
        trip: expect.objectContaining({
          origin: 'Manaus',
          destination: 'Parintins',
        }),
        dimensions: { length: 30, width: 20, height: 10 },
        photos: ['https://cdn/current-photo.jpg'],
        weight: 2.5,
        price: 120,
      }),
    );
  });

  it('serializes shipment with null dimensions and default photos', () => {
    const serialized = (
      controller as unknown as {
        serializeShipment: (shipment: Record<string, unknown>) => {
          dimensions: {
            length: number | null;
            width: number | null;
            height: number | null;
          } | null;
          photos: string[];
          weight: number | null;
          price: number | null;
        };
      }
    ).serializeShipment({
      id: 'shipment-2',
      weightKg: null,
      weight: null,
      totalPrice: null,
      photos: null,
      length: null,
      width: null,
      height: null,
    });

    expect(serialized).toEqual(
      expect.objectContaining({
        dimensions: null,
        photos: [],
        weight: null,
        price: null,
      }),
    );
  });
});

function createReq(role = 'passenger'): AuthenticatedRequest {
  return {
    user: {
      sub: 'user-1',
      role,
    },
  } as AuthenticatedRequest;
}

function makeShipment() {
  return {
    id: 'shipment-1',
    senderId: 'user-1',
    totalPrice: 120,
    weightKg: 2.5,
    photos: ['https://cdn/current-photo.jpg'],
    length: 30,
    width: 20,
    height: 10,
    status: ShipmentStatus.DELIVERED,
    trip: {
      origin: '',
      destination: '',
      route: {
        originName: 'Manaus',
        destinationName: 'Parintins',
      },
    },
  };
}
