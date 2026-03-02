import { Controller, Post, Get, Patch, Delete, Param, Body, UseGuards, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
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

  @Get()
  @ApiOperation({ summary: 'Listar todos os gestores dos meus barcos' })
  getMyStaff(@Request() req: any) {
    return this.boatStaffService.captainGetMyStaff(req.user.sub);
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
