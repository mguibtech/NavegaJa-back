import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, LessThan, FindOptionsWhere } from 'typeorm';
import {
  Booking,
  BookingStatus,
  PaymentStatus,
  PaymentMethod,
} from './booking.entity';
import { Trip, TripStatus } from '../trips/trip.entity';
import { CreateBookingDto } from './dto/create-booking.dto';
import { ChildPassengerDto } from './dto/passenger.dto';
import { GamificationService } from '../gamification/gamification.service';
import { PdfStream } from '../pdf/pdf.types';
import { PointAction } from '../gamification/point-transaction.entity';
import { KM_BLOCK } from '../gamification/km-transaction.entity';
import { CouponsService } from '../coupons/coupons.service';
import { User } from '../users/user.entity';
import { PixService } from '../payments/pix.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PdfService } from '../pdf/pdf.service';
import { FloodService } from '../weather/flood.service';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    @InjectRepository(Booking)
    private bookingsRepo: Repository<Booking>,
    @InjectRepository(Trip)
    private tripsRepo: Repository<Trip>,
    @InjectRepository(User)
    private usersRepo: Repository<User>,
    private gamificationService: GamificationService,
    private couponsService: CouponsService,
    private pixService: PixService,
    private notificationsService: NotificationsService,
    private pdfService: PdfService,
    private floodService: FloodService,
  ) {}

  private async findBookingByIdOrThrow(
    id: string,
    relations: string[] = [],
  ): Promise<Booking> {
    const booking = await this.bookingsRepo.findOne({
      where: { id },
      relations,
    });
    if (!booking) {
      throw new NotFoundException('Reserva não encontrada');
    }

    return booking;
  }

  private async adjustTripAvailableSeats(
    tripId: string,
    seatsDelta: number,
  ): Promise<Trip | null> {
    const trip = await this.tripsRepo.findOne({ where: { id: tripId } });
    if (!trip) {
      return null;
    }

    trip.availableSeats += seatsDelta;
    await this.tripsRepo.save(trip);
    return trip;
  }

  private getBookingDistanceKm(booking: Booking): number {
    return Math.round(Number(booking.trip?.route?.distanceKm ?? 0));
  }

  private async rewardCompletedBooking(
    booking: Booking,
    convertReferral: boolean,
  ): Promise<void> {
    await this.gamificationService.awardPoints(
      booking.passengerId,
      PointAction.BOOKING_COMPLETED,
      booking.id,
    );

    await this.gamificationService.checkFirstTripOfMonthBonus(
      booking.passengerId,
      booking.id,
    );

    if (convertReferral) {
      await this.gamificationService.convertReferral(booking.passengerId);
    }

    await this.gamificationService.awardBoatOwnerPassengerCompleted(
      booking.trip?.boat?.ownerId,
      booking.id,
    );

    const distanceKm = this.getBookingDistanceKm(booking);
    if (distanceKm > 0) {
      await this.gamificationService.creditKm(
        booking.passengerId,
        distanceKm,
        booking.id,
      );
    }
  }

  private async markBookingCompleted(
    booking: Booking,
    convertReferral: boolean,
  ): Promise<Booking> {
    booking.status = BookingStatus.COMPLETED;
    const saved = await this.bookingsRepo.save(booking);

    await this.rewardCompletedBooking(booking, convertReferral);

    return saved;
  }

  private async assertCaptainCanConfirmPayments(
    confirmedBy?: string,
    confirmedByRole?: string,
  ): Promise<void> {
    if (confirmedByRole !== 'captain' || !confirmedBy) {
      return;
    }

    const captain = await this.usersRepo.findOne({
      where: { id: confirmedBy },
      select: ['id', 'isVerified'],
    });
    if (!captain?.isVerified) {
      throw new ForbiddenException(
        'Conta não verificada. Aguarde a aprovação do NavegaJá.',
      );
    }
  }

  async calculatePrice(
    passengerId: string,
    tripId: string,
    quantity: number,
    couponCode?: string,
    redeemKm?: number,
    children?: ChildPassengerDto[],
  ) {
    const trip = await this.tripsRepo.findOne({ where: { id: tripId } });
    if (!trip) throw new NotFoundException('Viagem não encontrada');

    const user = await this.usersRepo.findOne({ where: { id: passengerId } });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    // Crianças ≤ 9 anos viajam grátis (mas ocupam assento)
    const MAX_FREE_CHILDREN = 3;
    const childrenList = children || [];
    if (childrenList.length > quantity) {
      throw new BadRequestException(
        'Número de crianças não pode exceder o total de assentos.',
      );
    }
    const freeChildrenCount = childrenList.filter((c) => c.age <= 9).length;
    if (freeChildrenCount > MAX_FREE_CHILDREN) {
      throw new BadRequestException(
        `Máximo de ${MAX_FREE_CHILDREN} crianças grátis por reserva. Para grupos maiores, entre em contato com o capitão.`,
      );
    }
    const childrenDiscount = Number(trip.price) * freeChildrenCount;

    const basePrice = Number(trip.price) * quantity; // preço cheio (todos os assentos)
    const priceAfterChildren = basePrice - childrenDiscount;

    let tripDiscount = 0;
    let priceAfterTripDiscount = priceAfterChildren;
    let couponDiscount = 0;
    let loyaltyDiscount = 0;
    let kmDiscount = 0;

    // 1. Desconto da viagem (capitão)
    if (trip.discount > 0) {
      tripDiscount = (priceAfterChildren * trip.discount) / 100;
      priceAfterTripDiscount = priceAfterChildren - tripDiscount;
    }

    // 2. Cupom promocional
    let couponData = null;
    if (couponCode) {
      const validation = await this.couponsService.validate(
        couponCode,
        passengerId,
        priceAfterTripDiscount,
      );
      if (validation.valid && validation.discount) {
        couponDiscount = validation.discount;
        couponData = validation.coupon;
      }
    }

    const priceAfterCoupon = priceAfterTripDiscount - couponDiscount;

    // 3. Desconto de gamificação (nível de fidelidade)
    const userDiscount =
      await this.gamificationService.getUserDiscount(passengerId);
    if (userDiscount > 0) {
      loyaltyDiscount = (priceAfterCoupon * userDiscount) / 100;
    }

    const priceAfterLoyalty = priceAfterCoupon - loyaltyDiscount;

    // 4. Desconto de km (milhas fluviais) — cada bloco de 500 km = R$25
    if (redeemKm && redeemKm > 0) {
      if (redeemKm % KM_BLOCK !== 0) {
        throw new BadRequestException(
          `Km deve ser múltiplo de ${KM_BLOCK}. Ex: 500, 1000, 1500...`,
        );
      }
      if (user.redeemableKm < redeemKm) {
        throw new BadRequestException(
          `Km insuficiente. Você tem ${user.redeemableKm} km disponíveis.`,
        );
      }
      kmDiscount = this.gamificationService.calcKmDiscount(redeemKm);
      kmDiscount = Math.min(kmDiscount, priceAfterLoyalty); // não pode exceder o preço
    }

    const finalPrice = priceAfterLoyalty - kmDiscount;
    const totalDiscount =
      childrenDiscount +
      tripDiscount +
      couponDiscount +
      loyaltyDiscount +
      kmDiscount;

    return {
      basePrice,
      childrenDiscount,
      freeChildrenCount,
      children: childrenList,
      tripDiscount,
      tripDiscountPercent: trip.discount,
      couponDiscount,
      couponCode: couponData?.code,
      loyaltyDiscount,
      loyaltyDiscountPercent: userDiscount,
      loyaltyLevel: user.level,
      kmDiscount,
      kmRedeemed: redeemKm || 0,
      redeemableKm: user.redeemableKm,
      totalDiscount,
      finalPrice: Math.max(0, finalPrice),
      discountsApplied: [
        freeChildrenCount > 0 && {
          type: 'children',
          label: `${freeChildrenCount} criança(s) grátis (≤ 9 anos)`,
          amount: childrenDiscount,
        },
        trip.discount > 0 && {
          type: 'trip',
          label: 'Promoção Especial',
          percent: trip.discount,
          amount: tripDiscount,
        },
        couponData && {
          type: 'coupon',
          code: couponData.code,
          label: couponData.description || 'Cupom',
          amount: couponDiscount,
        },
        userDiscount > 0 && {
          type: 'loyalty',
          level: user.level,
          percent: userDiscount,
          amount: loyaltyDiscount,
        },
        kmDiscount > 0 && {
          type: 'km',
          label: `${redeemKm} Milhas Fluviais`,
          amount: kmDiscount,
        },
      ].filter(Boolean),
    };
  }

  async create(passengerId: string, dto: CreateBookingDto): Promise<Booking> {
    const trip = await this.tripsRepo.findOne({ where: { id: dto.tripId } });
    if (!trip) throw new NotFoundException('Viagem não encontrada');

    const quantity = dto.quantity;
    if (trip.availableSeats < quantity) {
      throw new BadRequestException(
        `Apenas ${trip.availableSeats} assentos disponíveis`,
      );
    }

    // Verificar se já existe booking ativo deste passageiro nesta viagem
    const existingBooking = await this.bookingsRepo.findOne({
      where: {
        passengerId,
        tripId: dto.tripId,
        status: In([
          BookingStatus.PENDING,
          BookingStatus.CONFIRMED,
          BookingStatus.CHECKED_IN,
        ]),
      },
    });
    if (existingBooking) {
      throw new ConflictException(
        'Você já possui uma reserva ativa para esta viagem. Para alterar o número de assentos, cancele a reserva existente e crie uma nova.',
      );
    }

    // Validar CPFs dos passageiros adicionais
    if (dto.passengers?.length) {
      // CPFs duplicados entre os extras
      const extraCpfs = dto.passengers.map((p) => p.cpf);
      if (new Set(extraCpfs).size !== extraCpfs.length) {
        throw new BadRequestException(
          'Há CPFs duplicados entre os passageiros adicionais.',
        );
      }

      // CPF de extra igual ao do passageiro principal
      const mainUser = await this.usersRepo.findOne({
        where: { id: passengerId },
        select: ['cpf'],
      });
      if (mainUser?.cpf && extraCpfs.includes(mainUser.cpf)) {
        throw new BadRequestException(
          'O CPF do passageiro principal não pode constar nos passageiros adicionais.',
        );
      }
    }

    // Calcular preço com descontos (inclui km e crianças grátis se informados)
    const priceBreakdown = await this.calculatePrice(
      passengerId,
      dto.tripId,
      quantity,
      dto.couponCode,
      dto.redeemKm,
      dto.children,
    );
    const totalPrice = priceBreakdown.finalPrice;

    // Determinar status inicial baseado no método de pagamento
    let initialStatus = BookingStatus.PENDING;
    let initialPaymentStatus = PaymentStatus.PENDING;

    // Pagamento em dinheiro: confirma direto (paga a bordo)
    if (dto.paymentMethod === PaymentMethod.CASH) {
      initialStatus = BookingStatus.CONFIRMED;
      initialPaymentStatus = PaymentStatus.PENDING; // Paga a bordo
    }

    // Pagamento com cartão: confirma direto (simulado - gateway futuro)
    if (
      dto.paymentMethod === PaymentMethod.CREDIT_CARD ||
      dto.paymentMethod === PaymentMethod.DEBIT_CARD
    ) {
      initialStatus = BookingStatus.CONFIRMED;
      initialPaymentStatus = PaymentStatus.PAID; // Simulado
    }

    const booking = this.bookingsRepo.create({
      passengerId,
      tripId: dto.tripId,
      seatNumber: dto.seatNumber,
      seats: quantity,
      totalPrice,
      qrCodeCheckin: null, // Será gerado após confirmação
      paymentMethod: dto.paymentMethod,
      status: initialStatus,
      paymentStatus: initialPaymentStatus,
      kmRedeemed: priceBreakdown.kmRedeemed,
      kmDiscount: priceBreakdown.kmDiscount,
      childrenCount: priceBreakdown.freeChildrenCount,
      children: priceBreakdown.children?.length
        ? priceBreakdown.children
        : null,
      extraPassengers: dto.passengers?.length ? dto.passengers : null,
    });

    // Salva o booking primeiro para gerar o ID
    let saved = await this.bookingsRepo.save(booking);

    // Se método for PIX: gerar dados PIX
    if (dto.paymentMethod === PaymentMethod.PIX) {
      const pixData = await this.pixService.generatePixPayment(
        saved.id,
        totalPrice,
        `Reserva ${trip.origin} → ${trip.destination} - ${quantity} assento(s)`,
      );

      saved.pixQrCode = pixData.pixQrCode;
      saved.pixQrCodeImage = pixData.pixQrCodeImage;
      saved.pixTxid = pixData.pixTxid;
      saved.pixExpiresAt = pixData.pixExpiresAt;
      saved.pixKey = pixData.pixKey;

      saved = await this.bookingsRepo.save(saved);
    }

    // Se já está confirmado (CASH ou CARD): gerar QR code de check-in e reduzir assentos
    if (saved.status === BookingStatus.CONFIRMED) {
      const qrCodeData = `NVGJ-${saved.id}`;
      saved.qrCodeCheckin = qrCodeData;
      saved = await this.bookingsRepo.save(saved);

      // Reduzir assentos disponíveis
      trip.availableSeats -= quantity;
      await this.tripsRepo.save(trip);
    }

    // Debitar km se foram resgatados
    if (priceBreakdown.kmRedeemed > 0) {
      await this.gamificationService.deductKm(
        passengerId,
        priceBreakdown.kmRedeemed,
        saved.id,
      );
    }

    // Incrementar uso do cupom se foi aplicado
    if (dto.couponCode && priceBreakdown.couponDiscount > 0) {
      const coupon = await this.couponsService.findByCode(dto.couponCode);
      await this.couponsService.incrementUsage(coupon.id);
    }

    // Notificar passageiro (se já confirmado) e capitão (nova reserva)
    const route = `${trip.origin} → ${trip.destination}`;
    if (saved.status === BookingStatus.CONFIRMED) {
      await this.notificationsService.sendToUser(passengerId, {
        title: '✅ Reserva confirmada!',
        body: `Sua viagem ${route} está confirmada. Boa viagem!`,
        data: {
          type: 'booking_confirmed',
          bookingId: saved.id,
          tripId: trip.id,
        },
      });
    }
    await this.notificationsService.sendToUser(trip.captainId, {
      title: '🎫 Nova reserva!',
      body: `${quantity} assento(s) reservado(s) na viagem ${route}.`,
      data: { type: 'new_booking', bookingId: saved.id, tripId: trip.id },
    });

    // Adicionar aviso de cheia (informativo — não bloqueia a reserva)
    let floodWarning = false;
    let floodSeverity = 'NO_FLOODING';
    try {
      const flood = await this.floodService.getFloodStatus(
        -3.119,
        -60.0217,
        100,
      );
      floodSeverity = flood.severity;
      floodWarning =
        flood.severity === 'SEVERE' || flood.severity === 'EXTREME';
    } catch {
      // Erro na API de cheias não bloqueia a reserva
    }
    return Object.assign(saved, {
      priceBreakdown,
      floodWarning,
      floodSeverity,
    });
  }

  async findByPassenger(
    passengerId: string,
    status?: string,
  ): Promise<Booking[]> {
    const where: FindOptionsWhere<Booking> = { passengerId };

    if (status === 'active') {
      where.status = In([BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN]);
    } else if (status === 'completed') {
      where.status = BookingStatus.COMPLETED;
    } else if (status === 'cancelled') {
      where.status = BookingStatus.CANCELLED;
    }

    return this.bookingsRepo.find({
      where,
      relations: ['trip', 'trip.route', 'trip.captain', 'trip.boat'],
      order: { createdAt: 'DESC' },
    });
  }

  async findById(id: string): Promise<Booking> {
    return this.findBookingByIdOrThrow(id, [
      'trip',
      'trip.route',
      'trip.captain',
      'trip.boat',
      'passenger',
    ]);
  }

  async findByTrip(tripId: string): Promise<Booking[]> {
    return this.bookingsRepo.find({
      where: { tripId },
      relations: ['passenger'],
      order: { createdAt: 'ASC' },
    });
  }

  async getTracking(bookingId: string, userId: string) {
    const booking = await this.bookingsRepo.findOne({
      where: { id: bookingId },
      relations: ['trip', 'trip.route', 'trip.captain', 'trip.boat'],
    });
    if (!booking) throw new NotFoundException('Reserva não encontrada');
    if (booking.passengerId !== userId) {
      throw new ForbiddenException('Acesso negado');
    }

    const trip = booking.trip;

    // Se não tem route, criar objeto com dados da trip
    const route = trip.route || {
      originName: trip.origin,
      destinationName: trip.destination,
      originLat: -3.119, // Default Manaus
      originLng: -60.0217,
      destinationLat: -2.6286, // Default Parintins (caso comum)
      destinationLng: -56.7356,
      distanceKm: 369,
      durationMin: 360,
    };

    // Calcula progresso baseado no status da trip
    let progress = 0;
    const timeline: { status: string; label: string; active: boolean }[] = [];

    switch (trip.status) {
      case TripStatus.SCHEDULED:
        progress = 0;
        timeline.push(
          { status: 'scheduled', label: 'Viagem agendada', active: true },
          { status: 'in_progress', label: 'Em andamento', active: false },
          { status: 'completed', label: 'Chegou ao destino', active: false },
        );
        break;
      case TripStatus.IN_PROGRESS:
        progress = 50;
        if (trip.estimatedArrivalAt && trip.departureAt) {
          const totalDuration =
            new Date(trip.estimatedArrivalAt).getTime() -
            new Date(trip.departureAt).getTime();
          const elapsed = Date.now() - new Date(trip.departureAt).getTime();
          if (totalDuration > 0) {
            progress = Math.min(
              95,
              Math.round((elapsed / totalDuration) * 100),
            );
            if (progress < 20) progress = 20;
          }
        }
        timeline.push(
          { status: 'scheduled', label: 'Viagem agendada', active: true },
          { status: 'in_progress', label: 'Navegando', active: true },
          { status: 'completed', label: 'Chegou ao destino', active: false },
        );
        break;
      case TripStatus.COMPLETED:
        progress = 100;
        timeline.push(
          { status: 'scheduled', label: 'Viagem agendada', active: true },
          { status: 'in_progress', label: 'Navegou', active: true },
          { status: 'completed', label: 'Chegou ao destino', active: true },
        );
        break;
      case TripStatus.CANCELLED:
        progress = 0;
        timeline.push({
          status: 'cancelled',
          label: 'Viagem cancelada',
          active: true,
        });
        break;
    }

    return {
      bookingId: booking.id,
      bookingStatus: booking.status,
      qrCode: booking.qrCodeCheckin,
      trip: {
        id: trip.id,
        status: trip.status,
        departureAt: trip.departureAt,
        estimatedArrivalAt: trip.estimatedArrivalAt,
        currentLat: trip.currentLat,
        currentLng: trip.currentLng,
      },
      route: {
        originName: route.originName,
        originLat: route.originLat,
        originLng: route.originLng,
        destinationName: route.destinationName,
        destinationLat: route.destinationLat,
        destinationLng: route.destinationLng,
        distanceKm: route.distanceKm,
        durationMin: route.durationMin,
      },
      captain: {
        id: trip.captain.id,
        name: trip.captain.name,
        phone: trip.captain.phone,
        rating: trip.captain.rating,
        avatarUrl: trip.captain.avatarUrl,
      },
      boat: trip.boat
        ? {
            id: trip.boat.id,
            name: trip.boat.name,
            type: trip.boat.type,
            photoUrl: trip.boat.photoUrl,
          }
        : null,
      progress,
      timeline,
    };
  }

  async checkin(bookingId: string): Promise<Booking> {
    const booking = await this.findById(bookingId);
    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new BadRequestException('Reserva não está confirmada');
    }
    booking.status = BookingStatus.CHECKED_IN;
    booking.checkedInAt = new Date();
    return this.bookingsRepo.save(booking);
  }

  async cancel(bookingId: string, userId: string): Promise<Booking> {
    const booking = await this.findById(bookingId);
    const hadPaidBooking = booking.paymentStatus === PaymentStatus.PAID;
    if (booking.passengerId !== userId) {
      throw new BadRequestException('Apenas o passageiro pode cancelar');
    }
    if (booking.status === BookingStatus.CANCELLED) {
      throw new BadRequestException('Reserva já cancelada');
    }
    if (booking.status === BookingStatus.CHECKED_IN) {
      throw new BadRequestException(
        'Cancelamento não permitido: o passageiro já realizou check-in/embarque.',
      );
    }
    if (booking.status === BookingStatus.COMPLETED) {
      throw new BadRequestException(
        'Cancelamento não permitido: a viagem já foi concluída.',
      );
    }

    // Só devolve assentos se estava CONFIRMED (pagamento confirmado)
    if (booking.status === BookingStatus.CONFIRMED) {
      await this.adjustTripAvailableSeats(booking.tripId, booking.seats);
    }

    booking.status = BookingStatus.CANCELLED;

    // Sem gateway integrado, o cancelamento apenas sinaliza o reembolso manual.
    if (hadPaidBooking) {
      booking.paymentStatus = PaymentStatus.REFUND_PENDING;
    }

    const saved = await this.bookingsRepo.save(booking);

    // Devolver km se foram resgatados nesta booking
    if (booking.kmRedeemed > 0) {
      await this.gamificationService.refundKm(
        booking.passengerId,
        booking.kmRedeemed,
        booking.id,
      );
    }

    // Notificar passageiro
    await this.notificationsService.sendToUser(userId, {
      title: '❌ Reserva cancelada',
      body: hadPaidBooking
        ? 'Sua reserva foi cancelada. O valor pago ficará pendente para reembolso manual.'
        : 'Sua reserva foi cancelada com sucesso.',
      data: {
        type: 'booking_cancelled',
        bookingId: booking.id,
        paymentStatus: booking.paymentStatus,
      },
    });

    return saved;
  }

  async complete(bookingId: string): Promise<Booking> {
    const booking = await this.findById(bookingId); // já carrega trip.route
    if (booking.status !== BookingStatus.CHECKED_IN) {
      throw new BadRequestException(
        'Reserva precisa estar em check-in para ser concluída',
      );
    }
    return this.markBookingCompleted(booking, true);
  }

  /**
   * Confirma pagamento PIX manualmente (admin/capitão)
   * Similar ao padrão do Shipments (shipments.service.ts:388-406)
   */
  async confirmPayment(
    bookingId: string,
    confirmedBy?: string,
    confirmedByRole?: string,
  ): Promise<Booking> {
    // Capitão não verificado não pode confirmar pagamentos
    await this.assertCaptainCanConfirmPayments(confirmedBy, confirmedByRole);

    const booking = await this.findById(bookingId);

    // Validações
    if (booking.paymentStatus === PaymentStatus.PAID) {
      throw new BadRequestException('Pagamento já confirmado');
    }

    if (booking.status === BookingStatus.CANCELLED) {
      throw new BadRequestException('Reserva cancelada');
    }

    // Verificar se PIX expirou
    if (
      booking.pixExpiresAt &&
      this.pixService.isExpired(booking.pixExpiresAt)
    ) {
      throw new BadRequestException('PIX expirado. Gere uma nova reserva.');
    }

    // Atualizar status
    booking.paymentStatus = PaymentStatus.PAID;
    booking.status = BookingStatus.CONFIRMED;
    booking.pixPaidAt = new Date();

    const saved = await this.bookingsRepo.save(booking);

    // Gerar QR Code de check-in
    const qrCodeData = `NVGJ-${saved.id}`;
    saved.qrCodeCheckin = qrCodeData;
    await this.bookingsRepo.save(saved);

    // Reduzir assentos disponíveis AGORA
    const trip = await this.adjustTripAvailableSeats(
      booking.tripId,
      -booking.seats,
    );

    // Notificar passageiro: pagamento confirmado
    await this.notificationsService.sendToUser(booking.passengerId, {
      title: '💰 Pagamento confirmado!',
      body: `Reserva confirmada${trip ? ` — ${trip.origin} → ${trip.destination}` : ''}.`,
      data: { type: 'payment_confirmed', bookingId: booking.id },
    });

    return saved;
  }

  /**
   * Retorna status de pagamento para polling do frontend
   */
  async getPaymentStatus(bookingId: string) {
    const booking = await this.findById(bookingId);

    return {
      bookingId: booking.id,
      paymentStatus: booking.paymentStatus,
      status: booking.status,
      paymentMethod: booking.paymentMethod,
      totalPrice: booking.totalPrice,
      pixPaidAt: booking.pixPaidAt,
      pixExpiresAt: booking.pixExpiresAt,
      isExpired: booking.pixExpiresAt
        ? this.pixService.isExpired(booking.pixExpiresAt)
        : false,
    };
  }

  /**
   * Quando a viagem é concluída, completa automaticamente todas as reservas
   * CONFIRMED e CHECKED_IN — o capitão pode não ter conseguido escanear todos
   * (conectividade instável no Amazonas).
   */
  /** Cancela todas as reservas activas de uma viagem. Retorna os IDs dos passageiros afectados. */
  async autoCancelByTrip(tripId: string): Promise<string[]> {
    const bookings = await this.bookingsRepo.find({
      where: {
        tripId,
        status: In([
          BookingStatus.PENDING,
          BookingStatus.CONFIRMED,
          BookingStatus.CHECKED_IN,
        ]),
      },
    });

    const passengerIds: string[] = [];
    for (const booking of bookings) {
      booking.status = BookingStatus.CANCELLED;
      await this.bookingsRepo.save(booking);
      passengerIds.push(booking.passengerId);
    }
    return passengerIds;
  }

  async autoCompleteByTrip(tripId: string): Promise<void> {
    const bookings = await this.bookingsRepo.find({
      where: {
        tripId,
        status: In([BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN]),
      },
      relations: ['trip', 'trip.route', 'trip.boat'],
    });

    for (const booking of bookings) {
      await this.markBookingCompleted(booking, false);
    }
  }

  /**
   * Gera bilhete de embarque em PDF
   */
  async generateTicketPdf(
    bookingId: string,
    userId: string,
    userRole: string,
  ): Promise<PdfStream> {
    const booking = await this.findBookingByIdOrThrow(bookingId, [
      'trip',
      'trip.boat',
      'trip.captain',
      'passenger',
    ]);

    // Apenas passenger, captain da viagem ou admin
    if (
      userRole !== 'admin' &&
      booking.passengerId !== userId &&
      booking.trip?.captainId !== userId
    ) {
      throw new ForbiddenException('Acesso negado ao bilhete');
    }

    const trip = booking.trip;
    const passenger = booking.passenger;
    const captain = trip?.captain;
    const boat = trip?.boat;

    return this.pdfService.createTicket({
      bookingId: booking.id,
      passengerName: passenger?.name || 'Passageiro',
      origin: trip?.origin || 'N/A',
      destination: trip?.destination || 'N/A',
      departureAt: trip?.departureAt || new Date(),
      estimatedArrivalAt: trip?.estimatedArrivalAt || null,
      captainName: captain?.name || 'Capitão',
      captainRating: Number(captain?.rating) || 5.0,
      boatName: boat?.name || 'Embarcação',
      boatType: boat?.type || '',
      seats: booking.seats,
      totalPrice: Number(booking.totalPrice),
      paymentStatus: booking.paymentStatus,
      qrCodeCheckin: booking.qrCodeCheckin,
      createdAt: booking.createdAt,
      children: booking.children,
      extraPassengers: booking.extraPassengers,
    });
  }

  /**
   * Cancela bookings com PIX expirado (roda a cada 5 minutos)
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async cancelExpiredPixPayments() {
    const expiredBookings = await this.bookingsRepo.find({
      where: {
        paymentStatus: PaymentStatus.PENDING,
        paymentMethod: PaymentMethod.PIX,
        pixExpiresAt: LessThan(new Date()),
      },
    });

    for (const booking of expiredBookings) {
      booking.status = BookingStatus.CANCELLED;
      await this.bookingsRepo.save(booking);

      this.logger.log(`Booking ${booking.id} cancelado por PIX expirado`);
    }

    return { cancelled: expiredBookings.length };
  }
}
