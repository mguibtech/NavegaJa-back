import { Controller, Post, Get, Patch, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { TripsService } from './trips.service';
import { CreateTripDto, UpdateTripStatusDto, UpdateLocationDto } from './dto/trip.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, Roles } from '../common/roles.guard';

@ApiTags('Trips')
@Controller('trips')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TripsController {
  constructor(private tripsService: TripsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar viagens disponíveis' })
  @ApiQuery({ name: 'route_id', required: false })
  @ApiQuery({ name: 'date', required: false })
  findAvailable(
    @Query('route_id') routeId?: string,
    @Query('date') date?: string,
  ) {
    return this.tripsService.findAvailable(routeId, date);
  }

  @Get('captain/my-trips')
  @UseGuards(RolesGuard)
  @Roles('captain')
  @ApiOperation({ summary: 'Viagens do capitão logado' })
  myTrips(@Request() req: any) {
    return this.tripsService.findByCaptain(req.user.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhes da viagem' })
  findById(@Param('id') id: string) {
    return this.tripsService.findById(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('captain')
  @ApiOperation({ summary: 'Criar viagem (captain only)' })
  create(@Request() req: any, @Body() dto: CreateTripDto) {
    return this.tripsService.create(req.user.sub, dto);
  }

  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles('captain')
  @ApiOperation({ summary: 'Atualizar status da viagem' })
  updateStatus(
    @Param('id') id: string,
    @Request() req: any,
    @Body() dto: UpdateTripStatusDto,
  ) {
    return this.tripsService.updateStatus(id, req.user.sub, dto);
  }

  @Patch(':id/location')
  @UseGuards(RolesGuard)
  @Roles('captain')
  @ApiOperation({ summary: 'Atualizar posição GPS' })
  updateLocation(
    @Param('id') id: string,
    @Request() req: any,
    @Body() dto: UpdateLocationDto,
  ) {
    return this.tripsService.updateLocation(id, req.user.sub, dto);
  }
}
