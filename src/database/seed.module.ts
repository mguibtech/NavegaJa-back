import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeedService } from './seed.service';
import { User } from '../users/user.entity';
import { Boat } from '../boats/boat.entity';
import { Route } from '../routes/route.entity';
import { Trip } from '../trips/trip.entity';
import { Booking } from '../bookings/booking.entity';
import { Shipment } from '../shipments/shipment.entity';
import { Review } from '../reviews/review.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Boat, Route, Trip, Booking, Shipment, Review]),
  ],
  providers: [SeedService],
})
export class SeedModule {}
