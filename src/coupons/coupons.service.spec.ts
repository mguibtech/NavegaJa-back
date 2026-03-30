import type { Repository } from 'typeorm';
import { CouponsService } from './coupons.service';
import { CouponApplicability, CouponType, type Coupon } from './coupon.entity';
import type { Trip } from '../trips/trip.entity';
import type { Shipment } from '../shipments/shipment.entity';
import type { NotificationsService } from '../notifications/notifications.service';

type CouponsQbMock = {
  where: jest.Mock;
  andWhere: jest.Mock;
  orderBy: jest.Mock;
  getMany: jest.Mock;
};

const createCouponsQb = (result: Coupon[] = []): CouponsQbMock => {
  const qb = {
    where: jest.fn(),
    andWhere: jest.fn(),
    orderBy: jest.fn(),
    getMany: jest.fn().mockResolvedValue(result),
  } as CouponsQbMock;
  qb.where.mockReturnValue(qb);
  qb.andWhere.mockReturnValue(qb);
  qb.orderBy.mockReturnValue(qb);
  return qb;
};

describe('CouponsService', () => {
  const createService = () => {
    const couponsRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn((data: Partial<Coupon>) => data as Coupon),
      save: jest.fn((data: Coupon) => Promise.resolve(data)),
      increment: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    const tripsRepo = {
      findOne: jest.fn(),
    };
    const shipmentsRepo = {
      findOne: jest.fn(),
    };
    const notificationsService = {
      broadcast: jest.fn().mockResolvedValue({ sent: 10 }),
    };

    const service = new CouponsService(
      couponsRepo as unknown as Repository<Coupon>,
      tripsRepo as unknown as Repository<Trip>,
      shipmentsRepo as unknown as Repository<Shipment>,
      notificationsService as unknown as NotificationsService,
    );

    return {
      service,
      couponsRepo,
      tripsRepo,
      shipmentsRepo,
      notificationsService,
    };
  };

  it('creates coupon with uppercase code and rejects duplicates/invalid percentage', async () => {
    const { service, couponsRepo, notificationsService } = createService();
    couponsRepo.findOne
      .mockResolvedValueOnce({ id: 'existing' })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    await expect(
      service.create({
        code: 'vip10',
        type: CouponType.FIXED,
        value: 10,
      } as never),
    ).rejects.toMatchObject({
      response: { message: expect.stringMatching(/c[oó]digo de cupom/i) },
    });

    await expect(
      service.create({
        code: 'vip1000',
        type: CouponType.PERCENTAGE,
        value: 120,
      } as never),
    ).rejects.toMatchObject({
      response: { message: expect.stringMatching(/Porcentagem/i) },
    });

    const saved = await service.create({
      code: 'vip15',
      type: CouponType.PERCENTAGE,
      value: 15,
      applicableTo: CouponApplicability.BOTH,
    } as never);

    expect(saved.code).toBe('VIP15');
    expect(notificationsService.broadcast).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ couponCode: 'VIP15' }),
      }),
    );
  });

  it('returns active coupons through query builder filters', async () => {
    const { service, couponsRepo } = createService();
    const qb = createCouponsQb([{ id: 'coupon-1' } as Coupon]);
    couponsRepo.createQueryBuilder.mockReturnValue(qb);

    const result = await service.findActive();

    expect(result).toEqual([{ id: 'coupon-1' }]);
    expect(qb.where).toHaveBeenCalledWith('coupon.isActive = :active', {
      active: true,
    });
    expect(qb.andWhere).toHaveBeenCalledTimes(3);
  });

  it('finds coupon by code and throws when not found', async () => {
    const { service, couponsRepo } = createService();
    couponsRepo.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: 'coupon-1',
      code: 'VIP15',
    });

    await expect(service.findByCode('vip15')).rejects.toMatchObject({
      response: { message: expect.stringMatching(/cupom.*encontrado/i) },
    });
    await expect(service.findByCode('vip15')).resolves.toMatchObject({
      id: 'coupon-1',
    });
  });

  it('validates trip coupons with route, min purchase and max discount rules', async () => {
    const { service, couponsRepo } = createService();
    const baseCoupon = {
      id: 'coupon-1',
      code: 'VIP',
      applicableTo: CouponApplicability.BOTH,
      isActive: true,
      usageCount: 0,
      usageLimit: null,
      minPurchase: 100,
      fromCity: 'Manaus',
      toCity: 'Parintins',
      type: CouponType.PERCENTAGE,
      value: 50,
      maxDiscount: 40,
      validFrom: null,
      validUntil: null,
    };

    couponsRepo.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        ...baseCoupon,
        applicableTo: CouponApplicability.SHIPMENTS,
      })
      .mockResolvedValueOnce(baseCoupon);

    const notFound = await service.validate('vip', 'u-1', 200);
    const wrongApplicability = await service.validate('vip', 'u-1', 200);
    const valid = await service.validate('vip', 'u-1', 200, {
      origin: 'Manaus Centro',
      destination: 'Parintins',
    } as Trip);

    expect(notFound).toEqual(
      expect.objectContaining({
        valid: false,
        message: expect.stringMatching(/cupom.*encontrado/i),
      }),
    );
    expect(wrongApplicability).toEqual({
      valid: false,
      message: expect.stringMatching(/apenas para encomendas/i),
    });
    expect(valid.valid).toBe(true);
    expect(valid.discount).toBe(40);
  });

  it('validates shipment coupons including weight, route and date constraints', async () => {
    const { service, couponsRepo, shipmentsRepo } = createService();
    const now = new Date();
    const shipmentCoupon = {
      id: 'coupon-2',
      code: 'SHIP',
      applicableTo: CouponApplicability.BOTH,
      isActive: true,
      usageCount: 0,
      usageLimit: 10,
      minPurchase: 80,
      minWeight: 1,
      maxWeight: 10,
      fromCity: 'Manaus',
      toCity: 'Parintins',
      type: CouponType.FIXED,
      value: 20,
      maxDiscount: null,
      validFrom: new Date(now.getTime() - 86_400_000),
      validUntil: new Date(now.getTime() + 86_400_000),
    };
    couponsRepo.findOne.mockResolvedValue(shipmentCoupon);
    shipmentsRepo.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'shipment-1',
        totalPrice: 120,
        weight: 0.5,
        trip: { origin: 'Manaus', destination: 'Parintins' },
      })
      .mockResolvedValueOnce({
        id: 'shipment-1',
        totalPrice: 120,
        weight: 2,
        trip: { origin: 'Manaus', destination: 'Parintins' },
      });

    const missingShipment = await service.validateForShipment(
      'ship',
      'u-1',
      'shipment-1',
    );
    const lowWeight = await service.validateForShipment('ship', 'u-1', 's-2');
    const valid = await service.validateForShipment('ship', 'u-1', 's-3');

    expect(missingShipment).toEqual(
      expect.objectContaining({
        valid: false,
        message: expect.stringMatching(/encomenda.*encontrada/i),
      }),
    );
    expect(lowWeight.message).toMatch(/acima de 1kg/);
    expect(valid).toMatchObject({ valid: true, discount: 20 });
  });

  it('increments usage, updates and deletes coupons', async () => {
    const { service, couponsRepo } = createService();
    couponsRepo.findOne
      .mockResolvedValueOnce({
        id: 'coupon-1',
        code: 'VIP15',
      })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'coupon-1',
        code: 'VIP15',
      });
    couponsRepo.delete
      .mockResolvedValueOnce({ affected: 1 })
      .mockResolvedValueOnce({ affected: 0 });

    await service.incrementUsage('coupon-1');
    expect(couponsRepo.increment).toHaveBeenCalledWith(
      { id: 'coupon-1' },
      'usageCount',
      1,
    );

    const updated = await service.update('coupon-1', {
      code: 'vip20',
      value: 20,
    });
    expect(updated.code).toBe('VIP20');

    await expect(service.delete('coupon-1')).resolves.toBeUndefined();
    await expect(service.delete('coupon-missing')).rejects.toMatchObject({
      response: { message: expect.stringMatching(/cupom.*encontrado/i) },
    });
  });
});
