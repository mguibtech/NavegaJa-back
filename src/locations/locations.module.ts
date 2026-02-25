import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { LocationsController } from './locations.controller';
import { LocationsService } from './locations.service';

@Module({
  imports: [
    CacheModule.register({ ttl: 3600000, max: 200 }),
  ],
  controllers: [LocationsController],
  providers: [LocationsService],
  exports: [LocationsService],
})
export class LocationsModule {}
