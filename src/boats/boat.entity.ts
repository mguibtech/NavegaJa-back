import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Trip } from '../trips/trip.entity';

@Entity('boats')
export class Boat {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'owner_id' })
  ownerId: string;

  @ManyToOne(() => User, (user) => user.boats)
  @JoinColumn({ name: 'owner_id' })
  owner: User;

  @Column({ length: 255 })
  name: string;

  @Column({ length: 100 })
  type: string; // lancha, voadeira, balsa, recreio

  @Column()
  capacity: number;

  @Column({ length: 100, nullable: true })
  model: string;

  @Column({ nullable: true })
  year: number;

  @Column({ name: 'photo_url', type: 'text', nullable: true })
  photoUrl: string;

  @Column({ type: 'jsonb', default: [] })
  amenities: string[];

  @Column({ type: 'jsonb', default: [] })
  photos: string[];

  @Column({ name: 'registration_num', length: 100, nullable: true })
  registrationNum: string;

  @Column({ name: 'is_verified', default: false })
  isVerified: boolean;

  // ── Documentação do barco ──────────────────────────────────────────────────

  @Column({ name: 'document_photos', type: 'jsonb', default: [] })
  documentPhotos: string[]; // licença de navegação, certificado de vistoria, etc.

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason: string | null; // razão de rejeição pelo admin

  @Column({ name: 'verified_at', type: 'timestamp', nullable: true })
  verifiedAt: Date | null;

  @Column({ type: 'decimal', precision: 2, scale: 1, default: 5.0 })
  rating: number;

  @Column({ name: 'review_count', default: 0 })
  reviewCount: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => Trip, (trip) => trip.boat)
  trips: Trip[];
}
