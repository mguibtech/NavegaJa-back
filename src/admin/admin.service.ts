import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, Between } from 'typeorm';
import { User, UserRole } from '../users/user.entity';
import { Trip, TripStatus } from '../trips/trip.entity';
import { Shipment, ShipmentStatus } from '../shipments/shipment.entity';
import { SosAlert, SosAlertStatus } from '../safety/sos-alert.entity';
import { SafetyChecklist } from '../safety/safety-checklist.entity';
import { Booking, BookingStatus, PaymentStatus } from '../bookings/booking.entity';
import { Coupon } from '../coupons/coupon.entity';

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
    @InjectRepository(Coupon)
    private couponsRepo: Repository<Coupon>,
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

    const activities: any[] = [];

    // ==================== VIAGENS ====================
    recentTrips.forEach((trip) => {
      const statusInfo = this.getTripStatusInfo(trip.status);
      activities.push({
        type: `trip_${trip.status}`,
        category: 'trip',
        description: statusInfo.description(trip),
        user: trip.captain?.name || 'Capitão',
        details: {
          tripId: trip.id,
          route: `${trip.origin} → ${trip.destination}`,
          departureAt: trip.departureAt,
          price: Number(trip.price),
          totalSeats: trip.totalSeats,
          boat: trip.boat?.name,
          status: trip.status,
        },
        icon: statusInfo.icon,
        color: statusInfo.color,
        link: `/admin/trips/${trip.id}`,
        timestamp: trip.createdAt,
      });
    });

    // ==================== ENCOMENDAS ====================
    recentShipments.forEach((shipment) => {
      const statusInfo = this.getShipmentStatusInfo(shipment.status);
      activities.push({
        type: `shipment_${shipment.status}`,
        category: 'shipment',
        description: statusInfo.description(shipment),
        user: shipment.sender?.name || 'Remetente',
        details: {
          shipmentId: shipment.id,
          trackingCode: shipment.trackingCode,
          route: shipment.trip ? `${shipment.trip.origin} → ${shipment.trip.destination}` : 'Rota não disponível',
          weight: Number(shipment.weight),
          price: Number(shipment.totalPrice),
          status: shipment.status,
        },
        icon: statusInfo.icon,
        color: statusInfo.color,
        link: `/admin/shipments/${shipment.id}`,
        timestamp: shipment.createdAt,
      });
    });

    // ==================== USUÁRIOS ====================
    recentUsers.forEach((user) => {
      const roleInfo = this.getUserRoleInfo(user.role);
      activities.push({
        type: 'user_registered',
        category: 'user',
        description: `Novo ${roleInfo.label}: ${user.name}`,
        user: user.name,
        details: {
          userId: user.id,
          email: user.email,
          phone: user.phone,
          role: user.role,
        },
        icon: roleInfo.icon,
        color: roleInfo.color,
        link: `/admin/users/${user.id}`,
        timestamp: user.createdAt,
      });
    });

    // ==================== RESERVAS ====================
    recentBookings.forEach((booking) => {
      const statusInfo = this.getBookingStatusInfo(booking.status);
      const paymentInfo = booking.paymentStatus === PaymentStatus.PAID ? ' (Pago)' : '';
      activities.push({
        type: `booking_${booking.status}`,
        category: 'booking',
        description: `${statusInfo.action}: ${booking.trip?.origin || '?'} → ${booking.trip?.destination || '?'}${paymentInfo}`,
        user: booking.passenger?.name || 'Passageiro',
        details: {
          bookingId: booking.id,
          route: booking.trip ? `${booking.trip.origin} → ${booking.trip.destination}` : 'Rota não disponível',
          seats: booking.seats,
          totalPrice: Number(booking.totalPrice),
          status: booking.status,
          paymentStatus: booking.paymentStatus,
          paymentMethod: booking.paymentMethod,
        },
        icon: statusInfo.icon,
        color: statusInfo.color,
        link: `/admin/bookings/${booking.id}`,
        timestamp: booking.createdAt,
      });
    });

    // ==================== CUPONS ====================
    recentCoupons.forEach((coupon) => {
      const typeLabel = coupon.type === 'percentage' ? `${Number(coupon.value)}% OFF` : `R$ ${Number(coupon.value)} OFF`;
      activities.push({
        type: 'coupon_created',
        category: 'coupon',
        description: `Cupom criado: ${coupon.code}`,
        user: 'Admin',
        details: {
          couponId: coupon.id,
          code: coupon.code,
          type: coupon.type,
          value: Number(coupon.value),
          typeLabel,
          applicableTo: coupon.applicableTo,
          usageLimit: coupon.usageLimit,
          usageCount: coupon.usageCount,
          validUntil: coupon.validUntil,
        },
        icon: '🎟️',
        color: 'purple',
        link: `/admin/coupons/${coupon.id}`,
        timestamp: coupon.createdAt,
      });
    });

    // ==================== ALERTAS SOS ====================
    recentSosAlerts.forEach((sos) => {
      const isActive = sos.status === SosAlertStatus.ACTIVE;
      activities.push({
        type: `sos_${sos.status}`,
        category: 'sos',
        description: isActive ? `🆘 Alerta SOS acionado` : `✅ Alerta SOS resolvido`,
        user: sos.user?.name || 'Usuário',
        details: {
          sosId: sos.id,
          latitude: sos.latitude,
          longitude: sos.longitude,
          status: sos.status,
          description: sos.description,
          resolvedAt: sos.resolvedAt,
        },
        icon: isActive ? '🆘' : '✅',
        color: isActive ? 'red' : 'green',
        link: `/admin/safety/sos/${sos.id}`,
        timestamp: sos.createdAt,
      });
    });

    // ==================== CHECKLISTS COMPLETADOS ====================
    recentChecklists.forEach((checklist) => {
      activities.push({
        type: 'checklist_completed',
        category: 'safety',
        description: `✅ Checklist de segurança completado`,
        user: checklist.captain?.name || 'Capitão',
        details: {
          checklistId: checklist.id,
          tripId: checklist.tripId,
          route: checklist.trip ? `${checklist.trip.origin} → ${checklist.trip.destination}` : 'Rota não disponível',
          completedAt: checklist.completedAt,
        },
        icon: '✅',
        color: 'green',
        link: `/admin/safety/checklists/${checklist.id}`,
        timestamp: checklist.completedAt || checklist.createdAt,
      });
    });

    // Ordenar por timestamp e limitar
    return activities
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  // Helper methods para informações de status
  private getTripStatusInfo(status: TripStatus) {
    const statusMap: Record<TripStatus, { description: (trip: Trip) => string; icon: string; color: string }> = {
      [TripStatus.SCHEDULED]: {
        description: (trip: Trip) => `Nova viagem: ${trip.origin} → ${trip.destination}`,
        icon: '🚤',
        color: 'blue'
      },
      [TripStatus.IN_PROGRESS]: {
        description: (trip: Trip) => `Viagem iniciada: ${trip.origin} → ${trip.destination}`,
        icon: '⛵',
        color: 'orange'
      },
      [TripStatus.COMPLETED]: {
        description: (trip: Trip) => `Viagem concluída: ${trip.origin} → ${trip.destination}`,
        icon: '🏁',
        color: 'green'
      },
      [TripStatus.CANCELLED]: {
        description: (trip: Trip) => `Viagem cancelada: ${trip.origin} → ${trip.destination}`,
        icon: '❌',
        color: 'red'
      },
    };
    return statusMap[status] || statusMap[TripStatus.SCHEDULED];
  }

  private getShipmentStatusInfo(status: ShipmentStatus) {
    const statusMap: Record<ShipmentStatus, { description: (shipment: Shipment) => string; icon: string; color: string }> = {
      [ShipmentStatus.PENDING]: {
        description: (shipment: Shipment) => `Nova encomenda: ${shipment.trackingCode}`,
        icon: '📦',
        color: 'blue'
      },
      [ShipmentStatus.PAID]: {
        description: (shipment: Shipment) => `Encomenda paga: ${shipment.trackingCode}`,
        icon: '💰',
        color: 'green'
      },
      [ShipmentStatus.COLLECTED]: {
        description: (shipment: Shipment) => `Encomenda coletada: ${shipment.trackingCode}`,
        icon: '📮',
        color: 'orange'
      },
      [ShipmentStatus.IN_TRANSIT]: {
        description: (shipment: Shipment) => `Encomenda em trânsito: ${shipment.trackingCode}`,
        icon: '🚢',
        color: 'blue'
      },
      [ShipmentStatus.ARRIVED]: {
        description: (shipment: Shipment) => `Encomenda chegou: ${shipment.trackingCode}`,
        icon: '🎯',
        color: 'blue'
      },
      [ShipmentStatus.OUT_FOR_DELIVERY]: {
        description: (shipment: Shipment) => `Saiu para entrega: ${shipment.trackingCode}`,
        icon: '🚚',
        color: 'orange'
      },
      [ShipmentStatus.DELIVERED]: {
        description: (shipment: Shipment) => `Encomenda entregue: ${shipment.trackingCode}`,
        icon: '✅',
        color: 'green'
      },
      [ShipmentStatus.CANCELLED]: {
        description: (shipment: Shipment) => `Encomenda cancelada: ${shipment.trackingCode}`,
        icon: '❌',
        color: 'red'
      },
    };
    return statusMap[status] || statusMap[ShipmentStatus.PENDING];
  }

  private getBookingStatusInfo(status: BookingStatus) {
    const statusMap = {
      [BookingStatus.PENDING]: {
        action: 'Nova reserva',
        icon: '🎫',
        color: 'blue'
      },
      [BookingStatus.CONFIRMED]: {
        action: 'Reserva confirmada',
        icon: '✅',
        color: 'green'
      },
      [BookingStatus.CHECKED_IN]: {
        action: 'Check-in realizado',
        icon: '🎟️',
        color: 'purple'
      },
      [BookingStatus.COMPLETED]: {
        action: 'Viagem concluída',
        icon: '🏁',
        color: 'green'
      },
      [BookingStatus.CANCELLED]: {
        action: 'Reserva cancelada',
        icon: '❌',
        color: 'red'
      },
    };
    return statusMap[status] || statusMap[BookingStatus.PENDING];
  }

  private getUserRoleInfo(role: UserRole) {
    const roleMap = {
      [UserRole.PASSENGER]: { label: 'passageiro', icon: '👤', color: 'gray' },
      [UserRole.CAPTAIN]: { label: 'capitão', icon: '⚓', color: 'blue' },
      [UserRole.ADMIN]: { label: 'administrador', icon: '👑', color: 'purple' },
    };
    return roleMap[role] || roleMap[UserRole.PASSENGER];
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
