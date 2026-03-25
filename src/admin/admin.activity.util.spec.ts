import {
  Booking,
  BookingStatus,
  PaymentStatus,
} from '../bookings/booking.entity';
import {
  Coupon,
  CouponApplicability,
  CouponType,
} from '../coupons/coupon.entity';
import { SosAlert, SosAlertStatus } from '../safety/sos-alert.entity';
import { SafetyChecklist } from '../safety/safety-checklist.entity';
import { Trip, TripStatus } from '../trips/trip.entity';
import { User, UserRole } from '../users/user.entity';
import {
  buildRecentBookingActivities,
  buildRecentChecklistActivities,
  buildRecentCouponActivities,
  buildRecentSosActivities,
  buildRecentTripActivities,
  buildRecentUserActivities,
} from './admin.activity.util';

describe('admin.activity.util', () => {
  it('buildRecentTripActivities should map trip status and route details', () => {
    const createdAt = new Date('2026-03-25T12:00:00.000Z');
    const activities = buildRecentTripActivities([
      {
        id: 'trip-1',
        origin: 'Manaus',
        destination: 'Parintins',
        departureAt: createdAt,
        price: 150,
        totalSeats: 12,
        status: TripStatus.SCHEDULED,
        createdAt,
        captain: { name: 'Rita' },
        boat: { name: 'Solimoes' },
      } as Trip,
    ]);

    expect(activities[0].type).toBe(`trip_${TripStatus.SCHEDULED}`);
    expect(activities[0].category).toBe('trip');
    expect(activities[0].description).toContain('Manaus');
    expect(activities[0].details).toMatchObject({
      tripId: 'trip-1',
      price: 150,
      totalSeats: 12,
      boat: 'Solimoes',
      status: TripStatus.SCHEDULED,
    });
    expect(activities[0].details.route).toEqual(
      expect.stringContaining('Parintins'),
    );
    expect(activities[0].link).toBe('/admin/trips/trip-1');
  });

  it('buildRecentUserActivities should map user role details', () => {
    const createdAt = new Date('2026-03-25T12:00:00.000Z');
    const activities = buildRecentUserActivities([
      {
        id: 'user-1',
        name: 'Marina',
        email: 'marina@example.com',
        phone: '92988888888',
        role: UserRole.CAPTAIN,
        createdAt,
      } as User,
    ]);

    expect(activities[0].type).toBe('user_registered');
    expect(activities[0].description).toContain('Marina');
    expect(activities[0].details).toMatchObject({
      userId: 'user-1',
      role: UserRole.CAPTAIN,
    });
    expect(activities[0].link).toBe('/admin/users/user-1');
  });

  it('buildRecentBookingActivities should expose payment context and route fallback', () => {
    const createdAt = new Date('2026-03-25T12:00:00.000Z');
    const activities = buildRecentBookingActivities([
      {
        id: 'booking-1',
        seats: 2,
        totalPrice: 320,
        status: BookingStatus.CONFIRMED,
        paymentStatus: PaymentStatus.REFUND_PENDING,
        paymentMethod: 'pix',
        createdAt,
        passenger: { name: 'Bianca' },
      } as Booking,
    ]);

    expect(activities[0].type).toBe(`booking_${BookingStatus.CONFIRMED}`);
    expect(activities[0].description).toContain('Reembolso pendente');
    expect(activities[0].details).toMatchObject({
      bookingId: 'booking-1',
      seats: 2,
      totalPrice: 320,
      paymentStatus: PaymentStatus.REFUND_PENDING,
      paymentMethod: 'pix',
    });
    expect(activities[0].details.route).toEqual(expect.any(String));
    expect(activities[0].link).toBe('/admin/bookings/booking-1');
  });

  it('buildRecentCouponActivities should generate readable discount labels', () => {
    const createdAt = new Date('2026-03-25T12:00:00.000Z');
    const activities = buildRecentCouponActivities([
      {
        id: 'coupon-1',
        code: 'AMAZON10',
        type: CouponType.PERCENTAGE,
        value: 10,
        applicableTo: CouponApplicability.BOTH,
        usageLimit: 100,
        usageCount: 4,
        validUntil: createdAt,
        createdAt,
      } as Coupon,
    ]);

    expect(activities[0].category).toBe('coupon');
    expect(activities[0].description).toContain('AMAZON10');
    expect(activities[0].details).toMatchObject({
      couponId: 'coupon-1',
      typeLabel: '10% OFF',
    });
  });

  it('buildRecentSosActivities and buildRecentChecklistActivities should map safety events', () => {
    const createdAt = new Date('2026-03-25T12:00:00.000Z');
    const [sosActivity] = buildRecentSosActivities([
      {
        id: 'sos-1',
        latitude: -3.1,
        longitude: -60.0,
        status: SosAlertStatus.ACTIVE,
        description: 'Motor parou',
        createdAt,
        user: { name: 'Carlos' },
      } as SosAlert,
    ]);
    const [checklistActivity] = buildRecentChecklistActivities([
      {
        id: 'check-1',
        tripId: 'trip-1',
        completedAt: createdAt,
        createdAt,
        captain: { name: 'Helena' },
        trip: { origin: 'Manaus', destination: 'Novo Airao' },
      } as SafetyChecklist,
    ]);

    expect(sosActivity.type).toBe(`sos_${SosAlertStatus.ACTIVE}`);
    expect(sosActivity.color).toBe('red');
    expect(sosActivity.link).toBe('/admin/safety/sos/sos-1');

    expect(checklistActivity.type).toBe('checklist_completed');
    expect(checklistActivity.category).toBe('safety');
    expect(checklistActivity.link).toBe('/admin/safety/checklists/check-1');
    expect(checklistActivity.details).toMatchObject({
      checklistId: 'check-1',
      tripId: 'trip-1',
    });
  });
});
