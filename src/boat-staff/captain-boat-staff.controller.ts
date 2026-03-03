import { Controller, Post, Get, Patch, Delete, Param, Body, UseGuards, Request, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';
import { BoatStaffService } from './boat-staff.service';
import { CaptainAssignManagerDto, UpdateBoatStaffDto } from './dto/boat-staff.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, Roles } from '../common/roles.guard';

@ApiTags('Captain — Gestores de Barco')
@Controller('captain/boat-staff')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('captain')
@ApiBearerAuth()
export class CaptainBoatStaffController {
  constructor(private boatStaffService: BoatStaffService) {}

  @Post()
  @ApiOperation({
    summary: 'Adicionar gestor ao barco pelo telefone',
    description:
      'O capitão adiciona um utilizador existente como gestor de um dos seus barcos. ' +
      'Se o utilizador tiver role passageiro, é elevado automaticamente para boat_manager.',
  })
  assign(@Request() req: any, @Body() dto: CaptainAssignManagerDto) {
    return this.boatStaffService.captainAssignByPhone(req.user.sub, dto);
  }

  @Get('lookup')
  @ApiOperation({ summary: 'Buscar utilizador por telefone ou CPF (pré-visualização antes de adicionar)' })
  @ApiQuery({ name: 'phone', required: false, description: 'Telefone do utilizador' })
  @ApiQuery({ name: 'cpf', required: false, description: 'CPF do utilizador' })
  lookup(@Query('phone') phone?: string, @Query('cpf') cpf?: string) {
    return this.boatStaffService.lookupUser({ phone, cpf });
  }

  @Get()
  @Roles('captain', 'boat_manager')
  @ApiOperation({
    summary: 'Listar gestores (captain) ou as minhas atribuições (boat_manager)',
    description:
      'Captain: devolve todos os gestores dos seus barcos. ' +
      'Boat_manager: devolve os registos BoatStaff onde userId = currentUser (barcos que gere).',
  })
  getMyStaff(@Request() req: any) {
    return this.boatStaffService.getMyStaff(req.user.sub, req.user.role);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar permissões de um gestor' })
  @ApiParam({ name: 'id', description: 'UUID do registo BoatStaff' })
  update(@Param('id') id: string, @Request() req: any, @Body() dto: UpdateBoatStaffDto) {
    return this.boatStaffService.captainUpdateStaff(id, req.user.sub, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remover gestor do barco' })
  @ApiParam({ name: 'id', description: 'UUID do registo BoatStaff' })
  remove(@Param('id') id: string, @Request() req: any) {
    return this.boatStaffService.captainRemoveStaff(id, req.user.sub);
  }
}
