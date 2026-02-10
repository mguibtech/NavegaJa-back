import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn, OneToMany,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Trip } from '../trips/trip.entity';

@Entity('boats')
export class Boat {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'owner_id' })
  ownerId: string;

  @ManyToOne(() => User, (user) => user.boats)
  @JoinColumn({ name: 'owner_id' })
  owner: User;

  @Column({ length: 255 })
  name: string;

  @Column({ length: 100 })
  type: string; // lancha, voadeira, balsa, recreio

  @Column()
  capacity: number;

  @Column({ name: 'photo_url', type: 'text', nullable: true })
  photoUrl: string;

  @Column({ name: 'registration_num', length: 100, nullable: true })
  registrationNum: string;

  @Column({ name: 'is_verified', default: false })
  isVerified: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => Trip, (trip) => trip.boat)
  trips: Trip[];
}
