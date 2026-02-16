import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TripsController } from './trips.controller';
import { TripsService } from './trips.service';
import { Trip } from './trip.entity';
import { Boat } from '../boats/boat.entity';
import { ShipmentsModule } from '../shipments/shipments.module';
import { SafetyModule } from '../safety/safety.module';
import { WeatherModule } from '../weather/weather.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Trip, Boat]),
    forwardRef(() => ShipmentsModule),
    forwardRef(() => SafetyModule),
    WeatherModule,
  ],
  controllers: [TripsController],
  providers: [TripsService],
  exports: [TripsService],
})
export class TripsModule {}
