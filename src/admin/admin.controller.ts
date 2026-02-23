import { Controller, Get, Patch, Delete, Post, Param, Body, Query, UseGuards, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiQuery, ApiResponse, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, Roles } from '../common/roles.guard';
import { AdminService } from './admin.service';
import { UserRole } from '../users/user.entity';
import { NotificationsService, BroadcastFilters } from '../notifications/notifications.service';
import { IsString, IsNotEmpty, IsOptional, IsArray, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class BroadcastNotificationDto {
  @ApiProperty({ example: '🎉 Festa de Parintins', description: 'Título da notificação' })
  @IsString() @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'Cupom especial 20% OFF nas viagens para Parintins!', description: 'Corpo da notificação' })
  @IsString() @IsNotEmpty()
  body: string;

  @ApiPropertyOptional({ type: [String], example: ['Parintins', 'Manaus'], description: 'Filtrar por cidades (vazio = todas)' })
  @IsOptional() @IsArray() @IsString({ each: true })
  cities?: string[];

  @ApiPropertyOptional({ enum: UserRole, isArray: true, example: [UserRole.PASSENGER], description: 'Filtrar por roles (vazio = todos)' })
  @IsOptional() @IsArray() @IsEnum(UserRole, { each: true })
  roles?: UserRole[];

  @ApiPropertyOptional({ description: 'Dados extras para o app (deep link, etc)', example: { type: 'coupon', couponCode: 'PARINTINS20' } })
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
  ) {}

  // ==================== USUÁRIOS ====================

  @Get('users')
  @ApiOperation({
    summary: 'Listar todos os usuários (Admin)',
    description: 'Lista todos os usuários do sistema com paginação e filtros',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'role', required: false, enum: UserRole, description: 'Filtrar por role' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Buscar por nome, email ou telefone' })
  @ApiResponse({ status: 200, description: 'Lista de usuários' })
  async getAllUsers(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('role') role?: UserRole,
    @Query('search') search?: string,
  ) {
    return this.adminService.getAllUsers(page, limit, role, search);
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
    description: 'Permite promover/rebaixar usuário (passenger ↔ captain ↔ admin)',
  })
  updateUserRole(@Param('id') id: string, @Body('role') role: UserRole) {
    return this.adminService.updateUserRole(id, role);
  }

  @Patch('users/:id/status')
  @ApiOperation({
    summary: 'Ativar/desativar usuário (Admin)',
    description: 'Permite bloquear acesso de um usuário',
  })
  updateUserStatus(
    @Param('id') id: string,
    @Body('active') active: boolean,
  ) {
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
  @ApiQuery({ name: 'status', required: false, type: String, description: 'Filtrar por status' })
  @ApiQuery({ name: 'captainId', required: false, type: String, description: 'Filtrar por capitão' })
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
  updateTripStatus(@Param('id') id: string, @Body('status') status: string) {
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
  @ApiQuery({ name: 'status', required: false, type: String, description: 'Filtrar por status' })
  @ApiQuery({ name: 'trackingCode', required: false, type: String, description: 'Buscar por código' })
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
  updateShipmentStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.adminService.updateShipmentStatus(id, status);
  }

  // ==================== DASHBOARD OVERVIEW ====================

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

  @Get('dashboard/chart')
  @ApiOperation({
    summary: 'Dados do gráfico por dia (Admin)',
    description: 'Retorna contagem de reservas, usuários e viagens agrupados por dia',
  })
  @ApiQuery({ name: 'days', required: false, type: Number, example: 7 })
  getDashboardChart(@Query('days', new DefaultValuePipe(7), ParseIntPipe) days: number) {
    return this.adminService.getDashboardChart(days);
  }

  @Get('dashboard/activity')
  @ApiOperation({
    summary: 'Atividade recente do sistema (Admin)',
    description: 'Últimas 50 ações no sistema (criações, atualizações, etc)',
  })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 50 })
  getRecentActivity(@Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number) {
    return this.adminService.getRecentActivity(limit);
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
  @ApiQuery({ name: 'status', required: false, type: String, description: 'Filtrar por status (pending, confirmed, checked_in, completed, cancelled)' })
  @ApiQuery({ name: 'paymentStatus', required: false, type: String, description: 'Filtrar por status de pagamento (pending, paid, refunded)' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Buscar por nome do passageiro, email ou ID' })
  @ApiResponse({ status: 200, description: 'Lista de reservas' })
  async getAllBookings(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('status') status?: string,
    @Query('paymentStatus') paymentStatus?: string,
    @Query('search') search?: string,
  ) {
    return this.adminService.getAllBookings(page, limit, status, paymentStatus, search);
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
          total: 54300.00,
          confirmed: 51200.00,
          pending: 3100.00,
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
  @ApiResponse({ status: 200, description: 'Detalhes da reserva incluindo passageiro, viagem e capitão' })
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
    @Body('status') status: string,
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
    description: 'Lista todas as avaliações do sistema com paginação. Tipo: passenger_to_captain | captain_to_passenger',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'type', required: false, type: String, description: 'Filtrar por tipo (passenger_to_captain | captain_to_passenger)' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Buscar por nome do revisor, capitão ou passageiro' })
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
    description: 'Total de reviews, médias por tipo (capitão, barco, passageiro) e distribuição de estrelas',
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
    description: 'Retorna todos os campos da avaliação com relações (revisor, capitão, barco, passageiro, viagem)',
  })
  @ApiResponse({ status: 200, description: 'Detalhes completos da avaliação' })
  getReviewDetails(@Param('id') id: string) {
    return this.adminService.getReviewDetails(id);
  }

  @Delete('reviews/:id')
  @ApiOperation({
    summary: 'Remover avaliação (Admin)',
    description: 'Remove uma avaliação inapropriada e recalcula automaticamente os ratings afectados (capitão, barco e/ou passageiro)',
  })
  @ApiResponse({ status: 200, description: 'Avaliação removida e ratings recalculados' })
  deleteReview(@Param('id') id: string) {
    return this.adminService.deleteReview(id);
  }

  // ==================== NOTIFICAÇÕES ====================

  @Post('notifications/broadcast')
  @ApiOperation({
    summary: 'Enviar notificação broadcast (Admin)',
    description: 'Envia push notification para todos os usuários ou para um segmento específico (cidade, role). Requer Firebase configurado.',
  })
  @ApiResponse({
    status: 201,
    description: 'Broadcast enviado',
    schema: { example: { sent: 142, message: 'Broadcast enviado para 142 dispositivos' } },
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
    description: 'Lista barcos e capitães com documentação pendente de verificação',
  })
  @ApiResponse({ status: 200, description: 'Lista de verificações pendentes' })
  getPendingVerifications() {
    return this.adminService.getPendingVerifications();
  }

  @Get('boats')
  @ApiOperation({
    summary: 'Listar todas as embarcações (Admin)',
    description: 'Lista todas as embarcações com filtro por status de verificação',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'verified', required: false, type: String, description: 'true | false | (omitir = todos)' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Buscar por nome, registro ou dono' })
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
    description: 'Aprova ou rejeita a documentação de uma embarcação. Se rejeitado, indicar motivo.',
  })
  @ApiResponse({
    status: 200,
    description: 'Decisão registada',
    schema: { example: { message: 'Embarcação aprovada com sucesso', boatId: 'uuid', isVerified: true } },
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
    summary: 'Verificar/des-verificar capitão (Admin)',
    description: 'Marca o capitão como verificado (documentos validados) ou revoga a verificação.',
  })
  @ApiResponse({
    status: 200,
    description: 'Estado de verificação actualizado',
    schema: { example: { message: 'Capitão verificado com sucesso', userId: 'uuid', isVerified: true } },
  })
  verifyCapt(
    @Param('id') id: string,
    @Body('verified') verified: boolean,
  ) {
    return this.adminService.verifyCapt(id, verified);
  }
}
