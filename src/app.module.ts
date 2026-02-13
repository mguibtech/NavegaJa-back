import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
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
import { CargoModule } from './cargo/cargo.module';
import { SeedModule } from './database/seed.module';
import { GamificationModule } from './gamification/gamification.module';
import { FavoritesModule } from './favorites/favorites.module';
import { CouponsModule } from './coupons/coupons.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5432),
        username: config.get('DB_USERNAME', 'postgres'),
        password: config.get('DB_PASSWORD', '1234'),
        database: config.get('DB_DATABASE', 'navegaja'),
        autoLoadEntities: true,
        synchronize: true, // DEV only - cria tabelas automaticamente
        logging: false,
      }),
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
    SeedModule,
  ],
})
export class AppModule {}
