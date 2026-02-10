import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, ManyToOne, JoinColumn, OneToMany,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Boat } from '../boats/boat.entity';
import { Route } from '../routes/route.entity';
import { Booking } from '../bookings/booking.entity';
import { Shipment } from '../shipments/shipment.entity';
import { Review } from '../reviews/review.entity';

export enum TripStatus {
  SCHEDULED = 'scheduled',
  BOARDING = 'boarding',
  SAILING = 'sailing',
  ARRIVED = 'arrived',
  CANCELLED = 'cancelled',
}

@Entity('trips')
export class Trip {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'captain_id' })
  captainId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'captain_id' })
  captain: User;

  @Column({ name: 'boat_id' })
  boatId: string;

  @ManyToOne(() => Boat, (boat) => boat.trips)
  @JoinColumn({ name: 'boat_id' })
  boat: Boat;

  @Column({ name: 'route_id' })
  routeId: string;

  @ManyToOne(() => Route, (route) => route.trips)
  @JoinColumn({ name: 'route_id' })
  route: Route;

  @Column({ name: 'departure_at', type: 'timestamp' })
  departureAt: Date;

  @Column({ name: 'estimated_arrival_at', type: 'timestamp', nullable: true })
  estimatedArrivalAt: Date | null;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ name: 'cargo_price_kg', type: 'decimal', precision: 10, scale: 2, default: 0 })
  cargoPriceKg: number;

  @Column({ name: 'total_seats' })
  totalSeats: number;

  @Column({ name: 'available_seats' })
  availableSeats: number;

  @Column({ type: 'enum', enum: TripStatus, default: TripStatus.SCHEDULED })
  status: TripStatus;

  @Column({ name: 'current_lat', type: 'decimal', precision: 10, scale: 7, nullable: true })
  currentLat: number;

  @Column({ name: 'current_lng', type: 'decimal', precision: 10, scale: 7, nullable: true })
  currentLng: number;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => Booking, (booking) => booking.trip)
  bookings: Booking[];

  @OneToMany(() => Shipment, (shipment) => shipment.trip)
  shipments: Shipment[];

  @OneToMany(() => Review, (review) => review.trip)
  reviews: Review[];
}
