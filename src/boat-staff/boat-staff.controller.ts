import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiResponse,
} from '@nestjs/swagger';
import { BoatStaffService } from './boat-staff.service';
import { CreateBoatStaffDto, UpdateBoatStaffDto } from './dto/boat-staff.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, Roles } from '../common/roles.guard';

@ApiTags('Admin — Boat Staff')
@Controller('admin/boat-staff')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@ApiBearerAuth()
export class BoatStaffController {
  constructor(private boatStaffService: BoatStaffService) {}

  @Post()
  @ApiOperation({
    summary: 'Atribuir utilizador boat_manager a um barco (admin)',
  })
  @ApiResponse({
    status: 201,
    description: 'Gestor atribuÃ­do ao barco com sucesso',
    schema: {
      example: {
        id: 'uuid',
        boatId: 'boat-uuid',
        userId: 'user-uuid',
        position: 'Motorista',
      },
    },
  })
  assign(@Body() dto: CreateBoatStaffDto) {
    return this.boatStaffService.assignStaff(dto);
  }

  @Get('boat/:boatId')
  @ApiOperation({ summary: 'Listar staff de um barco (admin)' })
  @ApiParam({ name: 'boatId', description: 'UUID do barco' })
  @ApiResponse({
    status: 200,
    description: 'Lista de gestores vinculados ao barco',
  })
  findByBoat(@Param('boatId') boatId: string) {
    return this.boatStaffService.findByBoat(boatId);
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Listar barcos geridos por um utilizador (admin)' })
  @ApiParam({ name: 'userId', description: 'UUID do utilizador' })
  @ApiResponse({
    status: 200,
    description: 'Lista de barcos geridos pelo utilizador',
  })
  findByUser(@Param('userId') userId: string) {
    return this.boatStaffService.findByUser(userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar permissões do staff (admin)' })
  @ApiParam({ name: 'id', description: 'UUID do registo BoatStaff' })
  @ApiResponse({
    status: 200,
    description: 'PermissÃµes do gestor actualizadas',
  })
  update(@Param('id') id: string, @Body() dto: UpdateBoatStaffDto) {
    return this.boatStaffService.updateStaff(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remover staff de um barco (admin)' })
  @ApiParam({ name: 'id', description: 'UUID do registo BoatStaff' })
  @ApiResponse({
    status: 200,
    description: 'Gestor removido do barco',
    schema: {
      example: {
        message: 'Gestor removido com sucesso',
      },
    },
  })
  remove(@Param('id') id: string) {
    return this.boatStaffService.removeStaff(id);
  }
}
