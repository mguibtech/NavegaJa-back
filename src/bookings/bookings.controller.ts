import { Controller, Post, Get, Patch, Param, Body, UseGuards, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, Roles } from '../common/roles.guard';

@ApiTags('Bookings')
@Controller('bookings')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BookingsController {
  constructor(private bookingsService: BookingsService) {}

  @Post()
  @ApiOperation({ summary: 'Criar reserva' })
  create(@Request() req: any, @Body() dto: CreateBookingDto) {
    return this.bookingsService.create(req.user.sub, dto);
  }

  @Get('my-bookings')
  @ApiOperation({ summary: 'Minhas reservas' })
  myBookings(@Request() req: any) {
    return this.bookingsService.findByPassenger(req.user.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhes da reserva' })
  findById(@Param('id') id: string) {
    return this.bookingsService.findById(id);
  }

  @Get('trip/:tripId')
  @UseGuards(RolesGuard)
  @Roles('captain')
  @ApiOperation({ summary: 'Passageiros de uma viagem (captain)' })
  findByTrip(@Param('tripId') tripId: string) {
    return this.bookingsService.findByTrip(tripId);
  }

  @Patch(':id/checkin')
  @UseGuards(RolesGuard)
  @Roles('captain')
  @ApiOperation({ summary: 'Check-in via QR (captain)' })
  checkin(@Param('id') id: string) {
    return this.bookingsService.checkin(id);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancelar reserva' })
  cancel(@Param('id') id: string, @Request() req: any) {
    return this.bookingsService.cancel(id, req.user.sub);
  }
}
