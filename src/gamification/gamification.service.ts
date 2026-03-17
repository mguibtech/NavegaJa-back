import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import {
  PointTransaction,
  PointAction,
  LoyaltyLevel,
  LEVEL_THRESHOLDS,
  POINTS_MAP,
} from './point-transaction.entity';
import { Referral, ReferralStatus } from './referral.entity';
import {
  KmTransaction,
  KmTransactionType,
  KM_BLOCK,
  DISCOUNT_PER_BLOCK,
} from './km-transaction.entity';
import { User, UserRole } from '../users/user.entity';
import { ensureReferralCode } from '../users/referral-code.util';

@Injectable()
export class GamificationService {
  constructor(
    @InjectRepository(PointTransaction)
    private pointsRepo: Repository<PointTransaction>,
    @InjectRepository(User)
    private usersRepo: Repository<User>,
    @InjectRepository(Referral)
    private referralsRepo: Repository<Referral>,
    @InjectRepository(KmTransaction)
    private kmRepo: Repository<KmTransaction>,
  ) {}

  async awardPoints(
    userId: string,
    action: PointAction,
    referenceId?: string,
  ): Promise<PointTransaction> {
    const points = POINTS_MAP[action];
    const description = this.getDescription(action);

    const transaction = this.pointsRepo.create({
      userId,
      action,
      points,
      description,
      referenceId: referenceId || undefined,
    });

    const saved = await this.pointsRepo.save(transaction);

    // Atualiza totalPoints atomicamente
    await this.usersRepo.increment({ id: userId }, 'totalPoints', points);

    // Recalcula nível
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (user) {
      const newLevel = this.calculateLevel(user.totalPoints);
      const currentLevel = user.level as LoyaltyLevel;
      if (currentLevel !== newLevel) {
        await this.usersRepo.update(userId, { level: newLevel });
      }
    }

    return saved;
  }

  async awardBoatOwnerTripCompleted(
    ownerId: string | null | undefined,
    tripId: string,
  ): Promise<PointTransaction | null> {
    if (!ownerId) return null;
    return this.awardPointsOnce(
      ownerId,
      PointAction.BOAT_OWNER_TRIP_COMPLETED,
      tripId,
    );
  }

  async awardBoatOwnerPassengerCompleted(
    ownerId: string | null | undefined,
    bookingId: string,
  ): Promise<PointTransaction | null> {
    if (!ownerId) return null;
    return this.awardPointsOnce(
      ownerId,
      PointAction.BOAT_OWNER_PASSENGER_COMPLETED,
      bookingId,
    );
  }

  async awardBoatOwnerShipmentDelivered(
    ownerId: string | null | undefined,
    shipmentId: string,
  ): Promise<PointTransaction | null> {
    if (!ownerId) return null;
    return this.awardPointsOnce(
      ownerId,
      PointAction.BOAT_OWNER_SHIPMENT_DELIVERED,
      shipmentId,
    );
  }

  async checkFirstTripOfMonthBonus(
    userId: string,
    bookingId: string,
  ): Promise<PointTransaction | null> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const count = await this.pointsRepo.count({
      where: {
        userId,
        action: PointAction.BOOKING_COMPLETED,
        createdAt: MoreThanOrEqual(startOfMonth),
      },
    });

    // count === 1 = primeira viagem concluída do mês
    if (count === 1) {
      return this.awardPoints(userId, PointAction.FIRST_TRIP_MONTH, bookingId);
    }
    return null;
  }

  async getUserStats(userId: string) {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    const referralCode = await ensureReferralCode(this.usersRepo, user);

    const levelInfo =
      LEVEL_THRESHOLDS.find((l) => user.totalPoints >= l.minPoints) ||
      LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];

    const nextLevel = this.getNextLevel(user.totalPoints);

    return {
      totalPoints: user.totalPoints,
      level: user.level,
      discount: levelInfo.discount,
      referralCode,
      nextLevel: nextLevel
        ? {
            level: nextLevel.level,
            pointsNeeded: nextLevel.minPoints - user.totalPoints,
            discount: nextLevel.discount,
          }
        : null,
    };
  }

  async getHistory(userId: string, page = 1, limit = 20) {
    const [data, total] = await this.pointsRepo.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data,
      total,
      page,
      lastPage: Math.ceil(total / limit),
    };
  }

  async getLeaderboard(limit = 10) {
    const users = await this.usersRepo.find({
      select: ['id', 'name', 'avatarUrl', 'totalPoints', 'level'],
      where: [{ role: UserRole.PASSENGER }, { role: UserRole.CAPTAIN }],
      order: { totalPoints: 'DESC' },
      take: limit,
    });

    return users.map((user, index) => ({
      position: index + 1,
      id: user.id,
      name: user.name,
      avatarUrl: user.avatarUrl,
      totalPoints: user.totalPoints,
      level: user.level,
    }));
  }

  async getUserDiscount(userId: string): Promise<number> {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) return 0;

    const levelInfo =
      LEVEL_THRESHOLDS.find((l) => user.totalPoints >= l.minPoints) ||
      LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];
    return levelInfo.discount;
  }

  /**
   * Registra indicação quando novo usuário se cadastra com código de convite.
   * Pontos são dados apenas quando o indicado conclui sua 1ª viagem (convertReferral).
   */
  async processReferral(
    referralCode: string,
    newUserId: string,
  ): Promise<void> {
    const referrer = await this.usersRepo.findOne({ where: { referralCode } });
    if (!referrer) return;
    if (referrer.id === newUserId) return; // não pode se auto-indicar

    // Verificar se já existe registro de indicação para este usuário
    const existing = await this.referralsRepo.findOne({
      where: { referredId: newUserId },
    });
    if (existing) return;

    const referral = this.referralsRepo.create({
      referrerId: referrer.id,
      referredId: newUserId,
      status: ReferralStatus.PENDING,
      pointsAwarded: false,
    });
    await this.referralsRepo.save(referral);
  }

  /**
   * Chamado ao concluir a 1ª viagem do indicado → dá 50 NavegaCoins ao referrer.
   */
  async convertReferral(completedUserId: string): Promise<void> {
    const referral = await this.referralsRepo.findOne({
      where: {
        referredId: completedUserId,
        status: ReferralStatus.PENDING,
        pointsAwarded: false,
      },
    });
    if (!referral) return;

    referral.status = ReferralStatus.CONVERTED;
    referral.pointsAwarded = true;
    referral.convertedAt = new Date();
    await this.referralsRepo.save(referral);

    // Dar pontos ao quem indicou
    await this.awardPoints(
      referral.referrerId,
      PointAction.REFERRAL,
      completedUserId,
    );
  }

  /**
   * Estatísticas de indicações do usuário
   */
  async getReferralStats(userId: string) {
    const user = await this.usersRepo.findOne({
      where: { id: userId },
      select: ['id', 'referralCode'],
    });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    const referralCode = await ensureReferralCode(this.usersRepo, user);

    const referrals = await this.referralsRepo.find({
      where: { referrerId: userId },
      relations: ['referred'],
      order: { createdAt: 'DESC' },
    });

    const totalReferred = referrals.length;
    const totalConverted = referrals.filter(
      (r) => r.status === ReferralStatus.CONVERTED,
    ).length;

    return {
      referralCode,
      totalReferred,
      totalConverted,
      pendingConversions: totalReferred - totalConverted,
      list: referrals.map((r) => ({
        id: r.id,
        referredName: r.referred?.name || 'Usuário',
        referredAvatarUrl: r.referred?.avatarUrl || null,
        status: r.status,
        createdAt: r.createdAt,
        convertedAt: r.convertedAt,
      })),
    };
  }

  // ── Sistema de Milhas (km) ─────────────────────────────────────────────────

  /**
   * Calcula o desconto em R$ para um determinado número de km a resgatar.
   * km deve ser múltiplo de KM_BLOCK (500). Retorna 0 se inválido.
   */
  calcKmDiscount(redeemKm: number): number {
    if (!redeemKm || redeemKm <= 0) return 0;
    const blocks = Math.floor(redeemKm / KM_BLOCK);
    return blocks * DISCOUNT_PER_BLOCK;
  }

  /**
   * Valida e debita km do usuário ao confirmar booking.
   * Retorna o desconto em R$ aplicado.
   */
  async deductKm(
    userId: string,
    redeemKm: number,
    bookingId: string,
  ): Promise<number> {
    if (!redeemKm || redeemKm <= 0) return 0;

    if (redeemKm % KM_BLOCK !== 0) {
      throw new BadRequestException(
        `Km deve ser múltiplo de ${KM_BLOCK}. Informe 500, 1000, 1500...`,
      );
    }

    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    if (user.redeemableKm < redeemKm) {
      throw new BadRequestException(
        `Km insuficiente. Você tem ${user.redeemableKm} km disponíveis.`,
      );
    }

    const blocks = redeemKm / KM_BLOCK;
    const discount = blocks * DISCOUNT_PER_BLOCK;

    const tx = this.kmRepo.create({
      userId,
      km: -redeemKm,
      type: KmTransactionType.REDEEMED,
      description: `Resgate de ${redeemKm} km (${blocks} bloco${blocks > 1 ? 's' : ''}) → R$${discount.toFixed(2)} de desconto`,
      referenceId: bookingId,
    });
    await this.kmRepo.save(tx);

    await this.usersRepo.decrement({ id: userId }, 'redeemableKm', redeemKm);

    return discount;
  }

  /**
   * Credita km ao usuário ao completar uma viagem.
   */
  async creditKm(userId: string, km: number, bookingId: string): Promise<void> {
    if (!km || km <= 0) return;

    const tx = this.kmRepo.create({
      userId,
      km,
      type: KmTransactionType.EARNED,
      description: `${km} km acumulados na viagem`,
      referenceId: bookingId,
    });
    await this.kmRepo.save(tx);

    await this.usersRepo.increment({ id: userId }, 'totalKmTraveled', km);
    await this.usersRepo.increment({ id: userId }, 'redeemableKm', km);
  }

  /**
   * Devolve km ao usuário ao cancelar booking.
   */
  async refundKm(
    userId: string,
    kmRedeemed: number,
    bookingId: string,
  ): Promise<void> {
    if (!kmRedeemed || kmRedeemed <= 0) return;

    const tx = this.kmRepo.create({
      userId,
      km: kmRedeemed,
      type: KmTransactionType.REFUNDED,
      description: `${kmRedeemed} km devolvidos (cancelamento)`,
      referenceId: bookingId,
    });
    await this.kmRepo.save(tx);

    await this.usersRepo.increment({ id: userId }, 'redeemableKm', kmRedeemed);
  }

  /**
   * Estatísticas de km do usuário.
   */
  async getKmStats(userId: string) {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    const history = await this.kmRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 20,
    });

    const blocks = Math.floor(user.redeemableKm / KM_BLOCK);

    return {
      totalKmTraveled: user.totalKmTraveled,
      redeemableKm: user.redeemableKm,
      kmPerBlock: KM_BLOCK,
      discountPerBlock: DISCOUNT_PER_BLOCK,
      availableBlocks: blocks,
      maxDiscount: blocks * DISCOUNT_PER_BLOCK,
      history: history.map((t) => ({
        id: t.id,
        km: t.km,
        type: t.type,
        description: t.description,
        createdAt: t.createdAt,
      })),
    };
  }

  private calculateLevel(totalPoints: number): LoyaltyLevel {
    for (const threshold of LEVEL_THRESHOLDS) {
      if (totalPoints >= threshold.minPoints) {
        return threshold.level;
      }
    }
    return LoyaltyLevel.MARINHEIRO;
  }

  private getNextLevel(totalPoints: number) {
    for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
      if (LEVEL_THRESHOLDS[i].minPoints > totalPoints) {
        return LEVEL_THRESHOLDS[i];
      }
    }
    return null;
  }

  private getDescription(action: PointAction): string {
    const descriptions: Partial<Record<PointAction, string>> = {
      [PointAction.BOOKING_COMPLETED]: 'Viagem concluída',
      [PointAction.SHIPMENT_DELIVERED]: 'Encomenda entregue',
      [PointAction.CARGO_DELIVERED]: 'Carga entregue',
      [PointAction.REVIEW_CREATED]: 'Avaliação enviada',
      [PointAction.FIRST_TRIP_MONTH]: 'Bônus primeira viagem do mês',
      [PointAction.REFERRAL]: 'Indicação de amigo',
    };
    if (action === PointAction.BOAT_OWNER_TRIP_COMPLETED) {
      return 'Bonus do dono por viagem concluida no barco';
    }
    if (action === PointAction.BOAT_OWNER_PASSENGER_COMPLETED) {
      return 'Bonus do dono por passageiro transportado no barco';
    }
    if (action === PointAction.BOAT_OWNER_SHIPMENT_DELIVERED) {
      return 'Bonus do dono por encomenda entregue no barco';
    }
    return descriptions[action] || 'TransaÃ§Ã£o de pontos';
  }

  private async awardPointsOnce(
    userId: string,
    action: PointAction,
    referenceId: string,
  ): Promise<PointTransaction | null> {
    const existing = await this.pointsRepo.findOne({
      where: { userId, action, referenceId },
    });
    if (existing) return null;
    return this.awardPoints(userId, action, referenceId);
  }
}
