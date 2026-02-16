import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, Between } from 'typeorm';
import { User, UserRole } from '../users/user.entity';
import { Trip, TripStatus } from '../trips/trip.entity';
import { Shipment, ShipmentStatus } from '../shipments/shipment.entity';
import { SosAlert, SosAlertStatus } from '../safety/sos-alert.entity';
import { SafetyChecklist } from '../safety/safety-checklist.entity';
import { Booking, BookingStatus, PaymentStatus } from '../bookings/booking.entity';

@Injectable()
export class AdminService {
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
  ) {}

  // ==================== USUÁRIOS ====================

  async getAllUsers(page: number, limit: number, role?: UserRole, search?: string) {
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
    const sanitizedUsers = users.map(({ passwordHash, ...user }) => user);

    return {
      data: sanitizedUsers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getUserStats() {
    const total = await this.usersRepo.count();

    // Por role
    const byRole = {
      passenger: await this.usersRepo.count({ where: { role: UserRole.PASSENGER } }),
      captain: await this.usersRepo.count({ where: { role: UserRole.CAPTAIN } }),
      admin: await this.usersRepo.count({ where: { role: UserRole.ADMIN } }),
    };

    // Novos usuários
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    const newToday = await this.usersRepo.count({
      where: { createdAt: MoreThan(today) },
    });

    const newThisWeek = await this.usersRepo.count({
      where: { createdAt: MoreThan(weekAgo) },
    });

    const newThisMonth = await this.usersRepo.count({
      where: { createdAt: MoreThan(monthAgo) },
    });

    return {
      total,
      byRole,
      newToday,
      newThisWeek,
      newThisMonth,
      activeUsers: total, // TODO: implementar lógica de usuários ativos (último acesso)
    };
  }

  async getUserDetails(id: string) {
    const user = await this.usersRepo.findOne({
      where: { id },
      relations: ['boats'],
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    // Estatísticas do usuário
    const stats = {
      totalTrips: 0,
      totalShipments: 0,
      totalSpent: 0,
    };

    if (user.role === UserRole.CAPTAIN) {
      stats.totalTrips = await this.tripsRepo.count({ where: { captainId: id } });
    }

    if (user.role === UserRole.PASSENGER) {
      const bookings = await this.bookingsRepo.find({ where: { passengerId: id } });
      stats.totalSpent = bookings.reduce((sum, b) => sum + Number(b.totalPrice || 0), 0);
    }

    stats.totalShipments = await this.shipmentsRepo.count({ where: { senderId: id } });

    const { passwordHash, ...sanitizedUser } = user;

    return {
      ...sanitizedUser,
      stats,
    };
  }

  async updateUserRole(id: string, role: UserRole) {
    const user = await this.usersRepo.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    user.role = role;
    await this.usersRepo.save(user);

    const { passwordHash, ...sanitizedUser } = user;
    return sanitizedUser;
  }

  async updateUserStatus(id: string, active: boolean) {
    const user = await this.usersRepo.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    // TODO: adicionar campo 'active' na entidade User
    // Por enquanto, retornar mensagem
    return {
      message: `Usuário ${active ? 'ativado' : 'desativado'} com sucesso`,
      userId: id,
      active,
    };
  }

  async deleteUser(id: string) {
    const user = await this.usersRepo.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

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

  async getAllTrips(page: number, limit: number, status?: string, captainId?: string) {
    const skip = (page - 1) * limit;
    const qb = this.tripsRepo
      .createQueryBuilder('trip')
      .leftJoinAndSelect('trip.captain', 'captain')
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
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getTripStats() {
    const total = await this.tripsRepo.count();

    // Por status
    const byStatus = {
      scheduled: await this.tripsRepo.count({ where: { status: TripStatus.SCHEDULED } }),
      in_progress: await this.tripsRepo.count({ where: { status: TripStatus.IN_PROGRESS } }),
      completed: await this.tripsRepo.count({ where: { status: TripStatus.COMPLETED } }),
      cancelled: await this.tripsRepo.count({ where: { status: TripStatus.CANCELLED } }),
    };

    // Viagens por período
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    const todayTrips = await this.tripsRepo.count({
      where: { departureAt: MoreThan(today) },
    });

    const thisWeekTrips = await this.tripsRepo.count({
      where: { departureAt: MoreThan(weekAgo) },
    });

    const thisMonthTrips = await this.tripsRepo.count({
      where: { departureAt: MoreThan(monthAgo) },
    });

    // Receita (baseado em reservas)
    const bookings = await this.bookingsRepo.find();
    const totalRevenue = bookings.reduce((sum, b) => sum + Number(b.totalPrice || 0), 0);

    const avgPrice = total > 0 ? totalRevenue / total : 0;

    return {
      total,
      byStatus,
      todayTrips,
      thisWeekTrips,
      thisMonthTrips,
      totalRevenue: Number(totalRevenue.toFixed(2)),
      avgPrice: Number(avgPrice.toFixed(2)),
    };
  }

  async updateTripStatus(id: string, status: string) {
    const trip = await this.tripsRepo.findOne({ where: { id } });
    if (!trip) {
      throw new NotFoundException('Viagem não encontrada');
    }

    trip.status = status as TripStatus;
    await this.tripsRepo.save(trip);

    return trip;
  }

  async deleteTrip(id: string) {
    const trip = await this.tripsRepo.findOne({ where: { id } });
    if (!trip) {
      throw new NotFoundException('Viagem não encontrada');
    }

    if (trip.status === TripStatus.IN_PROGRESS) {
      throw new BadRequestException('Não é possível deletar viagem em andamento');
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
      .leftJoinAndSelect('shipment.sender', 'sender')
      .leftJoinAndSelect('shipment.trip', 'trip')
      .leftJoinAndSelect('trip.captain', 'captain');

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
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getShipmentStats() {
    const total = await this.shipmentsRepo.count();

    // Por status
    const byStatus = {
      pending: await this.shipmentsRepo.count({
        where: { status: ShipmentStatus.PENDING },
      }),
      collected: await this.shipmentsRepo.count({
        where: { status: ShipmentStatus.COLLECTED },
      }),
      in_transit: await this.shipmentsRepo.count({
        where: { status: ShipmentStatus.IN_TRANSIT },
      }),
      delivered: await this.shipmentsRepo.count({
        where: { status: ShipmentStatus.DELIVERED },
      }),
      cancelled: await this.shipmentsRepo.count({
        where: { status: ShipmentStatus.CANCELLED },
      }),
    };

    // Por período
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    const todayShipments = await this.shipmentsRepo.count({
      where: { createdAt: MoreThan(today) },
    });

    const thisWeekShipments = await this.shipmentsRepo.count({
      where: { createdAt: MoreThan(weekAgo) },
    });

    const thisMonthShipments = await this.shipmentsRepo.count({
      where: { createdAt: MoreThan(monthAgo) },
    });

    // Receita
    const shipments = await this.shipmentsRepo.find();
    const totalRevenue = shipments.reduce((sum, s) => sum + Number(s.totalPrice || 0), 0);
    const avgPrice = total > 0 ? totalRevenue / total : 0;

    return {
      total,
      byStatus,
      todayShipments,
      thisWeekShipments,
      thisMonthShipments,
      totalRevenue: Number(totalRevenue.toFixed(2)),
      avgPrice: Number(avgPrice.toFixed(2)),
    };
  }

  async updateShipmentStatus(id: string, status: string) {
    const shipment = await this.shipmentsRepo.findOne({ where: { id } });
    if (!shipment) {
      throw new NotFoundException('Encomenda não encontrada');
    }

    shipment.status = status as ShipmentStatus;
    await this.shipmentsRepo.save(shipment);

    return shipment;
  }

  // ==================== DASHBOARD OVERVIEW ====================

  async getDashboardOverview() {
    const [users, trips, shipments, sosAlerts] = await Promise.all([
      this.getUserStats(),
      this.getTripStats(),
      this.getShipmentStats(),
      this.getSosStats(),
    ]);

    const revenue = {
      today: await this.getRevenueByPeriod('today'),
      thisWeek: await this.getRevenueByPeriod('week'),
      thisMonth: await this.getRevenueByPeriod('month'),
    };

    return {
      users: {
        total: users.total,
        newToday: users.newToday,
        activeUsers: users.activeUsers,
      },
      trips: {
        total: trips.total,
        scheduled: trips.byStatus.scheduled,
        inProgress: trips.byStatus.in_progress,
        todayTrips: trips.todayTrips,
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
    const active = await this.sosRepo.count({ where: { status: SosAlertStatus.ACTIVE } });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const totalToday = await this.sosRepo.count({
      where: { createdAt: MoreThan(today) },
    });

    const totalThisWeek = await this.sosRepo.count({
      where: { createdAt: MoreThan(weekAgo) },
    });

    return {
      active,
      totalToday,
      totalThisWeek,
    };
  }

  private async getRevenueByPeriod(period: 'today' | 'week' | 'month'): Promise<number> {
    const now = new Date();
    let startDate: Date;

    if (period === 'today') {
      startDate = new Date(now);
      startDate.setHours(0, 0, 0, 0);
    } else if (period === 'week') {
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 7);
    } else {
      startDate = new Date(now);
      startDate.setMonth(startDate.getMonth() - 1);
    }

    const [bookings, shipments] = await Promise.all([
      this.bookingsRepo.find({ where: { createdAt: MoreThan(startDate) } }),
      this.shipmentsRepo.find({ where: { createdAt: MoreThan(startDate) } }),
    ]);

    const bookingsRevenue = bookings.reduce((sum, b) => sum + Number(b.totalPrice || 0), 0);
    const shipmentsRevenue = shipments.reduce((sum, s) => sum + Number(s.totalPrice || 0), 0);

    return Number((bookingsRevenue + shipmentsRevenue).toFixed(2));
  }

  async getRecentActivity(limit: number) {
    // TODO: Implementar sistema de logs/auditoria
    // Por enquanto, retornar atividades simuladas baseadas em criações recentes

    const [recentTrips, recentShipments, recentUsers] = await Promise.all([
      this.tripsRepo.find({
        order: { createdAt: 'DESC' },
        take: 10,
        relations: ['captain'],
      }),
      this.shipmentsRepo.find({
        order: { createdAt: 'DESC' },
        take: 10,
        relations: ['sender'],
      }),
      this.usersRepo.find({
        order: { createdAt: 'DESC' },
        take: 10,
      }),
    ]);

    const activities: any[] = [];

    recentTrips.forEach((trip) => {
      activities.push({
        type: 'trip_created',
        description: `Nova viagem: ${trip.origin} → ${trip.destination}`,
        user: trip.captain?.name || 'Capitão',
        timestamp: trip.createdAt,
      });
    });

    recentShipments.forEach((shipment) => {
      activities.push({
        type: 'shipment_created',
        description: `Nova encomenda: ${shipment.trackingCode}`,
        user: shipment.sender?.name || 'Remetente',
        timestamp: shipment.createdAt,
      });
    });

    recentUsers.forEach((user) => {
      activities.push({
        type: 'user_registered',
        description: `Novo usuário: ${user.name}`,
        user: user.name,
        timestamp: user.createdAt,
      });
    });

    // Ordenar por timestamp e limitar
    return activities
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  // ==================== SEGURANÇA ====================

  async getAllChecklists(incomplete?: boolean) {
    const where: any = {};

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
    const complete = await this.checklistsRepo.count({ where: { allItemsChecked: true } });
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
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getBookingsStats() {
    const total = await this.bookingsRepo.count();

    // Por status
    const pending = await this.bookingsRepo.count({ where: { status: BookingStatus.PENDING } });
    const confirmed = await this.bookingsRepo.count({ where: { status: BookingStatus.CONFIRMED } });
    const checkedIn = await this.bookingsRepo.count({ where: { status: BookingStatus.CHECKED_IN } });
    const completed = await this.bookingsRepo.count({ where: { status: BookingStatus.COMPLETED } });
    const cancelled = await this.bookingsRepo.count({ where: { status: BookingStatus.CANCELLED } });

    // Por status de pagamento
    const paymentPending = await this.bookingsRepo.count({ where: { paymentStatus: PaymentStatus.PENDING } });
    const paid = await this.bookingsRepo.count({ where: { paymentStatus: PaymentStatus.PAID } });

    // Receita total
    const allBookings = await this.bookingsRepo.find();
    const totalRevenue = allBookings.reduce((sum, b) => sum + Number(b.totalPrice || 0), 0);

    // Receita confirmada (apenas pagamentos confirmados)
    const paidBookings = await this.bookingsRepo.find({ where: { paymentStatus: PaymentStatus.PAID } });
    const confirmedRevenue = paidBookings.reduce((sum, b) => sum + Number(b.totalPrice || 0), 0);

    // Estatísticas de período
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    const newToday = await this.bookingsRepo.count({
      where: { createdAt: MoreThan(today) },
    });

    const newThisWeek = await this.bookingsRepo.count({
      where: { createdAt: MoreThan(weekAgo) },
    });

    const newThisMonth = await this.bookingsRepo.count({
      where: { createdAt: MoreThan(monthAgo) },
    });

    return {
      total,
      byStatus: {
        pending,
        confirmed,
        checkedIn,
        completed,
        cancelled,
      },
      byPaymentStatus: {
        pending: paymentPending,
        paid,
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

  async updateBookingStatus(id: string, status: string) {
    const booking = await this.bookingsRepo.findOne({ where: { id } });

    if (!booking) {
      throw new NotFoundException('Reserva não encontrada');
    }

    // Validar status
    const validStatuses = ['pending', 'confirmed', 'checked_in', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      throw new BadRequestException(`Status inválido. Use: ${validStatuses.join(', ')}`);
    }

    booking.status = status as any;

    return this.bookingsRepo.save(booking);
  }

  async deleteBooking(id: string) {
    const booking = await this.bookingsRepo.findOne({ where: { id } });

    if (!booking) {
      throw new NotFoundException('Reserva não encontrada');
    }

    await this.bookingsRepo.delete(id);

    return { message: 'Reserva deletada com sucesso' };
  }
}
