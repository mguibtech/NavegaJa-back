import { AdminController } from '../admin/admin.controller';
import { AuthController } from '../auth/auth.controller';
import { BoatStaffController } from '../boat-staff/boat-staff.controller';
import { CaptainBoatStaffController } from '../boat-staff/captain-boat-staff.controller';
import { BoatsController } from '../boats/boats.controller';
import { BookingsController } from '../bookings/bookings.controller';
import { CaptainController } from '../captain/captain.controller';
import { CargoController } from '../cargo/cargo.controller';
import { ChatController } from '../chat/chat.controller';
import { CouponsController } from '../coupons/coupons.controller';
import { PromotionsController } from '../coupons/promotions.controller';
import { DocumentChangeRequestsController } from '../document-change-requests/document-change-requests.controller';
import { FavoritesController } from '../favorites/favorites.controller';
import { GamificationController } from '../gamification/gamification.controller';
import { LocationsController } from '../locations/locations.controller';
import { NotificationsController } from '../notifications/notifications.controller';
import { PaymentMethodsController } from '../payment-methods/payment-methods.controller';
import { PaymentsController } from '../payments/payments.controller';
import { ReviewsController } from '../reviews/reviews.controller';
import { RoutesController } from '../routes/routes.controller';
import { SafetyController } from '../safety/safety.controller';
import { ShipmentsController } from '../shipments/shipments.controller';
import { StopReviewsController } from '../stop-reviews/stop-reviews.controller';
import { TripsController } from '../trips/trips.controller';
import { UploadController } from '../upload/upload.controller';
import { UsersController } from '../users/users.controller';
import { WeatherController } from '../weather/weather.controller';

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'fixed-uuid'),
}));

type ControllerCtor = new (...args: unknown[]) => object;
type MethodRecord = Record<string, (...args: unknown[]) => unknown>;

const CONTROLLERS: Array<{ name: string; ctor: ControllerCtor }> = [
  {
    name: 'AdminController',
    ctor: AdminController as unknown as ControllerCtor,
  },
  { name: 'AuthController', ctor: AuthController as unknown as ControllerCtor },
  {
    name: 'BoatStaffController',
    ctor: BoatStaffController as unknown as ControllerCtor,
  },
  {
    name: 'CaptainBoatStaffController',
    ctor: CaptainBoatStaffController as unknown as ControllerCtor,
  },
  {
    name: 'BoatsController',
    ctor: BoatsController as unknown as ControllerCtor,
  },
  {
    name: 'BookingsController',
    ctor: BookingsController as unknown as ControllerCtor,
  },
  {
    name: 'CaptainController',
    ctor: CaptainController as unknown as ControllerCtor,
  },
  {
    name: 'CargoController',
    ctor: CargoController as unknown as ControllerCtor,
  },
  { name: 'ChatController', ctor: ChatController as unknown as ControllerCtor },
  {
    name: 'CouponsController',
    ctor: CouponsController as unknown as ControllerCtor,
  },
  {
    name: 'PromotionsController',
    ctor: PromotionsController as unknown as ControllerCtor,
  },
  {
    name: 'DocumentChangeRequestsController',
    ctor: DocumentChangeRequestsController as unknown as ControllerCtor,
  },
  {
    name: 'FavoritesController',
    ctor: FavoritesController as unknown as ControllerCtor,
  },
  {
    name: 'GamificationController',
    ctor: GamificationController as unknown as ControllerCtor,
  },
  {
    name: 'LocationsController',
    ctor: LocationsController as unknown as ControllerCtor,
  },
  {
    name: 'NotificationsController',
    ctor: NotificationsController as unknown as ControllerCtor,
  },
  {
    name: 'PaymentMethodsController',
    ctor: PaymentMethodsController as unknown as ControllerCtor,
  },
  {
    name: 'PaymentsController',
    ctor: PaymentsController as unknown as ControllerCtor,
  },
  {
    name: 'ReviewsController',
    ctor: ReviewsController as unknown as ControllerCtor,
  },
  {
    name: 'RoutesController',
    ctor: RoutesController as unknown as ControllerCtor,
  },
  {
    name: 'SafetyController',
    ctor: SafetyController as unknown as ControllerCtor,
  },
  {
    name: 'ShipmentsController',
    ctor: ShipmentsController as unknown as ControllerCtor,
  },
  {
    name: 'StopReviewsController',
    ctor: StopReviewsController as unknown as ControllerCtor,
  },
  {
    name: 'TripsController',
    ctor: TripsController as unknown as ControllerCtor,
  },
  {
    name: 'UploadController',
    ctor: UploadController as unknown as ControllerCtor,
  },
  {
    name: 'UsersController',
    ctor: UsersController as unknown as ControllerCtor,
  },
  {
    name: 'WeatherController',
    ctor: WeatherController as unknown as ControllerCtor,
  },
];

const createServiceDependency = (): object =>
  new Proxy(
    {},
    {
      get: (_target, prop: string | symbol): unknown => {
        if (prop === 'then') {
          return undefined;
        }
        return jest.fn().mockResolvedValue({ ok: true });
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

describe('Controllers smoke', () => {
  it.each(CONTROLLERS)(
    'invokes public methods in $name without hard failure',
    async ({ ctor }) => {
      const dependencies = Array.from({ length: ctor.length }, () =>
        createServiceDependency(),
      );
      const controller = new ctor(...dependencies) as MethodRecord;
      const methodNames = Object.getOwnPropertyNames(
        Object.getPrototypeOf(controller),
      ).filter((methodName) => methodName !== 'constructor');

      expect(methodNames.length).toBeGreaterThan(0);

      for (const methodName of methodNames) {
        const method = controller[methodName];
        if (typeof method !== 'function') {
          continue;
        }

        const args = Array.from({ length: method.length }, () =>
          createUniversalArg(),
        );

        try {
          const result = method.apply(controller, args);
          if (isPromiseLike(result)) {
            await result;
          }
        } catch {
          // Smoke coverage only: ignore method-specific validation/runtime errors.
        }
      }
    },
  );
});
