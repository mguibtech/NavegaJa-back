import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Trip } from '../trips/trip.entity';

export enum BookingStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  CHECKED_IN = 'checked_in',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum PaymentMethod {
  PIX = 'pix',
  CASH = 'cash',
  CREDIT_CARD = 'credit_card',
  DEBIT_CARD = 'debit_card',
}

export enum PaymentStatus {
  PENDING = 'pending',
  PAID = 'paid',
  REFUNDED = 'refunded',
}

@Entity('bookings')
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'passenger_id' })
  passengerId: string;

  @ManyToOne(() => User, (user) => user.bookings)
  @JoinColumn({ name: 'passenger_id' })
  passenger: User;

  @Column({ name: 'trip_id' })
  tripId: string;

  @ManyToOne(() => Trip, (trip) => trip.bookings)
  @JoinColumn({ name: 'trip_id' })
  trip: Trip;

  @Column({ name: 'seat_number', type: 'int', nullable: true })
  seatNumber: number;

  @Column({ default: 1 })
  seats: number;

  @Column({ name: 'total_price', type: 'decimal', precision: 10, scale: 2 })
  totalPrice: number;

  @Column({ type: 'enum', enum: BookingStatus, default: BookingStatus.PENDING })
  status: BookingStatus;

  // QR Code de check-in (separado do QR Code de pagamento PIX)
  @Column({ name: 'qr_code_checkin', type: 'text', nullable: true })
  qrCodeCheckin: string | null;

  // Dados do PIX
  @Column({ name: 'pix_qr_code', type: 'text', nullable: true })
  pixQrCode: string | null;

  @Column({ name: 'pix_qr_code_image', type: 'text', nullable: true })
  pixQrCodeImage: string | null;

  @Column({ name: 'pix_expires_at', type: 'timestamp', nullable: true })
  pixExpiresAt: Date | null;

  @Column({ name: 'pix_txid', type: 'varchar', length: 50, nullable: true })
  pixTxid: string | null;

  @Column({ name: 'pix_key', type: 'varchar', length: 100, nullable: true })
  pixKey: string | null;

  @Column({ name: 'pix_paid_at', type: 'timestamp', nullable: true })
  pixPaidAt: Date | null;

  @Column({ name: 'payment_method', type: 'enum', enum: PaymentMethod, default: PaymentMethod.PIX })
  paymentMethod: PaymentMethod;

  @Column({ name: 'payment_status', type: 'enum', enum: PaymentStatus, default: PaymentStatus.PENDING })
  paymentStatus: PaymentStatus;

  @Column({ name: 'checked_in_at', type: 'timestamp', nullable: true })
  checkedInAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
