import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Coupon } from './coupon.entity';
import { Promotion } from './promotion.entity';
import { Trip } from '../trips/trip.entity';
import { Shipment } from '../shipments/shipment.entity';
import { User } from '../users/user.entity';
import { CouponsService } from './coupons.service';
import { PromotionsService } from './promotions.service';
import { CouponsController } from './coupons.controller';
import { PromotionsController } from './promotions.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Coupon, Promotion, Trip, Shipment, User]),
    NotificationsModule,
  ],
  controllers: [CouponsController, PromotionsController],
  providers: [CouponsService, PromotionsService],
  exports: [CouponsService, PromotionsService],
})
export class CouponsModule {}
