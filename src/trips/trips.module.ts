import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TripsController } from './trips.controller';
import { TripsService } from './trips.service';
import { Trip } from './trip.entity';
import { Boat } from '../boats/boat.entity';
import { User } from '../users/user.entity';
import { ShipmentsModule } from '../shipments/shipments.module';
import { SafetyModule } from '../safety/safety.module';
import { WeatherModule } from '../weather/weather.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { BookingsModule } from '../bookings/bookings.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Trip, Boat, User]),
    forwardRef(() => ShipmentsModule),
    forwardRef(() => SafetyModule),
    WeatherModule,
    NotificationsModule,
    BookingsModule,
  ],
  controllers: [TripsController],
  providers: [TripsService],
  exports: [TripsService],
})
export class TripsModule {}
