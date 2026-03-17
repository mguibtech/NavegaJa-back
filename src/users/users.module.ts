import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User } from './user.entity';
import { Review } from '../reviews/review.entity';
import { Trip } from '../trips/trip.entity';
import { LocationsModule } from '../locations/locations.module';
import { DocumentChangeRequestsModule } from '../document-change-requests/document-change-requests.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Review, Trip]),
    LocationsModule,
    DocumentChangeRequestsModule,
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
