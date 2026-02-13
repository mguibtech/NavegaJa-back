import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Coupon } from './coupon.entity';
import { Trip } from '../trips/trip.entity';
import { CouponsService } from './coupons.service';
import { CouponsController } from './coupons.controller';
import { PromotionsController } from './promotions.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Coupon, Trip])],
  controllers: [CouponsController, PromotionsController],
  providers: [CouponsService],
  exports: [CouponsService],
})
export class CouponsModule {}
