import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SafetyService } from './safety.service';
import { SafetyController } from './safety.controller';
import { EmergencyContact } from './emergency-contact.entity';
import { SafetyChecklist } from './safety-checklist.entity';
import { SosAlert } from './sos-alert.entity';
import { Trip } from '../trips/trip.entity';
import { User } from '../users/user.entity';
import { WeatherModule } from '../weather/weather.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EmergencyContact,
      SafetyChecklist,
      SosAlert,
      Trip,
      User,
    ]),
    WeatherModule,
    NotificationsModule,
  ],
  controllers: [SafetyController],
  providers: [SafetyService],
  exports: [SafetyService],
})
export class SafetyModule {}
