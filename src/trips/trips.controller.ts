import { Controller, Post, Get, Put, Delete, Patch, Param, Body, Query, UseGuards, Request, ParseUUIDPipe, BadRequestException } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiQuery, ApiParam, ApiOkResponse } from '@nestjs/swagger';
import { TripsService } from './trips.service';
import { CreateTripDto, UpdateTripStatusDto, UpdateLocationDto, PopularDestinationsResponseDto } from './dto/trip.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, Roles } from '../common/roles.guard';

@ApiTags('Trips')
@Controller('trips')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TripsController {
  constructor(private tripsService: TripsService) {}

  @Get()
  @ApiOperation({ summary: 'Buscar viagens disponíveis (filtros: origin, destination, date)' })
  @ApiQuery({ name: 'origin', required: false, description: 'Nome da cidade de origem (ex: Manaus)' })
  @ApiQuery({ name: 'destination', required: false, description: 'Nome da cidade de destino (ex: Parintins)' })
  @ApiQuery({ name: 'date', required: false, description: 'Data no formato YYYY-MM-DD' })
  search(
    @Query('origin') origin?: string,
    @Query('destination') destination?: string,
    @Query('date') date?: string,
  ) {
    return this.tripsService.search(origin, destination, date);
  }

  @Get('popular')
  @ApiOperation({ summary: 'Destinos e rotas populares' })
  @ApiOkResponse({ type: PopularDestinationsResponseDto })
  getPopular() {
    return this.tripsService.getPopularDestinations();
  }

  @Get('captain/my-trips')
  @UseGuards(RolesGuard)
  @Roles('captain')
  @ApiOperation({ summary: 'Viagens do capitão logado' })
  myTrips(@Request() req: any) {
    return this.tripsService.findByCaptain(req.user.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhes de uma viagem específica' })
  @ApiParam({ name: 'id', description: 'UUID da viagem', example: '2b5b9cab-4a3d-4eb6-8e5c-fa11153f587d' })
  findById(@Param('id', new ParseUUIDPipe({ errorHttpStatusCode: 400 })) id: string) {
    return this.tripsService.findById(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('captain')
  @ApiOperation({ summary: 'Criar nova viagem (captain only)' })
  create(@Request() req: any, @Body() dto: CreateTripDto) {
    return this.tripsService.create(req.user.sub, dto);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles('captain')
  @ApiOperation({ summary: 'Atualizar viagem (captain only)' })
  @ApiParam({ name: 'id', description: 'UUID da viagem' })
  update(@Param('id', ParseUUIDPipe) id: string, @Request() req: any, @Body() dto: CreateTripDto) {
    return this.tripsService.update(id, req.user.sub, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('captain')
  @ApiOperation({ summary: 'Deletar viagem (captain only)' })
  @ApiParam({ name: 'id', description: 'UUID da viagem' })
  delete(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.tripsService.delete(id, req.user.sub);
  }

  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles('captain')
  @ApiOperation({ summary: 'Atualizar status da viagem' })
  @ApiParam({ name: 'id', description: 'UUID da viagem' })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any,
    @Body() dto: UpdateTripStatusDto,
  ) {
    return this.tripsService.updateStatus(id, req.user.sub, dto);
  }

  @Patch(':id/location')
  @UseGuards(RolesGuard)
  @Roles('captain')
  @ApiOperation({ summary: 'Atualizar posição GPS' })
  @ApiParam({ name: 'id', description: 'UUID da viagem' })
  updateLocation(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any,
    @Body() dto: UpdateLocationDto,
  ) {
    return this.tripsService.updateLocation(id, req.user.sub, dto);
  }
}
