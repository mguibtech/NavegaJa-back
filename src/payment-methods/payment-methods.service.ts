import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentMethod, CardBrand } from './payment-method.entity';
import { CreatePaymentMethodDto } from './dto/create-payment-method.dto';

const MAX_CARDS_PER_USER = 5;

@Injectable()
export class PaymentMethodsService {
  constructor(
    @InjectRepository(PaymentMethod)
    private repo: Repository<PaymentMethod>,
  ) {}

  async findAll(userId: string): Promise<PaymentMethod[]> {
    return this.repo.find({
      where: { userId },
      order: { isDefault: 'DESC', createdAt: 'ASC' },
    });
  }

  async create(
    userId: string,
    dto: CreatePaymentMethodDto,
  ): Promise<PaymentMethod> {
    // Validar expiração
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    if (
      dto.expiryYear < currentYear ||
      (dto.expiryYear === currentYear && dto.expiryMonth < currentMonth)
    ) {
      throw new BadRequestException('Cartão expirado');
    }

    // Limite por utilizador
    const count = await this.repo.count({ where: { userId } });
    if (count >= MAX_CARDS_PER_USER) {
      throw new BadRequestException(
        `Limite de ${MAX_CARDS_PER_USER} cartões atingido`,
      );
    }

    const last4 = dto.cardNumber.slice(-4);
    const brand = this.detectBrand(dto.cardNumber);

    // Se for o primeiro cartão ou pedir setAsDefault, desmarcar os outros
    const setDefault = dto.setAsDefault || count === 0;
    if (setDefault) {
      await this.repo.update({ userId }, { isDefault: false });
    }

    const card = this.repo.create({
      userId,
      type: dto.type,
      brand,
      last4,
      holderName: dto.holderName.toUpperCase().trim(),
      expiryMonth: dto.expiryMonth,
      expiryYear: dto.expiryYear,
      isDefault: setDefault,
      externalId: null,
      externalProvider: null,
    });

    return this.repo.save(card);
  }

  async setDefault(id: string, userId: string): Promise<PaymentMethod> {
    const card = await this.repo.findOne({ where: { id } });
    if (!card) throw new NotFoundException('Cartão não encontrado');
    if (card.userId !== userId)
      throw new ForbiddenException('Este cartão não pertence a você');

    await this.repo.update({ userId }, { isDefault: false });
    await this.repo.update(id, { isDefault: true });
    return this.repo.findOne({ where: { id } }) as Promise<PaymentMethod>;
  }

  async remove(id: string, userId: string): Promise<void> {
    const card = await this.repo.findOne({ where: { id } });
    if (!card) throw new NotFoundException('Cartão não encontrado');
    if (card.userId !== userId)
      throw new ForbiddenException('Este cartão não pertence a você');

    const wasDefault = card.isDefault;
    await this.repo.delete(id);

    // Se era o default, promover o cartão mais antigo restante
    if (wasDefault) {
      const next = await this.repo.findOne({
        where: { userId },
        order: { createdAt: 'ASC' },
      });
      if (next) {
        await this.repo.update(next.id, { isDefault: true });
      }
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private detectBrand(cardNumber: string): CardBrand {
    const n = cardNumber.replace(/\s/g, '');

    if (/^3[47]/.test(n)) return CardBrand.AMEX;

    // Elo — BINs brasileiros principais
    if (
      /^(4011|4312|4389|4514|4576|5041|5066|5090|636297|636368|636369|509091|509048|509067|509049|509069|509050|509074|509068|509040|509045|509051|509046|509099|509078|509053|509071|509070|509007|509061|509062|509063|509064|509065|627780)/.test(
        n,
      )
    ) {
      return CardBrand.ELO;
    }

    // Hipercard
    if (/^(384100|384140|384160|606282|637095|637568)/.test(n)) {
      return CardBrand.HIPERCARD;
    }

    // Mastercard (inclui séries 2xxx do novo range)
    if (/^5[1-5]/.test(n) || /^2(2[2-9][1-9]|[3-6]\d{2}|7[01]\d|720)/.test(n)) {
      return CardBrand.MASTERCARD;
    }

    if (/^4/.test(n)) return CardBrand.VISA;

    return CardBrand.OTHER;
  }
}
