import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsModule } from '../notifications/notifications.module';
import { User } from '../users/user.entity';
import { DocumentChangeRequest } from './document-change-request.entity';
import { DocumentChangeRequestsController } from './document-change-requests.controller';
import { DocumentChangeRequestsService } from './document-change-requests.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([DocumentChangeRequest, User]),
    NotificationsModule,
  ],
  controllers: [DocumentChangeRequestsController],
  providers: [DocumentChangeRequestsService],
  exports: [DocumentChangeRequestsService],
})
export class DocumentChangeRequestsModule {}
