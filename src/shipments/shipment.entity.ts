import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Trip } from '../trips/trip.entity';

export enum ShipmentStatus {
  PENDING = 'pending',
  IN_TRANSIT = 'in_transit',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
}

@Entity('shipments')
export class Shipment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'sender_id' })
  senderId: string;

  @ManyToOne(() => User, (user) => user.shipments)
  @JoinColumn({ name: 'sender_id' })
  sender: User;

  @Column({ name: 'trip_id' })
  tripId: string;

  @ManyToOne(() => Trip, (trip) => trip.shipments)
  @JoinColumn({ name: 'trip_id' })
  trip: Trip;

  @Column({ type: 'text' })
  description: string;

  @Column({ name: 'weight_kg', type: 'decimal', precision: 6, scale: 2, nullable: true })
  weightKg: number;

  // Dimensões em centímetros (para cálculo volumétrico)
  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  length: number;

  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  width: number;

  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  height: number;

  // Array de URLs de fotos (máximo 5)
  @Column({ type: 'text', array: true, nullable: true })
  photos: string[];

  @Column({ name: 'recipient_name', length: 255 })
  recipientName: string;

  @Column({ name: 'recipient_phone', length: 20 })
  recipientPhone: string;

  @Column({ name: 'recipient_address', type: 'text' })
  recipientAddress: string;

  @Column({ name: 'total_price', type: 'decimal', precision: 10, scale: 2 })
  totalPrice: number;

  @Column({ name: 'payment_method', length: 20, default: 'pix' })
  paymentMethod: string;

  @Column({ name: 'qr_code', type: 'text', nullable: true })
  qrCode: string;

  @Column({ type: 'enum', enum: ShipmentStatus, default: ShipmentStatus.PENDING })
  status: ShipmentStatus;

  @Column({ name: 'delivery_photo_url', type: 'text', nullable: true })
  deliveryPhotoUrl: string;

  @Column({ name: 'delivered_at', type: 'timestamp', nullable: true })
  deliveredAt: Date;

  @Column({ name: 'tracking_code', length: 20, unique: true })
  trackingCode: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
