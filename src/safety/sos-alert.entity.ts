import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { User } from '../users/user.entity';
import { Trip } from '../trips/trip.entity';

export enum SosAlertStatus {
  ACTIVE = 'active',       // Alerta ativo
  RESOLVED = 'resolved',   // Resolvido
  FALSE_ALARM = 'false_alarm', // Falso alarme
  CANCELLED = 'cancelled', // Cancelado pelo usuário
}

export enum SosAlertType {
  EMERGENCY = 'emergency',     // Emergência geral
  MEDICAL = 'medical',         // Emergência médica
  FIRE = 'fire',               // Incêndio
  WATER_LEAK = 'water_leak',   // Vazamento de água/naufrágio
  MECHANICAL = 'mechanical',   // Problema mecânico
  WEATHER = 'weather',         // Condições climáticas perigosas
  ACCIDENT = 'accident',       // Acidente
  OTHER = 'other',             // Outro
}

/**
 * Alertas SOS acionados por passageiros ou capitães durante viagens
 * Sistema de emergência inspirado em incidentes recentes
 */
@Entity('sos_alerts')
export class SosAlert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'uuid', name: 'trip_id', nullable: true })
  tripId: string | null;

  @ManyToOne(() => Trip, { nullable: true })
  @JoinColumn({ name: 'trip_id' })
  trip: Trip | null;

  @Column({ type: 'enum', enum: SosAlertType })
  type: SosAlertType;

  @Column({ type: 'enum', enum: SosAlertStatus, default: SosAlertStatus.ACTIVE })
  status: SosAlertStatus;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  // Localização GPS (se disponível)
  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitude: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitude: number | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  location: string | null; // Ex: "Próximo ao Encontro das Águas"

  // Informações de resolução
  @Column({ type: 'uuid', name: 'resolved_by_id', nullable: true })
  resolvedById: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'resolved_by_id' })
  resolvedBy: User | null;

  @Column({ type: 'timestamp', nullable: true })
  resolvedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  resolutionNotes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
