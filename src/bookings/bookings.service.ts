import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Booking, BookingStatus, PaymentStatus } from './booking.entity';
import { Trip, TripStatus } from '../trips/trip.entity';
import { CreateBookingDto } from './dto/create-booking.dto';
import { GamificationService } from '../gamification/gamification.service';
import { PointAction } from '../gamification/point-transaction.entity';
import { CouponsService } from '../coupons/coupons.service';
import { User } from '../users/user.entity';

@Injectable()
export class BookingsService {
  constructor(
    @InjectRepository(Booking)
    private bookingsRepo: Repository<Booking>,
    @InjectRepository(Trip)
    private tripsRepo: Repository<Trip>,
    @InjectRepository(User)
    private usersRepo: Repository<User>,
    private gamificationService: GamificationService,
    private couponsService: CouponsService,
  ) {}

  async calculatePrice(passengerId: string, tripId: string, quantity: number, couponCode?: string) {
    const trip = await this.tripsRepo.findOne({ where: { id: tripId } });
    if (!trip) throw new NotFoundException('Viagem não encontrada');

    const user = await this.usersRepo.findOne({ where: { id: passengerId } });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    const basePrice = Number(trip.price) * quantity;
    let priceAfterTripDiscount = basePrice;
    let tripDiscount = 0;
    let couponDiscount = 0;
    let loyaltyDiscount = 0;

    // 1. Desconto da viagem (capitão)
    if (trip.discount > 0) {
      tripDiscount = (basePrice * trip.discount) / 100;
      priceAfterTripDiscount = basePrice - tripDiscount;
    }

    // 2. Cupom promocional
    let couponData = null;
    if (couponCode) {
      const validation = await this.couponsService.validate(couponCode, passengerId, priceAfterTripDiscount);
      if (validation.valid && validation.discount) {
        couponDiscount = validation.discount;
        couponData = validation.coupon;
      }
    }

    const priceAfterCoupon = priceAfterTripDiscount - couponDiscount;

    // 3. Desconto de gamificação
    const userDiscount = await this.gamificationService.getUserDiscount(passengerId);
    if (userDiscount > 0) {
      loyaltyDiscount = (priceAfterCoupon * userDiscount) / 100;
    }

    const finalPrice = priceAfterCoupon - loyaltyDiscount;
    const totalDiscount = tripDiscount + couponDiscount + loyaltyDiscount;

    return {
      basePrice,
      tripDiscount,
      tripDiscountPercent: trip.discount,
      couponDiscount,
      couponCode: couponData?.code,
      loyaltyDiscount,
      loyaltyDiscountPercent: userDiscount,
      loyaltyLevel: user.level,
      totalDiscount,
      finalPrice: Math.max(0, finalPrice),
      discountsApplied: [
        trip.discount > 0 && { type: 'trip', label: 'Promoção Especial', percent: trip.discount, amount: tripDiscount },
        couponData && { type: 'coupon', code: couponData.code, label: couponData.description || 'Cupom', amount: couponDiscount },
        userDiscount > 0 && { type: 'loyalty', level: user.level, percent: userDiscount, amount: loyaltyDiscount },
      ].filter(Boolean),
    };
  }

  async create(passengerId: string, dto: CreateBookingDto): Promise<Booking> {
    const trip = await this.tripsRepo.findOne({ where: { id: dto.tripId } });
    if (!trip) throw new NotFoundException('Viagem não encontrada');

    const quantity = dto.quantity;
    if (trip.availableSeats < quantity) {
      throw new BadRequestException(`Apenas ${trip.availableSeats} assentos disponíveis`);
    }

    // Calcular preço com descontos
    const priceBreakdown = await this.calculatePrice(passengerId, dto.tripId, quantity, dto.couponCode);
    const totalPrice = priceBreakdown.finalPrice;

    const booking = this.bookingsRepo.create({
      passengerId,
      tripId: dto.tripId,
      seatNumber: dto.seatNumber,
      seats: quantity,
      totalPrice,
      qrCode: null, // Será gerado após ter o ID
      paymentMethod: dto.paymentMethod,
      status: BookingStatus.CONFIRMED,
      paymentStatus: PaymentStatus.PAID, // Simulado
    });

    // Salva o booking primeiro para gerar o ID
    let saved = await this.bookingsRepo.save(booking);

    // Gera QR code compacto (apenas o ID do booking para validação)
    // O app irá gerar a imagem QR a partir deste dado
    const qrCodeData = `NVGJ-${saved.id}`;
    saved.qrCode = qrCodeData;
    saved = await this.bookingsRepo.save(saved);

    // Atualiza assentos disponíveis
    trip.availableSeats -= quantity;
    await this.tripsRepo.save(trip);

    // Incrementar uso do cupom se foi aplicado
    if (dto.couponCode && priceBreakdown.couponDiscount > 0) {
      const coupon = await this.couponsService.findByCode(dto.couponCode);
      await this.couponsService.incrementUsage(coupon.id);
    }

    // Adicionar breakdown de preços na resposta
    (saved as any).priceBreakdown = priceBreakdown;

    return saved;
  }

  async findByPassenger(passengerId: string, status?: string): Promise<Booking[]> {
    const where: any = { passengerId };

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
    const booking = await this.bookingsRepo.findOne({
      where: { id },
      relations: ['trip', 'trip.route', 'trip.captain', 'trip.boat', 'passenger'],
    });
    if (!booking) throw new NotFoundException('Reserva não encontrada');
    return booking;
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
      originLat: -3.1190,  // Default Manaus
      originLng: -60.0217,
      destinationLat: -2.6286,  // Default Parintins (caso comum)
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
          const totalDuration = new Date(trip.estimatedArrivalAt).getTime() - new Date(trip.departureAt).getTime();
          const elapsed = Date.now() - new Date(trip.departureAt).getTime();
          if (totalDuration > 0) {
            progress = Math.min(95, Math.round((elapsed / totalDuration) * 100));
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
        timeline.push(
          { status: 'cancelled', label: 'Viagem cancelada', active: true },
        );
        break;
    }

    return {
      bookingId: booking.id,
      bookingStatus: booking.status,
      qrCode: booking.qrCode,
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
      boat: {
        id: trip.boat.id,
        name: trip.boat.name,
        type: trip.boat.type,
        photoUrl: trip.boat.photoUrl,
      },
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
    if (booking.passengerId !== userId) {
      throw new BadRequestException('Apenas o passageiro pode cancelar');
    }
    if (booking.status === BookingStatus.CANCELLED) {
      throw new BadRequestException('Reserva já cancelada');
    }

    // Devolve assentos
    const trip = await this.tripsRepo.findOne({ where: { id: booking.tripId } });
    if (trip) {
      trip.availableSeats += booking.seats;
      await this.tripsRepo.save(trip);
    }

    booking.status = BookingStatus.CANCELLED;
    booking.paymentStatus = PaymentStatus.REFUNDED;
    return this.bookingsRepo.save(booking);
  }

  async complete(bookingId: string): Promise<Booking> {
    const booking = await this.findById(bookingId);
    if (booking.status !== BookingStatus.CHECKED_IN) {
      throw new BadRequestException('Reserva precisa estar em check-in para ser concluída');
    }

    booking.status = BookingStatus.COMPLETED;
    const saved = await this.bookingsRepo.save(booking);

    // Credita NavegaCoins ao passageiro
    await this.gamificationService.awardPoints(
      booking.passengerId,
      PointAction.BOOKING_COMPLETED,
      booking.id,
    );

    // Verifica bônus primeira viagem do mês
    await this.gamificationService.checkFirstTripOfMonthBonus(
      booking.passengerId,
      booking.id,
    );

    return saved;
  }
}
