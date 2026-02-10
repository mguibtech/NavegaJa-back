import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany,
} from 'typeorm';
import { Trip } from '../trips/trip.entity';

@Entity('routes')
export class Route {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'origin_name', length: 255 })
  originName: string;

  @Column({ name: 'origin_lat', type: 'decimal', precision: 10, scale: 7 })
  originLat: number;

  @Column({ name: 'origin_lng', type: 'decimal', precision: 10, scale: 7 })
  originLng: number;

  @Column({ name: 'destination_name', length: 255 })
  destinationName: string;

  @Column({ name: 'destination_lat', type: 'decimal', precision: 10, scale: 7 })
  destinationLat: number;

  @Column({ name: 'destination_lng', type: 'decimal', precision: 10, scale: 7 })
  destinationLng: number;

  @Column({ name: 'distance_km', type: 'decimal', precision: 6, scale: 1, nullable: true })
  distanceKm: number;

  @Column({ name: 'duration_min', nullable: true })
  durationMin: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => Trip, (trip) => trip.route)
  trips: Trip[];
}
