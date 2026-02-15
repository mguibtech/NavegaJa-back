import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TripsController } from './trips.controller';
import { TripsService } from './trips.service';
import { Trip } from './trip.entity';
import { ShipmentsModule } from '../shipments/shipments.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Trip]),
    forwardRef(() => ShipmentsModule),
  ],
  controllers: [TripsController],
  providers: [TripsService],
  exports: [TripsService],
})
export class TripsModule {}
