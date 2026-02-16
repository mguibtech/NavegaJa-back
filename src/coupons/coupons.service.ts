import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Coupon, CouponType, CouponApplicability } from './coupon.entity';
import { CreateCouponDto } from './dto/coupon.dto';
import { Trip } from '../trips/trip.entity';
import { Shipment } from '../shipments/shipment.entity';

@Injectable()
export class CouponsService {
  constructor(
    @InjectRepository(Coupon)
    private couponsRepo: Repository<Coupon>,
    @InjectRepository(Trip)
    private tripsRepo: Repository<Trip>,
    @InjectRepository(Shipment)
    private shipmentsRepo: Repository<Shipment>,
  ) {}

  async create(dto: CreateCouponDto): Promise<Coupon> {
    // Verificar se código já existe
    const existing = await this.couponsRepo.findOne({ where: { code: dto.code.toUpperCase() } });
    if (existing) {
      throw new BadRequestException('Código de cupom já existe');
    }

    // Validações
    if (dto.type === CouponType.PERCENTAGE && dto.value > 100) {
      throw new BadRequestException('Porcentagem não pode ser maior que 100%');
    }

    const coupon = this.couponsRepo.create({
      ...dto,
      code: dto.code.toUpperCase(),
      validFrom: dto.validFrom ? new Date(dto.validFrom) : null,
      validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
    });

    return this.couponsRepo.save(coupon);
  }

  async findAll(): Promise<Coupon[]> {
    return this.couponsRepo.find({ order: { createdAt: 'DESC' } });
  }

  async findActive(): Promise<Coupon[]> {
    const now = new Date();
    const qb = this.couponsRepo.createQueryBuilder('coupon');

    qb.where('coupon.isActive = :active', { active: true });

    // Verificar se está dentro do período de validade
    qb.andWhere(
      '(coupon.validFrom IS NULL OR coupon.validFrom <= :now)',
      { now }
    );
    qb.andWhere(
      '(coupon.validUntil IS NULL OR coupon.validUntil >= :now)',
      { now }
    );

    // Verificar se não atingiu limite de uso
    qb.andWhere(
      '(coupon.usageLimit IS NULL OR coupon.usageCount < coupon.usageLimit)'
    );

    return qb.orderBy('coupon.createdAt', 'DESC').getMany();
  }

  async findByCode(code: string): Promise<Coupon> {
    const coupon = await this.couponsRepo.findOne({ where: { code: code.toUpperCase() } });
    if (!coupon) {
      throw new NotFoundException('Cupom não encontrado');
    }
    return coupon;
  }

  async validate(
    code: string,
    userId: string,
    totalPrice: number,
    trip?: Trip
  ): Promise<{
    valid: boolean;
    coupon?: Coupon;
    discount?: number;
    message?: string;
  }> {
    const coupon = await this.couponsRepo.findOne({ where: { code: code.toUpperCase() } });

    if (!coupon) {
      return { valid: false, message: 'Cupom não encontrado' };
    }

    // Verificar se cupom é aplicável a viagens
    if (coupon.applicableTo === CouponApplicability.SHIPMENTS) {
      return { valid: false, message: 'Este cupom é válido apenas para encomendas' };
    }

    if (!coupon.isActive) {
      return { valid: false, message: 'Cupom inativo' };
    }

    // Verificar datas
    const now = new Date();
    if (coupon.validFrom && now < coupon.validFrom) {
      return { valid: false, message: 'Cupom ainda não é válido' };
    }
    if (coupon.validUntil && now > coupon.validUntil) {
      return { valid: false, message: 'Cupom expirado' };
    }

    // Verificar limite de uso
    if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
      return { valid: false, message: 'Cupom esgotado' };
    }

    // Verificar valor mínimo
    if (coupon.minPurchase && totalPrice < Number(coupon.minPurchase)) {
      return {
        valid: false,
        message: `Valor mínimo de compra: R$ ${Number(coupon.minPurchase).toFixed(2)}`
      };
    }

    // Verificar filtros de rota (se cupom tiver restrições de rota)
    if (trip && (coupon.fromCity || coupon.toCity)) {
      if (coupon.fromCity) {
        const tripFrom = trip.origin.toLowerCase();
        const couponFrom = coupon.fromCity.toLowerCase();
        if (!tripFrom.includes(couponFrom) && !couponFrom.includes(tripFrom)) {
          return {
            valid: false,
            message: `Este cupom só vale para viagens saindo de ${coupon.fromCity}`
          };
        }
      }

      if (coupon.toCity) {
        const tripTo = trip.destination.toLowerCase();
        const couponTo = coupon.toCity.toLowerCase();
        if (!tripTo.includes(couponTo) && !couponTo.includes(tripTo)) {
          return {
            valid: false,
            message: `Este cupom só vale para viagens indo para ${coupon.toCity}`
          };
        }
      }
    }

    // Calcular desconto
    let discount = 0;
    if (coupon.type === CouponType.PERCENTAGE) {
      discount = (totalPrice * Number(coupon.value)) / 100;
    } else {
      discount = Number(coupon.value);
    }

    // Aplicar desconto máximo
    if (coupon.maxDiscount && discount > Number(coupon.maxDiscount)) {
      discount = Number(coupon.maxDiscount);
    }

    return { valid: true, coupon, discount };
  }

  /**
   * Validar cupom para encomendas (shipments)
   */
  async validateForShipment(
    code: string,
    userId: string,
    shipmentId: string,
  ): Promise<{
    valid: boolean;
    coupon?: Coupon;
    discount?: number;
    message?: string;
  }> {
    const coupon = await this.couponsRepo.findOne({ where: { code: code.toUpperCase() } });

    if (!coupon) {
      return { valid: false, message: 'Cupom não encontrado' };
    }

    // Verificar se cupom é aplicável a encomendas
    if (coupon.applicableTo === CouponApplicability.TRIPS) {
      return { valid: false, message: 'Este cupom é válido apenas para viagens' };
    }

    if (!coupon.isActive) {
      return { valid: false, message: 'Cupom inativo' };
    }

    // Verificar datas
    const now = new Date();
    if (coupon.validFrom && now < coupon.validFrom) {
      return { valid: false, message: 'Cupom ainda não é válido' };
    }
    if (coupon.validUntil && now > coupon.validUntil) {
      return { valid: false, message: 'Cupom expirado' };
    }

    // Verificar limite de uso
    if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
      return { valid: false, message: 'Cupom esgotado' };
    }

    // Buscar encomenda com trip para verificar filtros
    const shipment = await this.shipmentsRepo.findOne({
      where: { id: shipmentId },
      relations: ['trip'],
    });

    if (!shipment) {
      return { valid: false, message: 'Encomenda não encontrada' };
    }

    const totalPrice = Number(shipment.totalPrice);

    // Verificar valor mínimo
    if (coupon.minPurchase && totalPrice < Number(coupon.minPurchase)) {
      return {
        valid: false,
        message: `Valor mínimo de compra: R$ ${Number(coupon.minPurchase).toFixed(2)}`
      };
    }

    // Verificar filtros de peso
    const weight = Number(shipment.weight);
    if (coupon.minWeight && weight < Number(coupon.minWeight)) {
      return {
        valid: false,
        message: `Este cupom é válido apenas para encomendas acima de ${Number(coupon.minWeight)}kg`
      };
    }
    if (coupon.maxWeight && weight > Number(coupon.maxWeight)) {
      return {
        valid: false,
        message: `Este cupom é válido apenas para encomendas até ${Number(coupon.maxWeight)}kg`
      };
    }

    // Verificar filtros de rota (se cupom tiver restrições de rota)
    if (shipment.trip && (coupon.fromCity || coupon.toCity)) {
      if (coupon.fromCity) {
        const tripFrom = shipment.trip.origin.toLowerCase();
        const couponFrom = coupon.fromCity.toLowerCase();
        if (!tripFrom.includes(couponFrom) && !couponFrom.includes(tripFrom)) {
          return {
            valid: false,
            message: `Este cupom só vale para encomendas saindo de ${coupon.fromCity}`
          };
        }
      }

      if (coupon.toCity) {
        const tripTo = shipment.trip.destination.toLowerCase();
        const couponTo = coupon.toCity.toLowerCase();
        if (!tripTo.includes(couponTo) && !couponTo.includes(tripTo)) {
          return {
            valid: false,
            message: `Este cupom só vale para encomendas indo para ${coupon.toCity}`
          };
        }
      }
    }

    // Calcular desconto
    let discount = 0;
    if (coupon.type === CouponType.PERCENTAGE) {
      discount = (totalPrice * Number(coupon.value)) / 100;
    } else {
      discount = Number(coupon.value);
    }

    // Aplicar desconto máximo
    if (coupon.maxDiscount && discount > Number(coupon.maxDiscount)) {
      discount = Number(coupon.maxDiscount);
    }

    return { valid: true, coupon, discount };
  }

  async incrementUsage(couponId: string): Promise<void> {
    await this.couponsRepo.increment({ id: couponId }, 'usageCount', 1);
  }

  async update(id: string, dto: Partial<CreateCouponDto>): Promise<Coupon> {
    const coupon = await this.couponsRepo.findOne({ where: { id } });
    if (!coupon) {
      throw new NotFoundException('Cupom não encontrado');
    }

    if (dto.code && dto.code !== coupon.code) {
      const existing = await this.couponsRepo.findOne({ where: { code: dto.code.toUpperCase() } });
      if (existing) {
        throw new BadRequestException('Código de cupom já existe');
      }
      dto.code = dto.code.toUpperCase();
    }

    Object.assign(coupon, dto);
    return this.couponsRepo.save(coupon);
  }

  async delete(id: string): Promise<void> {
    const result = await this.couponsRepo.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException('Cupom não encontrado');
    }
  }
}
