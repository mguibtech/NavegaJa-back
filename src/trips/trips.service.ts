import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, Between } from 'typeorm';
import { Trip, TripStatus } from './trip.entity';
import { CreateTripDto, UpdateTripStatusDto, UpdateLocationDto } from './dto/trip.dto';
import { ShipmentsService } from '../shipments/shipments.service';
import { ShipmentStatus } from '../shipments/shipment.entity';

@Injectable()
export class TripsService {
  constructor(
    @InjectRepository(Trip)
    private tripsRepo: Repository<Trip>,
    @Inject(forwardRef(() => ShipmentsService))
    private shipmentsService: ShipmentsService,
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
      cargoPriceKg: dto.cargoPriceKg || 0,
      cargoCapacityKg: dto.cargoCapacityKg || null,
      availableCargoKg: dto.cargoCapacityKg || null, // Inicializa com capacidade total
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

  async search(
    origin?: string,
    destination?: string,
    date?: string,
    minPrice?: number,
    maxPrice?: number,
    departureTime?: 'morning' | 'afternoon' | 'night',
    minRating?: number,
  ): Promise<Trip[]> {
    const qb = this.tripsRepo
      .createQueryBuilder('trip')
      .leftJoinAndSelect('trip.captain', 'captain')
      .leftJoinAndSelect('trip.boat', 'boat')
      .where('trip.status = :status', { status: TripStatus.SCHEDULED });

    // Filtro por origem
    if (origin) {
      qb.andWhere('LOWER(trip.origin) LIKE LOWER(:origin)', { origin: `%${origin}%` });
    }

    // Filtro por destino
    if (destination) {
      qb.andWhere('LOWER(trip.destination) LIKE LOWER(:destination)', { destination: `%${destination}%` });
    }

    // Filtro por data
    if (date) {
      const dayStart = new Date(date);

      // Validar se a data é válida
      if (isNaN(dayStart.getTime())) {
        throw new BadRequestException(
          `Data inválida: "${date}". Use o formato YYYY-MM-DD (ex: 2026-02-15)`
        );
      }

      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);
      qb.andWhere('trip.departure_at BETWEEN :dayStart AND :dayEnd', { dayStart, dayEnd });
    } else {
      qb.andWhere('trip.departure_at >= :now', { now: new Date() });
    }

    // Filtro por preço mínimo
    if (minPrice !== undefined && minPrice !== null) {
      qb.andWhere('trip.price >= :minPrice', { minPrice });
    }

    // Filtro por preço máximo
    if (maxPrice !== undefined && maxPrice !== null) {
      qb.andWhere('trip.price <= :maxPrice', { maxPrice });
    }

    // Filtro por período do dia
    if (departureTime) {
      switch (departureTime) {
        case 'morning': // 06:00 - 11:59
          qb.andWhere('EXTRACT(HOUR FROM trip.departure_at) >= 6 AND EXTRACT(HOUR FROM trip.departure_at) < 12');
          break;
        case 'afternoon': // 12:00 - 17:59
          qb.andWhere('EXTRACT(HOUR FROM trip.departure_at) >= 12 AND EXTRACT(HOUR FROM trip.departure_at) < 18');
          break;
        case 'night': // 18:00 - 05:59
          qb.andWhere('EXTRACT(HOUR FROM trip.departure_at) >= 18 OR EXTRACT(HOUR FROM trip.departure_at) < 6');
          break;
      }
    }

    // Filtro por avaliação mínima do capitão
    if (minRating !== undefined && minRating !== null) {
      qb.andWhere('CAST(captain.rating AS DECIMAL) >= :minRating', { minRating });
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

    const oldStatus = trip.status;
    trip.status = dto.status;
    const saved = await this.tripsRepo.save(trip);

    // Auto-atualizar encomendas quando viagem muda de status
    if (dto.status === TripStatus.IN_PROGRESS && oldStatus !== TripStatus.IN_PROGRESS) {
      // Viagem partiu - atualizar encomendas COLLECTED para IN_TRANSIT
      await this.shipmentsService.updateShipmentsByTrip(tripId, ShipmentStatus.IN_TRANSIT);
    } else if (dto.status === TripStatus.COMPLETED && oldStatus !== TripStatus.COMPLETED) {
      // Viagem chegou - atualizar encomendas IN_TRANSIT para ARRIVED
      await this.shipmentsService.updateShipmentsByTrip(tripId, ShipmentStatus.ARRIVED);
    }

    return saved;
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
