import { BadRequestException } from '@nestjs/common';
import { ShipmentsService } from './shipments.service';
import { ShipmentStatus } from './shipment.entity';
import { PointAction } from '../gamification/point-transaction.entity';
import { PaymentMethod } from '../common/enums/payment-method.enum';
import { PaidBy } from '../common/enums/paid-by.enum';
import type { Repository } from 'typeorm';
import type { Shipment } from './shipment.entity';
import type { ShipmentTimeline } from './shipment-timeline.entity';
import type { Trip } from '../trips/trip.entity';
import type { Coupon } from '../coupons/coupon.entity';
import type { User } from '../users/user.entity';
import type { GamificationService } from '../gamification/gamification.service';
import type { NotificationsService } from '../notifications/notifications.service';

describe('ShipmentsService owner rewards', () => {
  it('awards boat owner points when a shipment is delivered', async () => {
    const shipment = {
      id: 'shipment-1',
      senderId: 'sender-1',
      trackingCode: 'TRK-1',
      validationCode: '123456',
      status: ShipmentStatus.ARRIVED,
      trip: {
        boat: { ownerId: 'owner-1' },
      },
    } as unknown as Shipment;

    const shipmentsRepo = {
      findOne: jest.fn().mockResolvedValue(shipment),
      save: jest.fn((value: Shipment) => Promise.resolve(value)),
      find: jest.fn().mockResolvedValue([]),
    };
    const timelineRepo = {
      create: jest.fn((value: Partial<ShipmentTimeline>) => value),
      save: jest.fn().mockResolvedValue(undefined),
    };
    const gamificationService = {
      awardPoints: jest.fn().mockResolvedValue({
        points: 15,
        action: PointAction.SHIPMENT_DELIVERED,
      }),
      awardBoatOwnerShipmentDelivered: jest.fn().mockResolvedValue(undefined),
    };
    const notificationsService = {
      sendToUser: jest.fn().mockResolvedValue(undefined),
    };

    const service = new ShipmentsService(
      shipmentsRepo as unknown as Repository<Shipment>,
      timelineRepo as unknown as Repository<ShipmentTimeline>,
      {} as Repository<Trip>,
      {} as Repository<Coupon>,
      {} as Repository<User>,
      gamificationService as unknown as GamificationService,
      notificationsService as unknown as NotificationsService,
    );

    await service.validateDelivery('TRK-1', '123456');

    expect(
      gamificationService.awardBoatOwnerShipmentDelivered,
    ).toHaveBeenCalledWith('owner-1', 'shipment-1');
  });
});

describe('ShipmentsService shipment availability policy', () => {
  it('rejects price calculation when cargoPriceKg is zero', async () => {
    const service = new ShipmentsService(
      {
        findOne: jest.fn().mockResolvedValue({
          id: 'trip-1',
          cargoPriceKg: 0,
          origin: 'Manaus',
          destination: 'Parintins',
        } as Trip),
        find: jest.fn().mockResolvedValue([]),
      } as unknown as Repository<Shipment>,
      {} as Repository<ShipmentTimeline>,
      {
        findOne: jest.fn().mockResolvedValue({
          id: 'trip-1',
          cargoPriceKg: 0,
          origin: 'Manaus',
          destination: 'Parintins',
        } as Trip),
      } as unknown as Repository<Trip>,
      {} as Repository<Coupon>,
      {} as Repository<User>,
      {} as GamificationService,
      {} as NotificationsService,
    );

    await expect(
      service.calculatePrice({
        tripId: 'trip-1',
        weight: 10,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('ShipmentsService cancellation policy', () => {
  it('rejects cancellation after collection', async () => {
    const shipment = {
      id: 'shipment-2',
      senderId: 'sender-1',
      status: ShipmentStatus.COLLECTED,
      trip: {
        id: 'trip-1',
        availableCargoKg: 100,
      },
    } as unknown as Shipment;

    const service = new ShipmentsService(
      {
        findOne: jest.fn().mockResolvedValue(shipment),
        find: jest.fn().mockResolvedValue([]),
      } as unknown as Repository<Shipment>,
      {} as Repository<ShipmentTimeline>,
      {} as Repository<Trip>,
      {} as Repository<Coupon>,
      {} as Repository<User>,
      {} as GamificationService,
      {} as NotificationsService,
    );

    await expect(
      service.cancel('shipment-2', 'sender-1'),
    ).rejects.toMatchObject({
      response: {
        message:
          'Cancelamento não permitido: a encomenda já foi coletada e entrou na operação logística.',
      },
    });
  });
});

describe('ShipmentsService cancellation reconciliation', () => {
  it('restores trip cargo capacity and records a timeline event when cancelling a paid shipment', async () => {
    const shipment = {
      id: 'shipment-3',
      senderId: 'sender-1',
      status: ShipmentStatus.PAID,
      weight: 10,
      length: 100,
      width: 50,
      height: 40,
      trip: {
        id: 'trip-1',
        availableCargoKg: 120,
      },
    } as unknown as Shipment;

    const shipmentsRepo = {
      findOne: jest.fn().mockResolvedValue(shipment),
      save: jest.fn((value: Shipment) => Promise.resolve(value)),
      find: jest.fn().mockResolvedValue([]),
    };
    const timelineRepo = {
      create: jest.fn((value: Partial<ShipmentTimeline>) => value),
      save: jest.fn().mockResolvedValue(undefined),
    };
    const tripsRepo = {
      update: jest.fn().mockResolvedValue(undefined),
    };

    const service = new ShipmentsService(
      shipmentsRepo as unknown as Repository<Shipment>,
      timelineRepo as unknown as Repository<ShipmentTimeline>,
      tripsRepo as unknown as Repository<Trip>,
      {} as Repository<Coupon>,
      {} as Repository<User>,
      {} as GamificationService,
      {} as NotificationsService,
    );

    const saved = await service.cancel(
      'shipment-3',
      'sender-1',
      'Mudança de plano',
    );

    expect(saved.status).toBe(ShipmentStatus.CANCELLED);
    expect(tripsRepo.update).toHaveBeenCalledWith('trip-1', {
      availableCargoKg: 153.33333333333334,
    });
    expect(timelineRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        shipmentId: 'shipment-3',
        status: ShipmentStatus.CANCELLED,
        description: 'Encomenda cancelada. Motivo: Mudança de plano',
        createdBy: 'sender-1',
      }),
    );
  });
});

describe('ShipmentsService payment confirmation flows', () => {
  it('confirms payment by webhook, records timeline and notifies the sender', async () => {
    const shipment = {
      id: 'shipment-4',
      senderId: 'sender-1',
      trackingCode: 'NJ2026000001',
      status: ShipmentStatus.PENDING,
    } as Shipment;

    const shipmentsRepo = {
      findOne: jest.fn().mockResolvedValue(shipment),
      save: jest.fn((value: Shipment) => Promise.resolve(value)),
      find: jest.fn().mockResolvedValue([]),
    };
    const timelineRepo = {
      create: jest.fn((value: Partial<ShipmentTimeline>) => value),
      save: jest.fn().mockResolvedValue(undefined),
    };
    const notificationsService = {
      sendToUser: jest.fn().mockResolvedValue(undefined),
    };

    const service = new ShipmentsService(
      shipmentsRepo as unknown as Repository<Shipment>,
      timelineRepo as unknown as Repository<ShipmentTimeline>,
      {} as Repository<Trip>,
      {} as Repository<Coupon>,
      {} as Repository<User>,
      {} as GamificationService,
      notificationsService as unknown as NotificationsService,
    );

    const saved = await service.confirmPaymentByWebhook(
      'NJ2026000001',
      'gw-123',
    );

    expect(saved.status).toBe(ShipmentStatus.PAID);
    expect(timelineRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        shipmentId: 'shipment-4',
        status: ShipmentStatus.PAID,
        description: 'Pagamento confirmado pelo gateway (ref: gw-123).',
      }),
    );
    const [, paidNotification] = notificationsService.sendToUser.mock
      .calls[0] as [string, { data: { type: string; shipmentId: string } }];
    expect(paidNotification.data).toEqual(
      expect.objectContaining({
        type: 'shipment_paid',
        shipmentId: 'shipment-4',
      }),
    );
  });

  it('keeps webhook confirmation idempotent when the shipment is already paid', async () => {
    const shipment = {
      id: 'shipment-5',
      senderId: 'sender-1',
      trackingCode: 'NJ2026000002',
      status: ShipmentStatus.PAID,
    } as Shipment;

    const shipmentsRepo = {
      findOne: jest.fn().mockResolvedValue(shipment),
      save: jest.fn((value: Shipment) => Promise.resolve(value)),
      find: jest.fn().mockResolvedValue([]),
    };
    const timelineRepo = {
      create: jest.fn((value: Partial<ShipmentTimeline>) => value),
      save: jest.fn().mockResolvedValue(undefined),
    };
    const notificationsService = {
      sendToUser: jest.fn().mockResolvedValue(undefined),
    };

    const service = new ShipmentsService(
      shipmentsRepo as unknown as Repository<Shipment>,
      timelineRepo as unknown as Repository<ShipmentTimeline>,
      {} as Repository<Trip>,
      {} as Repository<Coupon>,
      {} as Repository<User>,
      {} as GamificationService,
      notificationsService as unknown as NotificationsService,
    );

    const saved = await service.confirmPaymentByWebhook('NJ2026000002');

    expect(saved).toBe(shipment);
    expect(shipmentsRepo.save).not.toHaveBeenCalled();
    expect(timelineRepo.save).not.toHaveBeenCalled();
    expect(notificationsService.sendToUser).not.toHaveBeenCalled();
  });
});

describe('ShipmentsService collection policy', () => {
  it('blocks collection when the captain account is not verified', async () => {
    const shipmentsRepo = {
      find: jest.fn().mockResolvedValue([]),
    };
    const usersRepo = {
      findOne: jest
        .fn()
        .mockResolvedValue({ id: 'captain-1', isVerified: false }),
    };

    const service = new ShipmentsService(
      shipmentsRepo as unknown as Repository<Shipment>,
      {} as Repository<ShipmentTimeline>,
      {} as Repository<Trip>,
      {} as Repository<Coupon>,
      usersRepo as unknown as Repository<User>,
      {} as GamificationService,
      {} as NotificationsService,
    );

    await expect(
      service.collectShipment('shipment-6', 'captain-1', '123456'),
    ).rejects.toMatchObject({
      response: {
        message: 'Conta não verificada. Aguarde a aprovação do NavegaJá.',
      },
    });
  });

  it('allows collection for recipient-paid shipments still pending payment', async () => {
    const shipment = {
      id: 'shipment-7',
      senderId: 'sender-1',
      trackingCode: 'NJ2026000003',
      validationCode: '123456',
      status: ShipmentStatus.PENDING,
      paymentMethod: PaymentMethod.CASH,
      paidBy: PaidBy.RECIPIENT,
      trip: {
        captainId: 'captain-1',
      },
    } as unknown as Shipment;

    const shipmentsRepo = {
      findOne: jest.fn().mockResolvedValue(shipment),
      save: jest.fn((value: Shipment) => Promise.resolve(value)),
      find: jest.fn().mockResolvedValue([]),
    };
    const timelineRepo = {
      create: jest.fn((value: Partial<ShipmentTimeline>) => value),
      save: jest.fn().mockResolvedValue(undefined),
    };
    const usersRepo = {
      findOne: jest
        .fn()
        .mockResolvedValue({ id: 'captain-1', isVerified: true }),
    };
    const notificationsService = {
      sendToUser: jest.fn().mockResolvedValue(undefined),
    };

    const service = new ShipmentsService(
      shipmentsRepo as unknown as Repository<Shipment>,
      timelineRepo as unknown as Repository<ShipmentTimeline>,
      {} as Repository<Trip>,
      {} as Repository<Coupon>,
      usersRepo as unknown as Repository<User>,
      {} as GamificationService,
      notificationsService as unknown as NotificationsService,
    );

    const saved = await service.collectShipment(
      'shipment-7',
      'captain-1',
      '123456',
      'https://example.com/collection.jpg',
    );

    expect(saved.status).toBe(ShipmentStatus.COLLECTED);
    expect(saved.collectionPhotoUrl).toBe('https://example.com/collection.jpg');
    expect(timelineRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        shipmentId: 'shipment-7',
        status: ShipmentStatus.COLLECTED,
        createdBy: 'captain-1',
      }),
    );
    const [, collectedNotification] = notificationsService.sendToUser.mock
      .calls[0] as [string, { data: { type: string; shipmentId: string } }];
    expect(collectedNotification.data).toEqual(
      expect.objectContaining({
        type: 'shipment_collected',
        shipmentId: 'shipment-7',
      }),
    );
  });
});
