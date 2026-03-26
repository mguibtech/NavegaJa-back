import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { join } from 'path';
import { validateEnv } from './config/env.validation';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { BoatsModule } from './boats/boats.module';
import { RoutesModule } from './routes/routes.module';
import { TripsModule } from './trips/trips.module';
import { BookingsModule } from './bookings/bookings.module';
import { ShipmentsModule } from './shipments/shipments.module';
import { ReviewsModule } from './reviews/reviews.module';
import { UploadModule } from './upload/upload.module';
import { CargoModule } from './cargo/cargo.module';
import { SeedModule } from './database/seed.module';
import { GamificationModule } from './gamification/gamification.module';
import { FavoritesModule } from './favorites/favorites.module';
import { CouponsModule } from './coupons/coupons.module';
import { SafetyModule } from './safety/safety.module';
import { WeatherModule } from './weather/weather.module';
import { AdminModule } from './admin/admin.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PaymentsModule } from './payments/payments.module';
import { PaymentMethodsModule } from './payment-methods/payment-methods.module';
import { LocationsModule } from './locations/locations.module';
import { CaptainModule } from './captain/captain.module';
import { StopReviewsModule } from './stop-reviews/stop-reviews.module';
import { ChatModule } from './chat/chat.module';
import { BoatStaffModule } from './boat-staff/boat-staff.module';
import { DocumentChangeRequestsModule } from './document-change-requests/document-change-requests.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60000, limit: 300 }, // 300 req/min globalmente
      { name: 'strict', ttl: 60000, limit: 10 }, // 10 req/min em auth sensível
    ]),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const migrationsPath = join(
          __dirname,
          'database',
          'migrations',
          '*{.ts,.js}',
        ).replace(/\\/g, '/');

        return {
          type: 'postgres',
          host: config.get('DB_HOST', 'localhost'),
          port: config.get<number>('DB_PORT', 5432),
          username: config.get('DB_USERNAME', 'postgres'),
          password: config.get('DB_PASSWORD', '1234'),
          database: config.get('DB_DATABASE', 'navegaja'),
          autoLoadEntities: true,
          migrations: [migrationsPath],
          synchronize: config.get<boolean>('DB_SYNCHRONIZE', false),
          migrationsRun: config.get<boolean>('DB_MIGRATIONS_RUN', false),
          logging: false,
          extra: {
            client_encoding: 'UTF8',
          },
        };
      },
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
    CargoModule,
    GamificationModule,
    FavoritesModule,
    CouponsModule,
    SafetyModule,
    WeatherModule,
    AdminModule,
    NotificationsModule,
    PaymentsModule,
    PaymentMethodsModule,
    LocationsModule,
    CaptainModule,
    StopReviewsModule,
    ChatModule,
    BoatStaffModule,
    DocumentChangeRequestsModule,
    SeedModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
