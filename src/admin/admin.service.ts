import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  MoreThan,
  Between,
  IsNull,
  FindOptionsWhere,
} from 'typeorm';
import { NotificationsService } from '../notifications/notifications.service';
import { GamificationService } from '../gamification/gamification.service';
import { LoyaltyLevel } from '../gamification/point-transaction.entity';
import * as bcrypt from 'bcryptjs';
import { User, UserRole } from '../users/user.entity';
import { ensureReferralCode } from '../users/referral-code.util';
import { Trip, TripStatus } from '../trips/trip.entity';
import { TripsService } from '../trips/trips.service';
import { Shipment, ShipmentStatus } from '../shipments/shipment.entity';
import { SosAlert, SosAlertStatus } from '../safety/sos-alert.entity';
import { SafetyChecklist } from '../safety/safety-checklist.entity';
import {
  Booking,
  BookingStatus,
  PaymentStatus,
} from '../bookings/booking.entity';
import { Coupon } from '../coupons/coupon.entity';
import { Review, ReviewType } from '../reviews/review.entity';
import { Boat } from '../boats/boat.entity';
import { DocumentChangeRequestsService } from '../document-change-requests/document-change-requests.service';
import { AdminActivity } from './admin.activity.types';
import {
  buildRecentBookingActivities,
  buildRecentChecklistActivities,
  buildRecentCouponActivities,
  buildRecentShipmentActivities,
  buildRecentSosActivities,
  buildRecentTripActivities,
  buildRecentUserActivities,
} from './admin.activity.util';
import {
  buildAdminNotificationsPayload,
  buildPendingVerificationsPayload,
} from './admin.notification.util';
import {
  AdminNotificationsPayload,
  PendingVerificationsPayload,
} from './admin.notification.types';

@Injectable()
export class AdminService {
  // Campos seguros do capitão — nunca expor passwordHash/fcmToken/resetCode
  private static readonly CAPTAIN_SAFE_FIELDS = [
    'captain.id',
    'captain.name',
    'captain.phone',
    'captain.role',
    'captain.email',
    'captain.avatarUrl',
    'captain.rating',
    'captain.rating',
    'captain.isActive',
    'captain.city',
    'captain.state',
    'captain.isVerified',
    'captain.createdAt',
  ];

  private static readonly USER_SAFE_FIELDS = [
    'id',
    'name',
    'phone',
    'email',
    'role',
    'avatarUrl',
    'city',
    'state',
    'isActive',
    'isVerified',
    'createdAt',
  ];

  constructor(
    @InjectRepository(User)
    private usersRepo: Repository<User>,
    @InjectRepository(Trip)
    private tripsRepo: Repository<Trip>,
    @InjectRepository(Shipment)
    private shipmentsRepo: Repository<Shipment>,
    @InjectRepository(SosAlert)
    private sosRepo: Repository<SosAlert>,
    @InjectRepository(SafetyChecklist)
    private checklistsRepo: Repository<SafetyChecklist>,
    @InjectRepository(Booking)
    private bookingsRepo: Repository<Booking>,
    @InjectRepository(Coupon)
    private couponsRepo: Repository<Coupon>,
    @InjectRepository(Review)
    private reviewsRepo: Repository<Review>,
    @InjectRepository(Boat)
    private boatsRepo: Repository<Boat>,
    private notificationsService: NotificationsService,
    private gamificationService: GamificationService,
    private tripsService: TripsService,
    private documentChangeRequestsService: DocumentChangeRequestsService,
  ) {}

  private sanitizeUser(user: User): Partial<User> & {
    passwordHash?: string;
  } {
    const safeUser = { ...user } as Partial<User> & { passwordHash?: string };
    delete safeUser.passwordHash;
    return safeUser;
  }

  private buildPagination(page: number, limit: number, total: number) {
    return {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  private getStatsDateThresholds() {
    const today = this.startOfToday();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    return { today, weekAgo, monthAgo };
  }

  private async findUserOrThrow(id: string): Promise<User> {
    const user = await this.usersRepo.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    return user;
  }

  private async findUserWithBoatsOrThrow(id: string): Promise<User> {
    const user = await this.usersRepo.findOne({
      where: { id },
      relations: ['boats'],
    });
    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    return user;
  }

  private async findTripOrThrow(id: string): Promise<Trip> {
    const trip = await this.tripsRepo.findOne({ where: { id } });
    if (!trip) {
      throw new NotFoundException('Viagem não encontrada');
    }

    return trip;
  }

  private async findShipmentOrThrow(id: string): Promise<Shipment> {
    const shipment = await this.shipmentsRepo.findOne({ where: { id } });
    if (!shipment) {
      throw new NotFoundException('Encomenda não encontrada');
    }

    return shipment;
  }

  private async findBookingOrThrow(id: string): Promise<Booking> {
    const booking = await this.bookingsRepo.findOne({ where: { id } });
    if (!booking) {
      throw new NotFoundException('Reserva não encontrada');
    }

    return booking;
  }

  private async findReviewOrThrow(id: string): Promise<Review> {
    const review = await this.reviewsRepo.findOne({ where: { id } });
    if (!review) {
      throw new NotFoundException('Avaliação não encontrada');
    }

    return review;
  }

  private async findBoatWithOwnerOrThrow(id: string): Promise<Boat> {
    const boat = await this.boatsRepo.findOne({
      where: { id },
      relations: ['owner'],
    });
    if (!boat) {
      throw new NotFoundException('Embarcação não encontrada');
    }

    return boat;
  }

  private serializeAdminBoat(boat: Boat) {
    return {
      ...boat,
      owner: boat.owner
        ? { id: boat.owner.id, name: boat.owner.name, phone: boat.owner.phone }
        : null,
    };
  }

  private buildBoatVerificationNotification(
    boat: Boat,
    approved: boolean,
    reason: string,
  ): { title: string; body: string; data: Record<string, string> } {
    if (approved) {
      return {
        title: '✅ Embarcação aprovada!',
        body: `Sua embarcação "${boat.name}" foi verificada. Já pode criar viagens com ela.`,
        data: {
          type: 'boat_verified',
          boatId: boat.id,
        },
      };
    }

    return {
      title: '❌ Embarcação rejeitada',
      body: `"${boat.name}" — Motivo: ${reason}. Acesse o app para reenviar os documentos.`,
      data: {
        type: 'boat_rejected',
        boatId: boat.id,
        reason,
      },
    };
  }

  private async refreshCaptainRating(captainId: string): Promise<void> {
    const row = await this.reviewsRepo
      .createQueryBuilder('r')
      .select('ROUND(AVG(r.rating)::numeric, 1)', 'avg')
      .where('r.captain_id = :id', { id: captainId })
      .andWhere('r.review_type = :type', {
        type: ReviewType.PASSENGER_TO_CAPTAIN,
      })
      .getRawOne<{ avg: string | null }>();

    await this.usersRepo.update(captainId, {
      rating: Number(row?.avg || 5.0),
    });
  }

  private async refreshBoatRating(boatId: string): Promise<void> {
    const row = await this.reviewsRepo
      .createQueryBuilder('r')
      .select('ROUND(AVG(r.boat_rating)::numeric, 1)', 'avg')
      .addSelect('COUNT(*)', 'total')
      .where('r.boat_id = :id', { id: boatId })
      .andWhere('r.boat_rating IS NOT NULL')
      .getRawOne<{ avg: string | null; total: string | null }>();

    await this.boatsRepo.update(boatId, {
      rating: Number(row?.avg || 5.0),
      reviewCount: parseInt(row?.total || '0', 10),
    });
  }

  private async refreshPassengerRating(passengerId: string): Promise<void> {
    const row = await this.reviewsRepo
      .createQueryBuilder('r')
      .select('ROUND(AVG(r.passenger_rating)::numeric, 1)', 'avg')
      .where('r.passenger_id = :id', { id: passengerId })
      .andWhere('r.review_type = :type', {
        type: ReviewType.CAPTAIN_TO_PASSENGER,
      })
      .getRawOne<{ avg: string | null }>();

    await this.usersRepo.update(passengerId, {
      passengerRating: Number(row?.avg || 5.0),
    });
  }

  private async buildUserDetailsStats(user: User) {
    const stats = {
      totalTrips: 0,
      totalShipments: 0,
      totalSpent: 0,
    };

    if (user.role === UserRole.CAPTAIN) {
      stats.totalTrips = await this.tripsRepo.count({
        where: { captainId: user.id },
      });
    }

    if (user.role === UserRole.PASSENGER) {
      const bookings = await this.bookingsRepo.find({
        where: { passengerId: user.id },
      });
      stats.totalSpent = bookings.reduce(
        (sum, booking) => sum + Number(booking.totalPrice || 0),
        0,
      );
    }

    stats.totalShipments = await this.shipmentsRepo.count({
      where: { senderId: user.id },
    });

    return stats;
  }

  private async getAverageReviewRating(
    selectExpression: string,
    reviewType?: ReviewType,
  ): Promise<number> {
    const qb = this.reviewsRepo
      .createQueryBuilder('r')
      .select(selectExpression, 'avg');

    if (reviewType) {
      qb.where('r.review_type = :type', { type: reviewType });
    } else {
      qb.where('r.boat_rating IS NOT NULL');
    }

    const row = await qb.getRawOne<{ avg: string | null }>();
    return Number(row?.avg || 0);
  }

  private async getCaptainRatingDistribution() {
    const distributionRows = await this.reviewsRepo
      .createQueryBuilder('r')
      .select('r.rating', 'stars')
      .addSelect('COUNT(*)', 'count')
      .where('r.review_type = :type', { type: ReviewType.PASSENGER_TO_CAPTAIN })
      .groupBy('r.rating')
      .getRawMany<{ stars: number | null; count: string }>();

    const distribution: Record<number, number> = {
      5: 0,
      4: 0,
      3: 0,
      2: 0,
      1: 0,
    };

    for (const row of distributionRows) {
      if (row.stars) {
        distribution[row.stars] = parseInt(row.count, 10);
      }
    }

    return distribution;
  }

  // ==================== USUÁRIOS ====================

  async createCaptain(dto: {
    name: string;
    phone: string;
    email?: string;
    password: string;
    city: string;
    state?: string;
  }) {
    const phoneExists = await this.usersRepo.findOne({
      where: { phone: dto.phone },
    });
    if (phoneExists) throw new ConflictException('Telefone já cadastrado');

    if (dto.email) {
      const emailExists = await this.usersRepo.findOne({
        where: { email: dto.email },
      });
      if (emailExists) throw new ConflictException('E-mail já cadastrado');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const captain = await this.usersRepo.save({
      name: dto.name,
      phone: dto.phone,
      email: dto.email,
      passwordHash,
      role: UserRole.CAPTAIN,
      city: dto.city,
      state: dto.state ?? 'AM',
      isActive: true,
      isVerified: false, // aguarda verificação de documentos
    });
    await ensureReferralCode(this.usersRepo, captain);

    return this.sanitizeUser(captain);
  }

  async getAllUsers(
    page: number,
    limit: number,
    role?: UserRole,
    search?: string,
  ) {
    const skip = (page - 1) * limit;
    const qb = this.usersRepo.createQueryBuilder('user');

    if (role) {
      qb.andWhere('user.role = :role', { role });
    }

    if (search) {
      qb.andWhere(
        '(LOWER(user.name) LIKE LOWER(:search) OR LOWER(user.email) LIKE LOWER(:search) OR user.phone LIKE :search)',
        { search: `%${search}%` },
      );
    }

    const [users, total] = await qb
      .orderBy('user.createdAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    // Remove password hash from response
    const sanitizedUsers = users.map((user) => this.sanitizeUser(user));

    return {
      data: sanitizedUsers,
      pagination: this.buildPagination(page, limit, total),
    };
  }

  async getUserStats() {
    const { today, weekAgo, monthAgo } = this.getStatsDateThresholds();
    const [
      total,
      passengerCount,
      captainCount,
      adminCount,
      newToday,
      newThisWeek,
      newThisMonth,
      activeUsers,
    ] = await Promise.all([
      this.usersRepo.count(),
      this.usersRepo.count({ where: { role: UserRole.PASSENGER } }),
      this.usersRepo.count({ where: { role: UserRole.CAPTAIN } }),
      this.usersRepo.count({ where: { role: UserRole.ADMIN } }),
      this.usersRepo.count({ where: { createdAt: MoreThan(today) } }),
      this.usersRepo.count({ where: { createdAt: MoreThan(weekAgo) } }),
      this.usersRepo.count({ where: { createdAt: MoreThan(monthAgo) } }),
      this.usersRepo.count({ where: { isActive: true } }),
    ]);

    const byRole = {
      passenger: passengerCount,
      captain: captainCount,
      admin: adminCount,
    };

    return {
      total,
      byRole,
      newToday,
      newThisWeek,
      newThisMonth,
      activeUsers,
      blockedUsers: total - activeUsers,
    };
  }

  async getUserDetails(id: string) {
    const user = await this.findUserWithBoatsOrThrow(id);
    const stats = await this.buildUserDetailsStats(user);

    return {
      ...this.sanitizeUser(user),
      stats,
    };
  }

  async updateUserRole(id: string, role: UserRole) {
    const user = await this.findUserOrThrow(id);
    user.role = role;
    await this.usersRepo.save(user);

    return this.sanitizeUser(user);
  }

  async updateUserStatus(id: string, active: boolean) {
    const user = await this.findUserOrThrow(id);
    user.isActive = active;
    await this.usersRepo.save(user);

    return {
      message: `Usuário ${active ? 'ativado' : 'desativado'} com sucesso`,
      user: this.sanitizeUser(user),
    };
  }

  async deleteUser(id: string) {
    await this.findUserOrThrow(id);

    // Verificar se usuário tem viagens ativas
    const activeTrips = await this.tripsRepo.count({
      where: {
        captainId: id,
        status: TripStatus.IN_PROGRESS,
      },
    });

    if (activeTrips > 0) {
      throw new BadRequestException(
        'Não é possível deletar usuário com viagens em andamento',
      );
    }

    await this.usersRepo.delete(id);

    return {
      message: 'Usuário deletado com sucesso',
      userId: id,
    };
  }

  // ==================== VIAGENS ====================

  async getAllTrips(
    page: number,
    limit: number,
    status?: string,
    captainId?: string,
  ) {
    const skip = (page - 1) * limit;
    const qb = this.tripsRepo
      .createQueryBuilder('trip')
      .leftJoin('trip.captain', 'captain')
      .addSelect(AdminService.CAPTAIN_SAFE_FIELDS)
      .leftJoinAndSelect('trip.boat', 'boat');

    if (status) {
      qb.andWhere('trip.status = :status', { status });
    }

    if (captainId) {
      qb.andWhere('trip.captainId = :captainId', { captainId });
    }

    const [trips, total] = await qb
      .orderBy('trip.createdAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return {
      data: trips,
      pagination: this.buildPagination(page, limit, total),
    };
  }

  async getTripStats() {
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const monthAgo = new Date(now);
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    const [
      total,
      scheduled,
      inProgress,
      completed,
      cancelled,
      todayTrips,
      thisWeekTrips,
      thisMonthTrips,
      revenueRow,
    ] = await Promise.all([
      this.tripsRepo.count(),
      this.tripsRepo.count({ where: { status: TripStatus.SCHEDULED } }),
      this.tripsRepo.count({ where: { status: TripStatus.IN_PROGRESS } }),
      this.tripsRepo.count({ where: { status: TripStatus.COMPLETED } }),
      this.tripsRepo.count({ where: { status: TripStatus.CANCELLED } }),
      this.tripsRepo.count({ where: { createdAt: Between(today, tomorrow) } }),
      this.tripsRepo.count({ where: { createdAt: Between(weekAgo, now) } }),
      this.tripsRepo.count({ where: { createdAt: Between(monthAgo, now) } }),
      this.bookingsRepo
        .createQueryBuilder('b')
        .select('COALESCE(SUM(b.total_price), 0)', 'totalRevenue')
        .getRawOne<{ totalRevenue: string | null }>(),
    ]);

    const totalRevenue = Number(revenueRow?.totalRevenue || 0);
    const avgPrice = total > 0 ? totalRevenue / total : 0;

    return {
      total,
      byStatus: { scheduled, in_progress: inProgress, completed, cancelled },
      todayTrips,
      thisWeekTrips,
      thisMonthTrips,
      totalRevenue: Number(totalRevenue.toFixed(2)),
      avgPrice: Number(avgPrice.toFixed(2)),
    };
  }

  async updateTripStatus(id: string, status: TripStatus) {
    if (status === TripStatus.CANCELLED) {
      return this.tripsService.cancelTripWithPropagation(id);
    }

    const trip = await this.findTripOrThrow(id);
    trip.status = status as TripStatus;
    await this.tripsRepo.save(trip);

    return trip;
  }

  async deleteTrip(id: string) {
    const trip = await this.findTripOrThrow(id);
    if (trip.status === TripStatus.IN_PROGRESS) {
      throw new BadRequestException(
        'Não é possível deletar viagem em andamento',
      );
    }

    await this.tripsRepo.delete(id);

    return {
      message: 'Viagem deletada com sucesso',
      tripId: id,
    };
  }

  // ==================== ENCOMENDAS ====================

  async getAllShipments(
    page: number,
    limit: number,
    status?: string,
    trackingCode?: string,
  ) {
    const skip = (page - 1) * limit;
    const qb = this.shipmentsRepo
      .createQueryBuilder('shipment')
      .leftJoin('shipment.sender', 'sender')
      .addSelect([
        'sender.id',
        'sender.name',
        'sender.phone',
        'sender.email',
        'sender.role',
        'sender.city',
        'sender.createdAt',
      ])
      .leftJoinAndSelect('shipment.trip', 'trip')
      .leftJoin('trip.captain', 'captain')
      .addSelect(AdminService.CAPTAIN_SAFE_FIELDS);

    if (status) {
      qb.andWhere('shipment.status = :status', { status });
    }

    if (trackingCode) {
      qb.andWhere('LOWER(shipment.trackingCode) LIKE LOWER(:code)', {
        code: `%${trackingCode}%`,
      });
    }

    const [shipments, total] = await qb
      .orderBy('shipment.createdAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return {
      data: shipments,
      pagination: this.buildPagination(page, limit, total),
    };
  }

  async getShipmentStats() {
    const { today, weekAgo, monthAgo } = this.getStatsDateThresholds();

    const [
      total,
      pending,
      collected,
      inTransit,
      delivered,
      cancelled,
      todayShipments,
      thisWeekShipments,
      thisMonthShipments,
      revenueRow,
    ] = await Promise.all([
      this.shipmentsRepo.count(),
      this.shipmentsRepo.count({ where: { status: ShipmentStatus.PENDING } }),
      this.shipmentsRepo.count({ where: { status: ShipmentStatus.COLLECTED } }),
      this.shipmentsRepo.count({
        where: { status: ShipmentStatus.IN_TRANSIT },
      }),
      this.shipmentsRepo.count({ where: { status: ShipmentStatus.DELIVERED } }),
      this.shipmentsRepo.count({ where: { status: ShipmentStatus.CANCELLED } }),
      this.shipmentsRepo.count({ where: { createdAt: MoreThan(today) } }),
      this.shipmentsRepo.count({ where: { createdAt: MoreThan(weekAgo) } }),
      this.shipmentsRepo.count({ where: { createdAt: MoreThan(monthAgo) } }),
      this.shipmentsRepo
        .createQueryBuilder('s')
        .select('COALESCE(SUM(s.total_price), 0)', 'totalRevenue')
        .getRawOne<{ totalRevenue: string | null }>(),
    ]);

    const totalRevenue = Number(revenueRow?.totalRevenue || 0);
    const avgPrice = total > 0 ? totalRevenue / total : 0;

    return {
      total,
      byStatus: {
        pending,
        collected,
        in_transit: inTransit,
        delivered,
        cancelled,
      },
      todayShipments,
      thisWeekShipments,
      thisMonthShipments,
      totalRevenue: Number(totalRevenue.toFixed(2)),
      avgPrice: Number(avgPrice.toFixed(2)),
    };
  }

  async updateShipmentStatus(id: string, status: ShipmentStatus) {
    const shipment = await this.findShipmentOrThrow(id);
    shipment.status = status;
    await this.shipmentsRepo.save(shipment);

    return shipment;
  }

  // ==================== RECEITA POR PERÍODO ====================

  async getRevenueChart(period: '7d' | '30d' | '90d' = '30d') {
    const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
    const labels: string[] = [];
    const bookingsRevenue: number[] = [];
    const shipmentsRevenue: number[] = [];
    const total: number[] = [];

    for (let i = days - 1; i >= 0; i--) {
      const { start, end, label } = this.buildDayRange(i);
      labels.push(label);

      const [bRow, sRow] = await Promise.all([
        this.bookingsRepo
          .createQueryBuilder('b')
          .select('COALESCE(SUM(b.total_price), 0)', 'revenue')
          .where('b.created_at BETWEEN :start AND :end', { start, end })
          .getRawOne<{ revenue: string | null }>(),
        this.shipmentsRepo
          .createQueryBuilder('s')
          .select('COALESCE(SUM(s.total_price), 0)', 'revenue')
          .where('s.created_at BETWEEN :start AND :end', { start, end })
          .getRawOne<{ revenue: string | null }>(),
      ]);

      const b = Number(bRow?.revenue || 0);
      const s = Number(sRow?.revenue || 0);
      bookingsRevenue.push(Number(b.toFixed(2)));
      shipmentsRevenue.push(Number(s.toFixed(2)));
      total.push(Number((b + s).toFixed(2)));
    }

    const sumBookings = Number(
      bookingsRevenue.reduce((a, c) => a + c, 0).toFixed(2),
    );
    const sumShipments = Number(
      shipmentsRevenue.reduce((a, c) => a + c, 0).toFixed(2),
    );

    return {
      period,
      labels,
      bookings: bookingsRevenue,
      shipments: shipmentsRevenue,
      total,
      totals: {
        bookings: sumBookings,
        shipments: sumShipments,
        combined: Number((sumBookings + sumShipments).toFixed(2)),
      },
    };
  }

  // ==================== GRÁFICO POR DIA ====================

  async getDashboardChart(days: number = 7) {
    const labels: string[] = [];
    const bookings: number[] = [];
    const users: number[] = [];
    const trips: number[] = [];

    for (let i = days - 1; i >= 0; i--) {
      const { start, end, label } = this.buildDayRange(i);
      labels.push(label);

      const [b, u, t] = await Promise.all([
        this.bookingsRepo.count({ where: { createdAt: Between(start, end) } }),
        this.usersRepo.count({ where: { createdAt: Between(start, end) } }),
        this.tripsRepo.count({ where: { createdAt: Between(start, end) } }),
      ]);

      bookings.push(b);
      users.push(u);
      trips.push(t);
    }

    return { labels, bookings, users, trips };
  }

  // ==================== DASHBOARD OVERVIEW ====================

  async getDashboardOverview() {
    const [users, trips, shipments, sosAlerts, revenue] = await Promise.all([
      this.getUserStats(),
      this.getTripStats(),
      this.getShipmentStats(),
      this.getSosStats(),
      this.getRevenueOverview(),
    ]);

    return {
      users: {
        total: users.total,
        newToday: users.newToday,
        activeUsers: users.activeUsers,
        byRole: users.byRole,
      },
      trips: {
        total: trips.total,
        scheduled: trips.byStatus.scheduled,
        inProgress: trips.byStatus.in_progress,
        todayTrips: trips.todayTrips,
        byStatus: trips.byStatus,
      },
      shipments: {
        total: shipments.total,
        pending: shipments.byStatus.pending,
        inTransit: shipments.byStatus.in_transit,
        todayShipments: shipments.todayShipments,
      },
      sosAlerts,
      revenue,
    };
  }

  private async getSosStats() {
    const { today, weekAgo } = this.getStatsDateThresholds();
    const [active, totalToday, totalThisWeek] = await Promise.all([
      this.sosRepo.count({
        where: { status: SosAlertStatus.ACTIVE },
      }),
      this.sosRepo.count({
        where: { createdAt: MoreThan(today) },
      }),
      this.sosRepo.count({
        where: { createdAt: MoreThan(weekAgo) },
      }),
    ]);

    return {
      active,
      totalToday,
      totalThisWeek,
    };
  }

  private async getRevenueOverview() {
    const [today, thisWeek, thisMonth] = await Promise.all([
      this.getRevenueByPeriod('today'),
      this.getRevenueByPeriod('week'),
      this.getRevenueByPeriod('month'),
    ]);

    return {
      today,
      thisWeek,
      thisMonth,
    };
  }

  private async getRevenueByPeriod(
    period: 'today' | 'week' | 'month',
  ): Promise<number> {
    const startDate = this.getRevenuePeriodStart(period);

    const [bookingsRow, shipmentsRow] = await Promise.all([
      this.bookingsRepo
        .createQueryBuilder('b')
        .select('COALESCE(SUM(b.total_price), 0)', 'revenue')
        .where('b.created_at > :startDate', { startDate })
        .getRawOne<{ revenue: string | null }>(),
      this.shipmentsRepo
        .createQueryBuilder('s')
        .select('COALESCE(SUM(s.total_price), 0)', 'revenue')
        .where('s.created_at > :startDate', { startDate })
        .getRawOne<{ revenue: string | null }>(),
    ]);

    const total =
      Number(bookingsRow?.revenue || 0) + Number(shipmentsRow?.revenue || 0);
    return Number(total.toFixed(2));
  }

  async getRecentActivity(limit: number) {
    // Buscar dados recentes de diferentes entidades
    const [
      recentTrips,
      recentShipments,
      recentUsers,
      recentBookings,
      recentCoupons,
      recentSosAlerts,
      recentChecklists,
    ] = await Promise.all([
      this.tripsRepo.find({
        order: { createdAt: 'DESC' },
        take: 10,
        relations: ['captain', 'boat'],
      }),
      this.shipmentsRepo.find({
        order: { createdAt: 'DESC' },
        take: 10,
        relations: ['sender', 'trip'],
      }),
      this.usersRepo.find({
        order: { createdAt: 'DESC' },
        take: 10,
        select: [
          'id',
          'name',
          'email',
          'phone',
          'role',
          'city',
          'state',
          'isActive',
          'createdAt',
        ],
      }),
      this.bookingsRepo.find({
        order: { createdAt: 'DESC' },
        take: 10,
        relations: ['passenger', 'trip'],
      }),
      this.couponsRepo.find({
        order: { createdAt: 'DESC' },
        take: 10,
      }),
      this.sosRepo.find({
        order: { createdAt: 'DESC' },
        take: 10,
        relations: ['user'],
      }),
      this.checklistsRepo.find({
        where: { allItemsChecked: true },
        order: { completedAt: 'DESC' },
        take: 10,
        relations: ['captain', 'trip'],
      }),
    ]);

    const activities: AdminActivity[] = [
      ...buildRecentTripActivities(recentTrips),
      ...buildRecentShipmentActivities(recentShipments),
      ...buildRecentUserActivities(recentUsers),
      ...buildRecentBookingActivities(recentBookings),
      ...buildRecentCouponActivities(recentCoupons),
      ...buildRecentSosActivities(recentSosAlerts),
      ...buildRecentChecklistActivities(recentChecklists),
    ];

    // Ordenar por timestamp e limitar
    return activities
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      )
      .slice(0, limit);
  }

  // ==================== SEGURANÇA ====================

  async getAllChecklists(incomplete?: boolean) {
    const where: FindOptionsWhere<SafetyChecklist> = {};

    if (incomplete !== undefined) {
      where.allItemsChecked = !incomplete;
    }

    return this.checklistsRepo.find({
      where,
      relations: ['trip', 'captain'],
      order: { createdAt: 'DESC' },
    });
  }

  async getChecklistStats() {
    const total = await this.checklistsRepo.count();
    const complete = await this.checklistsRepo.count({
      where: { allItemsChecked: true },
    });
    const incomplete = total - complete;

    const complianceRate = total > 0 ? (complete / total) * 100 : 0;

    return {
      total,
      complete,
      incomplete,
      complianceRate: Number(complianceRate.toFixed(2)),
    };
  }

  // ==================== RESERVAS (BOOKINGS) ====================

  async getAllBookings(
    page: number,
    limit: number,
    status?: string,
    paymentStatus?: string,
    search?: string,
  ) {
    const skip = (page - 1) * limit;
    const qb = this.bookingsRepo
      .createQueryBuilder('booking')
      .leftJoinAndSelect('booking.passenger', 'passenger')
      .leftJoinAndSelect('booking.trip', 'trip')
      .leftJoinAndSelect('trip.captain', 'captain');

    if (status) {
      qb.andWhere('booking.status = :status', { status });
    }

    if (paymentStatus) {
      qb.andWhere('booking.paymentStatus = :paymentStatus', { paymentStatus });
    }

    if (search) {
      qb.andWhere(
        '(LOWER(passenger.name) LIKE LOWER(:search) OR LOWER(passenger.email) LIKE LOWER(:search) OR booking.id LIKE :search)',
        { search: `%${search}%` },
      );
    }

    const [bookings, total] = await qb
      .orderBy('booking.createdAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return {
      data: bookings,
      pagination: this.buildPagination(page, limit, total),
    };
  }

  async getBookingsStats() {
    const { today, weekAgo, monthAgo } = this.getStatsDateThresholds();

    const [
      total,
      pending,
      confirmed,
      checkedIn,
      completed,
      cancelled,
      paymentPending,
      paid,
      refundPending,
      refunded,
      newToday,
      newThisWeek,
      newThisMonth,
      totalRevenueRow,
      confirmedRevenueRow,
    ] = await Promise.all([
      this.bookingsRepo.count(),
      this.bookingsRepo.count({ where: { status: BookingStatus.PENDING } }),
      this.bookingsRepo.count({ where: { status: BookingStatus.CONFIRMED } }),
      this.bookingsRepo.count({ where: { status: BookingStatus.CHECKED_IN } }),
      this.bookingsRepo.count({ where: { status: BookingStatus.COMPLETED } }),
      this.bookingsRepo.count({ where: { status: BookingStatus.CANCELLED } }),
      this.bookingsRepo.count({
        where: { paymentStatus: PaymentStatus.PENDING },
      }),
      this.bookingsRepo.count({ where: { paymentStatus: PaymentStatus.PAID } }),
      this.bookingsRepo.count({
        where: { paymentStatus: PaymentStatus.REFUND_PENDING },
      }),
      this.bookingsRepo.count({
        where: { paymentStatus: PaymentStatus.REFUNDED },
      }),
      this.bookingsRepo.count({ where: { createdAt: MoreThan(today) } }),
      this.bookingsRepo.count({ where: { createdAt: MoreThan(weekAgo) } }),
      this.bookingsRepo.count({ where: { createdAt: MoreThan(monthAgo) } }),
      this.bookingsRepo
        .createQueryBuilder('b')
        .select('COALESCE(SUM(b.total_price), 0)', 'totalRevenue')
        .getRawOne<{ totalRevenue: string | null }>(),
      this.bookingsRepo
        .createQueryBuilder('b')
        .select('COALESCE(SUM(b.total_price), 0)', 'confirmedRevenue')
        .where('b.payment_status = :status', { status: PaymentStatus.PAID })
        .getRawOne<{ confirmedRevenue: string | null }>(),
    ]);

    const totalRevenue = Number(totalRevenueRow?.totalRevenue || 0);
    const confirmedRevenue = Number(confirmedRevenueRow?.confirmedRevenue || 0);

    return {
      total,
      byStatus: { pending, confirmed, checkedIn, completed, cancelled },
      byPaymentStatus: {
        pending: paymentPending,
        paid,
        refund_pending: refundPending,
        refunded,
      },
      revenue: {
        total: Number(totalRevenue.toFixed(2)),
        confirmed: Number(confirmedRevenue.toFixed(2)),
        pending: Number((totalRevenue - confirmedRevenue).toFixed(2)),
      },
      newToday,
      newThisWeek,
      newThisMonth,
    };
  }

  async getBookingDetails(id: string) {
    const booking = await this.bookingsRepo.findOne({
      where: { id },
      relations: ['passenger', 'trip', 'trip.captain', 'trip.boat'],
    });

    if (!booking) {
      throw new NotFoundException('Reserva não encontrada');
    }

    return booking;
  }

  async updateBookingStatus(id: string, status: BookingStatus) {
    const booking = await this.findBookingOrThrow(id);
    booking.status = status;

    return this.bookingsRepo.save(booking);
  }

  async deleteBooking(id: string) {
    await this.findBookingOrThrow(id);
    await this.bookingsRepo.delete(id);

    return { message: 'Reserva deletada com sucesso' };
  }

  // ==================== REVIEWS ====================

  async getAllReviews(
    page: number,
    limit: number,
    type?: string,
    search?: string,
  ) {
    const skip = (page - 1) * limit;
    const qb = this.reviewsRepo
      .createQueryBuilder('review')
      .leftJoinAndSelect('review.reviewer', 'reviewer')
      .leftJoinAndSelect('review.captain', 'captain')
      .leftJoinAndSelect('review.boat', 'boat')
      .leftJoinAndSelect('review.passenger', 'passenger')
      .leftJoinAndSelect('review.trip', 'trip');

    if (type) {
      qb.andWhere('review.review_type = :type', { type });
    }

    if (search) {
      qb.andWhere(
        '(LOWER(reviewer.name) LIKE LOWER(:search) OR LOWER(captain.name) LIKE LOWER(:search) OR LOWER(passenger.name) LIKE LOWER(:search))',
        { search: `%${search}%` },
      );
    }

    const [reviews, total] = await qb
      .orderBy('review.createdAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return {
      data: reviews,
      pagination: this.buildPagination(page, limit, total),
    };
  }

  async getReviewStats() {
    const { today, weekAgo, monthAgo } = this.getStatsDateThresholds();
    const [
      totalPassengerReviews,
      totalCaptainReviews,
      captainAverage,
      boatAverage,
      passengerAverage,
      newToday,
      newThisWeek,
      newThisMonth,
      captainRatingDistribution,
    ] = await Promise.all([
      this.reviewsRepo.count({
        where: { reviewType: ReviewType.PASSENGER_TO_CAPTAIN },
      }),
      this.reviewsRepo.count({
        where: { reviewType: ReviewType.CAPTAIN_TO_PASSENGER },
      }),
      this.getAverageReviewRating(
        'ROUND(AVG(r.rating)::numeric, 2)',
        ReviewType.PASSENGER_TO_CAPTAIN,
      ),
      this.getAverageReviewRating('ROUND(AVG(r.boat_rating)::numeric, 2)'),
      this.getAverageReviewRating(
        'ROUND(AVG(r.passenger_rating)::numeric, 2)',
        ReviewType.CAPTAIN_TO_PASSENGER,
      ),
      this.reviewsRepo.count({
        where: { createdAt: MoreThan(today) },
      }),
      this.reviewsRepo.count({
        where: { createdAt: MoreThan(weekAgo) },
      }),
      this.reviewsRepo.count({
        where: { createdAt: MoreThan(monthAgo) },
      }),
      this.getCaptainRatingDistribution(),
    ]);

    return {
      total: totalPassengerReviews + totalCaptainReviews,
      passengerToCapitain: totalPassengerReviews,
      captainToPassenger: totalCaptainReviews,
      averages: {
        captain: captainAverage,
        boat: boatAverage,
        passenger: passengerAverage,
      },
      captainRatingDistribution,
      newToday,
      newThisWeek,
      newThisMonth,
    };
  }

  async getReviewDetails(id: string) {
    const review = await this.reviewsRepo.findOne({
      where: { id },
      relations: ['reviewer', 'captain', 'boat', 'passenger', 'trip'],
    });

    if (!review) {
      throw new NotFoundException('Avaliação não encontrada');
    }

    return review;
  }

  async deleteReview(id: string) {
    const review = await this.findReviewOrThrow(id);

    await this.reviewsRepo.delete(id);

    // Recalcular ratings após remoção
    if (review.captainId) {
      await this.refreshCaptainRating(review.captainId);
    }

    if (review.boatId) {
      await this.refreshBoatRating(review.boatId);
    }

    if (review.passengerId) {
      await this.refreshPassengerRating(review.passengerId);
    }

    return { message: 'Avaliação removida e ratings recalculados com sucesso' };
  }

  // ==================== EMBARCAÇÕES ====================

  async getAllBoats(
    page: number,
    limit: number,
    verified?: string,
    search?: string,
  ) {
    const skip = (page - 1) * limit;
    const qb = this.boatsRepo
      .createQueryBuilder('boat')
      .leftJoinAndSelect('boat.owner', 'owner');

    if (verified === 'true') {
      qb.andWhere('boat.isVerified = true');
    } else if (verified === 'false') {
      qb.andWhere('boat.isVerified = false');
    }

    if (search) {
      qb.andWhere(
        '(LOWER(boat.name) LIKE LOWER(:s) OR LOWER(boat.registrationNum) LIKE LOWER(:s) OR LOWER(owner.name) LIKE LOWER(:s))',
        { s: `%${search}%` },
      );
    }

    qb.orderBy('boat.createdAt', 'DESC').skip(skip).take(limit);

    const [boats, total] = await qb.getManyAndCount();
    return {
      boats: boats.map((boat) => this.serializeAdminBoat(boat)),
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }

  async verifyBoat(id: string, approved: boolean, rejectionReason?: string) {
    const boat = await this.findBoatWithOwnerOrThrow(id);
    const reason = rejectionReason ?? 'Documentação inválida ou incompleta';

    await this.boatsRepo.update(id, {
      isVerified: approved,
      rejectionReason: approved ? null : reason,
      verifiedAt: approved ? new Date() : null,
    });

    // Notificação push ao capitão dono do barco
    if (boat.ownerId) {
      await this.notificationsService.sendToUser(
        boat.ownerId,
        this.buildBoatVerificationNotification(boat, approved, reason),
      );
    }

    const action = approved ? 'aprovada' : 'rejeitada';
    return {
      message: `Embarcação ${action} com sucesso`,
      boatId: id,
      isVerified: approved,
    };
  }

  // ==================== VERIFICAÇÃO DE CAPITÃO ====================

  async verifyCapt(
    id: string,
    verified: boolean,
    rejectionReason?: string,
    adminId = 'admin-legacy-bulk',
  ) {
    await this.findUserOrThrow(id);

    if (!verified && !rejectionReason) {
      throw new BadRequestException('Informe o motivo da rejeição');
    }

    if (verified) {
      return this.documentChangeRequestsService.approvePendingRequestsForUser(
        id,
        adminId,
      );
    }

    return this.documentChangeRequestsService.rejectPendingRequestsForUser(
      id,
      adminId,
      rejectionReason,
    );
  }

  async getPendingVerifications(): Promise<PendingVerificationsPayload> {
    const [reviewPendingBoats, reviewPendingCaptains] = await Promise.all([
      this.boatsRepo.find({
        where: { isVerified: false, rejectionReason: IsNull() },
        relations: ['owner'],
        order: { createdAt: 'ASC' },
        take: 50,
      }),
      this.documentChangeRequestsService.getPendingCaptainSummaries(50),
    ]);

    return buildPendingVerificationsPayload(
      reviewPendingBoats,
      reviewPendingCaptains,
    );
  }

  // ==================== NOTIFICAÇÕES ADMIN (badge do header) ====================

  /**
   * Retorna os alertas pendentes de acção para o badge do header do painel admin.
   * Inclui: SOS activos, verificações pendentes (barcos + capitães), viagens novas (últimas 24h).
   */
  async getAdminNotifications(): Promise<AdminNotificationsPayload> {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [
      notificationSosAlerts,
      notificationPendingBoats,
      notificationPendingCaptains,
      notificationNewTrips,
    ] = await Promise.all([
      this.sosRepo.find({
        where: { status: SosAlertStatus.ACTIVE },
        relations: ['user'],
        order: { createdAt: 'DESC' },
        take: 5,
      }),
      this.boatsRepo.find({
        where: { isVerified: false, rejectionReason: IsNull() },
        relations: ['owner'],
        order: { createdAt: 'DESC' },
        take: 5,
      }),
      this.documentChangeRequestsService.getPendingCaptainSummaries(5),
      this.tripsRepo.find({
        where: { createdAt: MoreThan(since24h) },
        relations: ['captain'],
        order: { createdAt: 'DESC' },
        take: 5,
      }),
    ]);

    return buildAdminNotificationsPayload({
      sosAlerts: notificationSosAlerts,
      pendingBoats: notificationPendingBoats,
      pendingCaptains: notificationPendingCaptains,
      newTrips: notificationNewTrips,
    });
  }

  // ==================== GAMIFICATION (ADMIN) ====================

  async getAdminGamificationStats() {
    const leaderboard = await this.gamificationService.getLeaderboard(10);
    const { today, weekAgo, monthAgo } = this.getStatsDateThresholds();

    // Distribuição por nível
    const [marinheiro, navegador, capitao, almirante] = await Promise.all([
      this.usersRepo.count({ where: { level: LoyaltyLevel.MARINHEIRO } }),
      this.usersRepo.count({ where: { level: LoyaltyLevel.NAVEGADOR } }),
      this.usersRepo.count({ where: { level: LoyaltyLevel.CAPITAO } }),
      this.usersRepo.count({ where: { level: LoyaltyLevel.ALMIRANTE } }),
    ]);

    // Total de NavegaCoins distribuídos e por acção
    const totalPointsRow = await this.usersRepo
      .createQueryBuilder('u')
      .select('COALESCE(SUM(u.total_points), 0)', 'total')
      .getRawOne<{ total: string | null }>();

    const totalKmRow = await this.usersRepo
      .createQueryBuilder('u')
      .select('COALESCE(SUM(u.total_km_traveled), 0)', 'total')
      .getRawOne<{ total: string | null }>();

    // Referrals: total, convertidos, pendentes
    const [totalUsers, newToday, newThisWeek, newThisMonth] = await Promise.all(
      [
        this.usersRepo.count({
          where: [{ role: UserRole.PASSENGER }, { role: UserRole.CAPTAIN }],
        }),
        this.usersRepo.count({
          where: [
            { role: UserRole.PASSENGER, createdAt: MoreThan(today) },
            { role: UserRole.CAPTAIN, createdAt: MoreThan(today) },
          ],
        }),
        this.usersRepo.count({
          where: [
            { role: UserRole.PASSENGER, createdAt: MoreThan(weekAgo) },
            { role: UserRole.CAPTAIN, createdAt: MoreThan(weekAgo) },
          ],
        }),
        this.usersRepo.count({
          where: [
            { role: UserRole.PASSENGER, createdAt: MoreThan(monthAgo) },
            { role: UserRole.CAPTAIN, createdAt: MoreThan(monthAgo) },
          ],
        }),
      ],
    );

    return {
      overview: {
        totalNavegaCoinsDistributed: Number(totalPointsRow?.total || 0),
        totalKmTraveled: Number(totalKmRow?.total || 0),
        totalEligibleUsers: totalUsers,
        newUsersToday: newToday,
        newUsersThisWeek: newThisWeek,
        newUsersThisMonth: newThisMonth,
      },
      levelDistribution: {
        Marinheiro: marinheiro,
        Navegador: navegador,
        Capitão: capitao,
        Almirante: almirante,
      },
      leaderboard,
    };
  }

  // ── Helpers de data ─────────────────────────────────────────────────────────

  private startOfToday(): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private buildDayRange(daysAgo: number) {
    const start = new Date();
    start.setDate(start.getDate() - daysAgo);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setHours(23, 59, 59, 999);

    return { start, end, label: this.formatDayLabel(start) };
  }

  private formatDayLabel(date: Date): string {
    return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  private getRevenuePeriodStart(period: 'today' | 'week' | 'month'): Date {
    const startDate = new Date();

    if (period === 'today') {
      startDate.setHours(0, 0, 0, 0);
      return startDate;
    }

    if (period === 'week') {
      startDate.setDate(startDate.getDate() - 7);
      return startDate;
    }

    startDate.setMonth(startDate.getMonth() - 1);
    return startDate;
  }

  private daysAgo(days: number): Date {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d;
  }
}
