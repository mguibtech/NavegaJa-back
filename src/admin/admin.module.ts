import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { User } from '../users/user.entity';
import { Trip } from '../trips/trip.entity';
import { Shipment } from '../shipments/shipment.entity';
import { SosAlert } from '../safety/sos-alert.entity';
import { SafetyChecklist } from '../safety/safety-checklist.entity';
import { Booking } from '../bookings/booking.entity';
import { Coupon } from '../coupons/coupon.entity';
import { Review } from '../reviews/review.entity';
import { Boat } from '../boats/boat.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { LocationsModule } from '../locations/locations.module';
import { GamificationModule } from '../gamification/gamification.module';
import { TripsModule } from '../trips/trips.module';
import { DocumentChangeRequestsModule } from '../document-change-requests/document-change-requests.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Trip,
      Shipment,
      SosAlert,
      SafetyChecklist,
      Booking,
      Coupon,
      Review,
      Boat,
    ]),
    NotificationsModule,
    LocationsModule,
    GamificationModule,
    TripsModule,
    DocumentChangeRequestsModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
