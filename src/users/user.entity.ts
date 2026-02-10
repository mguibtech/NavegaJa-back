import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, OneToMany,
} from 'typeorm';
import { Boat } from '../boats/boat.entity';
import { Booking } from '../bookings/booking.entity';
import { Shipment } from '../shipments/shipment.entity';
import { Review } from '../reviews/review.entity';

export enum UserRole {
  PASSENGER = 'passenger',
  CAPTAIN = 'captain',
  ADMIN = 'admin',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  name: string;

  @Column({ length: 20, unique: true })
  phone: string;

  @Column({ name: 'password_hash', length: 255 })
  passwordHash: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.PASSENGER })
  role: UserRole;

  @Column({ name: 'avatar_url', type: 'text', nullable: true })
  avatarUrl: string;

  @Column({ type: 'decimal', precision: 2, scale: 1, default: 5.0 })
  rating: number;

  @Column({ name: 'total_trips', default: 0 })
  totalTrips: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => Boat, (boat) => boat.owner)
  boats: Boat[];

  @OneToMany(() => Booking, (booking) => booking.passenger)
  bookings: Booking[];

  @OneToMany(() => Shipment, (shipment) => shipment.sender)
  shipments: Shipment[];

  @OneToMany(() => Review, (review) => review.reviewer)
  reviews: Review[];
}
