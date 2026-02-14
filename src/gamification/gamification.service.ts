import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import {
  PointTransaction, PointAction, LoyaltyLevel,
  LEVEL_THRESHOLDS, POINTS_MAP,
} from './point-transaction.entity';
import { User } from '../users/user.entity';

@Injectable()
export class GamificationService {
  constructor(
    @InjectRepository(PointTransaction)
    private pointsRepo: Repository<PointTransaction>,
    @InjectRepository(User)
    private usersRepo: Repository<User>,
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

    const saved = await this.pointsRepo.save(transaction) as PointTransaction;

    // Atualiza totalPoints atomicamente
    await this.usersRepo.increment({ id: userId }, 'totalPoints', points);

    // Recalcula nível
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (user) {
      const newLevel = this.calculateLevel(user.totalPoints);
      if (user.level !== newLevel) {
        await this.usersRepo.update(userId, { level: newLevel });
      }
    }

    return saved;
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

    const levelInfo = LEVEL_THRESHOLDS.find(l => user.totalPoints >= l.minPoints)
      || LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];

    const nextLevel = this.getNextLevel(user.totalPoints);

    return {
      totalPoints: user.totalPoints,
      level: user.level,
      discount: levelInfo.discount,
      referralCode: user.referralCode,
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

    const levelInfo = LEVEL_THRESHOLDS.find(l => user.totalPoints >= l.minPoints)
      || LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];
    return levelInfo.discount;
  }

  async processReferral(referralCode: string, newUserId: string): Promise<void> {
    const referrer = await this.usersRepo.findOne({ where: { referralCode } });
    if (!referrer) return;

    await this.awardPoints(referrer.id, PointAction.REFERRAL, newUserId);
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
    const descriptions: Record<PointAction, string> = {
      [PointAction.BOOKING_COMPLETED]: 'Viagem concluída',
      [PointAction.SHIPMENT_DELIVERED]: 'Encomenda entregue',
      [PointAction.CARGO_DELIVERED]: 'Carga entregue',
      [PointAction.REVIEW_CREATED]: 'Avaliação enviada',
      [PointAction.FIRST_TRIP_MONTH]: 'Bônus primeira viagem do mês',
      [PointAction.REFERRAL]: 'Indicação de amigo',
    };
    return descriptions[action];
  }
}
