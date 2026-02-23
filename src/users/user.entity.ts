import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, OneToMany,
} from 'typeorm';
import { Boat } from '../boats/boat.entity';
import { Booking } from '../bookings/booking.entity';
import { Shipment } from '../shipments/shipment.entity';
import { Review } from '../reviews/review.entity';
import { PointTransaction } from '../gamification/point-transaction.entity';

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

  @Column({ length: 255, nullable: true })
  email: string;

  @Column({ name: 'reset_code', type: 'varchar', length: 6, nullable: true })
  resetCode: string | null;

  @Column({ name: 'reset_code_expires', type: 'timestamp', nullable: true })
  resetCodeExpires: Date | null;

  @Column({ type: 'varchar', length: 14, nullable: true, unique: true })
  cpf: string;

  @Column({ name: 'avatar_url', type: 'text', nullable: true })
  avatarUrl: string;

  @Column({ type: 'decimal', precision: 2, scale: 1, default: 5.0 })
  rating: number;

  @Column({ name: 'total_trips', default: 0 })
  totalTrips: number;

  @Column({ name: 'total_points', default: 0 })
  totalPoints: number;

  @Column({ name: 'level', type: 'varchar', length: 50, default: 'Marinheiro' })
  level: string;

  @Column({ name: 'referral_code', type: 'varchar', length: 20, unique: true, nullable: true })
  referralCode: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'passenger_rating', type: 'decimal', precision: 2, scale: 1, default: 5.0 })
  passengerRating: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  city: string | null;

  @Column({ type: 'varchar', length: 2, default: 'AM' })
  state: string;

  // ── Verificação de capitão ─────────────────────────────────────────────────

  @Column({ name: 'is_verified', type: 'boolean', default: false })
  isVerified: boolean; // documentos do capitão verificados pelo admin

  @Column({ name: 'license_photo_url', type: 'text', nullable: true })
  licensePhotoUrl: string | null; // habilitação de arrais / CNH náutica

  @Column({ name: 'certificate_photo_url', type: 'text', nullable: true })
  certificatePhotoUrl: string | null; // certificado de segurança / habilitação

  @Column({ name: 'verified_at', type: 'timestamp', nullable: true })
  verifiedAt: Date | null;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason: string | null; // motivo de rejeição de documentos pelo admin

  @Column({ name: 'fcm_token', type: 'text', nullable: true })
  fcmToken: string | null;

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

  @OneToMany(() => PointTransaction, (pt) => pt.user)
  pointTransactions: PointTransaction[];
}
