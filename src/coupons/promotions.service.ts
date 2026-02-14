import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { Promotion } from './promotion.entity';
import { CreatePromotionDto, UpdatePromotionDto } from './dto/promotion.dto';
import { Trip, TripStatus } from '../trips/trip.entity';
import { Coupon, CouponType } from './coupon.entity';

@Injectable()
export class PromotionsService {
  constructor(
    @InjectRepository(Promotion)
    private promotionsRepo: Repository<Promotion>,
    @InjectRepository(Trip)
    private tripsRepo: Repository<Trip>,
  ) {}

  async create(dto: CreatePromotionDto): Promise<Promotion> {
    const promotion = this.promotionsRepo.create({
      ...dto,
      startDate: dto.startDate ? new Date(dto.startDate) : null,
      endDate: dto.endDate ? new Date(dto.endDate) : null,
    });

    return this.promotionsRepo.save(promotion);
  }

  async findAll(): Promise<Promotion[]> {
    return this.promotionsRepo.find({
      order: { priority: 'DESC', createdAt: 'DESC' }
    });
  }

  async findActive(): Promise<Promotion[]> {
    const now = new Date();
    const qb = this.promotionsRepo.createQueryBuilder('promotion');

    qb.leftJoinAndSelect('promotion.coupon', 'coupon');
    qb.where('promotion.isActive = :active', { active: true });

    // Verificar se está dentro do período de validade
    qb.andWhere(
      '(promotion.startDate IS NULL OR promotion.startDate <= :now)',
      { now }
    );
    qb.andWhere(
      '(promotion.endDate IS NULL OR promotion.endDate >= :now)',
      { now }
    );

    return qb
      .orderBy('promotion.priority', 'DESC')
      .addOrderBy('promotion.createdAt', 'DESC')
      .take(10)
      .getMany();
  }

  async getSampleTripsForPromotion(promotion: Promotion, limit: number = 5) {
    const now = new Date();
    const qb = this.tripsRepo.createQueryBuilder('trip');

    // Apenas viagens futuras e ativas
    qb.where('trip.departureAt > :now', { now });
    qb.andWhere('trip.status = :status', { status: TripStatus.SCHEDULED });
    qb.andWhere('trip.availableSeats > 0');

    // Aplicar filtros de rota se houver
    if (promotion.fromCity) {
      qb.andWhere('LOWER(trip.origin) LIKE LOWER(:from)', {
        from: `%${promotion.fromCity}%`
      });
    }
    if (promotion.toCity) {
      qb.andWhere('LOWER(trip.destination) LIKE LOWER(:to)', {
        to: `%${promotion.toCity}%`
      });
    }

    const trips = await qb
      .orderBy('trip.departureAt', 'ASC')
      .take(limit)
      .getMany();

    // Calcular desconto para cada viagem
    if (!promotion.coupon) {
      return trips.map(trip => ({
        id: trip.id,
        from: trip.origin,
        to: trip.destination,
        departureDate: trip.departureAt,
        originalPrice: Number(trip.price),
        discountedPrice: Number(trip.price),
        savedAmount: 0,
      }));
    }

    return trips.map(trip => {
      const originalPrice = Number(trip.price);
      let discountAmount = 0;

      // TypeScript narrowing - já verificamos acima, mas precisamos verificar novamente aqui
      const coupon = promotion.coupon;
      if (coupon) {
        if (coupon.type === CouponType.PERCENTAGE) {
          discountAmount = (originalPrice * Number(coupon.value)) / 100;

          // Aplicar desconto máximo se configurado
          if (coupon.maxDiscount && discountAmount > Number(coupon.maxDiscount)) {
            discountAmount = Number(coupon.maxDiscount);
          }
        } else if (coupon.type === CouponType.FIXED) {
          discountAmount = Number(coupon.value);
        }
      }

      const discountedPrice = Math.max(0, originalPrice - discountAmount);

      return {
        id: trip.id,
        from: trip.origin,
        to: trip.destination,
        departureDate: trip.departureAt,
        originalPrice,
        discountedPrice,
        savedAmount: discountAmount,
      };
    });
  }

  async findOne(id: string): Promise<Promotion> {
    const promotion = await this.promotionsRepo.findOne({ where: { id } });
    if (!promotion) {
      throw new NotFoundException('Promoção não encontrada');
    }
    return promotion;
  }

  async update(id: string, dto: UpdatePromotionDto): Promise<Promotion> {
    const promotion = await this.findOne(id);

    Object.assign(promotion, {
      ...dto,
      startDate: dto.startDate ? new Date(dto.startDate) : promotion.startDate,
      endDate: dto.endDate ? new Date(dto.endDate) : promotion.endDate,
    });

    return this.promotionsRepo.save(promotion);
  }

  async delete(id: string): Promise<void> {
    const result = await this.promotionsRepo.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException('Promoção não encontrada');
    }
  }

  async toggleActive(id: string): Promise<Promotion> {
    const promotion = await this.findOne(id);
    promotion.isActive = !promotion.isActive;
    return this.promotionsRepo.save(promotion);
  }
}
