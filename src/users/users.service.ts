import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole, KycStatus } from './user.entity';
import { Review, ReviewType } from '../reviews/review.entity';
import { Trip } from '../trips/trip.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepo: Repository<User>,
    @InjectRepository(Review)
    private reviewsRepo: Repository<Review>,
    @InjectRepository(Trip)
    private tripsRepo: Repository<Trip>,
  ) {}

  async findById(id: string): Promise<any> {
    const user = await this.usersRepo.findOne({
      where: { id },
      relations: ['boats'],
    });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    const { passwordHash, ...safeUser } = user;

    if (user.role === UserRole.CAPTAIN) {
      return this.buildCaptainProfile(safeUser as Omit<User, 'passwordHash'>);
    }

    if (user.role === UserRole.PASSENGER) {
      return this.buildPassengerProfile(safeUser as Omit<User, 'passwordHash'>);
    }

    return safeUser;
  }

  async updateProfile(id: string, data: Partial<User>): Promise<any> {
    const { passwordHash, role, isActive, ...safeData } = data as any;

    // Se o capitão actualizou documentos, marcar como não verificado
    // para forçar nova revisão pelo admin
    const docFields = ['licensePhotoUrl', 'certificatePhotoUrl'];
    const updatingDocs = docFields.some(f => safeData[f] !== undefined);
    if (updatingDocs) {
      safeData.isVerified = false;
      safeData.verifiedAt = null;
      safeData.rejectionReason = null; // limpa rejeição anterior ao reenviar docs
    }

    await this.usersRepo.update(id, safeData);
    return this.findById(id);
  }

  async updateRating(captainId: string, newRating: number): Promise<void> {
    await this.usersRepo.update(captainId, { rating: newRating });
  }

  // ── KYC — Verificação de Identidade do Capitão ─────────────────────────────

  async submitKyc(userId: string, data: {
    selfieUrl: string;
    licensePhotoUrl: string;
    rnaqNumber?: string;
    certificatePhotoUrl?: string;
  }): Promise<{ kycStatus: KycStatus; message: string }> {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    if (user.role !== UserRole.CAPTAIN) {
      throw new ForbiddenException('Somente capitães podem enviar documentos KYC');
    }
    if (user.kycStatus === KycStatus.UNDER_REVIEW) {
      throw new BadRequestException('Seus documentos já estão em análise. Aguarde a revisão do admin.');
    }

    await this.usersRepo.update(userId, {
      selfieUrl: data.selfieUrl,
      licensePhotoUrl: data.licensePhotoUrl,
      rnaqNumber: data.rnaqNumber || null,
      certificatePhotoUrl: data.certificatePhotoUrl || null,
      kycStatus: KycStatus.UNDER_REVIEW,
      isVerified: false,
      rejectionReason: null,
    } as any);

    return {
      kycStatus: KycStatus.UNDER_REVIEW,
      message: 'Documentos enviados com sucesso. Um administrador irá analisá-los em breve.',
    };
  }

  async getKycStatus(userId: string): Promise<{
    kycStatus: KycStatus;
    isVerified: boolean;
    rejectionReason: string | null;
    selfieUrl: string | null;
    licensePhotoUrl: string | null;
    certificatePhotoUrl: string | null;
    rnaqNumber: string | null;
    verifiedAt: Date | null;
  }> {
    const user = await this.usersRepo.findOne({
      where: { id: userId },
      select: ['id', 'kycStatus', 'isVerified', 'rejectionReason', 'selfieUrl', 'licensePhotoUrl', 'certificatePhotoUrl', 'rnaqNumber', 'verifiedAt'],
    });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    return {
      kycStatus: user.kycStatus,
      isVerified: user.isVerified,
      rejectionReason: user.rejectionReason,
      selfieUrl: user.selfieUrl,
      licensePhotoUrl: user.licensePhotoUrl,
      certificatePhotoUrl: user.certificatePhotoUrl,
      rnaqNumber: user.rnaqNumber,
      verifiedAt: user.verifiedAt,
    };
  }

  // ── Perfil completo do Capitão ──────────────────────────────────────────────

  private async buildCaptainProfile(user: Omit<User, 'passwordHash'>) {
    const [reviews, totalTrips] = await Promise.all([
      this.reviewsRepo.find({
        where: { captainId: user.id, reviewType: ReviewType.PASSENGER_TO_CAPTAIN },
        relations: ['reviewer', 'trip'],
        order: { createdAt: 'DESC' },
        take: 10,
      }),
      this.tripsRepo.count({ where: { captainId: user.id } }),
    ]);

    const stats = this.buildRatingStats(reviews.map(r => r.captainRating));

    return {
      ...user,
      totalTrips,
      reviewCount: stats.total,
      recentReviews: reviews.map(r => ({
        id: r.id,
        captainRating: r.captainRating,
        captainComment: r.captainComment,
        boatRating: r.boatRating,
        boatComment: r.boatComment,
        createdAt: r.createdAt,
        reviewer: r.reviewer
          ? { id: r.reviewer.id, name: r.reviewer.name, avatarUrl: r.reviewer.avatarUrl }
          : null,
        trip: r.trip
          ? { id: r.trip.id, origin: r.trip.origin, destination: r.trip.destination }
          : null,
      })),
      ratingStats: stats,
    };
  }

  // ── Perfil completo do Passageiro ──────────────────────────────────────────

  private async buildPassengerProfile(user: Omit<User, 'passwordHash'>) {
    const reviews = await this.reviewsRepo.find({
      where: { passengerId: user.id, reviewType: ReviewType.CAPTAIN_TO_PASSENGER },
      relations: ['reviewer', 'trip'],
      order: { createdAt: 'DESC' },
      take: 10,
    });

    const stats = this.buildRatingStats(reviews.map(r => r.passengerRating));

    return {
      ...user,
      passengerReviewCount: stats.total,
      recentPassengerReviews: reviews.map(r => ({
        id: r.id,
        passengerRating: r.passengerRating,
        passengerComment: r.passengerComment,
        createdAt: r.createdAt,
        reviewer: r.reviewer
          ? { id: r.reviewer.id, name: r.reviewer.name, avatarUrl: r.reviewer.avatarUrl }
          : null,
        trip: r.trip
          ? { id: r.trip.id, origin: r.trip.origin, destination: r.trip.destination }
          : null,
      })),
      passengerRatingStats: stats,
    };
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private buildRatingStats(ratings: (number | null)[]) {
    const valid = ratings.filter((r): r is number => r !== null);
    const total = valid.length;
    if (total === 0) {
      return { total: 0, average: 0, distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } };
    }

    const distribution: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    let sum = 0;
    for (const r of valid) {
      sum += r;
      distribution[r] = (distribution[r] || 0) + 1;
    }

    return { total, average: Number((sum / total).toFixed(1)), distribution };
  }
}
