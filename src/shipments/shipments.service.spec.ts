import { BadRequestException } from '@nestjs/common';
import { ShipmentsService } from './shipments.service';
import { ShipmentStatus } from './shipment.entity';
import { PointAction } from '../gamification/point-transaction.entity';
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
