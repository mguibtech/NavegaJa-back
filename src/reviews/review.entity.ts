import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Trip } from '../trips/trip.entity';

@Entity('reviews')
export class Review {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'reviewer_id' })
  reviewerId: string;

  @ManyToOne(() => User, (user) => user.reviews)
  @JoinColumn({ name: 'reviewer_id' })
  reviewer: User;

  @Column({ name: 'trip_id' })
  tripId: string;

  @ManyToOne(() => Trip, (trip) => trip.reviews)
  @JoinColumn({ name: 'trip_id' })
  trip: Trip;

  @Column({ name: 'captain_id' })
  captainId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'captain_id' })
  captain: User;

  @Column()
  rating: number;

  @Column({ type: 'text', nullable: true })
  comment: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
