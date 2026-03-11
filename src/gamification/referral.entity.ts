import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { User } from '../users/user.entity';

export enum ReferralStatus {
  PENDING = 'pending', // Indicado se cadastrou mas não fez 1ª viagem
  CONVERTED = 'converted', // Indicado completou 1ª viagem → pontos dados
}

@Entity('referrals')
export class Referral {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'referrer_id', type: 'uuid' })
  referrerId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'referrer_id' })
  referrer: User;

  @Column({ name: 'referred_id', type: 'uuid', unique: true })
  @Index()
  referredId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'referred_id' })
  referred: User;

  @Column({
    type: 'enum',
    enum: ReferralStatus,
    default: ReferralStatus.PENDING,
  })
  status: ReferralStatus;

  @Column({ name: 'points_awarded', type: 'boolean', default: false })
  pointsAwarded: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'converted_at', type: 'timestamp', nullable: true })
  convertedAt: Date | null;
}
