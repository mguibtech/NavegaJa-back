import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Trip } from '../trips/trip.entity';
import { PaymentMethod } from '../common/enums/payment-method.enum';

export enum ShipmentStatus {
  PENDING = 'pending',           // Criada, aguardando pagamento
  PAID = 'paid',                 // Pagamento confirmado, aguardando coleta
  COLLECTED = 'collected',       // Capitão coletou do remetente
  IN_TRANSIT = 'in_transit',     // Viagem em andamento
  ARRIVED = 'arrived',           // Viagem chegou ao destino
  OUT_FOR_DELIVERY = 'out_for_delivery', // Capitão saiu para entregar
  DELIVERED = 'delivered',       // Destinatário confirmou recebimento
  CANCELLED = 'cancelled',       // Cancelada
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
  private _weight: number;

  // Getter e setter para expor como 'weight' na API
  get weight(): number {
    return this._weight;
  }

  set weight(value: number) {
    this._weight = value;
  }

  // Backward compatibility
  get weightKg(): number {
    return this._weight;
  }

  set weightKg(value: number) {
    this._weight = value;
  }

  // Dimensões em centímetros (para cálculo volumétrico)
  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  length: number;

  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  width: number;

  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  height: number;

  // Getter para retornar dimensions como objeto (se existirem)
  get dimensions(): { length: number; width: number; height: number } | null {
    if (this.length && this.width && this.height) {
      return {
        length: this.length,
        width: this.width,
        height: this.height,
      };
    }
    return null;
  }

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

  @Column({
    name: 'payment_method',
    type: 'enum',
    enum: PaymentMethod,
    default: PaymentMethod.PIX
  })
  paymentMethod: PaymentMethod;

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

  @Column({ name: 'validation_code', length: 6 })
  validationCode: string;

  @Column({ name: 'collection_photo_url', type: 'text', nullable: true })
  collectionPhotoUrl: string;

  @Column({ name: 'collected_at', type: 'timestamp', nullable: true })
  collectedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
