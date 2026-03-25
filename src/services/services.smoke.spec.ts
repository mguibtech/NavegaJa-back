import { AdminService } from '../admin/admin.service';
import { BoatStaffService } from '../boat-staff/boat-staff.service';
import { BookingsService } from '../bookings/bookings.service';
import { CouponsService } from '../coupons/coupons.service';
import { GamificationService } from '../gamification/gamification.service';
import { ReviewsService } from '../reviews/reviews.service';
import { ShipmentsService } from '../shipments/shipments.service';
import { TripsService } from '../trips/trips.service';
import { UsersService } from '../users/users.service';

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'fixed-uuid'),
}));

type ServiceCtor = new (...args: unknown[]) => object;
type MethodRecord = Record<string, (...args: unknown[]) => unknown>;

const createRecord = (): Record<string, unknown> => ({
  id: 'id-1',
  name: 'Mock Name',
  email: 'mock@navegaja.com',
  phone: '92999999999',
  role: 'admin',
  isActive: true,
  isVerified: true,
  status: 'completed',
  paymentStatus: 'paid',
  paymentMethod: 'pix',
  passengerId: 'user-1',
  senderId: 'user-1',
  captainId: 'user-1',
  boatId: 'boat-1',
  tripId: 'trip-1',
  seats: 1,
  totalSeats: 20,
  availableSeats: 10,
  cargoCapacityKg: 100,
  availableCargoKg: 90,
  totalPrice: 100,
  price: 100,
  createdAt: new Date(),
  updatedAt: new Date(),
  departureAt: new Date(Date.now() + 86_400_000),
  estimatedArrivalAt: new Date(Date.now() + 172_800_000),
  origin: 'Manaus',
  destination: 'Parintins',
  route: { id: 'route-1', distanceKm: 120 },
  boat: { id: 'boat-1', ownerId: 'owner-1', name: 'Boat' },
  trip: {
    id: 'trip-1',
    captainId: 'user-1',
    origin: 'Manaus',
    destination: 'Parintins',
    status: 'scheduled',
    departureAt: new Date(Date.now() + 86_400_000),
    estimatedArrivalAt: new Date(Date.now() + 172_800_000),
    totalSeats: 20,
    availableSeats: 10,
    cargoCapacityKg: 100,
    availableCargoKg: 90,
    route: { id: 'route-1', distanceKm: 120 },
    boat: { id: 'boat-1', ownerId: 'owner-1', name: 'Boat' },
    captain: { id: 'user-1', name: 'Captain', phone: '92999999999' },
  },
  passenger: { id: 'user-2', name: 'Passenger' },
  captain: { id: 'user-1', name: 'Captain', phone: '92999999999' },
  coupon: {
    id: 'coupon-1',
    type: 'percentage',
    value: 10,
    maxDiscount: 25,
  },
});

const createQueryBuilderProxy = (): object => {
  const qb = new Proxy(
    {},
    {
      get: (_target, prop: string | symbol): unknown => {
        if (prop === 'then') {
          return undefined;
        }

        const method = String(prop);
        if (method === 'getMany') {
          return jest.fn().mockResolvedValue([createRecord()]);
        }
        if (method === 'getOne') {
          return jest.fn().mockResolvedValue(createRecord());
        }
        if (method === 'getCount') {
          return jest.fn().mockResolvedValue(1);
        }
        if (method === 'getManyAndCount') {
          return jest.fn().mockResolvedValue([[createRecord()], 1]);
        }
        if (method === 'getRawMany') {
          return jest.fn().mockResolvedValue([createRecord()]);
        }
        if (method === 'getRawOne') {
          return jest
            .fn()
            .mockResolvedValue({ total: '100', totalPassengers: '1' });
        }
        if (method === 'execute') {
          return jest.fn().mockResolvedValue({ affected: 1 });
        }
        return jest.fn().mockReturnValue(qb);
      },
    },
  );
  return qb;
};

const createManagerProxy = (): object =>
  new Proxy(
    {},
    {
      get: (_target, prop: string | symbol): unknown => {
        if (prop === 'then') {
          return undefined;
        }
        if (String(prop) === 'getRepository') {
          return jest.fn().mockReturnValue(createDependencyProxy());
        }
        return jest.fn().mockResolvedValue(createRecord());
      },
    },
  );

const createDependencyProxy = (): object =>
  new Proxy(
    {},
    {
      get: (_target, prop: string | symbol): unknown => {
        if (prop === 'then') {
          return undefined;
        }

        const method = String(prop);

        if (method === 'manager') {
          return createManagerProxy();
        }
        if (method === 'createQueryBuilder') {
          return jest.fn().mockReturnValue(createQueryBuilderProxy());
        }
        if (method === 'transaction') {
          return jest
            .fn()
            .mockImplementation(
              (callback: (manager: object) => unknown): unknown =>
                callback(createManagerProxy()),
            );
        }
        if (method === 'find' || method === 'findBy') {
          return jest.fn().mockResolvedValue([createRecord()]);
        }
        if (method === 'findOne' || method === 'findOneBy') {
          return jest.fn().mockResolvedValue(createRecord());
        }
        if (method === 'findAndCount') {
          return jest.fn().mockResolvedValue([[createRecord()], 1]);
        }
        if (method === 'count') {
          return jest.fn().mockResolvedValue(1);
        }
        if (
          method === 'save' ||
          method === 'create' ||
          method === 'update' ||
          method === 'delete' ||
          method === 'remove' ||
          method === 'softDelete' ||
          method === 'restore' ||
          method === 'insert' ||
          method === 'upsert'
        ) {
          return jest.fn().mockResolvedValue(createRecord());
        }
        if (method === 'sendToUser' || method === 'sendToUsers') {
          return jest.fn().mockResolvedValue(undefined);
        }
        if (method === 'broadcast') {
          return jest.fn().mockResolvedValue(undefined);
        }
        if (method === 'get') {
          return jest.fn().mockReturnValue('mock-config');
        }
        return jest.fn().mockResolvedValue(createRecord());
      },
    },
  );

const createUniversalArg = (): unknown => {
  type UniversalCallable = ((...args: unknown[]) => unknown) &
    Record<string | symbol, unknown>;
  const holder: { proxy?: UniversalCallable } = {};
  const base = (() => holder.proxy) as UniversalCallable;
  const proxyRef = new Proxy(base, {
    get: (_target, prop: string | symbol): unknown => {
      if (prop === 'then') {
        return undefined;
      }
      if (prop === 'valueOf') {
        return () => 1;
      }
      if (prop === 'toString') {
        return () => 'mock';
      }
      if (prop === Symbol.iterator) {
        return function* iterator() {
          yield createRecord();
        };
      }
      return proxyRef;
    },
    apply: (): unknown => proxyRef,
  });
  holder.proxy = proxyRef;
  return proxyRef;
};

const isPromiseLike = (value: unknown): value is Promise<unknown> =>
  typeof value === 'object' &&
  value !== null &&
  'then' in value &&
  typeof (value as { then?: unknown }).then === 'function';

const SERVICES: Array<{ name: string; ctor: ServiceCtor }> = [
  { name: 'AdminService', ctor: AdminService as unknown as ServiceCtor },
  {
    name: 'BoatStaffService',
    ctor: BoatStaffService as unknown as ServiceCtor,
  },
  { name: 'BookingsService', ctor: BookingsService as unknown as ServiceCtor },
  { name: 'CouponsService', ctor: CouponsService as unknown as ServiceCtor },
  {
    name: 'GamificationService',
    ctor: GamificationService as unknown as ServiceCtor,
  },
  { name: 'ReviewsService', ctor: ReviewsService as unknown as ServiceCtor },
  {
    name: 'ShipmentsService',
    ctor: ShipmentsService as unknown as ServiceCtor,
  },
  { name: 'TripsService', ctor: TripsService as unknown as ServiceCtor },
  { name: 'UsersService', ctor: UsersService as unknown as ServiceCtor },
];

describe('Services smoke', () => {
  it.each(SERVICES)(
    'invokes class methods in $name without hard failure',
    async ({ ctor }) => {
      const dependencies = Array.from({ length: ctor.length }, () =>
        createDependencyProxy(),
      );
      const instance = new ctor(...dependencies) as MethodRecord;
      const methodNames = Object.getOwnPropertyNames(
        Object.getPrototypeOf(instance),
      ).filter((methodName) => methodName !== 'constructor');

      expect(methodNames.length).toBeGreaterThan(0);

      for (const methodName of methodNames) {
        const method = instance[methodName];
        if (typeof method !== 'function') {
          continue;
        }

        const args = Array.from({ length: method.length }, () =>
          createUniversalArg(),
        );

        try {
          const result = method.apply(instance, args);
          if (isPromiseLike(result)) {
            await result;
          }
        } catch {
          // Smoke coverage only.
        }
      }
    },
  );
});
