import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Inject,
  forwardRef,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  MoreThanOrEqual,
  Between,
  In,
  LessThan,
  FindOperator,
  FindOptionsWhere,
} from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Trip, TripStatus } from './trip.entity';
import { geocodeCity } from './city-coords';
import {
  getTripShipmentPolicy,
  normalizeCargoPriceKg,
  type TripShipmentPolicy,
} from './trip-shipment-policy';
import {
  CreateTripDto,
  UpdateTripStatusDto,
  UpdateLocationDto,
} from './dto/trip.dto';
import { ShipmentsService } from '../shipments/shipments.service';
import { ShipmentStatus } from '../shipments/shipment.entity';
import { SafetyService } from '../safety/safety.service';
import { WeatherService } from '../weather/weather.service';
import { FloodService } from '../weather/flood.service';
import { NotificationsService } from '../notifications/notifications.service';
import { BookingsService } from '../bookings/bookings.service';
import { PdfService } from '../pdf/pdf.service';
import { BoatStaffService } from '../boat-staff/boat-staff.service';
import { LocationsService } from '../locations/locations.service';
import { GamificationService } from '../gamification/gamification.service';
import { PdfStream } from '../pdf/pdf.types';
import { PaidBy } from '../common/enums/paid-by.enum';
import { Boat } from '../boats/boat.entity';
import { User } from '../users/user.entity';
import { Shipment } from '../shipments/shipment.entity';
import { Favorite, FavoriteType } from '../favorites/favorite.entity';
import {
  Booking,
  BookingStatus,
  PaymentStatus,
} from '../bookings/booking.entity';
import { ShipmentTimeline } from '../shipments/shipment-timeline.entity';

export interface WeatherWarning {
  score: number;
  warnings: string[];
  recommendations: string[];
}

export type TripStatusUpdateResult = Trip & {
  weatherWarning?: WeatherWarning;
};

type TripResponse = Trip & TripShipmentPolicy;

@Injectable()
export class TripsService {
  private readonly logger = new Logger(TripsService.name);

  private static readonly BLOCKING_CONFLICT_STATUSES = [
    TripStatus.SCHEDULED,
    TripStatus.IN_PROGRESS,
  ] as const;

  private static readonly CAPTAIN_SAFE_FIELDS = [
    'captain.id',
    'captain.name',
    'captain.phone',
    'captain.role',
    'captain.email',
    'captain.avatarUrl',
    'captain.rating',
    'captain.totalTrips',
    'captain.totalPoints',
    'captain.level',
    'captain.referralCode',
    'captain.isActive',
    'captain.passengerRating',
    'captain.city',
    'captain.state',
    'captain.isVerified',
    'captain.licensePhotoUrl',
    'captain.certificatePhotoUrl',
    'captain.verifiedAt',
    'captain.createdAt',
    'captain.updatedAt',
  ];

  private static readonly PASSENGER_SAFE_FIELDS =
    TripsService.CAPTAIN_SAFE_FIELDS.map((field) =>
      field.replace('captain.', 'passenger.'),
    );

  constructor(
    @InjectRepository(Trip)
    private tripsRepo: Repository<Trip>,
    @InjectRepository(Boat)
    private boatsRepo: Repository<Boat>,
    @InjectRepository(User)
    private usersRepo: Repository<User>,
    @InjectRepository(Shipment)
    private shipmentsRepo: Repository<Shipment>,
    @InjectRepository(Favorite)
    private favoritesRepo: Repository<Favorite>,
    @Inject(forwardRef(() => ShipmentsService))
    private shipmentsService: ShipmentsService,
    @Inject(forwardRef(() => SafetyService))
    private safetyService: SafetyService,
    private weatherService: WeatherService,
    private floodService: FloodService,
    private notificationsService: NotificationsService,
    private bookingsService: BookingsService,
    private gamificationService: GamificationService,
    private pdfService: PdfService,
    private boatStaffService: BoatStaffService,
    private locationsService: LocationsService,
  ) {}

  private serializeTrip<T extends Trip>(trip: T): T & TripShipmentPolicy {
    const shipmentPolicy = getTripShipmentPolicy(trip);

    return {
      ...trip,
      cargoPriceKg: shipmentPolicy.shipmentPricePerKg,
      ...shipmentPolicy,
    };
  }

  private serializeTrips<T extends Trip>(
    trips: T[],
  ): Array<T & TripShipmentPolicy> {
    return trips.map((trip) => this.serializeTrip(trip));
  }

  private async findTripByIdOrFail(id: string): Promise<Trip> {
    const qb = this.tripsRepo
      .createQueryBuilder('trip')
      .leftJoin('trip.captain', 'captain')
      .addSelect(TripsService.CAPTAIN_SAFE_FIELDS)
      .leftJoinAndSelect('trip.boat', 'boat')
      .leftJoinAndSelect('trip.bookings', 'bookings')
      .leftJoin('bookings.passenger', 'passenger')
      .addSelect(TripsService.PASSENGER_SAFE_FIELDS)
      .where('trip.id = :id', { id });

    const trip = await qb.getOne();
    if (!trip) throw new NotFoundException('Viagem nÃ£o encontrada');
    return trip;
  }

  private async ensureVerifiedCaptainForTripCreation(
    captainId: string,
    role?: string,
  ): Promise<void> {
    if (role === 'boat_manager') {
      return;
    }

    const captain = await this.usersRepo.findOne({
      where: { id: captainId },
      select: ['id', 'isVerified'],
    });
    if (!captain?.isVerified) {
      throw new ForbiddenException(
        'Conta nÃ£o verificada. Envie sua habilitaÃ§Ã£o nÃ¡utica e aguarde a aprovaÃ§Ã£o do NavegaJÃ¡.',
      );
    }
  }

  private validateTripRouteAndSchedule(
    dto: CreateTripDto,
    departureAt: Date,
    estimatedArrivalAt: Date,
  ): void {
    if (
      dto.origin.trim().toLowerCase() === dto.destination.trim().toLowerCase()
    ) {
      throw new BadRequestException('Origem e destino nÃ£o podem ser iguais.');
    }

    const now = new Date();
    if (departureAt < now) {
      throw new BadRequestException(
        'Data de partida deve ser futura. NÃ£o Ã© possÃ­vel criar viagens no passado.',
      );
    }

    if (estimatedArrivalAt <= departureAt) {
      throw new BadRequestException(
        'Data de chegada deve ser posterior Ã  data de partida.',
      );
    }
  }

  private async findBoatForTripCreation(
    captainId: string,
    boatId: string,
    role?: string,
  ): Promise<Boat> {
    if (role === 'boat_manager') {
      const boat = await this.boatsRepo.findOne({
        where: { id: boatId },
      });
      if (!boat) {
        throw new NotFoundException('Embarcação não encontrada');
      }

      const staff = await this.boatStaffService.canManageBoat(
        captainId,
        boatId,
      );
      if (!staff?.canCreateTrips) {
        throw new ForbiddenException(
          'Sem permissão para criar viagens nesta embarcação',
        );
      }

      return boat;
    }

    const boat = await this.boatsRepo.findOne({
      where: { id: boatId, ownerId: captainId },
    });
    if (!boat) {
      throw new NotFoundException(
        'Embarcação não encontrada ou você não é o proprietário desta embarcação.',
      );
    }

    return boat;
  }

  private ensureVerifiedBoatForTripCreation(boat: Boat): void {
    if (!boat.isVerified) {
      throw new ForbiddenException(
        'Embarcação ainda não aprovada pelo NavegaJá. Aguarde a verificação dos documentos.',
      );
    }
  }

  private ensureTripCapacityWithinBoat(dto: CreateTripDto, boat: Boat): void {
    if (dto.totalSeats > boat.capacity) {
      throw new BadRequestException(
        `Total de assentos (${dto.totalSeats}) excede a capacidade da embarcação (${boat.capacity} assentos).`,
      );
    }
  }

  private async ensureNoTripConflictForBoat(
    boatId: string,
    departureAt: Date,
    estimatedArrivalAt: Date,
  ): Promise<void> {
    const conflictingTrips = await this.tripsRepo
      .createQueryBuilder('trip')
      .where('trip.boat_id = :boatId', { boatId })
      .andWhere('trip.status IN (:...statuses)', {
        statuses: [...TripsService.BLOCKING_CONFLICT_STATUSES],
      })
      .andWhere(
        'trip.departure_at < :newArrivalAt AND ' +
          'COALESCE(trip.estimated_arrival_at, trip.departure_at) > :newDepartureAt',
        {
          newDepartureAt: departureAt,
          newArrivalAt: estimatedArrivalAt,
        },
      )
      .getCount();

    if (conflictingTrips > 0) {
      throw new BadRequestException(
        'Esta embarcação já possui viagem agendada neste horário. ' +
          'Verifique o calendário de viagens e escolha outro horário.',
      );
    }
  }

  private validateTripPricing(dto: CreateTripDto): void {
    if (dto.price <= 0) {
      throw new BadRequestException('Preço deve ser maior que zero.');
    }

    if (dto.cargoPriceKg !== undefined && dto.cargoPriceKg < 0) {
      throw new BadRequestException('Preço de carga não pode ser negativo.');
    }
  }

  private async ensureTripCreationAllowedByFloodRisk(): Promise<void> {
    try {
      const flood = await this.floodService.getFloodStatus(
        -3.119,
        -60.0217,
        100,
      );
      if (flood.severity === 'EXTREME') {
        throw new ForbiddenException(
          'Criação de viagem bloqueada: cheia extrema detectada na área. Aguarde a melhora das condições.',
        );
      }
    } catch (err) {
      if (err instanceof ForbiddenException) {
        throw err;
      }
      // Erro na API de cheias não bloqueia a criação da viagem.
    }
  }

  private async resolveTripOriginCoordinates(origin: string): Promise<{
    originLat?: number;
    originLng?: number;
  }> {
    const cityCoordinates = geocodeCity(origin);
    if (cityCoordinates) {
      return {
        originLat: cityCoordinates.lat,
        originLng: cityCoordinates.lng,
      };
    }

    const location = await this.locationsService.findConfirmedByName(origin);
    if (!location) {
      return {};
    }

    return {
      originLat: location.lat,
      originLng: location.lng,
    };
  }

  async create(
    userId: string,
    dto: CreateTripDto,
    role?: string,
  ): Promise<TripResponse> {
    // Alias para compatibilidade interna (trip.captainId = quem criou)
    const captainId = userId;
    const departureAt = new Date(dto.departureTime);
    const estimatedArrivalAt = new Date(dto.arrivalTime);
    await this.ensureVerifiedCaptainForTripCreation(captainId, role);
    this.validateTripRouteAndSchedule(dto, departureAt, estimatedArrivalAt);
    const boat = await this.findBoatForTripCreation(
      captainId,
      dto.boatId,
      role,
    );
    this.ensureVerifiedBoatForTripCreation(boat);
    this.ensureTripCapacityWithinBoat(dto, boat);
    await this.ensureNoTripConflictForBoat(
      dto.boatId,
      departureAt,
      estimatedArrivalAt,
    );
    this.validateTripPricing(dto);
    await this.ensureTripCreationAllowedByFloodRisk();

    // ========== VALIDAÇÕES CRÍTICAS ==========
    const normalizedCargoPriceKg = normalizeCargoPriceKg(dto.cargoPriceKg);

    // ========== CRIAR VIAGEM ==========

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
      cargoPriceKg: normalizedCargoPriceKg,
      cargoCapacityKg: dto.cargoCapacityKg || null,
      availableCargoKg: dto.cargoCapacityKg || null, // Inicializa com capacidade total
      ...(await this.resolveTripOriginCoordinates(dto.origin)),
    } as Partial<Trip>);

    const saved = await this.tripsRepo.save(trip);

    // Notificar usuários que favoritaram este capitão (fire-and-forget)
    this.notifyFavoriteCaptainFans(captainId, saved).catch(() => {});

    // Se criado por gestor, notificar o capitão dono do barco
    if (role === 'boat_manager' && boat.ownerId !== captainId) {
      this.notificationsService
        .sendToUser(boat.ownerId, {
          title: '🚢 Nova viagem criada no seu barco',
          body: `${boat.name}: ${dto.origin} → ${dto.destination} foi agendada pelo gestor.`,
          data: {
            type: 'trip_created_by_manager',
            tripId: saved.id,
            boatId: boat.id,
          },
        })
        .catch(() => {});
    }

    return this.serializeTrip(saved);
  }

  private async notifyFavoriteCaptainFans(
    captainId: string,
    trip: Trip,
  ): Promise<void> {
    const [captain, favorites] = await Promise.all([
      this.usersRepo.findOne({
        where: { id: captainId },
        select: ['id', 'name'],
      }),
      this.favoritesRepo.find({
        where: { type: FavoriteType.CAPTAIN, captainId },
        select: ['userId'],
      }),
    ]);

    if (!favorites.length) return;

    const userIds = favorites.map((f) => f.userId);
    const captainName = captain?.name || 'Seu capitão favorito';

    const departureDate = trip.departureAt.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

    await this.notificationsService.sendToUsers(userIds, {
      title: `${captainName} abriu nova rota!`,
      body: `${trip.origin} → ${trip.destination} em ${departureDate}. Garanta sua vaga!`,
      data: { type: 'captain_new_trip', tripId: trip.id, captainId },
    });
  }

  async findAvailable(
    routeId?: string,
    date?: string,
  ): Promise<TripResponse[]> {
    const where: {
      status: TripStatus;
      routeId?: string;
      departureAt?: FindOperator<Date>;
    } = {
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

    const trips = await this.tripsRepo.find({
      where,
      relations: ['captain', 'boat'],
      order: { departureAt: 'ASC' },
    });

    return this.serializeTrips(trips);
  }

  async search(
    origin?: string,
    destination?: string,
    date?: string,
    minPrice?: number,
    maxPrice?: number,
    departureTime?: 'morning' | 'afternoon' | 'night',
    minRating?: number,
    routeId?: string,
  ): Promise<TripResponse[]> {
    // ValidationPipe({ transform:true }) converte strings não numéricas para NaN — validar aqui
    if (minPrice !== undefined && !Number.isFinite(minPrice)) {
      throw new BadRequestException(
        'minPrice deve ser um número inteiro válido',
      );
    }
    if (maxPrice !== undefined && !Number.isFinite(maxPrice)) {
      throw new BadRequestException(
        'maxPrice deve ser um número inteiro válido',
      );
    }
    if (minRating !== undefined && !Number.isFinite(minRating)) {
      throw new BadRequestException(
        'minRating deve ser um número inteiro válido',
      );
    }

    const qb = this.tripsRepo
      .createQueryBuilder('trip')
      .leftJoin('trip.captain', 'captain')
      .addSelect(TripsService.CAPTAIN_SAFE_FIELDS)
      .leftJoinAndSelect('trip.boat', 'boat')
      .leftJoin('trip.route', 'route')
      .where('trip.status = :status', { status: TripStatus.SCHEDULED });

    // Filtro por routeId (filtro exacto — preferido quando o app conhece o routeId)
    if (routeId) {
      qb.andWhere('trip.route_id = :routeId', { routeId });
    }

    // Filtro por origem — usa COALESCE para suportar trips antigos com origin=''
    if (origin) {
      qb.andWhere(
        `LOWER(COALESCE(NULLIF(trip.origin, ''), route.origin_name)) LIKE LOWER(:origin)`,
        { origin: `%${origin}%` },
      );
    }

    // Filtro por destino — usa COALESCE para suportar trips antigos com destination=''
    if (destination) {
      qb.andWhere(
        `LOWER(COALESCE(NULLIF(trip.destination, ''), route.destination_name)) LIKE LOWER(:destination)`,
        { destination: `%${destination}%` },
      );
    }

    // Filtro por data
    if (date) {
      const dayStart = new Date(date);

      // Validar se a data é válida
      if (isNaN(dayStart.getTime())) {
        throw new BadRequestException(
          `Data inválida: "${date}". Use o formato YYYY-MM-DD (ex: 2026-02-15)`,
        );
      }

      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);
      qb.andWhere('trip.departure_at BETWEEN :dayStart AND :dayEnd', {
        dayStart,
        dayEnd,
      });
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
          qb.andWhere(
            'EXTRACT(HOUR FROM trip.departure_at) >= 6 AND EXTRACT(HOUR FROM trip.departure_at) < 12',
          );
          break;
        case 'afternoon': // 12:00 - 17:59
          qb.andWhere(
            'EXTRACT(HOUR FROM trip.departure_at) >= 12 AND EXTRACT(HOUR FROM trip.departure_at) < 18',
          );
          break;
        case 'night': // 18:00 - 05:59
          qb.andWhere(
            'EXTRACT(HOUR FROM trip.departure_at) >= 18 OR EXTRACT(HOUR FROM trip.departure_at) < 6',
          );
          break;
      }
    }

    // Filtro por avaliação mínima do capitão
    if (minRating !== undefined && minRating !== null) {
      qb.andWhere('CAST(captain.rating AS DECIMAL) >= :minRating', {
        minRating,
      });
    }

    qb.orderBy('trip.departure_at', 'ASC');

    return this.serializeTrips(await qb.getMany());
  }

  async findById(id: string): Promise<Trip> {
    const qb = this.tripsRepo
      .createQueryBuilder('trip')
      .leftJoin('trip.captain', 'captain')
      .addSelect(TripsService.CAPTAIN_SAFE_FIELDS)
      .leftJoinAndSelect('trip.boat', 'boat')
      .leftJoinAndSelect('trip.bookings', 'bookings')
      .leftJoin('bookings.passenger', 'passenger')
      .addSelect(TripsService.PASSENGER_SAFE_FIELDS)
      .where('trip.id = :id', { id });

    const trip = await qb.getOne();
    if (!trip) throw new NotFoundException('Viagem não encontrada');
    return trip;
  }

  /**
   * Endpoint de gestão do capitão — retorna bookings + shipments com todos os dados necessários.
   * Garante que o capitão só acede à sua própria viagem.
   */
  async findByIdResponse(id: string): Promise<TripResponse> {
    return this.serializeTrip(await this.findById(id));
  }

  async findByIdForCaptain(
    id: string,
    userId: string,
    role?: string,
  ): Promise<
    TripResponse & {
      passageiros: Array<{
        bookingId: string;
        status: BookingStatus;
        paymentStatus: PaymentStatus;
        seats: number;
        seatNumber: number | null;
        totalPrice: number;
        createdAt: Date;
        passenger: {
          id: string;
          name: string;
          phone: string;
          avatarUrl: string | null;
          passengerRating: number | null;
        } | null;
      }>;
      encomendas: Array<{
        id: string;
        trackingCode: string;
        validationCode: string | null;
        status: ShipmentStatus;
        description: string | null;
        weightKg: number;
        totalPrice: number;
        paidBy: string;
        recipientName: string;
        recipientPhone: string;
        recipientAddress: string | null;
        collectionPhotoUrl: string | null;
        deliveryPhotoUrl: string | null;
        createdAt: Date;
      }>;
      totalPassageiros: number;
      totalEncomendas: number;
    }
  > {
    const trip = await this.tripsRepo.findOne({
      where: { id },
      relations: ['boat'],
    });
    if (!trip) throw new NotFoundException('Viagem não encontrada');
    await this.assertCanManageTrip(trip, userId, role);

    // Usar entity-based QueryBuilder — TypeORM mapeia colunas snake_case↔camelCase automaticamente
    const [bookings, shipments] = await Promise.all([
      this.tripsRepo.manager
        .createQueryBuilder(Booking, 'b')
        .leftJoin('b.passenger', 'p')
        .select([
          'b.id',
          'b.status',
          'b.paymentStatus',
          'b.seats',
          'b.seatNumber',
          'b.totalPrice',
          'b.createdAt',
          'p.id',
          'p.name',
          'p.phone',
          'p.avatarUrl',
          'p.passengerRating',
        ])
        .where('b.tripId = :id', { id })
        .getMany(),

      this.shipmentsRepo.find({
        where: { tripId: id },
        order: { createdAt: 'ASC' },
      }),
    ]);

    const passageiros = bookings.map((b) => ({
      bookingId: b.id,
      status: b.status,
      paymentStatus: b.paymentStatus,
      seats: b.seats,
      seatNumber: b.seatNumber,
      totalPrice: Number(b.totalPrice),
      createdAt: b.createdAt,
      passenger: b.passenger
        ? {
            id: b.passenger.id,
            name: b.passenger.name,
            phone: b.passenger.phone,
            avatarUrl: b.passenger.avatarUrl,
            passengerRating: b.passenger.passengerRating,
          }
        : null,
    }));

    const encomendas = shipments.map((s) => ({
      id: s.id,
      trackingCode: s.trackingCode,
      validationCode: s.validationCode,
      status: s.status,
      description: s.description,
      weightKg: Number(s.weightKg),
      totalPrice: Number(s.totalPrice),
      paidBy: s.paidBy,
      recipientName: s.recipientName,
      recipientPhone: s.recipientPhone,
      recipientAddress: s.recipientAddress,
      collectionPhotoUrl: s.collectionPhotoUrl,
      deliveryPhotoUrl: s.deliveryPhotoUrl,
      createdAt: s.createdAt,
    }));

    return {
      ...this.serializeTrip(trip),
      passageiros,
      encomendas,
      totalPassageiros: passageiros.length,
      totalEncomendas: encomendas.length,
    };
  }

  /** Verifica se userId pode gerir uma viagem (capitão = dono; boat_manager = atribuído ao barco) */
  private async assertCanManageTrip(
    trip: Trip,
    userId: string,
    role?: string,
  ): Promise<void> {
    if (role === 'boat_manager') {
      const staff = trip.boatId
        ? await this.boatStaffService.canManageBoat(userId, trip.boatId)
        : null;
      if (!staff)
        throw new ForbiddenException('Sem permissão para gerir esta viagem');
    } else {
      if (trip.captainId !== userId)
        throw new ForbiddenException('Acesso negado');
    }
  }

  async cancelTripWithPropagation(
    tripId: string,
    options: { userId?: string; role?: string; notifyBoatOwner?: boolean } = {},
  ): Promise<Trip> {
    const { userId, role, notifyBoatOwner = false } = options;

    const result = await this.tripsRepo.manager.transaction(async (manager) => {
      const tripRepo = manager.getRepository(Trip);
      const bookingRepo = manager.getRepository(Booking);
      const shipmentRepo = manager.getRepository(Shipment);
      const timelineRepo = manager.getRepository(ShipmentTimeline);

      const trip = await tripRepo.findOne({
        where: { id: tripId },
        relations: ['boat'],
      });
      if (!trip) throw new NotFoundException('Viagem não encontrada');

      if (trip.status === TripStatus.CANCELLED) {
        return {
          trip,
          passengerIds: [] as string[],
          bookingsToRefundKm: [] as Array<{
            id: string;
            passengerId: string;
            kmRedeemed: number;
          }>,
          shipmentsToNotify: [] as Array<{
            shipmentId: string;
            senderId: string;
            trackingCode: string;
            title: string;
            body: string;
            notificationType: string;
          }>,
          boatOwnerId: trip.boat?.ownerId ?? null,
          hadPaidBookings: false,
        };
      }

      trip.status = TripStatus.CANCELLED;

      const passengerIds = new Set<string>();
      let seatsToRestore = 0;
      let hadPaidBookings = false;
      const bookings = await bookingRepo.find({
        where: {
          tripId,
          status: In([
            BookingStatus.PENDING,
            BookingStatus.CONFIRMED,
            BookingStatus.CHECKED_IN,
          ]),
        },
      });

      for (const booking of bookings) {
        const consumedSeat = [
          BookingStatus.CONFIRMED,
          BookingStatus.CHECKED_IN,
        ].includes(booking.status);
        if (consumedSeat) {
          seatsToRestore += booking.seats;
        }

        booking.status = BookingStatus.CANCELLED;
        if (booking.paymentStatus === PaymentStatus.PAID) {
          booking.paymentStatus = PaymentStatus.REFUND_PENDING;
          hadPaidBookings = true;
        }
        await bookingRepo.save(booking);
        passengerIds.add(booking.passengerId);
      }

      if (seatsToRestore > 0) {
        trip.availableSeats = Math.min(
          trip.totalSeats,
          trip.availableSeats + seatsToRestore,
        );
      }

      const bookingsToRefundKm = bookings
        .filter((booking) => booking.kmRedeemed && booking.kmRedeemed > 0)
        .map((booking) => ({
          id: booking.id,
          passengerId: booking.passengerId,
          kmRedeemed: booking.kmRedeemed,
        }));

      const shipments = await shipmentRepo.find({ where: { tripId } });
      let cargoToRestore = 0;
      const shipmentsToNotify: {
        shipmentId: string;
        senderId: string;
        trackingCode: string;
        title: string;
        body: string;
        notificationType: string;
      }[] = [];

      for (const shipment of shipments) {
        if (
          [ShipmentStatus.CANCELLED, ShipmentStatus.DELIVERED].includes(
            shipment.status,
          )
        ) {
          continue;
        }

        const canCancelShipment = [
          ShipmentStatus.PENDING,
          ShipmentStatus.PAID,
        ].includes(shipment.status);

        if (canCancelShipment) {
          const previousStatus = shipment.status;
          if (
            trip.availableCargoKg !== null &&
            trip.availableCargoKg !== undefined
          ) {
            let volumetricWeight = 0;
            if (shipment.length && shipment.width && shipment.height) {
              volumetricWeight =
                (Number(shipment.length) *
                  Number(shipment.width) *
                  Number(shipment.height)) /
                6000;
            }
            cargoToRestore += Math.max(
              Number(shipment.weight ?? shipment.weightKg ?? 0),
              volumetricWeight,
            );
          }

          shipment.status = ShipmentStatus.CANCELLED;
          await shipmentRepo.save(shipment);

          const refundWarning =
            previousStatus === ShipmentStatus.PAID &&
            shipment.paidBy !== PaidBy.RECIPIENT
              ? ' O valor pago ficará pendente para reembolso manual.'
              : '';

          const timelineEvent = timelineRepo.create({
            shipmentId: shipment.id,
            status: ShipmentStatus.CANCELLED,
            description:
              `Viagem cancelada - Encomenda cancelada automaticamente.${refundWarning}`.trim(),
            createdBy: userId ?? undefined,
          });
          await timelineRepo.save(timelineEvent);

          shipmentsToNotify.push({
            shipmentId: shipment.id,
            senderId: shipment.senderId,
            trackingCode: shipment.trackingCode,
            title: '❌ Encomenda cancelada',
            body:
              `Sua encomenda ${shipment.trackingCode} foi cancelada porque a viagem foi cancelada.` +
              refundWarning,
            notificationType: 'shipment_cancelled',
          });
          continue;
        }

        const timelineEvent = timelineRepo.create({
          shipmentId: shipment.id,
          status: shipment.status,
          description:
            'Viagem cancelada - Encomenda em operação logística. Tratativa manual necessária.',
          createdBy: userId ?? undefined,
        });
        await timelineRepo.save(timelineEvent);

        shipmentsToNotify.push({
          shipmentId: shipment.id,
          senderId: shipment.senderId,
          trackingCode: shipment.trackingCode,
          title: '⚠️ Viagem cancelada',
          body:
            `A viagem da encomenda ${shipment.trackingCode} foi cancelada, ` +
            'mas ela já entrou na operação logística e seguirá para tratativa manual.',
          notificationType: 'shipment_manual_resolution_required',
        });
      }

      if (
        cargoToRestore > 0 &&
        trip.availableCargoKg !== null &&
        trip.availableCargoKg !== undefined
      ) {
        const maxCargo =
          trip.cargoCapacityKg !== null && trip.cargoCapacityKg !== undefined
            ? trip.cargoCapacityKg
            : trip.availableCargoKg + cargoToRestore;
        trip.availableCargoKg = Math.min(
          maxCargo,
          trip.availableCargoKg + cargoToRestore,
        );
      }

      await tripRepo.save(trip);

      return {
        trip,
        passengerIds: Array.from(passengerIds),
        bookingsToRefundKm,
        shipmentsToNotify,
        boatOwnerId: trip.boat?.ownerId ?? null,
        hadPaidBookings,
      };
    });

    const route = `${result.trip.origin} → ${result.trip.destination}`;

    if (result.passengerIds.length > 0) {
      await this.notificationsService.sendToUsers(result.passengerIds, {
        title: '❌ Viagem cancelada',
        body:
          `A viagem ${route} foi cancelada. A sua reserva foi automaticamente cancelada.` +
          (result.hadPaidBookings
            ? ' Se houve pagamento, o valor ficará pendente para reembolso manual.'
            : ''),
        data: { type: 'trip_cancelled', tripId },
      });
    }

    for (const booking of result.bookingsToRefundKm) {
      await this.gamificationService.refundKm(
        booking.passengerId,
        booking.kmRedeemed,
        booking.id,
      );
    }

    for (const shipment of result.shipmentsToNotify) {
      await this.notificationsService.sendToUser(shipment.senderId, {
        title: shipment.title,
        body: shipment.body,
        data: {
          type: shipment.notificationType,
          shipmentId: shipment.shipmentId,
          trackingCode: shipment.trackingCode,
        },
      });
    }

    if (
      notifyBoatOwner &&
      role === 'boat_manager' &&
      result.boatOwnerId &&
      result.boatOwnerId !== userId
    ) {
      await this.notificationsService.sendToUser(result.boatOwnerId, {
        title: '⚠️ Viagem cancelada pelo gestor',
        body: `A viagem ${route} foi cancelada pelo gestor do seu barco.`,
        data: { type: 'trip_cancelled_by_manager', tripId },
      });
    }

    return this.serializeTrip(result.trip);
  }

  async findByCaptain(captainId: string): Promise<TripResponse[]> {
    // Incluir viagens criadas directamente pelo capitão + viagens nos barcos do capitão
    // criadas por boat_managers (trip.captainId = gestor, mas boat.ownerId = capitão)
    const boats = await this.boatsRepo.find({
      where: { ownerId: captainId },
      select: ['id'],
    });
    const boatIds = boats.map((b) => b.id);

    const conditions: FindOptionsWhere<Trip>[] = [{ captainId }];
    if (boatIds.length > 0) {
      conditions.push({ boatId: In(boatIds) });
    }

    const trips = await this.tripsRepo.find({
      where: conditions,
      relations: ['boat'],
      order: { departureAt: 'DESC' },
    });

    // Deduplicar (viagem criada pelo próprio capitão no seu barco apareceria duas vezes)
    const seen = new Set<string>();
    return this.serializeTrips(
      trips.filter((t) => {
        if (seen.has(t.id)) return false;
        seen.add(t.id);
        return true;
      }),
    );
  }

  /** Viagens de todos os barcos geridos pelo boat_manager */
  async findByManagedBoats(managerId: string): Promise<TripResponse[]> {
    const boatIds = await this.boatStaffService.getAssignedBoatIds(managerId);
    if (!boatIds.length) return [];
    const trips = await this.tripsRepo.find({
      where: { boatId: In(boatIds) },
      relations: ['boat'],
      order: { departureAt: 'DESC' },
    });
    return this.serializeTrips(trips);
  }

  async update(
    tripId: string,
    userId: string,
    dto: CreateTripDto,
    role?: string,
  ): Promise<TripResponse> {
    const trip = await this.tripsRepo.findOne({ where: { id: tripId } });
    if (!trip) throw new NotFoundException('Viagem não encontrada');
    await this.assertCanManageTrip(trip, userId, role);

    const departureAt = new Date(dto.departureTime);
    const estimatedArrivalAt = new Date(dto.arrivalTime);

    trip.origin = dto.origin;
    trip.destination = dto.destination;
    trip.boatId = dto.boatId;
    trip.departureAt = departureAt;
    trip.estimatedArrivalAt = estimatedArrivalAt;
    trip.price = dto.price;
    // Ajustar availableSeats mantendo os assentos ja reservados
    const bookedSeats = trip.totalSeats - trip.availableSeats;
    if (dto.totalSeats < bookedSeats) {
      throw new BadRequestException(
        `Nao e possivel reduzir lotacao para ${dto.totalSeats}. Ja existem ${bookedSeats} assentos reservados.`,
      );
    }
    trip.totalSeats = dto.totalSeats;
    // Ajustar availableSeats mantendo a diferença
    trip.availableSeats = dto.totalSeats - bookedSeats;

    if (dto.cargoPriceKg !== undefined) {
      trip.cargoPriceKg = normalizeCargoPriceKg(dto.cargoPriceKg);
    }
    if (dto.cargoCapacityKg !== undefined) {
      const usedCargo =
        trip.cargoCapacityKg != null && trip.availableCargoKg != null
          ? trip.cargoCapacityKg - trip.availableCargoKg
          : 0;
      if (dto.cargoCapacityKg < usedCargo) {
        throw new BadRequestException(
          `Nao e possivel reduzir capacidade de carga para ${dto.cargoCapacityKg} kg. Ja existem ${usedCargo} kg ocupados.`,
        );
      }
      trip.cargoCapacityKg = dto.cargoCapacityKg;
      trip.availableCargoKg = dto.cargoCapacityKg - usedCargo;
    }

    return this.serializeTrip(await this.tripsRepo.save(trip));
  }

  async delete(tripId: string, userId: string, role?: string): Promise<void> {
    const trip = await this.tripsRepo.findOne({
      where: { id: tripId },
      relations: ['boat'],
    });
    if (!trip) throw new NotFoundException('Viagem não encontrada');
    await this.assertCanManageTrip(trip, userId, role);

    const hasBookings = trip.availableSeats < trip.totalSeats;
    const hasShipments =
      (await this.shipmentsRepo.count({ where: { tripId } })) > 0;

    // Cancelar em vez de deletar se houver reservas ou encomendas
    if (hasBookings || hasShipments) {
      await this.cancelTripWithPropagation(tripId, {
        userId,
        role,
        notifyBoatOwner: role === 'boat_manager',
      });
      return;
    }

    await this.tripsRepo.remove(trip);
  }

  async updateStatus(
    tripId: string,
    userId: string,
    dto: UpdateTripStatusDto,
    role?: string,
  ): Promise<TripStatusUpdateResult> {
    const trip = await this.findTripByIdOrFail(tripId);
    await this.assertCanManageTrip(trip, userId, role);

    const oldStatus = trip.status;

    if (dto.status === oldStatus) {
      if (dto.status === TripStatus.CANCELLED) {
        return this.cancelTripWithPropagation(tripId, {
          userId,
          role,
          notifyBoatOwner: role === 'boat_manager',
        });
      }
      return this.serializeTrip(trip);
    }

    // Validar transições de status permitidas
    const validTransitions: Record<string, TripStatus[]> = {
      [TripStatus.SCHEDULED]: [TripStatus.IN_PROGRESS, TripStatus.CANCELLED],
      [TripStatus.IN_PROGRESS]: [TripStatus.COMPLETED, TripStatus.CANCELLED],
    };
    const allowed: TripStatus[] = validTransitions[oldStatus as string] ?? [];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(
        `Transição inválida: "${oldStatus}" → "${dto.status}". ` +
          (allowed.length
            ? `Permitido: ${allowed.join(', ')}.`
            : 'Viagem já está em estado final.'),
      );
    }

    // ========== VALIDAÇÕES DE SEGURANÇA ANTES DE INICIAR VIAGEM ==========
    let weatherWarning: WeatherWarning | null = null;

    if (
      dto.status === TripStatus.IN_PROGRESS &&
      oldStatus !== TripStatus.IN_PROGRESS
    ) {
      // 1. Verificar checklist de segurança completo
      const checklistComplete =
        await this.safetyService.isChecklistComplete(tripId);
      if (!checklistComplete) {
        throw new BadRequestException(
          '⚠️ Checklist de segurança não está completo. Complete o checklist antes de iniciar a viagem.',
        );
      }

      // 2. Verificar condições climáticas (usa coords atuais do GPS ou padrão Manaus)
      const _gc = geocodeCity(trip.origin);
      const lat = trip.currentLat || trip.originLat || _gc?.lat || -3.119;
      const lng = trip.currentLng || trip.originLng || _gc?.lng || -60.0217;

      try {
        const weatherSafety =
          await this.weatherService.evaluateNavigationSafety(lat, lng);

        // Score < 50: PERIGOSO — bloquear viagem
        if (weatherSafety.score < 50) {
          throw new BadRequestException(
            `❌ Condições climáticas PERIGOSAS (Score: ${weatherSafety.score}/100). ` +
              `NÃO é seguro navegar. Avisos: ${weatherSafety.warnings.join(', ')}. ` +
              `Recomendações: ${weatherSafety.recommendations.join(', ')}`,
          );
        }

        // Score 50–70: ALERTA — permite mas retorna aviso ao capitão
        if (weatherSafety.score < 70) {
          weatherWarning = {
            score: weatherSafety.score,
            warnings: weatherSafety.warnings,
            recommendations: weatherSafety.recommendations,
          };
        }
      } catch (error) {
        if (error instanceof BadRequestException) throw error;
        // Se API de clima falhar, não bloquear viagem (fallback)
        const message = error instanceof Error ? error.message : String(error);
        console.error('❌ Erro ao verificar clima:', message);
      }
    }

    if (dto.status === TripStatus.CANCELLED) {
      return this.cancelTripWithPropagation(tripId, {
        userId,
        role,
        notifyBoatOwner: role === 'boat_manager',
      });
    }

    trip.status = dto.status;
    const saved = await this.tripsRepo.save(trip);

    const route = `${trip.origin} → ${trip.destination}`;

    // Auto-atualizar encomendas quando viagem muda de status
    if (
      dto.status === TripStatus.IN_PROGRESS &&
      oldStatus !== TripStatus.IN_PROGRESS
    ) {
      // Viagem partiu - atualizar encomendas COLLECTED para IN_TRANSIT
      await this.shipmentsService.updateShipmentsByTrip(
        tripId,
        ShipmentStatus.IN_TRANSIT,
      );
      // Notificar passageiros
      await this.notificationsService.sendToTripPassengers(tripId, {
        title: '⛵ Sua viagem começou!',
        body: `A viagem ${route} partiu. Boa viagem!`,
        data: { type: 'trip_started', tripId },
      });
    } else if (
      dto.status === TripStatus.COMPLETED &&
      oldStatus !== TripStatus.COMPLETED
    ) {
      // Notificar ANTES de completar as reservas (sendToTripPassengers filtra por CONFIRMED/CHECKED_IN)
      await this.notificationsService.sendToTripPassengers(tripId, {
        title: '🏁 Viagem concluída!',
        body: `Chegou em ${trip.destination}. Não esqueça de avaliar o capitão!`,
        data: { type: 'trip_completed', tripId },
      });
      // Completar reservas abertas e atualizar encomendas
      await this.bookingsService.autoCompleteByTrip(tripId);
      await this.shipmentsService.updateShipmentsByTrip(
        tripId,
        ShipmentStatus.ARRIVED,
      );
      await this.gamificationService.awardBoatOwnerTripCompleted(
        trip.boat?.ownerId,
        trip.id,
      );
    }

    // Incluir weatherWarning no response quando capitão inicia viagem com alerta
    if (weatherWarning) {
      return { ...this.serializeTrip(saved), weatherWarning };
    }

    return this.serializeTrip(saved);
  }

  async updateLocation(
    tripId: string,
    userId: string,
    dto: UpdateLocationDto,
    role?: string,
  ): Promise<{
    lat: number;
    lng: number;
    lastLocationAt: Date;
    status: string;
  }> {
    const trip = await this.tripsRepo.findOne({ where: { id: tripId } });
    if (!trip) throw new NotFoundException('Viagem não encontrada');
    await this.assertCanManageTrip(trip, userId, role);
    const now = new Date();
    await this.tripsRepo.update(tripId, {
      currentLat: dto.lat,
      currentLng: dto.lng,
      lastLocationAt: now,
    });
    return {
      lat: dto.lat,
      lng: dto.lng,
      lastLocationAt: now,
      status: trip.status,
    };
  }

  async getLocation(tripId: string): Promise<{
    lat: number | null;
    lng: number | null;
    lastLocationAt: Date | null;
    status: string;
  }> {
    const trip = await this.tripsRepo.findOne({
      where: { id: tripId },
      relations: ['route'],
    });
    if (!trip) throw new NotFoundException('Viagem não encontrada');

    // Viagem agendada → posição é a cidade de origem (da rota ou geocodificada)
    const _originCoords =
      trip.route?.originLat && trip.route?.originLng
        ? {
            lat: Number(trip.route.originLat),
            lng: Number(trip.route.originLng),
          }
        : trip.originLat
          ? { lat: Number(trip.originLat), lng: Number(trip.originLng) }
          : geocodeCity(trip.origin);
    if (trip.status === TripStatus.SCHEDULED && _originCoords) {
      return {
        lat: _originCoords.lat,
        lng: _originCoords.lng,
        lastLocationAt: null,
        status: trip.status,
      };
    }

    // Viagem concluída → posição é a cidade de destino (da rota)
    if (trip.status === TripStatus.COMPLETED && trip.route) {
      return {
        lat: Number(trip.route.destinationLat),
        lng: Number(trip.route.destinationLng),
        lastLocationAt: trip.lastLocationAt ?? null,
        status: trip.status,
      };
    }

    // Em progresso ou sem rota → GPS em tempo real (fallback: coords da cidade de origem)
    const _fb = trip.originLat
      ? { lat: Number(trip.originLat), lng: Number(trip.originLng) }
      : geocodeCity(trip.origin);
    return {
      lat: trip.currentLat ?? _fb?.lat ?? null,
      lng: trip.currentLng ?? _fb?.lng ?? null,
      lastLocationAt: trip.lastLocationAt ?? null,
      status: trip.status,
    };
  }

  async generateCargoManifestPdf(
    tripId: string,
    userId: string,
    userRole: string,
  ): Promise<PdfStream> {
    const trip = await this.tripsRepo.findOne({
      where: { id: tripId },
      relations: ['captain', 'boat'],
    });
    if (!trip) throw new NotFoundException('Viagem não encontrada');

    if (userRole === 'boat_manager') {
      const staff = trip.boatId
        ? await this.boatStaffService.canManageBoat(userId, trip.boatId)
        : null;
      if (!staff)
        throw new ForbiddenException(
          'Sem permissão para gerar o manifesto desta viagem',
        );
    } else if (userRole !== 'admin' && trip.captainId !== userId) {
      throw new ForbiddenException(
        'Apenas o capitão ou admin pode gerar o manifesto',
      );
    }

    const shipments = await this.shipmentsRepo.find({
      where: { tripId },
      order: { createdAt: 'ASC' },
    });

    return this.pdfService.createCargoManifest({
      tripId: trip.id,
      origin: trip.origin || 'N/A',
      destination: trip.destination || 'N/A',
      departureAt: trip.departureAt,
      captainName: trip.captain?.name || 'Capitão',
      boatName: trip.boat?.name || 'Embarcação',
      shipments: shipments.map((s) => ({
        trackingCode: s.trackingCode,
        senderName: s.description?.split(' ')[0] || 'Remetente',
        recipientName: s.recipientName,
        recipientAddress: s.recipientAddress || '',
        weight: Number(s.weight) || 0,
        description: s.description || '',
        status: s.status,
        totalPrice: Number(s.totalPrice) || 0,
      })),
    });
  }

  async getPopularDestinations() {
    // COALESCE: se trip.origin for vazio (seed antigo), usa route.origin_name como fallback
    const now = new Date();

    const popularOrigins = await this.tripsRepo
      .createQueryBuilder('trip')
      .leftJoin('trip.route', 'route')
      .select(`COALESCE(NULLIF(trip.origin, ''), route.origin_name)`, 'city')
      .addSelect('COUNT(*)', 'count')
      .where('trip.status = :status', { status: TripStatus.SCHEDULED })
      .andWhere('trip.departure_at >= :now', { now })
      .andWhere(
        `COALESCE(NULLIF(trip.origin, ''), route.origin_name) IS NOT NULL`,
      )
      .groupBy(`COALESCE(NULLIF(trip.origin, ''), route.origin_name)`)
      .orderBy('count', 'DESC')
      .limit(10)
      .getRawMany<{ city: string; count: string }>();

    const popularDestinations = await this.tripsRepo
      .createQueryBuilder('trip')
      .leftJoin('trip.route', 'route')
      .select(
        `COALESCE(NULLIF(trip.destination, ''), route.destination_name)`,
        'city',
      )
      .addSelect('COUNT(*)', 'count')
      .where('trip.status = :status', { status: TripStatus.SCHEDULED })
      .andWhere('trip.departure_at >= :now', { now })
      .andWhere(
        `COALESCE(NULLIF(trip.destination, ''), route.destination_name) IS NOT NULL`,
      )
      .groupBy(`COALESCE(NULLIF(trip.destination, ''), route.destination_name)`)
      .orderBy('count', 'DESC')
      .limit(10)
      .getRawMany<{ city: string; count: string }>();

    const popularRoutes = await this.tripsRepo
      .createQueryBuilder('trip')
      .leftJoin('trip.route', 'route')
      .select(`COALESCE(NULLIF(trip.origin, ''), route.origin_name)`, 'origin')
      .addSelect(
        `COALESCE(NULLIF(trip.destination, ''), route.destination_name)`,
        'destination',
      )
      .addSelect('route.id', 'routeId')
      .addSelect('COUNT(*)', 'count')
      .addSelect('MIN(trip.price)', 'minPrice')
      .addSelect('AVG(trip.price)', 'avgPrice')
      .where('trip.status = :status', { status: TripStatus.SCHEDULED })
      .andWhere('trip.departure_at >= :now', { now })
      .groupBy(
        `COALESCE(NULLIF(trip.origin, ''), route.origin_name), COALESCE(NULLIF(trip.destination, ''), route.destination_name), route.id`,
      )
      .orderBy('count', 'DESC')
      .limit(10)
      .getRawMany<{
        origin: string;
        destination: string;
        routeId: string | null;
        count: string;
        minPrice: string;
        avgPrice: string;
      }>();

    return {
      origins: popularOrigins.map((item) => ({
        city: item.city,
        tripsCount: parseInt(item.count, 10),
      })),
      destinations: popularDestinations.map((item) => ({
        city: item.city,
        tripsCount: parseInt(item.count, 10),
      })),
      routes: popularRoutes.map((item) => ({
        routeId: item.routeId ?? null,
        origin: item.origin,
        destination: item.destination,
        tripsCount: parseInt(item.count, 10),
        minPrice: parseFloat(item.minPrice),
        avgPrice: parseFloat(item.avgPrice),
      })),
    };
  }

  /**
   * Auto-cancela viagens SCHEDULED cuja data de partida já passou há mais de 2 horas.
   * Roda a cada 15 minutos.
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async autoCancelExpiredTrips() {
    const grace = new Date();
    grace.setHours(grace.getHours() - 2); // 2h de tolerância

    const expired = await this.tripsRepo.find({
      where: {
        status: TripStatus.SCHEDULED,
        departureAt: LessThan(grace),
      },
    });

    for (const trip of expired) {
      await this.cancelTripWithPropagation(trip.id);
      this.logger.log(
        `Trip ${trip.id} auto-cancelada (partida expirada: ${trip.departureAt.toISOString()})`,
      );
    }

    if (expired.length > 0) {
      this.logger.log(
        `[Cron] ${expired.length} viagem(ns) auto-cancelada(s) por expiração.`,
      );
    }
  }
}
