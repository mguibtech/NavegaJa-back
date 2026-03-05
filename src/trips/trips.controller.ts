import { Controller, Post, Get, Put, Delete, Patch, Param, Body, Query, UseGuards, Request, ParseUUIDPipe, ParseIntPipe, BadRequestException, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiQuery, ApiParam, ApiOkResponse } from '@nestjs/swagger';
import { TripsService } from './trips.service';
import { LocationsService } from '../locations/locations.service';
import { CreateTripDto, UpdateTripStatusDto, UpdateLocationDto, PopularDestinationsResponseDto } from './dto/trip.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, Roles } from '../common/roles.guard';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Trips')
@Controller('trips')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TripsController {
  constructor(
    private tripsService: TripsService,
    private locationsService: LocationsService,
  ) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Buscar viagens disponíveis com filtros avançados' })
  @ApiQuery({ name: 'origin', required: false, description: 'Nome da cidade de origem (ex: Manaus)' })
  @ApiQuery({ name: 'destination', required: false, description: 'Nome da cidade de destino (ex: Parintins)' })
  @ApiQuery({ name: 'date', required: false, description: 'Data no formato YYYY-MM-DD' })
  @ApiQuery({ name: 'minPrice', required: false, description: 'Preço mínimo', type: Number })
  @ApiQuery({ name: 'maxPrice', required: false, description: 'Preço máximo', type: Number })
  @ApiQuery({ name: 'departureTime', required: false, description: 'Período do dia (morning, afternoon, night)', enum: ['morning', 'afternoon', 'night'] })
  @ApiQuery({ name: 'minRating', required: false, description: 'Avaliação mínima do capitão', type: Number })
  @ApiQuery({ name: 'routeId', required: false, description: 'UUID da rota (filtro exacto — preferido ao origin/destination)' })
  search(
    @Query('origin') origin?: string,
    @Query('destination') destination?: string,
    @Query('date') date?: string,
    @Query('minPrice', new ParseIntPipe({ optional: true })) minPrice?: number,
    @Query('maxPrice', new ParseIntPipe({ optional: true })) maxPrice?: number,
    @Query('departureTime') departureTime?: 'morning' | 'afternoon' | 'night',
    @Query('minRating', new ParseIntPipe({ optional: true })) minRating?: number,
    @Query('routeId') routeId?: string,
  ) {
    return this.tripsService.search(
      origin,
      destination,
      date,
      minPrice,
      maxPrice,
      departureTime,
      minRating,
      routeId,
    );
  }

  @Get('geocode')
  @Public()
  @ApiOperation({ summary: 'Autocomplete de localidades para origem/destino da viagem' })
  @ApiQuery({ name: 'q', required: true, description: 'Texto de busca (min 2 chars)' })
  @ApiQuery({ name: 'lat', required: false, description: 'Latitude atual (ordena por proximidade)' })
  @ApiQuery({ name: 'lng', required: false, description: 'Longitude atual' })
  geocodeLocations(
    @Query('q') q: string,
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
  ) {
    return this.locationsService.searchLocations(
      q || '',
      lat ? parseFloat(lat) : undefined,
      lng ? parseFloat(lng) : undefined,
    );
  }

  @Get('popular')
  @Public()
  @ApiOperation({ summary: 'Destinos e rotas populares' })
  @ApiOkResponse({ type: PopularDestinationsResponseDto })
  getPopular() {
    return this.tripsService.getPopularDestinations();
  }

  @Get('captain/my-trips')
  @UseGuards(RolesGuard)
  @Roles('captain', 'boat_manager')
  @ApiOperation({ summary: 'Viagens do capitão logado (ou todos os barcos geridos pelo boat_manager)' })
  myTrips(@Request() req: any) {
    if (req.user.role === 'boat_manager') {
      return this.tripsService.findByManagedBoats(req.user.sub);
    }
    return this.tripsService.findByCaptain(req.user.sub);
  }

  @Get(':id/manage')
  @UseGuards(RolesGuard)
  @Roles('captain', 'boat_manager')
  @ApiOperation({
    summary: 'Dados de gestão da viagem (captain ou boat_manager)',
    description: 'Retorna passageiros e encomendas da viagem para o ecrã "Gerenciar Viagem". Inclui validationCode das encomendas para o capitão confirmar coleta/entrega.',
  })
  @ApiParam({ name: 'id', description: 'UUID da viagem' })
  manageTrip(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.tripsService.findByIdForCaptain(id, req.user.sub, req.user.role);
  }

  @Get(':id/location')
  @Public()
  @ApiOperation({ summary: 'Localização GPS atual da viagem (tempo real)' })
  @ApiParam({ name: 'id', description: 'UUID da viagem' })
  getLocation(@Param('id', ParseUUIDPipe) id: string) {
    return this.tripsService.getLocation(id);
  }

  @Get(':id/cargo-manifest')
  @UseGuards(RolesGuard)
  @Roles('captain', 'admin', 'boat_manager')
  @ApiOperation({ summary: 'Manifesto de carga da viagem em PDF' })
  @ApiParam({ name: 'id', description: 'UUID da viagem' })
  async getCargoManifest(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any,
    @Res() res: Response,
  ) {
    const pdf = await this.tripsService.generateCargoManifestPdf(id, req.user.sub, req.user.role);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="manifesto-${id}.pdf"` });
    pdf.pipe(res);
    pdf.end();
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Detalhes de uma viagem específica' })
  @ApiParam({ name: 'id', description: 'UUID da viagem', example: '2b5b9cab-4a3d-4eb6-8e5c-fa11153f587d' })
  findById(@Param('id', new ParseUUIDPipe({ errorHttpStatusCode: 400 })) id: string) {
    return this.tripsService.findById(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('captain', 'boat_manager')
  @ApiOperation({ summary: 'Criar nova viagem (captain ou boat_manager)' })
  create(@Request() req: any, @Body() dto: CreateTripDto) {
    return this.tripsService.create(req.user.sub, dto, req.user.role);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles('captain', 'boat_manager')
  @ApiOperation({ summary: 'Atualizar viagem (captain ou boat_manager)' })
  @ApiParam({ name: 'id', description: 'UUID da viagem' })
  update(@Param('id', ParseUUIDPipe) id: string, @Request() req: any, @Body() dto: CreateTripDto) {
    return this.tripsService.update(id, req.user.sub, dto, req.user.role);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('captain', 'boat_manager')
  @ApiOperation({ summary: 'Deletar viagem (captain ou boat_manager)' })
  @ApiParam({ name: 'id', description: 'UUID da viagem' })
  delete(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.tripsService.delete(id, req.user.sub, req.user.role);
  }

  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles('captain', 'boat_manager')
  @ApiOperation({ summary: 'Atualizar status da viagem' })
  @ApiParam({ name: 'id', description: 'UUID da viagem' })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any,
    @Body() dto: UpdateTripStatusDto,
  ) {
    return this.tripsService.updateStatus(id, req.user.sub, dto, req.user.role);
  }

  @Patch(':id/location')
  @UseGuards(RolesGuard)
  @Roles('captain', 'boat_manager')
  @ApiOperation({ summary: 'Atualizar posição GPS' })
  @ApiParam({ name: 'id', description: 'UUID da viagem' })
  updateLocation(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any,
    @Body() dto: UpdateLocationDto,
  ) {
    return this.tripsService.updateLocation(id, req.user.sub, dto, req.user.role);
  }
}
