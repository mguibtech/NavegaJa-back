import { Controller, Get, Post, Put, Patch, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SafetyService } from './safety.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, Roles } from '../common/roles.guard';
import { Public } from '../common/decorators/public.decorator';
import { EmergencyServiceType } from './emergency-contact.entity';
import { SosAlertType, SosAlertStatus } from './sos-alert.entity';

@ApiTags('safety')
@Controller('safety')
export class SafetyController {
  constructor(private readonly safetyService: SafetyService) {}

  // ==================== CONTATOS DE EMERGÊNCIA ====================

  @Get('emergency-contacts')
  @Public()
  @ApiOperation({
    summary: 'Listar contatos de emergência',
    description: 'Lista pública de números de emergência (Marinha, Bombeiros, etc)',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de contatos de emergência ordenados por prioridade',
  })
  getEmergencyContacts(@Query('region') region?: string) {
    return this.safetyService.getEmergencyContacts(region);
  }

  @Post('emergency-contacts')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Criar contato de emergência',
    description: 'Apenas admin pode adicionar novos contatos',
  })
  createEmergencyContact(
    @Body()
    data: {
      type: EmergencyServiceType;
      name: string;
      phoneNumber: string;
      description?: string;
      region?: string;
      priority?: number;
    },
  ) {
    return this.safetyService.createEmergencyContact(data);
  }

  @Put('emergency-contacts/:id')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Atualizar contato de emergência' })
  updateEmergencyContact(@Param('id') id: string, @Body() updates: any) {
    return this.safetyService.updateEmergencyContact(id, updates);
  }

  @Post('emergency-contacts/seed')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Popular contatos de emergência padrão',
    description: 'Seed dos números de emergência de Manaus/Amazonas',
  })
  seedEmergencyContacts() {
    return this.safetyService.seedEmergencyContacts();
  }

  // ==================== CHECKLIST DE SEGURANÇA ====================

  @Post('checklists')
  @Roles('captain', 'admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Criar checklist de segurança para viagem',
    description: 'Capitão cria checklist antes de iniciar viagem',
  })
  createSafetyChecklist(@Body() data: { tripId: string }, @Request() req: any) {
    return this.safetyService.createSafetyChecklist(data.tripId, req.user.sub);
  }

  @Patch('checklists/:id')
  @Roles('captain', 'admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Atualizar checklist de segurança',
    description: 'Capitão marca itens do checklist conforme verifica',
  })
  updateSafetyChecklist(
    @Param('id') id: string,
    @Body()
    data: {
      lifeJacketsAvailable?: boolean;
      lifeJacketsCount?: number;
      fireExtinguisherCheck?: boolean;
      weatherConditionsOk?: boolean;
      weatherCondition?: string;
      boatConditionGood?: boolean;
      emergencyEquipmentCheck?: boolean;
      navigationLightsWorking?: boolean;
      maxCapacityRespected?: boolean;
      passengersOnBoard?: number;
      maxCapacity?: number;
      observations?: string;
    },
  ) {
    return this.safetyService.updateSafetyChecklist(id, data);
  }

  @Get('checklists/trip/:tripId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Buscar checklist de uma viagem' })
  getChecklistByTrip(@Param('tripId') tripId: string) {
    return this.safetyService.getChecklistByTrip(tripId);
  }

  @Get('checklists/trip/:tripId/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Verificar se checklist está completo',
    description: 'Usado para validar se viagem pode iniciar',
  })
  async checkChecklistStatus(@Param('tripId') tripId: string) {
    const isComplete = await this.safetyService.isChecklistComplete(tripId);
    return { tripId, checklistComplete: isComplete };
  }

  // ==================== ALERTAS SOS ====================

  @Post('sos')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Criar alerta SOS',
    description: 'Passageiro ou capitão aciona emergência',
  })
  @ApiResponse({
    status: 201,
    description: 'Alerta SOS criado com sucesso',
  })
  createSosAlert(
    @Body()
    data: {
      tripId?: string;
      type: SosAlertType;
      description?: string;
      latitude?: number;
      longitude?: number;
      location?: string;
    },
    @Request() req: any,
  ) {
    return this.safetyService.createSosAlert({
      userId: req.user.sub,
      ...data,
    });
  }

  @Get('sos/active')
  @Roles('admin', 'captain')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Listar alertas SOS ativos',
    description: 'Admin/Capitão visualiza emergências em andamento',
  })
  getActiveSosAlerts() {
    return this.safetyService.getActiveSosAlerts();
  }

  @Patch('sos/:id/resolve')
  @Roles('admin', 'captain')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Resolver alerta SOS',
    description: 'Admin/Capitão marca alerta como resolvido ou falso alarme',
  })
  resolveSosAlert(
    @Param('id') id: string,
    @Body()
    data: {
      status: SosAlertStatus.RESOLVED | SosAlertStatus.FALSE_ALARM;
      notes?: string;
    },
    @Request() req: any,
  ) {
    return this.safetyService.resolveSosAlert(id, req.user.sub, data.status, data.notes);
  }

  @Patch('sos/:id/cancel')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Cancelar alerta SOS',
    description: 'Usuário cancela seu próprio alerta',
  })
  cancelSosAlert(@Param('id') id: string, @Request() req: any) {
    return this.safetyService.cancelSosAlert(id, req.user.sub);
  }

  @Get('sos/my-alerts')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar meus alertas SOS' })
  getUserSosAlerts(@Request() req: any) {
    return this.safetyService.getUserSosAlerts(req.user.sub);
  }

  // ==================== INTEGRAÇÃO COM CLIMA ====================

  @Get('weather-suggestion')
  @Roles('captain', 'admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Sugerir condição climática para checklist',
    description: 'Capitão consulta clima antes de criar checklist',
  })
  async suggestWeather(@Query('lat') lat: string, @Query('lng') lng: string) {
    return this.safetyService.suggestWeatherCondition(parseFloat(lat), parseFloat(lng));
  }

  @Get('weather-safety')
  @Roles('captain', 'admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Avaliar segurança do clima para navegação',
    description: 'Verifica se condições climáticas permitem navegação segura',
  })
  async checkWeatherSafety(@Query('lat') lat: string, @Query('lng') lng: string) {
    return this.safetyService.checkWeatherSafety(parseFloat(lat), parseFloat(lng));
  }
}
