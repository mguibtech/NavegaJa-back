import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Trip } from '../trips/trip.entity';
import { User } from '../users/user.entity';

/**
 * Checklist de segurança que o capitão deve preencher antes de iniciar a viagem
 * Inspirado em procedimentos de segurança marítima após tragédia em Manaus
 */
@Entity('safety_checklists')
export class SafetyChecklist {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'trip_id' })
  tripId: string;

  @ManyToOne(() => Trip)
  @JoinColumn({ name: 'trip_id' })
  trip: Trip;

  @Column({ type: 'uuid', name: 'captain_id' })
  captainId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'captain_id' })
  captain: User;

  // Itens obrigatórios do checklist
  @Column({ type: 'boolean', default: false })
  lifeJacketsAvailable: boolean; // Coletes salva-vidas suficientes para todos

  @Column({ type: 'int', nullable: true })
  lifeJacketsCount: number | null; // Quantidade de coletes disponíveis

  @Column({ type: 'boolean', default: false })
  fireExtinguisherCheck: boolean; // Extintor de incêndio verificado

  @Column({ type: 'boolean', default: false })
  weatherConditionsOk: boolean; // Condições climáticas favoráveis

  @Column({ type: 'varchar', length: 100, nullable: true })
  weatherCondition: string | null; // Ex: "Ensolarado", "Nublado", "Chuva leve"

  @Column({ type: 'boolean', default: false })
  boatConditionGood: boolean; // Embarcação em boas condições

  @Column({ type: 'boolean', default: false })
  emergencyEquipmentCheck: boolean; // Equipamentos de emergência (rádio, sinalizadores)

  @Column({ type: 'boolean', default: false })
  navigationLightsWorking: boolean; // Luzes de navegação funcionando

  @Column({ type: 'boolean', default: false })
  maxCapacityRespected: boolean; // Capacidade máxima da embarcação respeitada

  @Column({ type: 'int', nullable: true })
  passengersOnBoard: number | null; // Número de passageiros a bordo

  @Column({ type: 'int', nullable: true })
  maxCapacity: number | null; // Capacidade máxima da embarcação

  // Observações adicionais
  @Column({ type: 'text', nullable: true })
  observations: string | null;

  @Column({ type: 'boolean', default: false })
  allItemsChecked: boolean; // Todos os itens foram verificados

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date | null; // Quando o checklist foi completado

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
