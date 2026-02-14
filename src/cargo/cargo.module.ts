import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CargoShipment } from './cargo.entity';
import { Trip } from '../trips/trip.entity';
import { CargoController } from './cargo.controller';
import { CargoService } from './cargo.service';
import { GamificationModule } from '../gamification/gamification.module';

@Module({
  imports: [TypeOrmModule.forFeature([CargoShipment, Trip]), GamificationModule],
  controllers: [CargoController],
  providers: [CargoService],
  exports: [CargoService],
})
export class CargoModule {}
