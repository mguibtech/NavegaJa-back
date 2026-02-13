import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Boat } from '../boats/boat.entity';

export enum FavoriteType {
  DESTINATION = 'destination',
  BOAT = 'boat',
  CAPTAIN = 'captain',
}

@Entity('favorites')
export class Favorite {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'enum', enum: FavoriteType })
  type: FavoriteType;

  // Para favoritos de DESTINO/ROTA
  @Column({ type: 'varchar', length: 255, nullable: true })
  origin: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  destination: string;

  // Para favoritos de BARCO
  @Column({ name: 'boat_id', type: 'uuid', nullable: true })
  boatId: string;

  @ManyToOne(() => Boat, { nullable: true })
  @JoinColumn({ name: 'boat_id' })
  boat: Boat;

  // Para favoritos de CAPITÃO
  @Column({ name: 'captain_id', type: 'uuid', nullable: true })
  captainId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'captain_id' })
  captain: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
