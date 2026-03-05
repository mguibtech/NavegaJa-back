import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

export enum CommunityLocationStatus {
  PENDING   = 'pending',
  CONFIRMED = 'confirmed',
  REJECTED  = 'rejected',
}

export enum CommunityLocationSource {
  USER_SUGGESTION = 'user_suggestion',
  USER_HOME       = 'user_home',
  ADMIN           = 'admin',
}

@Entity('community_locations')
export class CommunityLocation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  /** Lowercase sem acento — usado para deduplicação */
  @Column({ name: 'normalized_name', type: 'varchar', length: 150 })
  normalizedName: string;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  lat: number;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  lng: number;

  @Column({ type: 'varchar', length: 150, nullable: true })
  municipio: string | null;

  @Column({ type: 'varchar', length: 2, default: 'AM' })
  state: string;

  @Column({
    type: 'enum',
    enum: CommunityLocationStatus,
    default: CommunityLocationStatus.PENDING,
  })
  status: CommunityLocationStatus;

  /** Quantos utilizadores distintos sugeriram este ponto (< 2 km) */
  @Column({ name: 'confirmed_count', type: 'int', default: 1 })
  confirmedCount: number;

  @Column({
    type: 'enum',
    enum: CommunityLocationSource,
    default: CommunityLocationSource.USER_SUGGESTION,
  })
  source: CommunityLocationSource;

  @Column({ name: 'suggested_by_id', type: 'uuid', nullable: true })
  suggestedById: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'suggested_by_id' })
  suggestedBy: User | null;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
