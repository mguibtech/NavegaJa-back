import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Trip, TripStatus } from '../trips/trip.entity';
import { Booking, BookingStatus, PaymentStatus } from '../bookings/booking.entity';
import { User } from '../users/user.entity';

@Injectable()
export class CaptainService {
  constructor(
    @InjectRepository(Trip)
    private tripsRepo: Repository<Trip>,
    @InjectRepository(Booking)
    private bookingsRepo: Repository<Booking>,
    @InjectRepository(User)
    private usersRepo: Repository<User>,
  ) {}

  /**
   * Resumo analítico geral do capitão
   */
  async getAnalytics(captainId: string) {
    const captain = await this.usersRepo.findOne({
      where: { id: captainId },
      select: ['id', 'name', 'rating', 'totalPoints', 'level', 'totalTrips'],
    });
    if (!captain) throw new NotFoundException('Capitão não encontrado');

    const [totalTrips, completedTrips, cancelledTrips] = await Promise.all([
      this.tripsRepo.count({ where: { captainId } }),
      this.tripsRepo.count({ where: { captainId, status: TripStatus.COMPLETED } }),
      this.tripsRepo.count({ where: { captainId, status: TripStatus.CANCELLED } }),
    ]);

    // Receita total (soma de bookings pagos)
    const revenueResult = await this.bookingsRepo
      .createQueryBuilder('booking')
      .innerJoin('booking.trip', 'trip')
      .select('COALESCE(SUM(CAST(booking.total_price AS DECIMAL)), 0)', 'total')
      .addSelect('COUNT(DISTINCT booking.passenger_id)', 'totalPassengers')
      .where('trip.captain_id = :captainId', { captainId })
      .andWhere('booking.payment_status = :status', { status: PaymentStatus.PAID })
      .getRawOne();

    const completionRate = totalTrips > 0 ? Math.round((completedTrips / totalTrips) * 100) : 0;

    return {
      captainName: captain.name,
      rating: Number(captain.rating),
      level: captain.level,
      totalNavegaCoins: captain.totalPoints,
      totalTrips,
      completedTrips,
      cancelledTrips,
      completionRate,
      totalRevenue: parseFloat(revenueResult?.total || '0'),
      totalPassengers: parseInt(revenueResult?.totalPassengers || '0'),
    };
  }

  /**
   * Receita por período (daily breakdown)
   */
  async getRevenueSeries(captainId: string, period: '7d' | '30d' | '90d' = '30d') {
    const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
    const since = new Date();
    since.setDate(since.getDate() - days);

    const rows = await this.bookingsRepo
      .createQueryBuilder('booking')
      .innerJoin('booking.trip', 'trip')
      .select("DATE_TRUNC('day', booking.created_at)", 'date')
      .addSelect('COALESCE(SUM(CAST(booking.total_price AS DECIMAL)), 0)', 'amount')
      .addSelect('COUNT(*)', 'bookings')
      .where('trip.captain_id = :captainId', { captainId })
      .andWhere('booking.payment_status = :status', { status: PaymentStatus.PAID })
      .andWhere('booking.created_at >= :since', { since })
      .groupBy("DATE_TRUNC('day', booking.created_at)")
      .orderBy('date', 'ASC')
      .getRawMany();

    return rows.map(r => ({
      date: r.date,
      amount: parseFloat(r.amount),
      bookings: parseInt(r.bookings),
    }));
  }

  /**
   * Rotas mais lucrativas do capitão
   */
  async getTopRoutes(captainId: string) {
    const rows = await this.tripsRepo
      .createQueryBuilder('trip')
      .select('trip.origin', 'origin')
      .addSelect('trip.destination', 'destination')
      .addSelect('COUNT(*)', 'tripsCount')
      .addSelect('COALESCE(SUM(CAST(trip.price AS DECIMAL)), 0)', 'totalRevenue')
      .addSelect('ROUND(AVG(CAST(trip.price AS DECIMAL)), 2)', 'avgPrice')
      .where('trip.captain_id = :captainId', { captainId })
      .andWhere('trip.status = :status', { status: TripStatus.COMPLETED })
      .groupBy('trip.origin, trip.destination')
      .orderBy('"tripsCount"', 'DESC')
      .limit(10)
      .getRawMany();

    return rows.map(r => ({
      origin: r.origin,
      destination: r.destination,
      tripsCount: parseInt(r.tripsCount),
      totalRevenue: parseFloat(r.totalRevenue),
      avgPrice: parseFloat(r.avgPrice),
    }));
  }

  /**
   * Passageiros recorrentes do capitão
   */
  async getRecurringPassengers(captainId: string) {
    const rows = await this.bookingsRepo
      .createQueryBuilder('booking')
      .innerJoin('booking.trip', 'trip')
      .innerJoin('booking.passenger', 'passenger')
      .select('passenger.id', 'passengerId')
      .addSelect('passenger.name', 'passengerName')
      .addSelect('passenger.avatarUrl', 'avatarUrl')
      .addSelect('CAST(passenger.passengerRating AS DECIMAL)', 'passengerRating')
      .addSelect('COUNT(*)', 'totalBookings')
      .addSelect('COALESCE(SUM(CAST(booking.total_price AS DECIMAL)), 0)', 'totalSpent')
      .addSelect('MAX(booking.created_at)', 'lastTrip')
      .where('trip.captain_id = :captainId', { captainId })
      .andWhere('booking.status = :status', { status: BookingStatus.COMPLETED })
      .groupBy('passenger.id, passenger.name, passenger.avatarUrl, passenger.passengerRating')
      .having('COUNT(*) > 1')
      .orderBy('"totalBookings"', 'DESC')
      .limit(20)
      .getRawMany();

    return rows.map(r => ({
      passengerId: r.passengerId,
      passengerName: r.passengerName,
      avatarUrl: r.avatarUrl,
      passengerRating: parseFloat(r.passengerRating),
      totalBookings: parseInt(r.totalBookings),
      totalSpent: parseFloat(r.totalSpent),
      lastTrip: r.lastTrip,
    }));
  }
}
