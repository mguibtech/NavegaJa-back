import { Controller, Post, Get, Patch, Param, Body, UseGuards, Request, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { BookingsService } from './bookings.service';
import { CreateBookingDto, CancelBookingDto } from './dto/create-booking.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, Roles } from '../common/roles.guard';
import { ValidateCouponDto, CalculatePriceDto } from '../coupons/dto/coupon.dto';

@ApiTags('Bookings')
@Controller('bookings')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BookingsController {
  constructor(private bookingsService: BookingsService) {}

  @Get('my-bookings')
  @ApiOperation({ summary: 'Minhas reservas (passageiro logado)' })
  myBookings(@Request() req: any) {
    return this.bookingsService.findByPassenger(req.user.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhes de uma reserva (com QR code)' })
  findById(@Param('id') id: string, @Request() req: any) {
    return this.bookingsService.findById(id);
  }

  @Post('calculate-price')
  @ApiOperation({ summary: 'Calcular preço com descontos (preview antes de confirmar)' })
  calculatePrice(@Request() req: any, @Body() dto: CalculatePriceDto) {
    return this.bookingsService.calculatePrice(
      req.user.sub,
      dto.tripId,
      dto.quantity,
      dto.couponCode,
    );
  }

  @Post()
  @ApiOperation({ summary: 'Criar reserva (gera QR code automaticamente)' })
  create(@Request() req: any, @Body() dto: CreateBookingDto) {
    return this.bookingsService.create(req.user.sub, dto);
  }

  @Get(':id/tracking')
  @ApiOperation({ summary: 'Rastreamento da viagem em tempo real' })
  getTracking(@Param('id') id: string, @Request() req: any) {
    return this.bookingsService.getTracking(id, req.user.sub);
  }

  @Get('trip/:tripId')
  @UseGuards(RolesGuard)
  @Roles('captain')
  @ApiOperation({ summary: 'Passageiros de uma viagem (captain)' })
  findByTrip(@Param('tripId') tripId: string) {
    return this.bookingsService.findByTrip(tripId);
  }

  @Post(':id/confirm-payment')
  @UseGuards(RolesGuard)
  @Roles('admin', 'captain')
  @ApiOperation({
    summary: 'Confirmar pagamento PIX manualmente',
    description: 'Admin ou capitão confirma que recebeu o pagamento PIX',
  })
  confirmPayment(@Param('id') id: string, @Request() req: any) {
    return this.bookingsService.confirmPayment(id, req.user.sub);
  }

  @Get(':id/payment-status')
  @ApiOperation({
    summary: 'Consultar status de pagamento',
    description: 'Para polling do frontend verificar se pagamento foi confirmado',
  })
  getPaymentStatus(@Param('id') id: string) {
    return this.bookingsService.getPaymentStatus(id);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancelar reserva' })
  cancel(@Param('id') id: string, @Request() req: any, @Body() dto: CancelBookingDto) {
    return this.bookingsService.cancel(id, req.user.sub);
  }

  @Post(':id/checkin')
  @UseGuards(RolesGuard)
  @Roles('captain')
  @ApiOperation({ summary: 'Fazer check-in (captain only)' })
  checkin(@Param('id') id: string) {
    return this.bookingsService.checkin(id);
  }

  @Patch(':id/complete')
  @UseGuards(RolesGuard)
  @Roles('captain')
  @ApiOperation({ summary: 'Concluir viagem do passageiro (captain)' })
  complete(@Param('id') id: string) {
    return this.bookingsService.complete(id);
  }
}
