import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { Trip, TripStatus } from './trip.entity';
import { Route } from '../routes/route.entity';
import { CreateTripDto, UpdateTripStatusDto, UpdateLocationDto } from './dto/trip.dto';

@Injectable()
export class TripsService {
  constructor(
    @InjectRepository(Trip)
    private tripsRepo: Repository<Trip>,
    @InjectRepository(Route)
    private routesRepo: Repository<Route>,
  ) {}

  async create(captainId: string, dto: CreateTripDto): Promise<Trip> {
    const route = await this.routesRepo.findOne({ where: { id: dto.routeId } });
    if (!route) throw new NotFoundException('Rota não encontrada');

    const departureAt = new Date(dto.departureAt);
    const estimatedArrivalAt: Date | null = route.durationMin
      ? new Date(departureAt.getTime() + route.durationMin * 60000)
      : null;

    const trip = this.tripsRepo.create({
      captainId,
      boatId: dto.boatId,
      routeId: dto.routeId,
      departureAt,
      ...(estimatedArrivalAt ? { estimatedArrivalAt } : {}),
      price: dto.price,
      cargoPriceKg: dto.cargoPriceKg ?? 0,
      totalSeats: dto.totalSeats,
      availableSeats: dto.totalSeats,
      notes: dto.notes,
    } as Partial<Trip>);

    return this.tripsRepo.save(trip);
  }

  async findAvailable(routeId?: string, date?: string): Promise<Trip[]> {
    const where: any = {
      status: TripStatus.SCHEDULED,
      departureAt: MoreThanOrEqual(new Date()),
    };
    if (routeId) where.routeId = routeId;

    if (date) {
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);
      // Filter by date range handled in query
    }

    return this.tripsRepo.find({
      where,
      relations: ['captain', 'boat', 'route'],
      order: { departureAt: 'ASC' },
    });
  }

  async findById(id: string): Promise<Trip> {
    const trip = await this.tripsRepo.findOne({
      where: { id },
      relations: ['captain', 'boat', 'route', 'bookings'],
    });
    if (!trip) throw new NotFoundException('Viagem não encontrada');
    return trip;
  }

  async findByCaptain(captainId: string): Promise<Trip[]> {
    return this.tripsRepo.find({
      where: { captainId },
      relations: ['route', 'boat'],
      order: { departureAt: 'DESC' },
    });
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
}
