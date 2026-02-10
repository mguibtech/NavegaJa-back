import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BoatsController } from './boats.controller';
import { BoatsService } from './boats.service';
import { Boat } from './boat.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Boat])],
  controllers: [BoatsController],
  providers: [BoatsService],
  exports: [BoatsService],
})
export class BoatsModule {}
