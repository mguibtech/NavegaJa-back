import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Booking, BookingStatus, PaymentStatus } from './booking.entity';
import { Trip } from '../trips/trip.entity';
import { CreateBookingDto } from './dto/create-booking.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class BookingsService {
  constructor(
    @InjectRepository(Booking)
    private bookingsRepo: Repository<Booking>,
    @InjectRepository(Trip)
    private tripsRepo: Repository<Trip>,
  ) {}

  async create(passengerId: string, dto: CreateBookingDto): Promise<Booking> {
    const trip = await this.tripsRepo.findOne({ where: { id: dto.tripId } });
    if (!trip) throw new NotFoundException('Viagem não encontrada');

    const seats = dto.seats || 1;
    if (trip.availableSeats < seats) {
      throw new BadRequestException(`Apenas ${trip.availableSeats} assentos disponíveis`);
    }

    const totalPrice = Number(trip.price) * seats;
    const qrCode = `NVJ-${uuidv4().substring(0, 8).toUpperCase()}`;

    const booking = this.bookingsRepo.create({
      passengerId,
      tripId: dto.tripId,
      seats,
      totalPrice,
      qrCode,
      paymentMethod: dto.paymentMethod || 'pix',
      status: BookingStatus.CONFIRMED,
      paymentStatus: PaymentStatus.PAID, // Simulado
    });

    // Atualiza assentos disponíveis
    trip.availableSeats -= seats;
    await this.tripsRepo.save(trip);

    return this.bookingsRepo.save(booking);
  }

  async findByPassenger(passengerId: string): Promise<Booking[]> {
    return this.bookingsRepo.find({
      where: { passengerId },
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
}
