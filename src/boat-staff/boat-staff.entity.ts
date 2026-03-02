import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn, Unique,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Boat } from '../boats/boat.entity';

@Entity('boat_staff')
@Unique(['userId', 'boatId'])
export class BoatStaff {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'boat_id' })
  boatId: string;

  @ManyToOne(() => Boat)
  @JoinColumn({ name: 'boat_id' })
  boat: Boat;

  @Column({ name: 'can_create_trips', type: 'boolean', default: true })
  canCreateTrips: boolean;

  @Column({ name: 'can_confirm_payments', type: 'boolean', default: true })
  canConfirmPayments: boolean;

  @Column({ name: 'can_manage_shipments', type: 'boolean', default: true })
  canManageShipments: boolean;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
