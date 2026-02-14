import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, Roles } from '../common/roles.guard';
import { PromotionsService } from './promotions.service';
import { ActivePromotionsResponseDto, PromotionBannerDto } from './dto/promotions.dto';
import { CreatePromotionDto, UpdatePromotionDto } from './dto/promotion.dto';

@ApiTags('Promotions')
@Controller('promotions')
export class PromotionsController {
  constructor(private promotionsService: PromotionsService) {}

  @Get('active')
  @ApiOperation({ summary: 'Banners de promoções ativas com viagens e descontos' })
  @ApiOkResponse({ type: ActivePromotionsResponseDto })
  async getActivePromotions(): Promise<ActivePromotionsResponseDto> {
    const promotions = await this.promotionsService.findActive();

    const promotionsWithTrips = await Promise.all(
      promotions.map(async (p) => {
        const sampleTrips = await this.promotionsService.getSampleTripsForPromotion(p);

        return {
          id: p.id,
          title: p.title,
          description: p.description,
          imageUrl: p.imageUrl,
          ctaText: p.ctaText || undefined,
          ctaAction: p.ctaAction || undefined,
          ctaValue: p.ctaValue || undefined,
          backgroundColor: p.backgroundColor || undefined,
          textColor: p.textColor || undefined,
          priority: p.priority,
          startDate: p.startDate || undefined,
          endDate: p.endDate || undefined,
          coupon: p.coupon ? {
            code: p.coupon.code,
            type: p.coupon.type,
            value: Number(p.coupon.value),
            minPurchase: p.coupon.minPurchase ? Number(p.coupon.minPurchase) : undefined,
            maxDiscount: p.coupon.maxDiscount ? Number(p.coupon.maxDiscount) : undefined,
          } : undefined,
          fromCity: p.fromCity || undefined,
          toCity: p.toCity || undefined,
          sampleTrips,
        };
      })
    );

    return {
      promotions: promotionsWithTrips,
    };
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Criar promoção (admin only)' })
  create(@Body() dto: CreatePromotionDto) {
    return this.promotionsService.create(dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar todas promoções (admin only)' })
  findAll() {
    return this.promotionsService.findAll();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Buscar promoção por ID (admin only)' })
  findOne(@Param('id') id: string) {
    return this.promotionsService.findOne(id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Atualizar promoção (admin only)' })
  update(@Param('id') id: string, @Body() dto: UpdatePromotionDto) {
    return this.promotionsService.update(id, dto);
  }

  @Put(':id/toggle')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Ativar/desativar promoção (admin only)' })
  toggleActive(@Param('id') id: string) {
    return this.promotionsService.toggleActive(id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Deletar promoção (admin only)' })
  delete(@Param('id') id: string) {
    return this.promotionsService.delete(id);
  }
}
