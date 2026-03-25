import { Coupon, CouponType } from '../coupons/coupon.entity';
import { Trip, TripStatus } from '../trips/trip.entity';
import { Shipment, ShipmentStatus } from '../shipments/shipment.entity';
import {
  Booking,
  BookingStatus,
  PaymentStatus,
} from '../bookings/booking.entity';
import { User, UserRole } from '../users/user.entity';
import { SosAlert, SosAlertStatus } from '../safety/sos-alert.entity';
import { SafetyChecklist } from '../safety/safety-checklist.entity';
import { AdminActivity } from './admin.activity.types';

type TripStatusInfo = {
  description: (trip: Trip) => string;
  icon: string;
  color: string;
};

type ShipmentStatusInfo = {
  description: (shipment: Shipment) => string;
  icon: string;
  color: string;
};

type BookingStatusInfo = {
  action: string;
  icon: string;
  color: string;
};

type UserRoleInfo = {
  label: string;
  icon: string;
  color: string;
};

const tripStatusMap: Record<TripStatus, TripStatusInfo> = {
  [TripStatus.SCHEDULED]: {
    description: (trip: Trip) =>
      `Nova viagem: ${trip.origin} → ${trip.destination}`,
    icon: '🚤',
    color: 'blue',
  },
  [TripStatus.IN_PROGRESS]: {
    description: (trip: Trip) =>
      `Viagem iniciada: ${trip.origin} → ${trip.destination}`,
    icon: '⛵',
    color: 'orange',
  },
  [TripStatus.COMPLETED]: {
    description: (trip: Trip) =>
      `Viagem concluída: ${trip.origin} → ${trip.destination}`,
    icon: '🏁',
    color: 'green',
  },
  [TripStatus.CANCELLED]: {
    description: (trip: Trip) =>
      `Viagem cancelada: ${trip.origin} → ${trip.destination}`,
    icon: '❌',
    color: 'red',
  },
};

const shipmentStatusMap: Record<ShipmentStatus, ShipmentStatusInfo> = {
  [ShipmentStatus.PENDING]: {
    description: (shipment: Shipment) =>
      `Nova encomenda: ${shipment.trackingCode}`,
    icon: '📦',
    color: 'blue',
  },
  [ShipmentStatus.PAID]: {
    description: (shipment: Shipment) =>
      `Encomenda paga: ${shipment.trackingCode}`,
    icon: '💰',
    color: 'green',
  },
  [ShipmentStatus.COLLECTED]: {
    description: (shipment: Shipment) =>
      `Encomenda coletada: ${shipment.trackingCode}`,
    icon: '📮',
    color: 'orange',
  },
  [ShipmentStatus.IN_TRANSIT]: {
    description: (shipment: Shipment) =>
      `Encomenda em trânsito: ${shipment.trackingCode}`,
    icon: '🚢',
    color: 'blue',
  },
  [ShipmentStatus.ARRIVED]: {
    description: (shipment: Shipment) =>
      `Encomenda chegou: ${shipment.trackingCode}`,
    icon: '🎯',
    color: 'blue',
  },
  [ShipmentStatus.OUT_FOR_DELIVERY]: {
    description: (shipment: Shipment) =>
      `Saiu para entrega: ${shipment.trackingCode}`,
    icon: '🚚',
    color: 'orange',
  },
  [ShipmentStatus.DELIVERED]: {
    description: (shipment: Shipment) =>
      `Encomenda entregue: ${shipment.trackingCode}`,
    icon: '✅',
    color: 'green',
  },
  [ShipmentStatus.CANCELLED]: {
    description: (shipment: Shipment) =>
      `Encomenda cancelada: ${shipment.trackingCode}`,
    icon: '❌',
    color: 'red',
  },
};

const bookingStatusMap: Record<BookingStatus, BookingStatusInfo> = {
  [BookingStatus.PENDING]: {
    action: 'Nova reserva',
    icon: '🎫',
    color: 'blue',
  },
  [BookingStatus.CONFIRMED]: {
    action: 'Reserva confirmada',
    icon: '✅',
    color: 'green',
  },
  [BookingStatus.CHECKED_IN]: {
    action: 'Check-in realizado',
    icon: '🎟️',
    color: 'purple',
  },
  [BookingStatus.COMPLETED]: {
    action: 'Viagem concluída',
    icon: '🏁',
    color: 'green',
  },
  [BookingStatus.CANCELLED]: {
    action: 'Reserva cancelada',
    icon: '❌',
    color: 'red',
  },
};

const userRoleMap: Record<UserRole, UserRoleInfo> = {
  [UserRole.PASSENGER]: { label: 'passageiro', icon: '👤', color: 'gray' },
  [UserRole.CAPTAIN]: { label: 'capitão', icon: '⚓', color: 'blue' },
  [UserRole.ADMIN]: { label: 'administrador', icon: '👑', color: 'purple' },
  [UserRole.BOAT_MANAGER]: {
    label: 'gestor de barco',
    icon: '🚢',
    color: 'teal',
  },
};

export function buildRecentTripActivities(trips: Trip[]): AdminActivity[] {
  return trips.map((trip) => {
    const statusInfo =
      tripStatusMap[trip.status] || tripStatusMap[TripStatus.SCHEDULED];

    return {
      type: `trip_${trip.status}`,
      category: 'trip',
      description: statusInfo.description(trip),
      user: trip.captain?.name || 'Capitão',
      details: {
        tripId: trip.id,
        route: `${trip.origin} → ${trip.destination}`,
        departureAt: trip.departureAt,
        price: Number(trip.price),
        totalSeats: trip.totalSeats,
        boat: trip.boat?.name,
        status: trip.status,
      },
      icon: statusInfo.icon,
      color: statusInfo.color,
      link: `/admin/trips/${trip.id}`,
      timestamp: trip.createdAt,
    };
  });
}

export function buildRecentShipmentActivities(
  shipments: Shipment[],
): AdminActivity[] {
  return shipments.map((shipment) => {
    const statusInfo =
      shipmentStatusMap[shipment.status] ||
      shipmentStatusMap[ShipmentStatus.PENDING];

    return {
      type: `shipment_${shipment.status}`,
      category: 'shipment',
      description: statusInfo.description(shipment),
      user: shipment.sender?.name || 'Remetente',
      details: {
        shipmentId: shipment.id,
        trackingCode: shipment.trackingCode,
        route: shipment.trip
          ? `${shipment.trip.origin} → ${shipment.trip.destination}`
          : 'Rota não disponível',
        weight: Number(shipment.weight),
        price: Number(shipment.totalPrice),
        status: shipment.status,
      },
      icon: statusInfo.icon,
      color: statusInfo.color,
      link: `/admin/shipments/${shipment.id}`,
      timestamp: shipment.createdAt,
    };
  });
}

export function buildRecentUserActivities(users: User[]): AdminActivity[] {
  return users.map((user) => {
    const roleInfo = userRoleMap[user.role] || userRoleMap[UserRole.PASSENGER];

    return {
      type: 'user_registered',
      category: 'user',
      description: `Novo ${roleInfo.label}: ${user.name}`,
      user: user.name,
      details: {
        userId: user.id,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
      icon: roleInfo.icon,
      color: roleInfo.color,
      link: `/admin/users/${user.id}`,
      timestamp: user.createdAt,
    };
  });
}

export function buildRecentBookingActivities(
  bookings: Booking[],
): AdminActivity[] {
  return bookings.map((booking) => {
    const statusInfo =
      bookingStatusMap[booking.status] ||
      bookingStatusMap[BookingStatus.PENDING];
    const paymentInfo =
      booking.paymentStatus === PaymentStatus.PAID
        ? ' (Pago)'
        : booking.paymentStatus === PaymentStatus.REFUND_PENDING
          ? ' (Reembolso pendente)'
          : '';

    return {
      type: `booking_${booking.status}`,
      category: 'booking',
      description: `${statusInfo.action}: ${booking.trip?.origin || '?'} → ${booking.trip?.destination || '?'}${paymentInfo}`,
      user: booking.passenger?.name || 'Passageiro',
      details: {
        bookingId: booking.id,
        route: booking.trip
          ? `${booking.trip.origin} → ${booking.trip.destination}`
          : 'Rota não disponível',
        seats: booking.seats,
        totalPrice: Number(booking.totalPrice),
        status: booking.status,
        paymentStatus: booking.paymentStatus,
        paymentMethod: booking.paymentMethod,
      },
      icon: statusInfo.icon,
      color: statusInfo.color,
      link: `/admin/bookings/${booking.id}`,
      timestamp: booking.createdAt,
    };
  });
}

export function buildRecentCouponActivities(
  coupons: Coupon[],
): AdminActivity[] {
  return coupons.map((coupon) => {
    const typeLabel =
      coupon.type === CouponType.PERCENTAGE
        ? `${Number(coupon.value)}% OFF`
        : `R$ ${Number(coupon.value)} OFF`;

    return {
      type: 'coupon_created',
      category: 'coupon',
      description: `Cupom criado: ${coupon.code}`,
      user: 'Admin',
      details: {
        couponId: coupon.id,
        code: coupon.code,
        type: coupon.type,
        value: Number(coupon.value),
        typeLabel,
        applicableTo: coupon.applicableTo,
        usageLimit: coupon.usageLimit,
        usageCount: coupon.usageCount,
        validUntil: coupon.validUntil,
      },
      icon: '🎟️',
      color: 'purple',
      link: `/admin/coupons/${coupon.id}`,
      timestamp: coupon.createdAt,
    };
  });
}

export function buildRecentSosActivities(alerts: SosAlert[]): AdminActivity[] {
  return alerts.map((sos) => {
    const isActive = sos.status === SosAlertStatus.ACTIVE;

    return {
      type: `sos_${sos.status}`,
      category: 'sos',
      description: isActive
        ? `🆘 Alerta SOS acionado`
        : `✅ Alerta SOS resolvido`,
      user: sos.user?.name || 'Usuário',
      details: {
        sosId: sos.id,
        latitude: sos.latitude,
        longitude: sos.longitude,
        status: sos.status,
        description: sos.description,
        resolvedAt: sos.resolvedAt,
      },
      icon: isActive ? '🆘' : '✅',
      color: isActive ? 'red' : 'green',
      link: `/admin/safety/sos/${sos.id}`,
      timestamp: sos.createdAt,
    };
  });
}

export function buildRecentChecklistActivities(
  checklists: SafetyChecklist[],
): AdminActivity[] {
  return checklists.map((checklist) => ({
    type: 'checklist_completed',
    category: 'safety',
    description: `✅ Checklist de segurança completado`,
    user: checklist.captain?.name || 'Capitão',
    details: {
      checklistId: checklist.id,
      tripId: checklist.tripId,
      route: checklist.trip
        ? `${checklist.trip.origin} → ${checklist.trip.destination}`
        : 'Rota não disponível',
      completedAt: checklist.completedAt,
    },
    icon: '✅',
    color: 'green',
    link: `/admin/safety/checklists/${checklist.id}`,
    timestamp: checklist.completedAt || checklist.createdAt,
  }));
}
