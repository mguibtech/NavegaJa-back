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
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
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
  assign(@Body() dto: CreateBoatStaffDto) {
    return this.boatStaffService.assignStaff(dto);
  }

  @Get('boat/:boatId')
  @ApiOperation({ summary: 'Listar staff de um barco (admin)' })
  findByBoat(@Param('boatId') boatId: string) {
    return this.boatStaffService.findByBoat(boatId);
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Listar barcos geridos por um utilizador (admin)' })
  findByUser(@Param('userId') userId: string) {
    return this.boatStaffService.findByUser(userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar permissões do staff (admin)' })
  update(@Param('id') id: string, @Body() dto: UpdateBoatStaffDto) {
    return this.boatStaffService.updateStaff(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remover staff de um barco (admin)' })
  remove(@Param('id') id: string) {
    return this.boatStaffService.removeStaff(id);
  }
}
