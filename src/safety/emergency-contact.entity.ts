import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum EmergencyServiceType {
  MARINHA = 'marinha',
  BOMBEIROS = 'bombeiros',
  POLICIA = 'policia',
  SAMU = 'samu',
  DEFESA_CIVIL = 'defesa_civil',
  CAPITANIA_PORTOS = 'capitania_portos',
  OUTROS = 'outros',
}

/**
 * Contatos de emergência para serviços públicos
 * Números de socorro que aparecem no app para os usuários
 */
@Entity('emergency_contacts')
export class EmergencyContact {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: EmergencyServiceType })
  type: EmergencyServiceType;

  @Column({ type: 'varchar', length: 200 })
  name: string; // Ex: "Marinha do Brasil - Capitania dos Portos"

  @Column({ type: 'varchar', length: 20 })
  phoneNumber: string; // Ex: "190", "193", "(92) 3622-2500"

  @Column({ type: 'text', nullable: true })
  description: string | null; // Descrição do serviço

  @Column({ type: 'varchar', length: 100, nullable: true })
  region: string | null; // Ex: "Manaus", "Amazonas", "Nacional"

  @Column({ type: 'boolean', default: true })
  isActive: boolean; // Pode desativar contatos obsoletos

  @Column({ type: 'int', default: 0 })
  priority: number; // Ordem de exibição (0 = mais importante)

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
