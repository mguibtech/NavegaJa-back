import { Controller, Post, Get, Put, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { CouponsService } from './coupons.service';
import { CreateCouponDto } from './dto/coupon.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, Roles } from '../common/roles.guard';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { Trip } from '../trips/trip.entity';
import { ActivePromotionsResponseDto } from './dto/promotions.dto';

@ApiTags('Coupons')
@Controller('coupons')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CouponsController {
  constructor(
    private couponsService: CouponsService,
    @InjectRepository(Trip)
    private tripsRepo: Repository<Trip>,
  ) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Criar cupom (admin only)' })
  create(@Body() dto: CreateCouponDto) {
    return this.couponsService.create(dto);
  }

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
        status: 'scheduled',
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

  @Get()
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Listar cupons (admin only)' })
  findAll() {
    return this.couponsService.findAll();
  }

  @Get(':code')
  @ApiOperation({ summary: 'Buscar cupom por código' })
  findByCode(@Param('code') code: string) {
    return this.couponsService.findByCode(code);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Atualizar cupom (admin only)' })
  update(@Param('id') id: string, @Body() dto: Partial<CreateCouponDto>) {
    return this.couponsService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Deletar cupom (admin only)' })
  delete(@Param('id') id: string) {
    return this.couponsService.delete(id);
  }
}
