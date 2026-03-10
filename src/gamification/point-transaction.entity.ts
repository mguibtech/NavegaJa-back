import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

export enum PointAction {
  BOOKING_COMPLETED = 'booking_completed',
  SHIPMENT_DELIVERED = 'shipment_delivered',
  CARGO_DELIVERED = 'cargo_delivered',
  REVIEW_CREATED = 'review_created',
  FIRST_TRIP_MONTH = 'first_trip_month',
  REFERRAL = 'referral',
  BOAT_OWNER_TRIP_COMPLETED = 'boat_owner_trip_completed',
  BOAT_OWNER_PASSENGER_COMPLETED = 'boat_owner_passenger_completed',
  BOAT_OWNER_SHIPMENT_DELIVERED = 'boat_owner_shipment_delivered',
}

export enum LoyaltyLevel {
  MARINHEIRO = 'Marinheiro',
  NAVEGADOR = 'Navegador',
  CAPITAO = 'Capitão',
  ALMIRANTE = 'Almirante',
}

export const LEVEL_THRESHOLDS: {
  level: LoyaltyLevel;
  minPoints: number;
  discount: number;
}[] = [
  { level: LoyaltyLevel.ALMIRANTE, minPoints: 1500, discount: 15 },
  { level: LoyaltyLevel.CAPITAO, minPoints: 500, discount: 10 },
  { level: LoyaltyLevel.NAVEGADOR, minPoints: 100, discount: 5 },
  { level: LoyaltyLevel.MARINHEIRO, minPoints: 0, discount: 0 },
];

export const POINTS_MAP: Record<PointAction, number> = {
  [PointAction.BOOKING_COMPLETED]: 10,
  [PointAction.SHIPMENT_DELIVERED]: 15,
  [PointAction.CARGO_DELIVERED]: 15,
  [PointAction.REVIEW_CREATED]: 5,
  [PointAction.FIRST_TRIP_MONTH]: 20,
  [PointAction.REFERRAL]: 50,
  [PointAction.BOAT_OWNER_TRIP_COMPLETED]: 20,
  [PointAction.BOAT_OWNER_PASSENGER_COMPLETED]: 2,
  [PointAction.BOAT_OWNER_SHIPMENT_DELIVERED]: 5,
};

@Entity('point_transactions')
export class PointTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'enum', enum: PointAction })
  action: PointAction;

  @Column()
  points: number;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'reference_id', type: 'uuid', nullable: true })
  referenceId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
