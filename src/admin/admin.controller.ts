import {
  Controller,
  Get,
  Patch,
  Delete,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
  Request,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, Roles } from '../common/roles.guard';
import { AdminService } from './admin.service';
import { type AdminActivity } from './admin.activity.types';
import { LocationsService } from '../locations/locations.service';
import { CommunityLocationStatus } from '../locations/community-location.entity';
import { UserRole } from '../users/user.entity';
import { TripStatus } from '../trips/trip.entity';
import { BookingStatus } from '../bookings/booking.entity';
import { ShipmentStatus } from '../shipments/shipment.entity';
import {
  NotificationsService,
  BroadcastFilters,
} from '../notifications/notifications.service';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsEnum,
  IsEmail,
  MinLength,
  Length,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class CreateCaptainDto {
  @ApiProperty({
    example: 'Carlos Navegador',
    description: 'Nome completo do capitão',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: '92992001099',
    description: 'Número de telefone (login mobile)',
  })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({ example: 'carlos@email.com', required: false })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({
    example: '123456',
    description: 'Senha provisória (mínimo 6 caracteres)',
  })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: 'Manaus' })
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiPropertyOptional({ example: 'AM' })
  @IsString()
  @Length(2, 2)
  @IsOptional()
  state?: string;
}

class BroadcastNotificationDto {
  @ApiProperty({
    example: '🎉 Festa de Parintins',
    description: 'Título da notificação',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    example: 'Cupom especial 20% OFF nas viagens para Parintins!',
    description: 'Corpo da notificação',
  })
  @IsString()
  @IsNotEmpty()
  body: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['Parintins', 'Manaus'],
    description: 'Filtrar por cidades (vazio = todas)',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  cities?: string[];

  @ApiPropertyOptional({
    enum: UserRole,
    isArray: true,
    example: [UserRole.PASSENGER],
    description: 'Filtrar por roles (vazio = todos)',
  })
  @IsOptional()
  @IsArray()
  @IsEnum(UserRole, { each: true })
  roles?: UserRole[];

  @ApiPropertyOptional({
    description: 'Dados extras para o app (deep link, etc)',
    example: { type: 'coupon', couponCode: 'PARINTINS20' },
  })
  @IsOptional()
  data?: Record<string, string>;
}

@ApiTags('Admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@ApiBearerAuth()
export class AdminController {
  constructor(
    private adminService: AdminService,
    private notificationsService: NotificationsService,
    private locationsService: LocationsService,
  ) {}

  // ==================== USUÁRIOS ====================

  @Get('users')
  @ApiOperation({
    summary: 'Listar todos os usuários (Admin)',
    description: 'Lista todos os usuários do sistema com paginação e filtros',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({
    name: 'role',
    required: false,
    enum: UserRole,
    description: 'Filtrar por role',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Buscar por nome, email ou telefone',
  })
  @ApiResponse({ status: 200, description: 'Lista de usuários' })
  async getAllUsers(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('role') role?: UserRole,
    @Query('search') search?: string,
  ) {
    return this.adminService.getAllUsers(page, limit, role, search);
  }

  @Post('captains')
  @ApiOperation({
    summary: 'Criar conta de capitão (Admin)',
    description:
      'Apenas admins podem criar contas de capitão. O capitão receberá login por telefone e senha provisória.',
  })
  async createCaptain(@Body() dto: CreateCaptainDto) {
    return this.adminService.createCaptain(dto);
  }

  @Get('users/stats')
  @ApiOperation({ summary: 'Estatísticas de usuários (Admin)' })
  @ApiResponse({
    status: 200,
    description: 'Estatísticas gerais de usuários',
    schema: {
      example: {
        total: 150,
        byRole: {
          passenger: 120,
          captain: 25,
          admin: 5,
        },
        newToday: 3,
        newThisWeek: 15,
        newThisMonth: 42,
        activeUsers: 135,
      },
    },
  })
  getUserStats() {
    return this.adminService.getUserStats();
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Detalhes completos de um usuário (Admin)' })
  getUserDetails(@Param('id') id: string) {
    return this.adminService.getUserDetails(id);
  }

  @Patch('users/:id/role')
  @ApiOperation({
    summary: 'Alterar role do usuário (Admin)',
    description:
      'Permite promover/rebaixar usuário (passenger ↔ captain ↔ admin)',
  })
  updateUserRole(@Param('id') id: string, @Body('role') role: UserRole) {
    return this.adminService.updateUserRole(id, role);
  }

  @Patch('users/:id/status')
  @ApiOperation({
    summary: 'Ativar/desativar usuário (Admin)',
    description: 'Permite bloquear acesso de um usuário',
  })
  updateUserStatus(@Param('id') id: string, @Body('active') active: boolean) {
    return this.adminService.updateUserStatus(id, active);
  }

  @Delete('users/:id')
  @ApiOperation({
    summary: 'Deletar usuário permanentemente (Admin)',
    description: 'CUIDADO: Esta ação é irreversível',
  })
  deleteUser(@Param('id') id: string) {
    return this.adminService.deleteUser(id);
  }

  // ==================== VIAGENS ====================

  @Get('trips')
  @ApiOperation({
    summary: 'Listar todas as viagens (Admin)',
    description: 'Lista todas as viagens independente do status',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({
    name: 'status',
    required: false,
    type: String,
    description: 'Filtrar por status',
  })
  @ApiQuery({
    name: 'captainId',
    required: false,
    type: String,
    description: 'Filtrar por capitão',
  })
  getAllTrips(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('status') status?: string,
    @Query('captainId') captainId?: string,
  ) {
    return this.adminService.getAllTrips(page, limit, status, captainId);
  }

  @Get('trips/stats')
  @ApiOperation({ summary: 'Estatísticas de viagens (Admin)' })
  @ApiResponse({
    status: 200,
    description: 'Estatísticas gerais de viagens',
    schema: {
      example: {
        total: 250,
        byStatus: {
          scheduled: 45,
          in_progress: 8,
          completed: 180,
          cancelled: 17,
        },
        todayTrips: 5,
        thisWeekTrips: 32,
        thisMonthTrips: 78,
        totalRevenue: 125000.0,
        avgPrice: 52.5,
      },
    },
  })
  getTripStats() {
    return this.adminService.getTripStats();
  }

  @Patch('trips/:id/status')
  @ApiOperation({
    summary: 'Alterar status de qualquer viagem (Admin)',
    description: 'Admin pode forçar mudança de status',
  })
  updateTripStatus(
    @Param('id') id: string,
    @Body('status') status: TripStatus,
  ) {
    return this.adminService.updateTripStatus(id, status);
  }

  @Delete('trips/:id')
  @ApiOperation({ summary: 'Deletar viagem (Admin)' })
  deleteTrip(@Param('id') id: string) {
    return this.adminService.deleteTrip(id);
  }

  // ==================== ENCOMENDAS ====================

  @Get('shipments')
  @ApiOperation({
    summary: 'Listar todas as encomendas (Admin)',
    description: 'Lista todas as encomendas do sistema',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({
    name: 'status',
    required: false,
    type: String,
    description: 'Filtrar por status',
  })
  @ApiQuery({
    name: 'trackingCode',
    required: false,
    type: String,
    description: 'Buscar por código',
  })
  getAllShipments(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('status') status?: string,
    @Query('trackingCode') trackingCode?: string,
  ) {
    return this.adminService.getAllShipments(page, limit, status, trackingCode);
  }

  @Get('shipments/stats')
  @ApiOperation({ summary: 'Estatísticas de encomendas (Admin)' })
  @ApiResponse({
    status: 200,
    description: 'Estatísticas gerais de encomendas',
    schema: {
      example: {
        total: 520,
        byStatus: {
          pending: 45,
          collected: 12,
          in_transit: 25,
          delivered: 420,
          cancelled: 18,
        },
        todayShipments: 8,
        thisWeekShipments: 52,
        thisMonthShipments: 180,
        totalRevenue: 23400.0,
        avgPrice: 45.0,
      },
    },
  })
  getShipmentStats() {
    return this.adminService.getShipmentStats();
  }

  @Patch('shipments/:id/status')
  @ApiOperation({
    summary: 'Alterar status de encomenda manualmente (Admin)',
    description: 'Admin pode forçar mudança de status em casos especiais',
  })
  updateShipmentStatus(
    @Param('id') id: string,
    @Body('status') status: ShipmentStatus,
  ) {
    return this.adminService.updateShipmentStatus(id, status);
  }

  // ==================== DASHBOARD OVERVIEW ====================

  @Get('dashboard/overview')
  @Get('dashboard')
  @ApiOperation({
    summary: 'Overview geral do sistema (Admin)',
    description: 'Resumo com todos os números principais do dashboard',
  })
  @ApiResponse({
    status: 200,
    description: 'Dados gerais do dashboard',
    schema: {
      example: {
        users: {
          total: 150,
          newToday: 3,
          activeUsers: 135,
        },
        trips: {
          total: 250,
          scheduled: 45,
          inProgress: 8,
          todayTrips: 5,
        },
        shipments: {
          total: 520,
          pending: 45,
          inTransit: 25,
          todayShipments: 8,
        },
        sosAlerts: {
          active: 2,
          totalToday: 5,
          totalThisWeek: 12,
        },
        revenue: {
          today: 2340.0,
          thisWeek: 15680.0,
          thisMonth: 58900.0,
        },
        recentActivity: [],
      },
    },
  })
  getDashboardOverview() {
    return this.adminService.getDashboardOverview();
  }

  @Get('dashboard/revenue')
  @ApiOperation({
    summary: 'Receita diária por período (Admin)',
    description:
      'Retorna receita de bookings + encomendas agrupada por dia para o período seleccionado',
  })
  @ApiQuery({
    name: 'period',
    required: false,
    enum: ['7d', '30d', '90d'],
    example: '30d',
  })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        period: '30d',
        labels: ['01/03', '02/03'],
        bookings: [1200.0, 850.5],
        shipments: [340.0, 120.0],
        total: [1540.0, 970.5],
        totals: { bookings: 2050.5, shipments: 460.0, combined: 2510.5 },
      },
    },
  })
  getDashboardRevenue(@Query('period') period: '7d' | '30d' | '90d' = '30d') {
    const validPeriods = ['7d', '30d', '90d'];
    if (!validPeriods.includes(period)) period = '30d';
    return this.adminService.getRevenueChart(period);
  }

  @Get('dashboard/chart')
  @ApiOperation({
    summary: 'Dados do gráfico por dia (Admin)',
    description:
      'Retorna contagem de reservas, usuários e viagens agrupados por dia',
  })
  @ApiQuery({ name: 'days', required: false, type: Number, example: 7 })
  getDashboardChart(
    @Query('days', new DefaultValuePipe(7), ParseIntPipe) days: number,
  ) {
    return this.adminService.getDashboardChart(days);
  }

  @Get('dashboard/activity')
  @ApiOperation({
    summary: 'Atividade recente do sistema (Admin)',
    description: 'Últimas 50 ações no sistema (criações, atualizações, etc)',
  })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 50 })
  getRecentActivity(
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ): Promise<AdminActivity[]> {
    return this.adminService.getRecentActivity(limit);
  }

  // ==================== GAMIFICATION ====================

  @Get('gamification')
  @ApiOperation({
    summary: 'Estatísticas de gamificação (Admin)',
    description: 'Visão geral de NavegaCoins, km, níveis e leaderboard',
  })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        overview: {
          totalNavegaCoinsDistributed: 15420,
          totalKmTraveled: 82340,
          totalEligibleUsers: 145,
          newUsersToday: 3,
          newUsersThisWeek: 18,
          newUsersThisMonth: 64,
        },
        levelDistribution: {
          Marinheiro: 95,
          Navegador: 38,
          Capitão: 10,
          Almirante: 2,
        },
        leaderboard: [
          {
            position: 1,
            id: 'uuid',
            name: 'João',
            totalPoints: 2400,
            level: 'Almirante',
          },
        ],
      },
    },
  })
  getAdminGamification() {
    return this.adminService.getAdminGamificationStats();
  }

  // ==================== SEGURANÇA ====================

  @Get('safety/checklists')
  @ApiOperation({ summary: 'Listar todos os checklists de segurança (Admin)' })
  @ApiQuery({ name: 'incomplete', required: false, type: Boolean })
  getAllChecklists(@Query('incomplete') incomplete?: boolean) {
    return this.adminService.getAllChecklists(incomplete);
  }

  @Get('safety/checklists/stats')
  @ApiOperation({ summary: 'Estatísticas de compliance de segurança (Admin)' })
  getChecklistStats() {
    return this.adminService.getChecklistStats();
  }

  // ==================== RESERVAS (BOOKINGS) ====================

  @Get('bookings')
  @ApiOperation({
    summary: 'Listar todas as reservas (Admin)',
    description: 'Lista todas as reservas do sistema com paginação e filtros',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({
    name: 'status',
    required: false,
    type: String,
    description:
      'Filtrar por status (pending, confirmed, checked_in, completed, cancelled)',
  })
  @ApiQuery({
    name: 'paymentStatus',
    required: false,
    type: String,
    description:
      'Filtrar por status de pagamento (pending, paid, refund_pending, refunded)',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Buscar por nome do passageiro, email ou ID',
  })
  @ApiResponse({ status: 200, description: 'Lista de reservas' })
  async getAllBookings(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('status') status?: string,
    @Query('paymentStatus') paymentStatus?: string,
    @Query('search') search?: string,
  ) {
    return this.adminService.getAllBookings(
      page,
      limit,
      status,
      paymentStatus,
      search,
    );
  }

  @Get('bookings/stats')
  @ApiOperation({ summary: 'Estatísticas de reservas (Admin)' })
  @ApiResponse({
    status: 200,
    description: 'Estatísticas gerais de reservas',
    schema: {
      example: {
        total: 543,
        byStatus: {
          pending: 89,
          confirmed: 412,
          checkedIn: 15,
          completed: 385,
          cancelled: 42,
        },
        byPaymentStatus: {
          pending: 95,
          paid: 448,
        },
        revenue: {
          total: 54300.0,
          confirmed: 51200.0,
          pending: 3100.0,
        },
        newToday: 12,
        newThisWeek: 67,
        newThisMonth: 234,
      },
    },
  })
  getBookingsStats() {
    return this.adminService.getBookingsStats();
  }

  @Get('bookings/:id')
  @ApiOperation({ summary: 'Detalhes completos de uma reserva (Admin)' })
  @ApiResponse({
    status: 200,
    description: 'Detalhes da reserva incluindo passageiro, viagem e capitão',
  })
  getBookingDetails(@Param('id') id: string) {
    return this.adminService.getBookingDetails(id);
  }

  @Patch('bookings/:id/status')
  @ApiOperation({
    summary: 'Alterar status da reserva (Admin)',
    description: 'Permite mudar manualmente o status de uma reserva',
  })
  updateBookingStatus(
    @Param('id') id: string,
    @Body('status') status: BookingStatus,
  ) {
    return this.adminService.updateBookingStatus(id, status);
  }

  @Delete('bookings/:id')
  @ApiOperation({
    summary: 'Deletar reserva permanentemente (Admin)',
    description: 'CUIDADO: Esta ação é irreversível',
  })
  deleteBooking(@Param('id') id: string) {
    return this.adminService.deleteBooking(id);
  }

  // ==================== REVIEWS ====================

  @Get('reviews')
  @ApiOperation({
    summary: 'Listar todas as avaliações (Admin)',
    description:
      'Lista todas as avaliações do sistema com paginação. Tipo: passenger_to_captain | captain_to_passenger',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({
    name: 'type',
    required: false,
    type: String,
    description:
      'Filtrar por tipo (passenger_to_captain | captain_to_passenger)',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Buscar por nome do revisor, capitão ou passageiro',
  })
  @ApiResponse({ status: 200, description: 'Lista de avaliações paginada' })
  getAllReviews(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('type') type?: string,
    @Query('search') search?: string,
  ) {
    return this.adminService.getAllReviews(page, limit, type, search);
  }

  @Get('reviews/stats')
  @ApiOperation({
    summary: 'Estatísticas gerais de avaliações (Admin)',
    description:
      'Total de reviews, médias por tipo (capitão, barco, passageiro) e distribuição de estrelas',
  })
  @ApiResponse({
    status: 200,
    description: 'Estatísticas de avaliações',
    schema: {
      example: {
        total: 320,
        passengerToCapitain: 250,
        captainToPassenger: 70,
        averages: { captain: 4.7, boat: 4.5, passenger: 4.8 },
        captainRatingDistribution: { 5: 180, 4: 45, 3: 18, 2: 5, 1: 2 },
        newToday: 3,
        newThisWeek: 21,
        newThisMonth: 87,
      },
    },
  })
  getReviewStats() {
    return this.adminService.getReviewStats();
  }

  @Get('reviews/:id')
  @ApiOperation({
    summary: 'Detalhes de uma avaliação (Admin)',
    description:
      'Retorna todos os campos da avaliação com relações (revisor, capitão, barco, passageiro, viagem)',
  })
  @ApiResponse({ status: 200, description: 'Detalhes completos da avaliação' })
  getReviewDetails(@Param('id') id: string) {
    return this.adminService.getReviewDetails(id);
  }

  @Delete('reviews/:id')
  @ApiOperation({
    summary: 'Remover avaliação (Admin)',
    description:
      'Remove uma avaliação inapropriada e recalcula automaticamente os ratings afectados (capitão, barco e/ou passageiro)',
  })
  @ApiResponse({
    status: 200,
    description: 'Avaliação removida e ratings recalculados',
  })
  deleteReview(@Param('id') id: string) {
    return this.adminService.deleteReview(id);
  }

  // ==================== NOTIFICAÇÕES ====================

  @Get('notifications')
  @ApiOperation({
    summary: 'Notificações pendentes para o admin (badge do header)',
    description:
      'Retorna SOS activos, verificações pendentes e viagens novas nas últimas 24h. Usar para popular o badge de notificações no painel.',
  })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        totalUnread: 5,
        sos: {
          count: 1,
          items: [
            {
              id: 'uuid',
              type: 'emergency',
              userName: 'João',
              createdAt: '2026-02-23T10:00:00Z',
              link: '/admin/safety/sos/uuid',
            },
          ],
        },
        pendingVerifications: { count: 3, boats: [], captains: [] },
        newTrips: {
          count: 1,
          items: [
            {
              id: 'uuid',
              origin: 'Manaus',
              destination: 'Iranduba',
              captainName: 'Carlos',
              createdAt: '2026-02-23T09:00:00Z',
            },
          ],
        },
      },
    },
  })
  getNotifications() {
    return this.adminService.getAdminNotifications();
  }

  @Post('notifications/broadcast')
  @ApiOperation({
    summary: 'Enviar notificação broadcast (Admin)',
    description:
      'Envia push notification para todos os usuários ou para um segmento específico (cidade, role). Requer Firebase configurado.',
  })
  @ApiResponse({
    status: 201,
    description: 'Broadcast enviado',
    schema: {
      example: {
        sent: 142,
        message: 'Broadcast enviado para 142 dispositivos',
      },
    },
  })
  async broadcastNotification(@Body() dto: BroadcastNotificationDto) {
    const filters: BroadcastFilters = {};
    if (dto.cities?.length) filters.cities = dto.cities;
    if (dto.roles?.length) filters.roles = dto.roles;

    const result = await this.notificationsService.broadcast(
      { title: dto.title, body: dto.body, data: dto.data },
      filters,
    );

    return {
      sent: result.sent,
      message: `Broadcast enviado para ${result.sent} dispositivos`,
    };
  }

  // ==================== EMBARCAÇÕES ====================

  @Get('boats/pending')
  @ApiOperation({
    summary: 'Verificações pendentes (Admin)',
    description:
      'Lista barcos e capitães com documentação pendente de verificação',
  })
  @ApiResponse({ status: 200, description: 'Lista de verificações pendentes' })
  getPendingVerifications() {
    return this.adminService.getPendingVerifications();
  }

  @Get('boats')
  @ApiOperation({
    summary: 'Listar todas as embarcações (Admin)',
    description:
      'Lista todas as embarcações com filtro por status de verificação',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({
    name: 'verified',
    required: false,
    type: String,
    description: 'true | false | (omitir = todos)',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Buscar por nome, registro ou dono',
  })
  getAllBoats(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('verified') verified?: string,
    @Query('search') search?: string,
  ) {
    return this.adminService.getAllBoats(page, limit, verified, search);
  }

  @Patch('boats/:id/verify')
  @ApiOperation({
    summary: 'Aprovar ou rejeitar embarcação (Admin)',
    description:
      'Aprova ou rejeita a documentação de uma embarcação. Se rejeitado, indicar motivo.',
  })
  @ApiResponse({
    status: 200,
    description: 'Decisão registada',
    schema: {
      example: {
        message: 'Embarcação aprovada com sucesso',
        boatId: 'uuid',
        isVerified: true,
      },
    },
  })
  verifyBoat(
    @Param('id') id: string,
    @Body('approved') approved: boolean,
    @Body('rejectionReason') rejectionReason?: string,
  ) {
    return this.adminService.verifyBoat(id, approved, rejectionReason);
  }

  // ==================== VERIFICAÇÃO DE CAPITÃO ====================

  @Patch('users/:id/verify')
  @ApiOperation({
    summary:
      'Aprovar ou rejeitar solicitações pendentes de documentos do capitão (Admin)',
    description:
      'Compatibilidade com o painel atual. verified=true aprova em lote as requests PENDING do capitão; verified=false rejeita em lote as requests PENDING do capitão.',
  })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        message: 'Solicitações aprovadas com sucesso',
        userId: 'uuid',
        isVerified: true,
        kycStatus: 'approved',
        requestsReviewed: 2,
        requestIds: ['request-uuid-1', 'request-uuid-2'],
      },
    },
  })
  verifyCapt(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
    @Body('verified') verified: boolean,
    @Body('rejectionReason') rejectionReason?: string,
  ) {
    return this.adminService.verifyCapt(
      id,
      verified,
      rejectionReason,
      req.user.sub,
    );
  }

  // ==================== LOCALIDADES COMUNITÁRIAS ====================

  @Get('locations')
  @ApiOperation({
    summary: 'Listar sugestões de localidades (Admin)',
    description:
      'status: pending | confirmed | rejected. Sem parâmetro → todas.',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['pending', 'confirmed', 'rejected'],
  })
  listLocations(@Query('status') status?: string) {
    return this.locationsService.listForAdmin(
      status as CommunityLocationStatus | undefined,
    );
  }

  @Patch('locations/:id/approve')
  @ApiOperation({ summary: 'Aprovar sugestão de localidade (Admin)' })
  approveLocation(@Param('id') id: string) {
    return this.locationsService.approveLocation(id);
  }

  @Patch('locations/:id/reject')
  @ApiOperation({ summary: 'Rejeitar sugestão de localidade (Admin)' })
  rejectLocation(@Param('id') id: string, @Body('reason') reason?: string) {
    return this.locationsService.rejectLocation(id, reason);
  }
}
