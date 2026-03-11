import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StopReview } from './stop-review.entity';
import { GamificationService } from '../gamification/gamification.service';
import { PointAction } from '../gamification/point-transaction.entity';

@Injectable()
export class StopReviewsService {
  constructor(
    @InjectRepository(StopReview)
    private reviewsRepo: Repository<StopReview>,
    private gamificationService: GamificationService,
  ) {}

  async create(
    userId: string,
    data: {
      locationName: string;
      rating: number;
      comment?: string;
      photos?: string[];
      tripId?: string;
      lat?: number;
      lng?: number;
    },
  ): Promise<StopReview> {
    if (data.rating < 1 || data.rating > 5 || !Number.isInteger(data.rating)) {
      throw new BadRequestException('rating deve ser um inteiro de 1 a 5');
    }
    const review = this.reviewsRepo.create({
      userId,
      locationName: data.locationName,
      rating: data.rating,
      comment: data.comment || null,
      photos: data.photos?.length ? data.photos : null,
      tripId: data.tripId || null,
      lat: data.lat ?? null,
      lng: data.lng ?? null,
    });
    const saved = await this.reviewsRepo.save(review);

    // Dar 5 NavegaCoins ao usuário por avaliar um ponto de parada
    await this.gamificationService.awardPoints(
      userId,
      PointAction.REVIEW_CREATED,
      saved.id,
    );

    return saved;
  }

  async findByLocation(location: string, page = 1, limit = 20) {
    const [data, total] = await this.reviewsRepo
      .createQueryBuilder('r')
      .leftJoin('r.user', 'user')
      .addSelect(['user.id', 'user.name', 'user.avatarUrl'])
      .where('LOWER(r.location_name) LIKE LOWER(:location)', {
        location: `%${location}%`,
      })
      .orderBy('r.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, total, page, lastPage: Math.ceil(total / limit) };
  }

  async getTopLocations(limit = 10) {
    const rows = await this.reviewsRepo
      .createQueryBuilder('r')
      .select('r.location_name', 'locationName')
      .addSelect('ROUND(AVG(CAST(r.rating AS DECIMAL)), 1)', 'avgRating')
      .addSelect('COUNT(*)', 'reviewCount')
      .addSelect('AVG(CAST(r.lat AS DECIMAL))', 'lat')
      .addSelect('AVG(CAST(r.lng AS DECIMAL))', 'lng')
      .groupBy('r.location_name')
      .having('COUNT(*) >= 1')
      .orderBy('"avgRating"', 'DESC')
      .addOrderBy('"reviewCount"', 'DESC')
      .limit(limit)
      .getRawMany<{
        locationName: string;
        avgRating: string;
        reviewCount: string;
        lat: string | null;
        lng: string | null;
      }>();

    return rows.map((r) => ({
      locationName: r.locationName,
      avgRating: parseFloat(r.avgRating),
      reviewCount: parseInt(r.reviewCount, 10),
      lat: r.lat ? parseFloat(r.lat) : null,
      lng: r.lng ? parseFloat(r.lng) : null,
    }));
  }

  async findMyReviews(userId: string, page = 1, limit = 20) {
    const [data, total] = await this.reviewsRepo.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, lastPage: Math.ceil(total / limit) };
  }
}
