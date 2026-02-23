import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Review, ReviewType } from './review.entity';
import { CreatePassengerReviewDto, CreateCaptainReviewDto } from './dto/create-review.dto';
import { User } from '../users/user.entity';
import { Boat } from '../boats/boat.entity';
import { Booking, BookingStatus } from '../bookings/booking.entity';
import { Trip, TripStatus } from '../trips/trip.entity';
import { GamificationService } from '../gamification/gamification.service';
import { PointAction } from '../gamification/point-transaction.entity';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review)
    private reviewsRepo: Repository<Review>,
    @InjectRepository(User)
    private usersRepo: Repository<User>,
    @InjectRepository(Boat)
    private boatsRepo: Repository<Boat>,
    @InjectRepository(Booking)
    private bookingsRepo: Repository<Booking>,
    @InjectRepository(Trip)
    private tripsRepo: Repository<Trip>,
    private gamificationService: GamificationService,
  ) {}

  // ── Passageiro avalia Capitão + Barco ──────────────────────────────────────

  async createPassengerReview(reviewerId: string, dto: CreatePassengerReviewDto): Promise<Review> {
    // 1. Buscar a viagem e validar que está concluída
    const trip = await this.tripsRepo.findOne({ where: { id: dto.tripId } });
    if (!trip) throw new NotFoundException('Viagem não encontrada');
    if (trip.status !== TripStatus.COMPLETED) {
      throw new BadRequestException('Só é possível avaliar viagens concluídas');
    }

    // 2. Verificar que o reviewer tem reserva COMPLETED nesta viagem
    const booking = await this.bookingsRepo.findOne({
      where: {
        tripId: dto.tripId,
        passengerId: reviewerId,
        status: BookingStatus.COMPLETED,
      },
    });
    if (!booking) {
      throw new ForbiddenException(
        'Só pode avaliar viagens em que participou e que foram concluídas',
      );
    }

    // 3. Verificar que ainda não avaliou esta viagem
    const existing = await this.reviewsRepo.findOne({
      where: {
        reviewerId,
        tripId: dto.tripId,
        reviewType: ReviewType.PASSENGER_TO_CAPTAIN,
      },
    });
    if (existing) {
      throw new BadRequestException('Você já avaliou esta viagem');
    }

    // 4. Criar a review
    const review = this.reviewsRepo.create({
      reviewerId,
      tripId: dto.tripId,
      reviewType: ReviewType.PASSENGER_TO_CAPTAIN,
      captainId: trip.captainId,
      captainRating: dto.captainRating,
      captainComment: dto.captainComment ?? null,
      punctualityRating: dto.punctualityRating ?? null,
      communicationRating: dto.communicationRating ?? null,
      boatId: trip.boatId ?? null,
      boatRating: dto.boatRating ?? null,
      boatComment: dto.boatComment ?? null,
      boatPhotos: dto.boatPhotos?.length ? dto.boatPhotos : null,
      cleanlinessRating: dto.cleanlinessRating ?? null,
      comfortRating: dto.comfortRating ?? null,
    });

    const saved = await this.reviewsRepo.save(review);

    // 5. Recalcular rating do capitão via SQL
    await this.recalculateCaptainRating(trip.captainId);

    // 6. Recalcular rating do barco (se avaliado)
    if (dto.boatRating && trip.boatId) {
      await this.recalculateBoatRating(trip.boatId);
    }

    // 7. Gamification: premiar pontos ao reviewer
    await this.gamificationService.awardPoints(
      reviewerId,
      PointAction.REVIEW_CREATED,
      saved.id,
    );

    return saved;
  }

  // ── Capitão avalia Passageiro ──────────────────────────────────────────────

  async createCaptainReview(captainId: string, dto: CreateCaptainReviewDto): Promise<Review> {
    // 1. Buscar e validar a viagem
    const trip = await this.tripsRepo.findOne({ where: { id: dto.tripId } });
    if (!trip) throw new NotFoundException('Viagem não encontrada');
    if (trip.captainId !== captainId) {
      throw new ForbiddenException('Só o capitão desta viagem pode avaliar os passageiros');
    }
    if (trip.status !== TripStatus.COMPLETED) {
      throw new BadRequestException('Só é possível avaliar passageiros de viagens concluídas');
    }

    // 2. Verificar que o passageiro participou da viagem
    const booking = await this.bookingsRepo.findOne({
      where: {
        tripId: dto.tripId,
        passengerId: dto.passengerId,
        status: BookingStatus.COMPLETED,
      },
    });
    if (!booking) {
      throw new BadRequestException('Este passageiro não tem reserva concluída nesta viagem');
    }

    // 3. Verificar que ainda não avaliou este passageiro nesta viagem
    const existing = await this.reviewsRepo.findOne({
      where: {
        reviewerId: captainId,
        tripId: dto.tripId,
        passengerId: dto.passengerId,
        reviewType: ReviewType.CAPTAIN_TO_PASSENGER,
      },
    });
    if (existing) {
      throw new BadRequestException('Você já avaliou este passageiro nesta viagem');
    }

    // 4. Criar a review
    const review = this.reviewsRepo.create({
      reviewerId: captainId,
      tripId: dto.tripId,
      reviewType: ReviewType.CAPTAIN_TO_PASSENGER,
      passengerId: dto.passengerId,
      passengerRating: dto.passengerRating,
      passengerComment: dto.passengerComment ?? null,
    });

    const saved = await this.reviewsRepo.save(review);

    // 5. Recalcular rating do passageiro
    await this.recalculatePassengerRating(dto.passengerId);

    return saved;
  }

  // ── Leituras ───────────────────────────────────────────────────────────────

  async findByCaptain(captainId: string): Promise<{ reviews: object[]; stats: object }> {
    const reviews = await this.reviewsRepo.find({
      where: { captainId, reviewType: ReviewType.PASSENGER_TO_CAPTAIN },
      relations: ['reviewer', 'trip'],
      order: { createdAt: 'DESC' },
    });
    const stats = this.buildRatingStats(reviews.map(r => r.captainRating));
    return { reviews: reviews.map(r => this.sanitizeReview(r)), stats };
  }

  async findByBoat(boatId: string): Promise<{ reviews: object[]; stats: object }> {
    const reviews = await this.reviewsRepo.find({
      where: { boatId, reviewType: ReviewType.PASSENGER_TO_CAPTAIN },
      relations: ['reviewer', 'trip'],
      order: { createdAt: 'DESC' },
    });
    const stats = this.buildRatingStats(reviews.map(r => r.boatRating));
    return { reviews: reviews.map(r => this.sanitizeReview(r)), stats };
  }

  async findByPassenger(passengerId: string): Promise<{ reviews: object[]; stats: object }> {
    const reviews = await this.reviewsRepo.find({
      where: { passengerId, reviewType: ReviewType.CAPTAIN_TO_PASSENGER },
      relations: ['reviewer', 'trip'],
      order: { createdAt: 'DESC' },
    });
    const stats = this.buildRatingStats(reviews.map(r => r.passengerRating));
    return { reviews: reviews.map(r => this.sanitizeReview(r)), stats };
  }

  async findByTrip(tripId: string): Promise<object[]> {
    const reviews = await this.reviewsRepo.find({
      where: { tripId },
      relations: ['reviewer', 'captain', 'boat', 'passenger'],
      order: { createdAt: 'DESC' },
    });
    return reviews.map(r => this.sanitizeReview(r));
  }

  async findMyReviews(userId: string): Promise<object[]> {
    const reviews = await this.reviewsRepo.find({
      where: { reviewerId: userId },
      relations: ['trip', 'captain', 'boat', 'passenger'],
      order: { createdAt: 'DESC' },
    });
    return reviews.map(r => this.sanitizeReview(r));
  }

  async canReview(
    userId: string,
    tripId: string,
  ): Promise<{ canReview: boolean; alreadyReviewed: boolean; reason: string; isCaptain: boolean }> {
    const trip = await this.tripsRepo.findOne({ where: { id: tripId } });
    if (!trip) {
      return { canReview: false, alreadyReviewed: false, reason: 'Viagem não encontrada', isCaptain: false };
    }

    if (trip.status !== TripStatus.COMPLETED) {
      return { canReview: false, alreadyReviewed: false, reason: 'Viagem ainda não foi concluída', isCaptain: false };
    }

    const isCaptain = trip.captainId === userId;

    if (!isCaptain) {
      const booking = await this.bookingsRepo.findOne({
        where: { tripId, passengerId: userId, status: BookingStatus.COMPLETED },
      });
      if (!booking) {
        return { canReview: false, alreadyReviewed: false, reason: 'Você não participou desta viagem', isCaptain: false };
      }
      const existing = await this.reviewsRepo.findOne({
        where: { reviewerId: userId, tripId, reviewType: ReviewType.PASSENGER_TO_CAPTAIN },
      });
      if (existing) {
        return { canReview: false, alreadyReviewed: true, reason: 'Você já avaliou esta viagem', isCaptain: false };
      }
      return { canReview: true, alreadyReviewed: false, reason: 'Pode avaliar capitão e barco', isCaptain: false };
    }

    return { canReview: true, alreadyReviewed: false, reason: 'Pode avaliar os passageiros desta viagem', isCaptain: true };
  }

  // ── Helpers privados ───────────────────────────────────────────────────────

  private sanitizeUser(user: any) {
    if (!user) return null;
    const { passwordHash, resetCode, resetCodeExpires, ...safe } = user;
    return safe;
  }

  private sanitizeReview(review: Review) {
    return {
      ...review,
      reviewer: this.sanitizeUser(review.reviewer),
      captain: this.sanitizeUser((review as any).captain),
      passenger: this.sanitizeUser((review as any).passenger),
    };
  }

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

  private async recalculateCaptainRating(captainId: string): Promise<void> {
    const row = await this.reviewsRepo
      .createQueryBuilder('r')
      .select('ROUND(AVG(r.rating)::numeric, 1)', 'avg')
      .where('r.captain_id = :captainId', { captainId })
      .andWhere('r.review_type = :type', { type: ReviewType.PASSENGER_TO_CAPTAIN })
      .getRawOne();

    const avg = Number(row?.avg || 5.0);
    await this.usersRepo.update(captainId, { rating: avg });
  }

  private async recalculateBoatRating(boatId: string): Promise<void> {
    const row = await this.reviewsRepo
      .createQueryBuilder('r')
      .select('ROUND(AVG(r.boat_rating)::numeric, 1)', 'avg')
      .addSelect('COUNT(*)', 'total')
      .where('r.boat_id = :boatId', { boatId })
      .andWhere('r.boat_rating IS NOT NULL')
      .getRawOne();

    const avg = Number(row?.avg || 5.0);
    const count = parseInt(row?.total || '0');
    await this.boatsRepo.update(boatId, { rating: avg, reviewCount: count });
  }

  private async recalculatePassengerRating(passengerId: string): Promise<void> {
    const row = await this.reviewsRepo
      .createQueryBuilder('r')
      .select('ROUND(AVG(r.passenger_rating)::numeric, 1)', 'avg')
      .where('r.passenger_id = :passengerId', { passengerId })
      .andWhere('r.review_type = :type', { type: ReviewType.CAPTAIN_TO_PASSENGER })
      .getRawOne();

    const avg = Number(row?.avg || 5.0);
    await this.usersRepo.update(passengerId, { passengerRating: avg });
  }
}
