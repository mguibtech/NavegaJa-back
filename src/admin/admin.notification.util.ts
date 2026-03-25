import { Boat } from '../boats/boat.entity';
import { SosAlert } from '../safety/sos-alert.entity';
import { Trip } from '../trips/trip.entity';
import {
  AdminNotificationsPayload,
  PendingCaptainSummary,
  PendingVerificationsPayload,
} from './admin.notification.types';

export function buildPendingVerificationsPayload(
  boats: Boat[],
  captains: PendingCaptainSummary[],
): PendingVerificationsPayload {
  return {
    pendingBoats: boats.map((boat) => ({
      id: boat.id,
      name: boat.name,
      type: boat.type,
      registrationNum: boat.registrationNum,
      documentPhotos: boat.documentPhotos,
      photos: boat.photos,
      rejectionReason: boat.rejectionReason,
      createdAt: boat.createdAt,
      owner: boat.owner
        ? {
            id: boat.owner.id,
            name: boat.owner.name,
            phone: boat.owner.phone,
          }
        : null,
    })),
    pendingCaptains: captains,
    totalPending: boats.length + captains.length,
  };
}

export function buildAdminNotificationsPayload(params: {
  sosAlerts: SosAlert[];
  pendingBoats: Boat[];
  pendingCaptains: PendingCaptainSummary[];
  newTrips: Trip[];
}): AdminNotificationsPayload {
  const { sosAlerts, pendingBoats, pendingCaptains, newTrips } = params;

  return {
    totalUnread:
      sosAlerts.length +
      pendingBoats.length +
      pendingCaptains.length +
      newTrips.length,
    sos: {
      count: sosAlerts.length,
      items: sosAlerts.map((alert) => ({
        id: alert.id,
        type: alert.type,
        description: alert.description,
        location: alert.location,
        userName: alert.user?.name ?? 'Desconhecido',
        createdAt: alert.createdAt,
        link: `/admin/safety/sos/${alert.id}`,
      })),
    },
    pendingVerifications: {
      count: pendingBoats.length + pendingCaptains.length,
      boats: pendingBoats.map((boat) => ({
        id: boat.id,
        name: boat.name,
        type: boat.type,
        ownerName: boat.owner?.name ?? 'Desconhecido',
        createdAt: boat.createdAt,
        link: `/admin/boats/${boat.id}`,
      })),
      captains: pendingCaptains.map((captain) => ({
        id: captain.id,
        name: captain.name,
        phone: captain.phone,
        city: captain.city,
        createdAt: captain.createdAt,
        link: `/admin/users/${captain.id}`,
      })),
    },
    newTrips: {
      count: newTrips.length,
      items: newTrips.map((trip) => ({
        id: trip.id,
        origin: trip.origin,
        destination: trip.destination,
        captainName: trip.captain?.name ?? 'Desconhecido',
        departureAt: trip.departureAt,
        createdAt: trip.createdAt,
        link: `/admin/trips/${trip.id}`,
      })),
    },
  };
}
