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
  ],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
