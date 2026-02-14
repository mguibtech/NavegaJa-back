import { Controller, Post, Get, Put, Delete, Param, Body, UseGuards, NotFoundException } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CouponsService } from './coupons.service';
import { CreateCouponDto, ValidateCouponDto } from './dto/coupon.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, Roles } from '../common/roles.guard';
import { Trip } from '../trips/trip.entity';

@ApiTags('Coupons')
@Controller('coupons')
export class CouponsController {
  constructor(
    private couponsService: CouponsService,
    @InjectRepository(Trip)
    private tripsRepo: Repository<Trip>,
  ) {}

  @Get('active')
  @ApiOperation({ summary: 'Listar cupons ativos (app público)' })
  async findActive() {
    const coupons = await this.couponsService.findActive();
    return {
      coupons: coupons.map(c => ({
        code: c.code,
        description: c.description,
        type: c.type,
        value: Number(c.value),
        minPurchase: c.minPurchase ? Number(c.minPurchase) : undefined,
        maxDiscount: c.maxDiscount ? Number(c.maxDiscount) : undefined,
        validUntil: c.validUntil,
      }))
    };
  }

  @Post('validate')
  @ApiOperation({ summary: 'Validar cupom e calcular desconto (app público)' })
  async validateCoupon(@Body() dto: ValidateCouponDto) {
    const { code, tripId, quantity } = dto;

    // Buscar viagem
    const trip = await this.tripsRepo.findOne({ where: { id: tripId } });
    if (!trip) {
      throw new NotFoundException('Viagem não encontrada');
    }

    // Calcular preço total
    const totalPrice = Number(trip.price) * quantity;

    // Validar cupom (passando trip para verificar filtros de rota)
    const result = await this.couponsService.validate(code, '', totalPrice, trip);

    if (!result.valid) {
      return {
        valid: false,
        message: result.message,
      };
    }

    // TypeScript narrowing - garantir que coupon e discount existem
    if (!result.coupon || result.discount === undefined) {
      return {
        valid: false,
        message: 'Erro ao validar cupom',
      };
    }

    return {
      valid: true,
      coupon: {
        code: result.coupon.code,
        type: result.coupon.type,
        value: Number(result.coupon.value),
      },
      originalPrice: totalPrice,
      discount: result.discount,
      finalPrice: totalPrice - result.discount,
      savedAmount: result.discount,
    };
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Criar cupom (admin only)' })
  create(@Body() dto: CreateCouponDto) {
    return this.couponsService.create(dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar cupons (admin only)' })
  findAll() {
    return this.couponsService.findAll();
  }

  @Get(':code')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Buscar cupom por código' })
  findByCode(@Param('code') code: string) {
    return this.couponsService.findByCode(code);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Atualizar cupom (admin only)' })
  update(@Param('id') id: string, @Body() dto: Partial<CreateCouponDto>) {
    return this.couponsService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Deletar cupom (admin only)' })
  delete(@Param('id') id: string) {
    return this.couponsService.delete(id);
  }
}
