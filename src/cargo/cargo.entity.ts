import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Trip } from '../trips/trip.entity';

export enum CargoType {
  MOTORCYCLE = 'motorcycle',
  CAR = 'car',
  PICKUP_TRUCK = 'pickup_truck',
  RANCHO = 'rancho',
  CONSTRUCTION = 'construction',
  FUEL = 'fuel',
  LIVESTOCK = 'livestock',
  ELECTRONICS = 'electronics',
  GENERAL = 'general',
}

export enum CargoStatus {
  PENDING_QUOTE = 'pending_quote',
  QUOTED = 'quoted',
  CONFIRMED = 'confirmed',
  LOADED = 'loaded',
  IN_TRANSIT = 'in_transit',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
}

// Precos de referencia por tipo de carga (em R$)
export const CARGO_REFERENCE_PRICES: Record<CargoType, { unit: string; basePrice: number }> = {
  [CargoType.MOTORCYCLE]: { unit: 'unidade', basePrice: 150 },
  [CargoType.CAR]: { unit: 'unidade', basePrice: 500 },
  [CargoType.PICKUP_TRUCK]: { unit: 'unidade', basePrice: 650 },
  [CargoType.RANCHO]: { unit: 'tonelada', basePrice: 200 },
  [CargoType.CONSTRUCTION]: { unit: 'tonelada', basePrice: 180 },
  [CargoType.FUEL]: { unit: 'tambor (200L)', basePrice: 80 },
  [CargoType.LIVESTOCK]: { unit: 'cabeca', basePrice: 60 },
  [CargoType.ELECTRONICS]: { unit: 'volume', basePrice: 100 },
  [CargoType.GENERAL]: { unit: 'tonelada', basePrice: 150 },
};

@Entity('cargo_shipments')
export class CargoShipment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'sender_id' })
  senderId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'sender_id' })
  sender: User;

  @Column({ name: 'trip_id' })
  tripId: string;

  @ManyToOne(() => Trip, (trip) => trip.cargoShipments)
  @JoinColumn({ name: 'trip_id' })
  trip: Trip;

  @Column({ name: 'cargo_type', type: 'enum', enum: CargoType })
  cargoType: CargoType;

  @Column({ type: 'text' })
  description: string;

  @Column({ default: 1 })
  quantity: number;

  @Column({ name: 'estimated_weight_kg', type: 'decimal', precision: 10, scale: 2, nullable: true })
  estimatedWeightKg: number;

  @Column({ length: 255, nullable: true })
  dimensions: string;

  @Column({ name: 'photo_url', type: 'text', nullable: true })
  photoUrl: string;

  @Column({ name: 'receiver_name', length: 255 })
  receiverName: string;

  @Column({ name: 'receiver_phone', length: 20 })
  receiverPhone: string;

  @Column({ name: 'total_price', type: 'decimal', precision: 10, scale: 2 })
  totalPrice: number;

  @Column({ type: 'enum', enum: CargoStatus, default: CargoStatus.PENDING_QUOTE })
  status: CargoStatus;

  @Column({ name: 'tracking_code', length: 20, unique: true })
  trackingCode: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ name: 'delivery_photo_url', type: 'text', nullable: true })
  deliveryPhotoUrl: string;

  @Column({ name: 'delivered_at', type: 'timestamp', nullable: true })
  deliveredAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
