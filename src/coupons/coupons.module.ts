import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Coupon } from './coupon.entity';
import { Promotion } from './promotion.entity';
import { Trip } from '../trips/trip.entity';
import { CouponsService } from './coupons.service';
import { PromotionsService } from './promotions.service';
import { CouponsController } from './coupons.controller';
import { PromotionsController } from './promotions.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Coupon, Promotion, Trip])],
  controllers: [CouponsController, PromotionsController],
  providers: [CouponsService, PromotionsService],
  exports: [CouponsService, PromotionsService],
})
export class CouponsModule {}
