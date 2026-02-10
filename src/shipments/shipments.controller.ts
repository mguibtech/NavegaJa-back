import { Controller, Post, Get, Patch, Param, Body, UseGuards, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { ShipmentsService } from './shipments.service';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { ShipmentStatus } from './shipment.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, Roles } from '../common/roles.guard';

@ApiTags('Shipments')
@Controller('shipments')
export class ShipmentsController {
  constructor(private shipmentsService: ShipmentsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Criar encomenda' })
  create(@Request() req: any, @Body() dto: CreateShipmentDto) {
    return this.shipmentsService.create(req.user.sub, dto);
  }

  @Get('my-shipments')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Minhas encomendas' })
  myShipments(@Request() req: any) {
    return this.shipmentsService.findBySender(req.user.sub);
  }

  @Get('track/:code')
  @ApiOperation({ summary: 'Rastrear encomenda por código (público)' })
  track(@Param('code') code: string) {
    return this.shipmentsService.findByTrackingCode(code);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('captain')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Atualizar status (captain)' })
  updateStatus(@Param('id') id: string, @Body('status') status: ShipmentStatus) {
    return this.shipmentsService.updateStatus(id, status);
  }

  @Patch(':id/deliver')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('captain')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Confirmar entrega + foto (captain)' })
  deliver(@Param('id') id: string, @Body('deliveryPhotoUrl') photoUrl?: string) {
    return this.shipmentsService.deliver(id, photoUrl);
  }
}
