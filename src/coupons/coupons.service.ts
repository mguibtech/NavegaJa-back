import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Coupon, CouponType } from './coupon.entity';
import { CreateCouponDto } from './dto/coupon.dto';

@Injectable()
export class CouponsService {
  constructor(
    @InjectRepository(Coupon)
    private couponsRepo: Repository<Coupon>,
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

  async findByCode(code: string): Promise<Coupon> {
    const coupon = await this.couponsRepo.findOne({ where: { code: code.toUpperCase() } });
    if (!coupon) {
      throw new NotFoundException('Cupom não encontrado');
    }
    return coupon;
  }

  async validate(code: string, userId: string, totalPrice: number): Promise<{
    valid: boolean;
    coupon?: Coupon;
    discount?: number;
    message?: string;
  }> {
    const coupon = await this.couponsRepo.findOne({ where: { code: code.toUpperCase() } });

    if (!coupon) {
      return { valid: false, message: 'Cupom não encontrado' };
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
    if (coupon.minPurchase && totalPrice < coupon.minPurchase) {
      return {
        valid: false,
        message: `Valor mínimo de compra: R$ ${coupon.minPurchase}`
      };
    }

    // Calcular desconto
    let discount = 0;
    if (coupon.type === CouponType.PERCENTAGE) {
      discount = (totalPrice * coupon.value) / 100;
    } else {
      discount = coupon.value;
    }

    // Aplicar desconto máximo
    if (coupon.maxDiscount && discount > coupon.maxDiscount) {
      discount = coupon.maxDiscount;
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
