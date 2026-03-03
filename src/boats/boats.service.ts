import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Boat } from './boat.entity';
import { CreateBoatDto } from './dto/create-boat.dto';
import { UpdateBoatDto } from './dto/update-boat.dto';
import { Review, ReviewType } from '../reviews/review.entity';
import { Trip, TripStatus } from '../trips/trip.entity';
import { User } from '../users/user.entity';
import { BoatStaff } from '../boat-staff/boat-staff.entity';

@Injectable()
export class BoatsService {
  constructor(
    @InjectRepository(Boat)
    private boatsRepo: Repository<Boat>,
    @InjectRepository(Review)
    private reviewsRepo: Repository<Review>,
    @InjectRepository(Trip)
    private tripsRepo: Repository<Trip>,
    @InjectRepository(User)
    private usersRepo: Repository<User>,
    @InjectRepository(BoatStaff)
    private boatStaffRepo: Repository<BoatStaff>,
  ) {}

  async create(ownerId: string, dto: CreateBoatDto): Promise<Boat> {
    // Capitão precisa ter documentação aprovada pelo admin antes de cadastrar embarcação
    const captain = await this.usersRepo.findOne({ where: { id: ownerId } });
    if (!captain?.isVerified) {
      throw new ForbiddenException(
        'Sua documentação ainda não foi aprovada pelo administrador. Aguarde a verificação antes de cadastrar uma embarcação.',
      );
    }

    const boat = this.boatsRepo.create({ ...dto, ownerId });
    return this.boatsRepo.save(boat);
  }

  async update(id: string, ownerId: string, dto: UpdateBoatDto): Promise<any> {
    const boat = await this.boatsRepo.findOne({ where: { id } });
    if (!boat) throw new NotFoundException('Embarcação não encontrada');
    if (boat.ownerId !== ownerId) throw new ForbiddenException('Esta embarcação não pertence a você');

    // Se enviou documentos ou fotos, marcar como pendente de re-verificação
    const needsReview = dto.documentPhotos && dto.documentPhotos.length > 0;
    const updateData: Partial<Boat> = { ...dto };
    if (needsReview && boat.isVerified) {
      updateData.isVerified = false;
      updateData.rejectionReason = null;
      updateData.verifiedAt = null;
    }

    await this.boatsRepo.update(id, updateData);
    return this.findById(id);
  }

  async delete(id: string, ownerId: string): Promise<void> {
    const boat = await this.boatsRepo.findOne({ where: { id } });
    if (!boat) throw new NotFoundException('Embarcação não encontrada');
    if (boat.ownerId !== ownerId) throw new ForbiddenException('Esta embarcação não pertence a você');

    const activeTrips = await this.tripsRepo.count({
      where: [
        { boatId: id, status: TripStatus.SCHEDULED },
        { boatId: id, status: TripStatus.IN_PROGRESS },
      ],
    });
    if (activeTrips > 0) {
      throw new BadRequestException('Não é possível apagar uma embarcação com viagens activas');
    }

    // Remover gestores atribuídos a este barco
    await this.boatStaffRepo.delete({ boatId: id });

    // Garantir que boat_id em trips é nullable (idempotente — cobre a migração pendente do TypeORM)
    await this.tripsRepo.manager.query(
      `ALTER TABLE trips ALTER COLUMN boat_id DROP NOT NULL`,
    );

    // Anular FK antes de apagar (trips e reviews podem referenciar este barco)
    await this.tripsRepo.manager.query(
      `UPDATE trips SET boat_id = NULL WHERE boat_id = $1`,
      [id],
    );

    await this.reviewsRepo
      .createQueryBuilder()
      .update()
      .set({ boatId: null as any })
      .where('boat_id = :id', { id })
      .execute();

    await this.boatsRepo.delete(id);
  }

  async findByOwner(ownerId: string): Promise<Boat[]> {
    return this.boatsRepo.find({ where: { ownerId } });
  }

  /** Capitão → barcos próprios. Boat_manager → barcos atribuídos via BoatStaff. */
  async findAccessibleBoats(userId: string, role: string): Promise<Boat[]> {
    if (role === 'boat_manager') {
      const staffRecords = await this.boatStaffRepo.find({
        where: { userId, isActive: true },
        relations: ['boat'],
      });
      return staffRecords.map(s => s.boat).filter((b): b is Boat => !!b);
    }
    return this.findByOwner(userId);
  }

  async findById(id: string): Promise<any> {
    const boat = await this.boatsRepo.findOne({
      where: { id },
      relations: ['owner'],
    });
    if (!boat) throw new NotFoundException('Embarcação não encontrada');

    const [reviews, tripsCount] = await Promise.all([
      this.reviewsRepo.find({
        where: { boatId: id, reviewType: ReviewType.PASSENGER_TO_CAPTAIN },
        relations: ['reviewer', 'trip'],
        order: { createdAt: 'DESC' },
        take: 10,
      }),
      this.tripsRepo.count({ where: { boatId: id } }),
    ]);

    const stats = this.buildRatingStats(reviews.map(r => r.boatRating));

    const { owner } = boat;

    return {
      ...boat,
      owner: owner
        ? {
            id: owner.id,
            name: owner.name,
            avatarUrl: owner.avatarUrl,
            rating: owner.rating,
            totalTrips: owner.totalTrips,
          }
        : null,
      tripsCount,
      reviewCount: stats.total,
      recentReviews: reviews.map(r => ({
        id: r.id,
        boatRating: r.boatRating,
        boatComment: r.boatComment,
        captainRating: r.captainRating,
        captainComment: r.captainComment,
        createdAt: r.createdAt,
        reviewer: r.reviewer
          ? { id: r.reviewer.id, name: r.reviewer.name, avatarUrl: r.reviewer.avatarUrl }
          : null,
        trip: r.trip
          ? {
              id: r.trip.id,
              origin: r.trip.origin,
              destination: r.trip.destination,
              departureAt: r.trip.departureAt,
            }
          : null,
      })),
      ratingStats: stats,
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
