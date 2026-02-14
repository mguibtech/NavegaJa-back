import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { Shipment } from './shipment.entity';
import { User } from '../users/user.entity';

@Entity('shipment_reviews')
export class ShipmentReview {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'shipment_id', unique: true })
  shipmentId: string;

  @ManyToOne(() => Shipment)
  @JoinColumn({ name: 'shipment_id' })
  shipment: Shipment;

  @Column({ name: 'sender_id' })
  senderId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'sender_id' })
  sender: User;

  // Rating geral (1-5 estrelas)
  @Column({ type: 'int' })
  rating: number;

  // Rating da qualidade da entrega (1-5)
  @Column({ name: 'delivery_quality', type: 'int' })
  deliveryQuality: number;

  // Rating da pontualidade (1-5)
  @Column({ type: 'int' })
  timeliness: number;

  @Column({ type: 'text', nullable: true })
  comment: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
