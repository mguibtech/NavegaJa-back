import { Controller, Get, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, Roles } from '../common/roles.guard';
import { AdminService } from './admin.service';
import { UserRole } from '../users/user.entity';

@ApiTags('Admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@ApiBearerAuth()
export class AdminController {
  constructor(private adminService: AdminService) {}

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
    @Query('page') page = 1,
    @Query('limit') limit = 20,
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
    @Query('page') page = 1,
    @Query('limit') limit = 20,
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
    @Query('page') page = 1,
    @Query('limit') limit = 20,
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

  @Get('dashboard/activity')
  @ApiOperation({
    summary: 'Atividade recente do sistema (Admin)',
    description: 'Últimas 50 ações no sistema (criações, atualizações, etc)',
  })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 50 })
  getRecentActivity(@Query('limit') limit = 50) {
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
    @Query('page') page = 1,
    @Query('limit') limit = 20,
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
}
