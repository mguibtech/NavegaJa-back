import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Review } from './review.entity';
import { CreateReviewDto } from './dto/create-review.dto';
import { User } from '../users/user.entity';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review)
    private reviewsRepo: Repository<Review>,
    @InjectRepository(User)
    private usersRepo: Repository<User>,
  ) {}

  async create(reviewerId: string, dto: CreateReviewDto): Promise<Review> {
    const review = this.reviewsRepo.create({
      reviewerId,
      tripId: dto.tripId,
      captainId: dto.captainId,
      rating: dto.rating,
      comment: dto.comment,
    });

    const saved = await this.reviewsRepo.save(review);

    // Recalcula rating do capitão
    const reviews = await this.reviewsRepo.find({
      where: { captainId: dto.captainId },
    });
    const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
    await this.usersRepo.update(dto.captainId, {
      rating: Math.round(avgRating * 10) / 10,
    });

    return saved;
  }

  async findByCaptain(captainId: string): Promise<Review[]> {
    return this.reviewsRepo.find({
      where: { captainId },
      relations: ['reviewer', 'trip', 'trip.route'],
      order: { createdAt: 'DESC' },
    });
  }
}
