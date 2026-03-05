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
import { CargoShipment } from '../cargo/cargo.entity';

export enum TripStatus {
  SCHEDULED = 'scheduled',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
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

  @Column({ name: 'boat_id', nullable: true })
  boatId: string | null;

  @ManyToOne(() => Boat, (boat) => boat.trips, { nullable: true })
  @JoinColumn({ name: 'boat_id' })
  boat: Boat | null;

  @Column({ name: 'route_id', nullable: true })
  routeId: string;

  @ManyToOne(() => Route, (route) => route.trips)
  @JoinColumn({ name: 'route_id' })
  route: Route;

  @Column({ length: 255, nullable: true, default: '' })
  origin: string;

  @Column({ length: 255, nullable: true, default: '' })
  destination: string;

  @Column({ name: 'departure_at', type: 'timestamp' })
  departureAt: Date;

  @Column({ name: 'estimated_arrival_at', type: 'timestamp', nullable: true })
  estimatedArrivalAt: Date | null;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ type: 'int', default: 0, comment: 'Desconto em porcentagem (0-100)' })
  discount: number;

  @Column({ name: 'cargo_price_kg', type: 'decimal', precision: 10, scale: 2, nullable: true, default: null })
  cargoPriceKg: number | null;

  @Column({ name: 'cargo_capacity_kg', type: 'decimal', precision: 10, scale: 2, nullable: true, comment: 'Capacidade total de carga em kg' })
  cargoCapacityKg: number;

  @Column({ name: 'available_cargo_kg', type: 'decimal', precision: 10, scale: 2, nullable: true, comment: 'Carga disponível em kg (atualizada conforme reservas)' })
  availableCargoKg: number;

  @Column({ name: 'total_seats' })
  totalSeats: number;

  @Column({ name: 'available_seats' })
  availableSeats: number;

  @Column({ type: 'enum', enum: TripStatus, default: TripStatus.SCHEDULED })
  status: TripStatus;

  // Coordenadas geocodificadas da cidade de origem (preenchidas ao criar a viagem)
  @Column({ name: 'origin_lat', type: 'decimal', precision: 10, scale: 7, nullable: true })
  originLat: number | null;

  @Column({ name: 'origin_lng', type: 'decimal', precision: 10, scale: 7, nullable: true })
  originLng: number | null;

  // GPS em tempo real do capitão (actualizado via PATCH /trips/:id/location)
  @Column({ name: 'current_lat', type: 'decimal', precision: 10, scale: 7, nullable: true })
  currentLat: number | null;

  @Column({ name: 'current_lng', type: 'decimal', precision: 10, scale: 7, nullable: true })
  currentLng: number | null;

  @Column({ name: 'last_location_at', type: 'timestamp', nullable: true })
  lastLocationAt: Date | null;

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

  @OneToMany(() => CargoShipment, (cargo) => cargo.trip)
  cargoShipments: CargoShipment[];
}
