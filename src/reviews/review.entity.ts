import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Trip } from '../trips/trip.entity';
import { Boat } from '../boats/boat.entity';

export enum ReviewType {
  PASSENGER_TO_CAPTAIN = 'passenger_to_captain',
  CAPTAIN_TO_PASSENGER = 'captain_to_passenger',
}

@Entity('reviews')
@Unique(['reviewerId', 'tripId', 'reviewType'])
export class Review {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ── Quem escreveu ──────────────────────────────────────────────────────────

  @Column({ name: 'reviewer_id' })
  reviewerId: string;

  @ManyToOne(() => User, (user) => user.reviews)
  @JoinColumn({ name: 'reviewer_id' })
  reviewer: User;

  // ── Viagem de referência ───────────────────────────────────────────────────

  @Column({ name: 'trip_id' })
  tripId: string;

  @ManyToOne(() => Trip, (trip) => trip.reviews)
  @JoinColumn({ name: 'trip_id' })
  trip: Trip;

  // ── Tipo de avaliação ──────────────────────────────────────────────────────

  @Column({
    name: 'review_type',
    type: 'enum',
    enum: ReviewType,
    default: ReviewType.PASSENGER_TO_CAPTAIN,
  })
  reviewType: ReviewType;

  // ── Passageiro avalia Capitão (campos existentes mantidos com name: original) ──

  @Column({ name: 'captain_id', nullable: true })
  captainId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'captain_id' })
  captain: User | null;

  @Column({ name: 'rating', type: 'int', nullable: true })
  captainRating: number | null;

  @Column({ name: 'comment', type: 'text', nullable: true })
  captainComment: string | null;

  // ── Sub-ratings do Capitão (opcionais) ────────────────────────────────────

  @Column({ name: 'punctuality_rating', type: 'int', nullable: true })
  punctualityRating: number | null;

  @Column({ name: 'communication_rating', type: 'int', nullable: true })
  communicationRating: number | null;

  // ── Passageiro avalia Barco (opcional, na mesma submissão) ─────────────────

  @Column({ name: 'boat_id', nullable: true })
  boatId: string | null;

  @ManyToOne(() => Boat, { nullable: true })
  @JoinColumn({ name: 'boat_id' })
  boat: Boat | null;

  @Column({ name: 'boat_rating', type: 'int', nullable: true })
  boatRating: number | null;

  @Column({ name: 'boat_comment', type: 'text', nullable: true })
  boatComment: string | null;

  @Column({ name: 'boat_photos', type: 'simple-array', nullable: true })
  boatPhotos: string[] | null;

  // ── Sub-ratings do Barco (opcionais) ──────────────────────────────────────

  @Column({ name: 'cleanliness_rating', type: 'int', nullable: true })
  cleanlinessRating: number | null;

  @Column({ name: 'comfort_rating', type: 'int', nullable: true })
  comfortRating: number | null;

  // ── Capitão avalia Passageiro ──────────────────────────────────────────────

  @Column({ name: 'passenger_id', nullable: true })
  passengerId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'passenger_id' })
  passenger: User | null;

  @Column({ name: 'passenger_rating', type: 'int', nullable: true })
  passengerRating: number | null;

  @Column({ name: 'passenger_comment', type: 'text', nullable: true })
  passengerComment: string | null;

  // ── Timestamps ─────────────────────────────────────────────────────────────

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
