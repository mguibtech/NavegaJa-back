import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Favorite, FavoriteType } from './favorite.entity';
import { CreateFavoriteDto } from './dto/favorite.dto';

@Injectable()
export class FavoritesService {
  constructor(
    @InjectRepository(Favorite)
    private favoritesRepo: Repository<Favorite>,
  ) {}

  async create(userId: string, dto: CreateFavoriteDto): Promise<Favorite> {
    // Validar que os campos corretos estão preenchidos
    this.validateDto(dto);

    // Verificar se já existe
    const existing = await this.checkExisting(userId, dto);
    if (existing) {
      throw new ConflictException('Este item já está nos favoritos');
    }

    const favorite = this.favoritesRepo.create({
      userId,
      type: dto.type,
      destination: dto.type === FavoriteType.DESTINATION ? dto.destination : undefined,
      origin: dto.type === FavoriteType.DESTINATION ? dto.origin : undefined,
      boatId: dto.type === FavoriteType.BOAT ? dto.boatId : undefined,
      captainId: dto.type === FavoriteType.CAPTAIN ? dto.captainId : undefined,
    });

    return this.favoritesRepo.save(favorite);
  }

  async findAll(userId: string, type?: FavoriteType): Promise<Favorite[]> {
    const where: any = { userId };
    if (type) {
      where.type = type;
    }

    return this.favoritesRepo.find({
      where,
      relations: ['boat', 'captain'],
      order: { createdAt: 'DESC' },
    });
  }

  async remove(userId: string, favoriteId: string): Promise<void> {
    const favorite = await this.favoritesRepo.findOne({
      where: { id: favoriteId, userId },
    });

    if (!favorite) {
      throw new NotFoundException('Favorito não encontrado');
    }

    await this.favoritesRepo.remove(favorite);
  }

  async check(userId: string, dto: CreateFavoriteDto): Promise<{ isFavorite: boolean; favoriteId?: string }> {
    this.validateDto(dto);

    const favorite = await this.checkExisting(userId, dto);

    return {
      isFavorite: !!favorite,
      favoriteId: favorite?.id,
    };
  }

  async toggleFavorite(userId: string, dto: CreateFavoriteDto): Promise<{ action: 'added' | 'removed'; favorite?: Favorite }> {
    this.validateDto(dto);

    const existing = await this.checkExisting(userId, dto);

    if (existing) {
      await this.favoritesRepo.remove(existing);
      return { action: 'removed' };
    } else {
      const favorite = await this.create(userId, dto);
      return { action: 'added', favorite };
    }
  }

  // Helpers privados
  private validateDto(dto: CreateFavoriteDto): void {
    switch (dto.type) {
      case FavoriteType.DESTINATION:
        if (!dto.destination) {
          throw new BadRequestException('Campo "destination" é obrigatório para favoritos de destino');
        }
        break;
      case FavoriteType.BOAT:
        if (!dto.boatId) {
          throw new BadRequestException('Campo "boatId" é obrigatório para favoritos de barco');
        }
        break;
      case FavoriteType.CAPTAIN:
        if (!dto.captainId) {
          throw new BadRequestException('Campo "captainId" é obrigatório para favoritos de capitão');
        }
        break;
    }
  }

  private async checkExisting(userId: string, dto: CreateFavoriteDto): Promise<Favorite | null> {
    const qb = this.favoritesRepo.createQueryBuilder('favorite')
      .where('favorite.userId = :userId', { userId })
      .andWhere('favorite.type = :type', { type: dto.type });

    switch (dto.type) {
      case FavoriteType.DESTINATION:
        qb.andWhere('favorite.destination = :destination', { destination: dto.destination });
        if (dto.origin) {
          qb.andWhere('favorite.origin = :origin', { origin: dto.origin });
        } else {
          qb.andWhere('favorite.origin IS NULL');
        }
        break;
      case FavoriteType.BOAT:
        qb.andWhere('favorite.boatId = :boatId', { boatId: dto.boatId });
        break;
      case FavoriteType.CAPTAIN:
        qb.andWhere('favorite.captainId = :captainId', { captainId: dto.captainId });
        break;
    }

    return qb.getOne();
  }
}
