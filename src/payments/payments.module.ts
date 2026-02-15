import { Module } from '@nestjs/common';
import { PixService } from './pix.service';

@Module({
  providers: [PixService],
  exports: [PixService],
})
export class PaymentsModule {}
