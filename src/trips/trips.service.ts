import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, Between } from 'typeorm';
import { Trip, TripStatus } from './trip.entity';
import { CreateTripDto, UpdateTripStatusDto, UpdateLocationDto } from './dto/trip.dto';

@Injectable()
export class TripsService {
  constructor(
    @InjectRepository(Trip)
    private tripsRepo: Repository<Trip>,
  ) {}

  async create(captainId: string, dto: CreateTripDto): Promise<Trip> {
    const departureAt = new Date(dto.departureTime);
    const estimatedArrivalAt = new Date(dto.arrivalTime);

    const trip = this.tripsRepo.create({
      captainId,
      boatId: dto.boatId,
      origin: dto.origin,
      destination: dto.destination,
      departureAt,
      estimatedArrivalAt,
      price: dto.price,
      totalSeats: dto.totalSeats,
      availableSeats: dto.totalSeats,
    } as Partial<Trip>);

    return this.tripsRepo.save(trip);
  }

  async findAvailable(routeId?: string, date?: string): Promise<Trip[]> {
    const where: any = {
      status: TripStatus.SCHEDULED,
    };

    if (routeId) where.routeId = routeId;

    if (date) {
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);
      where.departureAt = Between(dayStart, dayEnd);
    } else {
      where.departureAt = MoreThanOrEqual(new Date());
    }

    return this.tripsRepo.find({
      where,
      relations: ['captain', 'boat'],
      order: { departureAt: 'ASC' },
    });
  }

  async search(origin?: string, destination?: string, date?: string): Promise<Trip[]> {
    const qb = this.tripsRepo
      .createQueryBuilder('trip')
      .leftJoinAndSelect('trip.captain', 'captain')
      .leftJoinAndSelect('trip.boat', 'boat')
      .where('trip.status = :status', { status: TripStatus.SCHEDULED });

    if (origin) {
      qb.andWhere('LOWER(trip.origin) LIKE LOWER(:origin)', { origin: `%${origin}%` });
    }

    if (destination) {
      qb.andWhere('LOWER(trip.destination) LIKE LOWER(:destination)', { destination: `%${destination}%` });
    }

    if (date) {
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);
      qb.andWhere('trip.departure_at BETWEEN :dayStart AND :dayEnd', { dayStart, dayEnd });
    } else {
      qb.andWhere('trip.departure_at >= :now', { now: new Date() });
    }

    qb.orderBy('trip.departure_at', 'ASC');

    return qb.getMany();
  }

  async findById(id: string): Promise<Trip> {
    const trip = await this.tripsRepo.findOne({
      where: { id },
      relations: [
        'captain',
        'boat',
        'bookings',
        'bookings.passenger',
      ],
    });
    if (!trip) throw new NotFoundException('Viagem não encontrada');
    return trip;
  }

  async findByCaptain(captainId: string): Promise<Trip[]> {
    return this.tripsRepo.find({
      where: { captainId },
      relations: ['boat'],
      order: { departureAt: 'DESC' },
    });
  }

  async update(tripId: string, captainId: string, dto: CreateTripDto): Promise<Trip> {
    const trip = await this.tripsRepo.findOne({ where: { id: tripId } });
    if (!trip) throw new NotFoundException('Viagem não encontrada');
    if (trip.captainId !== captainId) {
      throw new ForbiddenException('Apenas o capitão pode atualizar esta viagem');
    }

    const departureAt = new Date(dto.departureTime);
    const estimatedArrivalAt = new Date(dto.arrivalTime);

    trip.origin = dto.origin;
    trip.destination = dto.destination;
    trip.boatId = dto.boatId;
    trip.departureAt = departureAt;
    trip.estimatedArrivalAt = estimatedArrivalAt;
    trip.price = dto.price;
    trip.totalSeats = dto.totalSeats;
    // Ajustar availableSeats mantendo a diferença
    const bookedSeats = trip.totalSeats - trip.availableSeats;
    trip.availableSeats = dto.totalSeats - bookedSeats;

    return this.tripsRepo.save(trip);
  }

  async delete(tripId: string, captainId: string): Promise<void> {
    const trip = await this.tripsRepo.findOne({ where: { id: tripId } });
    if (!trip) throw new NotFoundException('Viagem não encontrada');
    if (trip.captainId !== captainId) {
      throw new ForbiddenException('Apenas o capitão pode deletar esta viagem');
    }

    // Cancelar em vez de deletar se houver reservas
    if (trip.availableSeats < trip.totalSeats) {
      trip.status = TripStatus.CANCELLED;
      await this.tripsRepo.save(trip);
    } else {
      await this.tripsRepo.remove(trip);
    }
  }

  async updateStatus(tripId: string, captainId: string, dto: UpdateTripStatusDto): Promise<Trip> {
    const trip = await this.findById(tripId);
    if (trip.captainId !== captainId) {
      throw new ForbiddenException('Apenas o capitão pode atualizar esta viagem');
    }
    trip.status = dto.status;
    return this.tripsRepo.save(trip);
  }

  async updateLocation(tripId: string, captainId: string, dto: UpdateLocationDto): Promise<Trip> {
    const trip = await this.findById(tripId);
    if (trip.captainId !== captainId) {
      throw new ForbiddenException('Apenas o capitão pode atualizar a localização');
    }
    trip.currentLat = dto.lat;
    trip.currentLng = dto.lng;
    return this.tripsRepo.save(trip);
  }

  async getPopularDestinations() {
    const popularOrigins = await this.tripsRepo
      .createQueryBuilder('trip')
      .select('trip.origin', 'city')
      .addSelect('COUNT(*)', 'count')
      .where('trip.status = :status', { status: TripStatus.SCHEDULED })
      .groupBy('trip.origin')
      .orderBy('count', 'DESC')
      .limit(10)
      .getRawMany();

    const popularDestinations = await this.tripsRepo
      .createQueryBuilder('trip')
      .select('trip.destination', 'city')
      .addSelect('COUNT(*)', 'count')
      .where('trip.status = :status', { status: TripStatus.SCHEDULED })
      .groupBy('trip.destination')
      .orderBy('count', 'DESC')
      .limit(10)
      .getRawMany();

    const popularRoutes = await this.tripsRepo
      .createQueryBuilder('trip')
      .select('trip.origin', 'origin')
      .addSelect('trip.destination', 'destination')
      .addSelect('COUNT(*)', 'count')
      .addSelect('MIN(trip.price)', 'minPrice')
      .addSelect('AVG(trip.price)', 'avgPrice')
      .where('trip.status = :status', { status: TripStatus.SCHEDULED })
      .groupBy('trip.origin, trip.destination')
      .orderBy('count', 'DESC')
      .limit(10)
      .getRawMany();

    return {
      origins: popularOrigins.map(item => ({
        city: item.city,
        tripsCount: parseInt(item.count),
      })),
      destinations: popularDestinations.map(item => ({
        city: item.city,
        tripsCount: parseInt(item.count),
      })),
      routes: popularRoutes.map(item => ({
        origin: item.origin,
        destination: item.destination,
        tripsCount: parseInt(item.count),
        minPrice: parseFloat(item.minPrice),
        avgPrice: parseFloat(item.avgPrice),
      })),
    };
  }
}
