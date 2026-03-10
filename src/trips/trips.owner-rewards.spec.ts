import { TripsService } from './trips.service';
import { TripStatus } from './trip.entity';
import type { Repository } from 'typeorm';
import type { Trip } from './trip.entity';
import type { Boat } from '../boats/boat.entity';
import type { User } from '../users/user.entity';
import type { Shipment } from '../shipments/shipment.entity';
import type { Favorite } from '../favorites/favorite.entity';
import type { ShipmentsService } from '../shipments/shipments.service';
import type { SafetyService } from '../safety/safety.service';
import type { WeatherService } from '../weather/weather.service';
import type { FloodService } from '../weather/flood.service';
import type { NotificationsService } from '../notifications/notifications.service';
import type { BookingsService } from '../bookings/bookings.service';
import type { GamificationService } from '../gamification/gamification.service';
import type { PdfService } from '../pdf/pdf.service';
import type { BoatStaffService } from '../boat-staff/boat-staff.service';
import type { LocationsService } from '../locations/locations.service';

describe('TripsService owner rewards', () => {
  it('awards boat owner points when a trip is completed', async () => {
    const tripsRepo = {
      save: jest.fn((value: Trip) => Promise.resolve(value)),
    };
    const bookingsService = {
      autoCompleteByTrip: jest.fn().mockResolvedValue(undefined),
    };
    const shipmentsService = {
      updateShipmentsByTrip: jest.fn().mockResolvedValue(undefined),
    };
    const notificationsService = {
      sendToTripPassengers: jest.fn().mockResolvedValue(undefined),
    };
    const gamificationService = {
      awardBoatOwnerTripCompleted: jest.fn().mockResolvedValue(undefined),
    };

    const service = new TripsService(
      tripsRepo as unknown as Repository<Trip>,
      {} as Repository<Boat>,
      {} as Repository<User>,
      {} as Repository<Shipment>,
      {} as Repository<Favorite>,
      shipmentsService as unknown as ShipmentsService,
      {} as SafetyService,
      {} as WeatherService,
      {} as FloodService,
      notificationsService as unknown as NotificationsService,
      bookingsService as unknown as BookingsService,
      gamificationService as unknown as GamificationService,
      {} as PdfService,
      {} as BoatStaffService,
      {} as LocationsService,
    );

    jest.spyOn(service, 'findById').mockResolvedValue({
      id: 'trip-1',
      status: TripStatus.IN_PROGRESS,
      origin: 'Manaus',
      destination: 'Parintins',
      boat: { ownerId: 'owner-1' },
    } as unknown as Trip);
    jest
      .spyOn(service as never, 'assertCanManageTrip')
      .mockResolvedValue(undefined);

    await service.updateStatus(
      'trip-1',
      'captain-1',
      { status: TripStatus.COMPLETED },
      'captain',
    );

    expect(gamificationService.awardBoatOwnerTripCompleted).toHaveBeenCalledWith(
      'owner-1',
      'trip-1',
    );
  });
});
