import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PixService } from './pix.service';
import { PaymentsController } from './payments.controller';
import { Booking } from '../bookings/booking.entity';
import { Shipment } from '../shipments/shipment.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Booking, Shipment])],
  controllers: [PaymentsController],
  providers: [PixService],
  exports: [PixService],
})
export class PaymentsModule {}
