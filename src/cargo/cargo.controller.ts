import { Controller, Post, Get, Patch, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { CargoService } from './cargo.service';
import { CreateCargoDto, UpdateCargoStatusDto, QuoteCargoDto } from './dto/cargo.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, Roles } from '../common/roles.guard';

@ApiTags('Cargo (Carga Comercial)')
@Controller('cargo')
export class CargoController {
  constructor(private cargoService: CargoService) {}

  @Get('types')
  @ApiOperation({ summary: 'Listar tipos de carga com precos de referencia' })
  getCargoTypes() {
    return this.cargoService.getCargoTypes();
  }

  @Get('track/:code')
  @ApiOperation({ summary: 'Rastrear carga pelo codigo (publico)' })
  track(@Param('code') code: string) {
    return this.cargoService.track(code);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Solicitar envio de carga comercial' })
  create(@Request() req: any, @Body() dto: CreateCargoDto) {
    return this.cargoService.create(req.user.sub, dto);
  }

  @Get('my-cargo')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Minhas cargas enviadas' })
  findMyCargo(@Request() req: any) {
    return this.cargoService.findMyCargo(req.user.sub);
  }

  @Get('trip/:tripId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('captain')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cargas de uma viagem (capitao)' })
  findByTrip(@Param('tripId') tripId: string) {
    return this.cargoService.findByTrip(tripId);
  }

  @Patch(':id/quote')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('captain')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Capitao define preco da carga' })
  quote(@Param('id') id: string, @Request() req: any, @Body() dto: QuoteCargoDto) {
    return this.cargoService.quote(id, req.user.sub, dto);
  }

  @Patch(':id/confirm')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remetente confirma carga cotada' })
  confirm(@Param('id') id: string, @Request() req: any) {
    return this.cargoService.confirm(id, req.user.sub);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('captain')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Atualizar status da carga (capitao)' })
  updateStatus(@Param('id') id: string, @Request() req: any, @Body() dto: UpdateCargoStatusDto) {
    return this.cargoService.updateStatus(id, req.user.sub, dto.status);
  }

  @Patch(':id/deliver')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('captain')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Marcar carga como entregue (capitao)' })
  deliver(@Param('id') id: string, @Request() req: any, @Body() body: { deliveryPhotoUrl?: string }) {
    return this.cargoService.deliver(id, req.user.sub, body.deliveryPhotoUrl);
  }
}
