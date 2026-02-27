import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StopReviewsController } from './stop-reviews.controller';
import { StopReviewsService } from './stop-reviews.service';
import { StopReview } from './stop-review.entity';
import { GamificationModule } from '../gamification/gamification.module';

@Module({
  imports: [TypeOrmModule.forFeature([StopReview]), GamificationModule],
  controllers: [StopReviewsController],
  providers: [StopReviewsService],
  exports: [StopReviewsService],
})
export class StopReviewsModule {}
