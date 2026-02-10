import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { BoatsModule } from './boats/boats.module';
import { RoutesModule } from './routes/routes.module';
import { TripsModule } from './trips/trips.module';
import { BookingsModule } from './bookings/bookings.module';
import { ShipmentsModule } from './shipments/shipments.module';
import { ReviewsModule } from './reviews/reviews.module';
import { UploadModule } from './upload/upload.module';
import { SeedModule } from './database/seed.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'postgres',
      password: '1234',
      database: 'navegaja',
      autoLoadEntities: true,
      synchronize: true, // DEV only - cria tabelas automaticamente
      logging: false,
    }),
    AuthModule,
    UsersModule,
    BoatsModule,
    RoutesModule,
    TripsModule,
    BookingsModule,
    ShipmentsModule,
    ReviewsModule,
    UploadModule,
    SeedModule,
  ],
})
export class AppModule {}
