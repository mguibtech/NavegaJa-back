import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CaptainController } from './captain.controller';
import { CaptainService } from './captain.service';
import { Trip } from '../trips/trip.entity';
import { Booking } from '../bookings/booking.entity';
import { User } from '../users/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Trip, Booking, User])],
  controllers: [CaptainController],
  providers: [CaptainService],
  exports: [CaptainService],
})
export class CaptainModule {}
