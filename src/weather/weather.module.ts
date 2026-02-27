import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { WeatherController } from './weather.controller';
import { WeatherService } from './weather.service';
import { FloodService } from './flood.service';
import { WeatherData } from './weather-data.entity';
import { Trip } from '../trips/trip.entity';
import { Booking } from '../bookings/booking.entity';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([WeatherData, Trip, Booking]),
    CacheModule.register({
      ttl: 1800000, // 30 minutos em milissegundos
      max: 100,
    }),
    NotificationsModule,
  ],
  controllers: [WeatherController],
  providers: [WeatherService, FloodService],
  exports: [WeatherService, FloodService],
})
export class WeatherModule {}
