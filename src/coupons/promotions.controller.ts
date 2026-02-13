import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CouponsService } from './coupons.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { Trip, TripStatus } from '../trips/trip.entity';
import { ActivePromotionsResponseDto } from './dto/promotions.dto';

@ApiTags('Promotions')
@Controller('promotions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PromotionsController {
  constructor(
    private couponsService: CouponsService,
    @InjectRepository(Trip)
    private tripsRepo: Repository<Trip>,
  ) {}

  @Get('active')
  @ApiOperation({ summary: 'Promoções ativas (cupons + viagens com desconto)' })
  @ApiOkResponse({ type: ActivePromotionsResponseDto })
  async getActivePromotions(): Promise<ActivePromotionsResponseDto> {
    // Buscar cupons ativos
    const coupons = await this.couponsService.findActive();

    // Buscar viagens com desconto
    const trips = await this.tripsRepo.find({
      where: {
        discount: MoreThan(0),
        status: TripStatus.SCHEDULED,
      },
      relations: ['captain', 'boat'],
      order: { departureAt: 'ASC' },
      take: 10,
    });

    return {
      coupons: coupons.map(c => ({
        code: c.code,
        description: c.description || '',
        type: c.type,
        value: Number(c.value),
        minPurchase: c.minPurchase ? Number(c.minPurchase) : null,
        validUntil: c.validUntil,
      })),
      trips: trips.map(t => ({
        id: t.id,
        origin: t.origin,
        destination: t.destination,
        price: Number(t.price),
        discount: t.discount,
        discountedPrice: Number(t.price) * (1 - t.discount / 100),
        departureAt: t.departureAt,
      })),
    };
  }
}
