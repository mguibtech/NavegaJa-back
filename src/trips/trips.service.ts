import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, Between } from 'typeorm';
import { Trip, TripStatus } from './trip.entity';
import { CreateTripDto, UpdateTripStatusDto, UpdateLocationDto } from './dto/trip.dto';
import { ShipmentsService } from '../shipments/shipments.service';
import { ShipmentStatus } from '../shipments/shipment.entity';
import { SafetyService } from '../safety/safety.service';
import { WeatherService } from '../weather/weather.service';
import { FloodService } from '../weather/flood.service';
import { NotificationsService } from '../notifications/notifications.service';
import { BookingsService } from '../bookings/bookings.service';
import { PdfService } from '../pdf/pdf.service';
import { Boat } from '../boats/boat.entity';
import { User } from '../users/user.entity';
import { Shipment } from '../shipments/shipment.entity';
import { Favorite, FavoriteType } from '../favorites/favorite.entity';
import { Booking } from '../bookings/booking.entity';

@Injectable()
export class TripsService {
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
    private pdfService: PdfService,
  ) {}

  async create(captainId: string, dto: CreateTripDto): Promise<Trip> {
    const departureAt = new Date(dto.departureTime);
    const estimatedArrivalAt = new Date(dto.arrivalTime);

    // ========== VALIDAÇÕES CRÍTICAS ==========

    // 0. Capitão deve ter documentação verificada pelo admin
    const captain = await this.usersRepo.findOne({
      where: { id: captainId },
      select: ['id', 'isVerified'],
    });
    if (!captain?.isVerified) {
      throw new ForbiddenException(
        'Conta não verificada. Envie sua habilitação náutica e aguarde a aprovação do NavegaJá.',
      );
    }

    // 1. Origem e destino não podem ser iguais
    if (dto.origin.trim().toLowerCase() === dto.destination.trim().toLowerCase()) {
      throw new BadRequestException('Origem e destino não podem ser iguais.');
    }

    // 2. Validar datas
    const now = new Date();
    if (departureAt < now) {
      throw new BadRequestException(
        'Data de partida deve ser futura. Não é possível criar viagens no passado.',
      );
    }

    if (estimatedArrivalAt <= departureAt) {
      throw new BadRequestException(
        'Data de chegada deve ser posterior à data de partida.',
      );
    }

    // 2. Validar embarcação (deve existir e pertencer ao capitão)
    const boat = await this.boatsRepo.findOne({
      where: { id: dto.boatId, ownerId: captainId },
    });

    if (!boat) {
      throw new NotFoundException(
        'Embarcação não encontrada ou você não é o proprietário desta embarcação.',
      );
    }

    // 2a. Embarcação deve estar aprovada pelo admin
    if (!boat.isVerified) {
      throw new ForbiddenException(
        'Embarcação ainda não aprovada pelo NavegaJá. Aguarde a verificação dos documentos.',
      );
    }

    // 3. Validar capacidade (totalSeats não pode exceder capacidade da embarcação)
    if (dto.totalSeats > boat.capacity) {
      throw new BadRequestException(
        `Total de assentos (${dto.totalSeats}) excede a capacidade da embarcação (${boat.capacity} assentos).`,
      );
    }

    // 4. Verificar conflitos de horário (embarcação não pode estar em duas viagens ao mesmo tempo)
    const conflictingTrips = await this.tripsRepo
      .createQueryBuilder('trip')
      .where('trip.boatId = :boatId', { boatId: dto.boatId })
      .andWhere('trip.status IN (:...statuses)', {
        statuses: [TripStatus.SCHEDULED, TripStatus.IN_PROGRESS],
      })
      .andWhere(
        '(trip.departure_at BETWEEN :departureStart AND :departureEnd) OR ' +
        '(trip.estimated_arrival_at BETWEEN :arrivalStart AND :arrivalEnd) OR ' +
        '(:departureStart BETWEEN trip.departure_at AND trip.estimated_arrival_at)',
        {
          departureStart: departureAt,
          departureEnd: estimatedArrivalAt,
          arrivalStart: departureAt,
          arrivalEnd: estimatedArrivalAt,
        },
      )
      .getCount();

    if (conflictingTrips > 0) {
      throw new BadRequestException(
        'Esta embarcação já possui viagem agendada neste horário. ' +
        'Verifique o calendário de viagens e escolha outro horário.',
      );
    }

    // 5. Validar preços (devem ser positivos)
    if (dto.price <= 0) {
      throw new BadRequestException('Preço deve ser maior que zero.');
    }

    if (dto.cargoPriceKg && dto.cargoPriceKg < 0) {
      throw new BadRequestException('Preço de carga não pode ser negativo.');
    }

    // 6. Verificar risco de cheia EXTREME (bloqueia criação da viagem)
    try {
      const flood = await this.floodService.getFloodStatus(-3.119, -60.0217, 100);
      if (flood.severity === 'EXTREME') {
        throw new ForbiddenException(
          'Criação de viagem bloqueada: cheia extrema detectada na área. Aguarde a melhora das condições.',
        );
      }
    } catch (err) {
      if (err instanceof ForbiddenException) throw err;
      // Erro na API de cheias não bloqueia a criação da viagem
    }

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
      cargoPriceKg: dto.cargoPriceKg || 0,
      cargoCapacityKg: dto.cargoCapacityKg || null,
      availableCargoKg: dto.cargoCapacityKg || null, // Inicializa com capacidade total
    } as Partial<Trip>);

    const saved = await this.tripsRepo.save(trip);

    // Notificar usuários que favoritaram este capitão (fire-and-forget)
    this.notifyFavoriteCaptainFans(captainId, saved).catch(() => {});

    return saved;
  }

  private async notifyFavoriteCaptainFans(captainId: string, trip: Trip): Promise<void> {
    const [captain, favorites] = await Promise.all([
      this.usersRepo.findOne({ where: { id: captainId }, select: ['id', 'name'] }),
      this.favoritesRepo.find({
        where: { type: FavoriteType.CAPTAIN, captainId },
        select: ['userId'],
      }),
    ]);

    if (!favorites.length) return;

    const userIds = favorites.map(f => f.userId);
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
    routeId?: string,
  ): Promise<Trip[]> {
    // ValidationPipe({ transform:true }) converte strings não numéricas para NaN — validar aqui
    if (minPrice !== undefined && !Number.isFinite(minPrice)) {
      throw new BadRequestException('minPrice deve ser um número inteiro válido');
    }
    if (maxPrice !== undefined && !Number.isFinite(maxPrice)) {
      throw new BadRequestException('maxPrice deve ser um número inteiro válido');
    }
    if (minRating !== undefined && !Number.isFinite(minRating)) {
      throw new BadRequestException('minRating deve ser um número inteiro válido');
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

  async findById(id: string): Promise<any> {
    const qb = this.tripsRepo
      .createQueryBuilder('trip')
      .leftJoin('trip.captain', 'captain')
      .addSelect(TripsService.CAPTAIN_SAFE_FIELDS)
      .leftJoinAndSelect('trip.boat', 'boat')
      .leftJoinAndSelect('trip.bookings', 'bookings')
      .leftJoin('bookings.passenger', 'passenger')
      .addSelect(TripsService.CAPTAIN_SAFE_FIELDS.map(f => f.replace('captain.', 'passenger.')))
      .where('trip.id = :id', { id });

    const trip = await qb.getOne();
    if (!trip) throw new NotFoundException('Viagem não encontrada');
    return trip;
  }

  /**
   * Endpoint de gestão do capitão — retorna bookings + shipments com todos os dados necessários.
   * Garante que o capitão só acede à sua própria viagem.
   */
  async findByIdForCaptain(id: string, captainId: string): Promise<any> {
    const trip = await this.tripsRepo.findOne({ where: { id }, relations: ['boat'] });
    if (!trip) throw new NotFoundException('Viagem não encontrada');
    if (trip.captainId !== captainId) {
      throw new ForbiddenException('Acesso negado');
    }

    // Usar entity-based QueryBuilder — TypeORM mapeia colunas snake_case↔camelCase automaticamente
    const [bookings, shipments] = await Promise.all([
      this.tripsRepo.manager
        .createQueryBuilder(Booking, 'b')
        .leftJoin('b.passenger', 'p')
        .select([
          'b.id', 'b.status', 'b.paymentStatus',
          'b.seats', 'b.seatNumber', 'b.totalPrice', 'b.createdAt',
          'p.id', 'p.name', 'p.phone', 'p.avatarUrl', 'p.passengerRating',
        ])
        .where('b.tripId = :id', { id })
        .getMany(),

      this.shipmentsRepo.find({
        where: { tripId: id },
        order: { createdAt: 'ASC' },
      }),
    ]);

    const passageiros = bookings.map(b => ({
      bookingId: b.id,
      status: b.status,
      paymentStatus: b.paymentStatus,
      seats: b.seats,
      seatNumber: b.seatNumber,
      totalPrice: Number(b.totalPrice),
      createdAt: b.createdAt,
      passenger: b.passenger ? {
        id: b.passenger.id,
        name: b.passenger.name,
        phone: b.passenger.phone,
        avatarUrl: (b.passenger as any).avatarUrl,
        passengerRating: (b.passenger as any).passengerRating,
      } : null,
    }));

    const encomendas = shipments.map(s => ({
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
      ...trip,
      passageiros,
      encomendas,
      totalPassageiros: passageiros.length,
      totalEncomendas: encomendas.length,
    };
  }

  // Campos seguros do capitão/passageiro — excluem passwordHash, resetCode, fcmToken
  private static readonly CAPTAIN_SAFE_FIELDS = [
    'captain.id', 'captain.name', 'captain.phone', 'captain.role', 'captain.email',
    'captain.avatarUrl', 'captain.rating', 'captain.totalTrips', 'captain.totalPoints',
    'captain.level', 'captain.referralCode', 'captain.isActive', 'captain.passengerRating',
    'captain.city', 'captain.state', 'captain.isVerified', 'captain.licensePhotoUrl',
    'captain.certificatePhotoUrl', 'captain.verifiedAt', 'captain.createdAt', 'captain.updatedAt',
  ];

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

    if (dto.cargoPriceKg !== undefined) trip.cargoPriceKg = dto.cargoPriceKg;
    if (dto.cargoCapacityKg !== undefined) {
      const usedCargo = (trip.cargoCapacityKg != null && trip.availableCargoKg != null)
        ? trip.cargoCapacityKg - trip.availableCargoKg
        : 0;
      trip.cargoCapacityKg = dto.cargoCapacityKg;
      trip.availableCargoKg = dto.cargoCapacityKg - usedCargo;
    }

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

    // Validar transições de status permitidas
    const validTransitions: Record<string, TripStatus[]> = {
      [TripStatus.SCHEDULED]: [TripStatus.IN_PROGRESS, TripStatus.CANCELLED],
      [TripStatus.IN_PROGRESS]: [TripStatus.COMPLETED, TripStatus.CANCELLED],
    };
    const allowed: TripStatus[] = validTransitions[oldStatus as string] ?? [];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(
        `Transição inválida: "${oldStatus}" → "${dto.status}". ` +
        (allowed.length ? `Permitido: ${allowed.join(', ')}.` : 'Viagem já está em estado final.'),
      );
    }

    // ========== VALIDAÇÕES DE SEGURANÇA ANTES DE INICIAR VIAGEM ==========
    let weatherWarning: { score: number; warnings: string[]; recommendations: string[] } | null = null;

    if (dto.status === TripStatus.IN_PROGRESS && oldStatus !== TripStatus.IN_PROGRESS) {
      // 1. Verificar checklist de segurança completo
      const checklistComplete = await this.safetyService.isChecklistComplete(tripId);
      if (!checklistComplete) {
        throw new BadRequestException(
          '⚠️ Checklist de segurança não está completo. Complete o checklist antes de iniciar a viagem.',
        );
      }

      // 2. Verificar condições climáticas (usa coords atuais do GPS ou padrão Manaus)
      const lat = trip.currentLat || -3.119;
      const lng = trip.currentLng || -60.0217;

      try {
        const weatherSafety = await this.weatherService.evaluateNavigationSafety(lat, lng);

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
        console.error('❌ Erro ao verificar clima:', error.message);
      }
    }

    trip.status = dto.status;
    const saved = await this.tripsRepo.save(trip);

    const route = `${trip.origin} → ${trip.destination}`;

    // Auto-atualizar encomendas quando viagem muda de status
    if (dto.status === TripStatus.IN_PROGRESS && oldStatus !== TripStatus.IN_PROGRESS) {
      // Viagem partiu - atualizar encomendas COLLECTED para IN_TRANSIT
      await this.shipmentsService.updateShipmentsByTrip(tripId, ShipmentStatus.IN_TRANSIT);
      // Notificar passageiros
      await this.notificationsService.sendToTripPassengers(tripId, {
        title: '⛵ Sua viagem começou!',
        body: `A viagem ${route} partiu. Boa viagem!`,
        data: { type: 'trip_started', tripId },
      });
    } else if (dto.status === TripStatus.COMPLETED && oldStatus !== TripStatus.COMPLETED) {
      // Notificar ANTES de completar as reservas (sendToTripPassengers filtra por CONFIRMED/CHECKED_IN)
      await this.notificationsService.sendToTripPassengers(tripId, {
        title: '🏁 Viagem concluída!',
        body: `Chegou em ${trip.destination}. Não esqueça de avaliar o capitão!`,
        data: { type: 'trip_completed', tripId },
      });
      // Completar reservas abertas e atualizar encomendas
      await this.bookingsService.autoCompleteByTrip(tripId);
      await this.shipmentsService.updateShipmentsByTrip(tripId, ShipmentStatus.ARRIVED);
    } else if (dto.status === TripStatus.CANCELLED && oldStatus !== TripStatus.CANCELLED) {
      // Viagem cancelada - notificar passageiros
      await this.notificationsService.sendToTripPassengers(tripId, {
        title: '❌ Viagem cancelada',
        body: `A viagem ${route} foi cancelada.`,
        data: { type: 'trip_cancelled', tripId },
      });
    }

    // Incluir weatherWarning no response quando capitão inicia viagem com alerta
    if (weatherWarning) {
      return { ...saved, weatherWarning };
    }

    return saved;
  }

  async updateLocation(tripId: string, captainId: string, dto: UpdateLocationDto): Promise<{ lat: number; lng: number; lastLocationAt: Date; status: string }> {
    const trip = await this.tripsRepo.findOne({ where: { id: tripId } });
    if (!trip) throw new NotFoundException('Viagem não encontrada');
    if (trip.captainId !== captainId) {
      throw new ForbiddenException('Apenas o capitão pode atualizar a localização');
    }
    const now = new Date();
    await this.tripsRepo.update(tripId, {
      currentLat: dto.lat,
      currentLng: dto.lng,
      lastLocationAt: now,
    } as any);
    return { lat: dto.lat, lng: dto.lng, lastLocationAt: now, status: trip.status };
  }

  async getLocation(tripId: string): Promise<{ lat: number | null; lng: number | null; lastLocationAt: Date | null; status: string }> {
    const trip = await this.tripsRepo.findOne({
      where: { id: tripId },
      select: ['id', 'currentLat', 'currentLng', 'lastLocationAt', 'status'],
    });
    if (!trip) throw new NotFoundException('Viagem não encontrada');
    return {
      lat: trip.currentLat ?? null,
      lng: trip.currentLng ?? null,
      lastLocationAt: trip.lastLocationAt ?? null,
      status: trip.status,
    };
  }

  async generateCargoManifestPdf(tripId: string, userId: string, userRole: string): Promise<any> {
    const trip = await this.tripsRepo.findOne({
      where: { id: tripId },
      relations: ['captain', 'boat'],
    });
    if (!trip) throw new NotFoundException('Viagem não encontrada');

    if (userRole !== 'admin' && trip.captainId !== userId) {
      throw new ForbiddenException('Apenas o capitão ou admin pode gerar o manifesto');
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
      captainName: (trip.captain as any)?.name || 'Capitão',
      boatName: (trip.boat as any)?.name || 'Embarcação',
      shipments: shipments.map(s => ({
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
    const popularOrigins = await this.tripsRepo
      .createQueryBuilder('trip')
      .leftJoin('trip.route', 'route')
      .select(`COALESCE(NULLIF(trip.origin, ''), route.origin_name)`, 'city')
      .addSelect('COUNT(*)', 'count')
      .where('trip.status = :status', { status: TripStatus.SCHEDULED })
      .andWhere(`COALESCE(NULLIF(trip.origin, ''), route.origin_name) IS NOT NULL`)
      .groupBy(`COALESCE(NULLIF(trip.origin, ''), route.origin_name)`)
      .orderBy('count', 'DESC')
      .limit(10)
      .getRawMany();

    const popularDestinations = await this.tripsRepo
      .createQueryBuilder('trip')
      .leftJoin('trip.route', 'route')
      .select(`COALESCE(NULLIF(trip.destination, ''), route.destination_name)`, 'city')
      .addSelect('COUNT(*)', 'count')
      .where('trip.status = :status', { status: TripStatus.SCHEDULED })
      .andWhere(`COALESCE(NULLIF(trip.destination, ''), route.destination_name) IS NOT NULL`)
      .groupBy(`COALESCE(NULLIF(trip.destination, ''), route.destination_name)`)
      .orderBy('count', 'DESC')
      .limit(10)
      .getRawMany();

    const popularRoutes = await this.tripsRepo
      .createQueryBuilder('trip')
      .leftJoin('trip.route', 'route')
      .select(`COALESCE(NULLIF(trip.origin, ''), route.origin_name)`, 'origin')
      .addSelect(`COALESCE(NULLIF(trip.destination, ''), route.destination_name)`, 'destination')
      .addSelect('route.id', 'routeId')
      .addSelect('COUNT(*)', 'count')
      .addSelect('MIN(trip.price)', 'minPrice')
      .addSelect('AVG(trip.price)', 'avgPrice')
      .where('trip.status = :status', { status: TripStatus.SCHEDULED })
      .groupBy(`COALESCE(NULLIF(trip.origin, ''), route.origin_name), COALESCE(NULLIF(trip.destination, ''), route.destination_name), route.id`)
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
        routeId: item.routeId ?? null,
        origin: item.origin,
        destination: item.destination,
        tripsCount: parseInt(item.count),
        minPrice: parseFloat(item.minPrice),
        avgPrice: parseFloat(item.avgPrice),
      })),
    };
  }
}
