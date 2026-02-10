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

  @Column({ default: 1 })
  seats: number;

  @Column({ name: 'total_price', type: 'decimal', precision: 10, scale: 2 })
  totalPrice: number;

  @Column({ type: 'enum', enum: BookingStatus, default: BookingStatus.PENDING })
  status: BookingStatus;

  @Column({ name: 'qr_code', length: 255, unique: true })
  qrCode: string;

  @Column({ name: 'payment_method', length: 50, default: 'pix' })
  paymentMethod: string;

  @Column({ name: 'payment_status', type: 'enum', enum: PaymentStatus, default: PaymentStatus.PENDING })
  paymentStatus: PaymentStatus;

  @Column({ name: 'checked_in_at', type: 'timestamp', nullable: true })
  checkedInAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
