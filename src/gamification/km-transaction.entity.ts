import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

export const KM_BLOCK = 500; // km por bloco
export const DISCOUNT_PER_BLOCK = 25; // R$ de desconto por bloco de 500 km

export enum KmTransactionType {
  EARNED = 'earned', // km creditado ao completar viagem
  REDEEMED = 'redeemed', // km usado como desconto em booking
  REFUNDED = 'refunded', // km devolvido ao cancelar booking
}

@Entity('km_transactions')
export class KmTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'int' })
  km: number; // positivo = crédito, negativo = débito

  @Column({ type: 'enum', enum: KmTransactionType })
  type: KmTransactionType;

  @Column({ type: 'text' })
  description: string;

  @Column({ name: 'reference_id', type: 'uuid', nullable: true })
  referenceId: string | null; // bookingId

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
