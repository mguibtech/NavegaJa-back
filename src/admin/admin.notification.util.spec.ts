import { Boat } from '../boats/boat.entity';
import { SosAlert, SosAlertStatus } from '../safety/sos-alert.entity';
import { Trip } from '../trips/trip.entity';
import {
  buildAdminNotificationsPayload,
  buildPendingVerificationsPayload,
} from './admin.notification.util';
import { PendingCaptainSummary } from './admin.notification.types';

describe('admin.notification.util', () => {
  it('buildPendingVerificationsPayload should map boats and captains', () => {
    const createdAt = new Date('2026-03-25T12:00:00.000Z');
    const boats = [
      {
        id: 'boat-1',
        name: 'Expresso Rio',
        type: 'Lancha',
        registrationNum: 'REG-123',
        documentPhotos: ['doc-1'],
        photos: ['photo-1'],
        rejectionReason: null,
        createdAt,
        owner: {
          id: 'user-1',
          name: 'Carlos',
          phone: '92999999999',
        },
      },
    ] as Boat[];
    const captains: PendingCaptainSummary[] = [
      {
        id: 'captain-1',
        name: 'Marina',
        phone: '92988888888',
        email: 'marina@example.com',
        cpf: '12345678900',
        city: 'Manaus',
        state: 'AM',
        createdAt,
        selfieUrl: 'selfie.jpg',
        licensePhotoUrl: 'license.jpg',
        certificatePhotoUrl: 'certificate.jpg',
        documentChangeRequests: [],
      },
    ];

    const payload = buildPendingVerificationsPayload(boats, captains);

    expect(payload.totalPending).toBe(2);
    expect(payload.pendingBoats[0]).toEqual({
      id: 'boat-1',
      name: 'Expresso Rio',
      type: 'Lancha',
      registrationNum: 'REG-123',
      documentPhotos: ['doc-1'],
      photos: ['photo-1'],
      rejectionReason: null,
      createdAt,
      owner: {
        id: 'user-1',
        name: 'Carlos',
        phone: '92999999999',
      },
    });
    expect(payload.pendingCaptains).toEqual(captains);
  });

  it('buildAdminNotificationsPayload should aggregate counts and links', () => {
    const createdAt = new Date('2026-03-25T12:00:00.000Z');
    const payload = buildAdminNotificationsPayload({
      sosAlerts: [
        {
          id: 'sos-1',
          type: 'panic',
          description: 'Ajuda urgente',
          location: 'Rio Negro',
          createdAt,
          status: SosAlertStatus.ACTIVE,
          user: { name: 'Paula' },
        } as SosAlert,
      ],
      pendingBoats: [
        {
          id: 'boat-1',
          name: 'Expresso Rio',
          type: 'Lancha',
          createdAt,
          owner: { name: 'Carlos' },
        } as Boat,
      ],
      pendingCaptains: [
        {
          id: 'captain-1',
          name: 'Marina',
          phone: '92988888888',
          email: null,
          cpf: null,
          city: 'Manaus',
          state: 'AM',
          createdAt,
          selfieUrl: null,
          licensePhotoUrl: null,
          certificatePhotoUrl: null,
          documentChangeRequests: [],
        },
      ],
      newTrips: [
        {
          id: 'trip-1',
          origin: 'Manaus',
          destination: 'Parintins',
          departureAt: createdAt,
          createdAt,
          captain: { name: 'Joao' },
        } as Trip,
      ],
    });

    expect(payload.totalUnread).toBe(4);
    expect(payload.sos.items[0].link).toBe('/admin/safety/sos/sos-1');
    expect(payload.pendingVerifications.boats[0].link).toBe(
      '/admin/boats/boat-1',
    );
    expect(payload.pendingVerifications.captains[0].link).toBe(
      '/admin/users/captain-1',
    );
    expect(payload.newTrips.items[0].link).toBe('/admin/trips/trip-1');
  });
});
