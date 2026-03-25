import {
  Controller,
  Post,
  Param,
  UseGuards,
  Request,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PixService } from './pix.service';
import { Booking } from '../bookings/booking.entity';
import { Shipment } from '../shipments/shipment.entity';

@ApiTags('Payments')
@Controller('payments')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PaymentsController {
  constructor(
    private pixService: PixService,
    @InjectRepository(Booking)
    private bookingsRepo: Repository<Booking>,
    @InjectRepository(Shipment)
    private shipmentsRepo: Repository<Shipment>,
  ) {}

  @Post('pix/booking/:id')
  @ApiOperation({
    summary: 'Gerar QR Code PIX para reserva',
    description:
      'Gera um QR Code PIX com validade de 15 minutos para pagar a reserva indicada. Apenas o próprio passageiro pode gerar.',
  })
  @ApiResponse({
    status: 201,
    description: 'QR Code PIX gerado com sucesso',
    schema: {
      example: {
        pixQrCode: '00020126580014BR.GOV.BCB.PIX...',
        pixQrCodeImage: 'data:image/png;base64,...',
        pixTxid: 'NVGJ12345678ABCD1234',
        pixExpiresAt: '2026-02-19T13:15:00.000Z',
        pixKey: 'navegaja@example.com',
        amount: 120.5,
        description: 'NavegaJá — Reserva Manaus → Parintins',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Utilizador nÃ£o autenticado' })
  @ApiResponse({
    status: 403,
    description: 'Reserva nÃ£o pertence ao utilizador autenticado',
  })
  @ApiResponse({ status: 404, description: 'Reserva nÃ£o encontrada' })
  @ApiResponse({ status: 500, description: 'Falha ao gerar dados PIX' })
  async generatePixForBooking(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const booking = await this.bookingsRepo.findOne({
      where: { id },
      relations: ['trip'],
    });
    if (!booking) throw new NotFoundException('Reserva não encontrada');
    if (booking.passengerId !== req.user.sub) {
      throw new ForbiddenException('Esta reserva não pertence a você');
    }

    const description = `NavegaJá — Reserva ${booking.trip?.origin ?? ''} → ${booking.trip?.destination ?? ''}`;
    const pixData = await this.pixService.generatePixPayment(
      booking.id,
      Number(booking.totalPrice),
      description,
    );

    return { ...pixData, amount: Number(booking.totalPrice), description };
  }

  @Post('pix/shipment/:id')
  @ApiOperation({
    summary: 'Gerar QR Code PIX para encomenda',
    description:
      'Gera um QR Code PIX com validade de 15 minutos para pagar a encomenda indicada. Apenas o remetente pode gerar.',
  })
  @ApiResponse({
    status: 201,
    description: 'QR Code PIX gerado com sucesso',
    schema: {
      example: {
        pixQrCode: '00020126580014BR.GOV.BCB.PIX...',
        pixQrCodeImage: 'data:image/png;base64,...',
        pixTxid: 'NVGJ12345678ABCD1234',
        pixExpiresAt: '2026-02-19T13:15:00.000Z',
        pixKey: 'navegaja@example.com',
        amount: 45.0,
        description: 'NavegaJá — Encomenda TRK-ABC12345',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Utilizador nÃ£o autenticado' })
  @ApiResponse({
    status: 403,
    description: 'Encomenda nÃ£o pertence ao utilizador autenticado',
  })
  @ApiResponse({ status: 404, description: 'Encomenda nÃ£o encontrada' })
  @ApiResponse({ status: 500, description: 'Falha ao gerar dados PIX' })
  async generatePixForShipment(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const shipment = await this.shipmentsRepo.findOne({ where: { id } });
    if (!shipment) throw new NotFoundException('Encomenda não encontrada');
    if (shipment.senderId !== req.user.sub) {
      throw new ForbiddenException('Esta encomenda não pertence a você');
    }

    const description = `NavegaJá — Encomenda ${shipment.trackingCode}`;
    const pixData = await this.pixService.generatePixPayment(
      shipment.id,
      Number(shipment.totalPrice),
      description,
    );

    return { ...pixData, amount: Number(shipment.totalPrice), description };
  }
}
