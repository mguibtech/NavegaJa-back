import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SafetyService } from './safety.service';
import { SafetyController } from './safety.controller';
import { EmergencyContact } from './emergency-contact.entity';
import { SafetyChecklist } from './safety-checklist.entity';
import { SosAlert } from './sos-alert.entity';
import { WeatherModule } from '../weather/weather.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EmergencyContact,
      SafetyChecklist,
      SosAlert,
    ]),
    WeatherModule,
  ],
  controllers: [SafetyController],
  providers: [SafetyService],
  exports: [SafetyService],
})
export class SafetyModule {}
