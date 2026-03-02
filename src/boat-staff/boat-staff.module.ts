import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BoatStaff } from './boat-staff.entity';
import { Boat } from '../boats/boat.entity';
import { User } from '../users/user.entity';
import { BoatStaffService } from './boat-staff.service';
import { BoatStaffController } from './boat-staff.controller';
import { CaptainBoatStaffController } from './captain-boat-staff.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [TypeOrmModule.forFeature([BoatStaff, Boat, User]), NotificationsModule],
  controllers: [BoatStaffController, CaptainBoatStaffController],
  providers: [BoatStaffService],
  exports: [BoatStaffService],
})
export class BoatStaffModule {}
