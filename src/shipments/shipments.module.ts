import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShipmentsController } from './shipments.controller';
import { ShipmentsService } from './shipments.service';
import { StorageService } from './storage.service';
import { Shipment } from './shipment.entity';
import { ShipmentTimeline } from './shipment-timeline.entity';
import { ShipmentReview } from './shipment-review.entity';
import { Trip } from '../trips/trip.entity';
import { Coupon } from '../coupons/coupon.entity';
import { GamificationModule } from '../gamification/gamification.module';
import { CouponsModule } from '../coupons/coupons.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Shipment,
      ShipmentTimeline,
      ShipmentReview,
      Trip,
      Coupon,
    ]),
    GamificationModule,
    CouponsModule,
  ],
  controllers: [ShipmentsController],
  providers: [ShipmentsService, StorageService],
  exports: [ShipmentsService],
})
export class ShipmentsModule {}
