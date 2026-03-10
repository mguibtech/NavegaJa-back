import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BoatsController } from './boats.controller';
import { BoatsService } from './boats.service';
import { Boat } from './boat.entity';
import { Review } from '../reviews/review.entity';
import { Trip } from '../trips/trip.entity';
import { User } from '../users/user.entity';
import { BoatStaff } from '../boat-staff/boat-staff.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { Favorite } from '../favorites/favorite.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Boat, Review, Trip, User, BoatStaff, Favorite]),
    NotificationsModule,
  ],
  controllers: [BoatsController],
  providers: [BoatsService],
  exports: [BoatsService],
})
export class BoatsModule {}
