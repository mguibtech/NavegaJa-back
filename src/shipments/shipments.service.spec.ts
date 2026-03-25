import { BadRequestException } from '@nestjs/common';
import * as QRCode from 'qrcode';
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

jest.mock('qrcode', () => ({
  __esModule: true,
  toDataURL: jest.fn(),
}));

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

describe('ShipmentsService extended flows', () => {
  const createHarness = () => {
    const shipmentsRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      create: jest.fn((value: Partial<Shipment>) => value),
      save: jest.fn((value: Shipment) => Promise.resolve(value)),
      update: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    const timelineRepo = {
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((value: Partial<ShipmentTimeline>) => value),
      save: jest.fn().mockResolvedValue(undefined),
    };
    const tripsRepo = {
      findOne: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
      save: jest.fn((value: Trip) => Promise.resolve(value)),
    };
    const couponsRepo = {
      findOne: jest.fn(),
    };
    const usersRepo = {
      findOne: jest.fn(),
    };
    const gamificationService = {
      awardPoints: jest.fn().mockResolvedValue({
        points: 10,
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
      tripsRepo as unknown as Repository<Trip>,
      couponsRepo as unknown as Repository<Coupon>,
      usersRepo as unknown as Repository<User>,
      gamificationService as unknown as GamificationService,
      notificationsService as unknown as NotificationsService,
    );

    return {
      service,
      shipmentsRepo,
      timelineRepo,
      tripsRepo,
      couponsRepo,
      usersRepo,
      gamificationService,
      notificationsService,
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('creates shipment, reserves cargo, persists qr code and notifies app recipient', async () => {
    const {
      service,
      shipmentsRepo,
      tripsRepo,
      usersRepo,
      notificationsService,
      timelineRepo,
    } = createHarness();
    const trip = {
      id: 'trip-1',
      availableCargoKg: 100,
      cargoPriceKg: 12,
      origin: 'Manaus',
      destination: 'Parintins',
    } as Trip;
    tripsRepo.findOne.mockResolvedValue(trip);
    jest.spyOn(service, 'calculatePrice').mockResolvedValue({
      basePrice: 120,
      finalPrice: 120,
      chargedWeight: 30,
      actualWeight: 30,
      weightCharge: 120,
      pricePerKg: 4,
      totalDiscount: 0,
      couponDiscount: 0,
    } as never);
    (QRCode.toDataURL as jest.Mock).mockResolvedValue(
      'data:image/png;base64,shipment-qr',
    );
    shipmentsRepo.save.mockResolvedValue({
      id: 'shipment-10',
      senderId: 'sender-1',
      tripId: 'trip-1',
      trackingCode: 'NJ2026000010',
      validationCode: '123456',
      paidBy: PaidBy.RECIPIENT,
      totalPrice: 120,
      recipientPhone: '5511999999999',
    });
    usersRepo.findOne.mockImplementation(({ where }) => {
      if (where?.phone) {
        return Promise.resolve({
          id: 'recipient-1',
          name: 'DestinatÃ¡rio',
          fcmToken: 'token',
        });
      }
      if (where?.id) {
        return Promise.resolve({
          id: 'sender-1',
          name: 'Remetente',
        });
      }
      return Promise.resolve(null);
    });

    const saved = await service.create('sender-1', {
      tripId: 'trip-1',
      description: 'EletrÃ´nicos',
      weight: 30,
      paymentMethod: PaymentMethod.CASH,
      paidBy: PaidBy.RECIPIENT,
      recipientName: 'DestinatÃ¡rio',
      recipientPhone: '5511999999999',
    } as never);

    expect(saved.id).toBe('shipment-10');
    expect(tripsRepo.update).toHaveBeenCalledWith('trip-1', {
      availableCargoKg: 70,
    });
    expect(shipmentsRepo.update).toHaveBeenCalledWith('shipment-10', {
      qrCode: 'data:image/png;base64,shipment-qr',
    });
    expect(shipmentsRepo.update).toHaveBeenCalledWith('shipment-10', {
      recipientUserId: 'recipient-1',
    });
    expect(timelineRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        shipmentId: 'shipment-10',
        status: ShipmentStatus.PENDING,
      }),
    );
    expect(notificationsService.sendToUser).toHaveBeenCalledWith(
      'recipient-1',
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'shipment_incoming',
          shipmentId: 'shipment-10',
        }),
      }),
    );
  });

  it('rolls back shipment creation when trip cargo is insufficient', async () => {
    const { service, shipmentsRepo, tripsRepo, usersRepo } = createHarness();
    tripsRepo.findOne.mockResolvedValue({
      id: 'trip-2',
      availableCargoKg: 10,
      cargoPriceKg: 10,
      origin: 'Manaus',
      destination: 'Careiro',
    } as Trip);
    jest.spyOn(service, 'calculatePrice').mockResolvedValue({
      basePrice: 80,
      finalPrice: 80,
      chargedWeight: 20,
      actualWeight: 20,
      weightCharge: 80,
      pricePerKg: 4,
      totalDiscount: 0,
      couponDiscount: 0,
    } as never);
    (QRCode.toDataURL as jest.Mock).mockResolvedValue(
      'data:image/png;base64,shipment-qr',
    );
    shipmentsRepo.save.mockResolvedValue({
      id: 'shipment-11',
      trackingCode: 'NJ2026000011',
      validationCode: '654321',
    });
    usersRepo.findOne.mockResolvedValue(null);

    await expect(
      service.create('sender-1', {
        tripId: 'trip-2',
        description: 'Caixa',
        weight: 20,
        paymentMethod: PaymentMethod.PIX,
        recipientName: 'DestinatÃ¡rio',
        recipientPhone: '5511888888888',
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(shipmentsRepo.delete).toHaveBeenCalledWith('shipment-11');
  });

  it('blocks findById for users who are not sender or trip captain', async () => {
    const { service, shipmentsRepo } = createHarness();
    shipmentsRepo.findOne.mockResolvedValue({
      id: 'shipment-12',
      senderId: 'sender-allowed',
      trip: {
        captainId: 'captain-allowed',
      },
    } as Shipment);

    await expect(service.findById('shipment-12', 'intruder')).rejects.toMatchObject(
      {
        response: expect.objectContaining({
          message: expect.stringContaining('permiss'),
        }),
      },
    );
  });

  it('updates shipment status and creates a timeline event', async () => {
    const { service, shipmentsRepo, timelineRepo } = createHarness();
    shipmentsRepo.findOne.mockResolvedValue({
      id: 'shipment-13',
      senderId: 'sender-13',
      status: ShipmentStatus.PENDING,
    } as Shipment);

    const saved = await service.updateStatus(
      'shipment-13',
      ShipmentStatus.IN_TRANSIT,
      'captain-13',
    );

    expect(saved.status).toBe(ShipmentStatus.IN_TRANSIT);
    expect(timelineRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        shipmentId: 'shipment-13',
        status: ShipmentStatus.IN_TRANSIT,
        createdBy: 'captain-13',
      }),
    );
  });

  it('delivers shipment and awards sender/owner points', async () => {
    const { service, shipmentsRepo, gamificationService } = createHarness();
    shipmentsRepo.findOne.mockResolvedValue({
      id: 'shipment-14',
      senderId: 'sender-14',
      status: ShipmentStatus.OUT_FOR_DELIVERY,
      trip: {
        boat: { ownerId: 'owner-14' },
      },
    } as Shipment);

    const saved = await service.deliver('shipment-14', 'https://photo');

    expect(saved.status).toBe(ShipmentStatus.DELIVERED);
    expect(gamificationService.awardPoints).toHaveBeenCalledWith(
      'sender-14',
      PointAction.SHIPMENT_DELIVERED,
      'shipment-14',
    );
    expect(
      gamificationService.awardBoatOwnerShipmentDelivered,
    ).toHaveBeenCalledWith('owner-14', 'shipment-14');
  });

  it('confirms payment for pending shipment created by sender', async () => {
    const { service, shipmentsRepo, timelineRepo } = createHarness();
    shipmentsRepo.findOne.mockResolvedValue({
      id: 'shipment-15',
      senderId: 'sender-15',
      paymentMethod: PaymentMethod.PIX,
      paidBy: PaidBy.SENDER,
      status: ShipmentStatus.PENDING,
    } as Shipment);

    const saved = await service.confirmPayment('shipment-15', 'sender-15');

    expect(saved.status).toBe(ShipmentStatus.PAID);
    expect(timelineRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        shipmentId: 'shipment-15',
        status: ShipmentStatus.PAID,
      }),
    );
  });

  it('blocks sender payment confirmation for cash shipments', async () => {
    const { service, shipmentsRepo } = createHarness();
    shipmentsRepo.findOne.mockResolvedValue({
      id: 'shipment-16',
      senderId: 'sender-16',
      paymentMethod: PaymentMethod.CASH,
      paidBy: PaidBy.SENDER,
      status: ShipmentStatus.PENDING,
    } as Shipment);

    await expect(
      service.confirmPayment('shipment-16', 'sender-16'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('blocks sender payment confirmation for recipient-paid shipments', async () => {
    const { service, shipmentsRepo } = createHarness();
    shipmentsRepo.findOne.mockResolvedValue({
      id: 'shipment-17',
      senderId: 'sender-17',
      paymentMethod: PaymentMethod.PIX,
      paidBy: PaidBy.RECIPIENT,
      status: ShipmentStatus.PENDING,
    } as Shipment);

    await expect(
      service.confirmPayment('shipment-17', 'sender-17'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('sets out-for-delivery and notifies sender and recipient', async () => {
    const { service, shipmentsRepo, notificationsService } = createHarness();
    shipmentsRepo.findOne.mockResolvedValue({
      id: 'shipment-18',
      senderId: 'sender-18',
      trackingCode: 'NJ2026000018',
      status: ShipmentStatus.ARRIVED,
      paidBy: PaidBy.RECIPIENT,
      totalPrice: 99.9,
      recipientUserId: 'recipient-18',
      trip: {
        captainId: 'captain-18',
      },
    } as Shipment);

    const saved = await service.outForDelivery('shipment-18', 'captain-18');

    expect(saved.status).toBe(ShipmentStatus.OUT_FOR_DELIVERY);
    expect(notificationsService.sendToUser).toHaveBeenCalledTimes(2);
    const [, recipientPayload] = notificationsService.sendToUser.mock
      .calls[1] as [string, { body: string }];
    expect(recipientPayload.body).toContain('R$ 99.90');
  });

  it('blocks out-for-delivery when shipment has not arrived', async () => {
    const { service, shipmentsRepo } = createHarness();
    shipmentsRepo.findOne.mockResolvedValue({
      id: 'shipment-19',
      status: ShipmentStatus.COLLECTED,
      trip: {
        captainId: 'captain-19',
      },
    } as Shipment);

    await expect(
      service.outForDelivery('shipment-19', 'captain-19'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('blocks delivery validation when code is invalid', async () => {
    const { service, shipmentsRepo } = createHarness();
    shipmentsRepo.findOne.mockResolvedValue({
      id: 'shipment-20',
      senderId: 'sender-20',
      trackingCode: 'NJ2026000020',
      validationCode: '111111',
      status: ShipmentStatus.ARRIVED,
      trip: { boat: { ownerId: 'owner-20' } },
    } as Shipment);

    await expect(
      service.validateDelivery('NJ2026000020', '000000'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('validates delivery, awards coins and notifies both parties', async () => {
    const { service, shipmentsRepo, gamificationService, notificationsService } =
      createHarness();
    shipmentsRepo.findOne.mockResolvedValue({
      id: 'shipment-21',
      senderId: 'sender-21',
      trackingCode: 'NJ2026000021',
      validationCode: '222222',
      status: ShipmentStatus.OUT_FOR_DELIVERY,
      recipientUserId: 'recipient-21',
      trip: { boat: { ownerId: 'owner-21' } },
    } as Shipment);
    gamificationService.awardPoints.mockResolvedValue({
      points: 25,
      action: PointAction.SHIPMENT_DELIVERED,
    });

    const result = await service.validateDelivery('NJ2026000021', '222222');

    expect(result.message).toBe('Entrega confirmada com sucesso!');
    expect(result.navegaCoinsEarned).toBe(25);
    expect(notificationsService.sendToUser).toHaveBeenCalledTimes(2);
  });

  it('updates shipments by trip and notifies sender for in-transit status', async () => {
    const { service, shipmentsRepo, notificationsService } = createHarness();
    shipmentsRepo.find.mockResolvedValue([
      {
        id: 'shipment-22',
        senderId: 'sender-22',
        trackingCode: 'NJ2026000022',
        status: ShipmentStatus.PAID,
      },
      {
        id: 'shipment-22b',
        senderId: 'sender-22',
        trackingCode: 'NJ2026000022B',
        status: ShipmentStatus.CANCELLED,
      },
      {
        id: 'shipment-22c',
        senderId: 'sender-22',
        trackingCode: 'NJ2026000022C',
        status: ShipmentStatus.DELIVERED,
      },
    ] as Shipment[]);

    await service.updateShipmentsByTrip('trip-22', ShipmentStatus.IN_TRANSIT);

    expect(shipmentsRepo.save).toHaveBeenCalledTimes(1);
    expect(notificationsService.sendToUser).toHaveBeenCalledWith(
      'sender-22',
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'shipment_in_transit',
          shipmentId: 'shipment-22',
        }),
      }),
    );
  });

  it('sends arrival notification when bulk status is ARRIVED', async () => {
    const { service, shipmentsRepo, notificationsService } = createHarness();
    shipmentsRepo.find.mockResolvedValue([
      {
        id: 'shipment-23',
        senderId: 'sender-23',
        trackingCode: 'NJ2026000023',
        status: ShipmentStatus.PAID,
      },
    ] as Shipment[]);

    await service.updateShipmentsByTrip('trip-23', ShipmentStatus.ARRIVED);

    expect(notificationsService.sendToUser).toHaveBeenCalledWith(
      'sender-23',
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'shipment_arrived',
          shipmentId: 'shipment-23',
        }),
      }),
    );
  });

  it('sends cancellation notification when bulk status is CANCELLED', async () => {
    const { service, shipmentsRepo, notificationsService } = createHarness();
    shipmentsRepo.find.mockResolvedValue([
      {
        id: 'shipment-24',
        senderId: 'sender-24',
        trackingCode: 'NJ2026000024',
        status: ShipmentStatus.PAID,
      },
    ] as Shipment[]);

    await service.updateShipmentsByTrip('trip-24', ShipmentStatus.CANCELLED);

    expect(notificationsService.sendToUser).toHaveBeenCalledWith(
      'sender-24',
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'shipment_cancelled',
          shipmentId: 'shipment-24',
        }),
      }),
    );
  });

  it('rejects cancellation when shipment is already delivered', async () => {
    const { service, shipmentsRepo } = createHarness();
    shipmentsRepo.findOne.mockResolvedValue({
      id: 'shipment-25',
      senderId: 'sender-25',
      status: ShipmentStatus.DELIVERED,
      trip: { id: 'trip-25', availableCargoKg: 100 },
    } as Shipment);

    await expect(
      service.cancel('shipment-25', 'sender-25'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects cancellation when shipment is already cancelled', async () => {
    const { service, shipmentsRepo } = createHarness();
    shipmentsRepo.findOne.mockResolvedValue({
      id: 'shipment-26',
      senderId: 'sender-26',
      status: ShipmentStatus.CANCELLED,
      trip: { id: 'trip-26', availableCargoKg: 100 },
    } as Shipment);

    await expect(
      service.cancel('shipment-26', 'sender-26'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('cancels pending shipment without touching cargo when trip is not tracked', async () => {
    const { service, shipmentsRepo, tripsRepo, timelineRepo } = createHarness();
    shipmentsRepo.findOne.mockResolvedValue({
      id: 'shipment-27',
      senderId: 'sender-27',
      status: ShipmentStatus.PENDING,
      weight: 5,
      trip: {
        id: 'trip-27',
        availableCargoKg: null,
      },
    } as Shipment);

    const saved = await service.cancel('shipment-27', 'sender-27');

    expect(saved.status).toBe(ShipmentStatus.CANCELLED);
    expect(tripsRepo.update).not.toHaveBeenCalled();
    expect(timelineRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        shipmentId: 'shipment-27',
        description: 'Encomenda cancelada pelo remetente',
      }),
    );
  });
});
