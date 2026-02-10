import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TripsController } from './trips.controller';
import { TripsService } from './trips.service';
import { Trip } from './trip.entity';
import { Route } from '../routes/route.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Trip, Route])],
  controllers: [TripsController],
  providers: [TripsService],
  exports: [TripsService],
})
export class TripsModule {}
