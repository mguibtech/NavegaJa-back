import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn,
} from 'typeorm';
import { Shipment } from './shipment.entity';
import { User } from '../users/user.entity';

@Entity('shipment_timeline')
export class ShipmentTimeline {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'shipment_id' })
  shipmentId: string;

  @ManyToOne(() => Shipment)
  @JoinColumn({ name: 'shipment_id' })
  shipment: Shipment;

  @Column({ length: 20 })
  status: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ length: 255, nullable: true })
  location: string;

  @Column({ name: 'created_by', nullable: true })
  createdBy: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  creator: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
