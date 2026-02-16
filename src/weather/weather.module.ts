import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { WeatherController } from './weather.controller';
import { WeatherService } from './weather.service';
import { WeatherData } from './weather-data.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([WeatherData]),
    CacheModule.register({
      ttl: 1800000, // 30 minutos em milissegundos
      max: 100, // Máximo 100 itens no cache
    }),
  ],
  controllers: [WeatherController],
  providers: [WeatherService],
  exports: [WeatherService], // Exporta para outros módulos usarem
})
export class WeatherModule {}
