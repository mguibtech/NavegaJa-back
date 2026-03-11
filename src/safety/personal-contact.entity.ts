import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

/**
 * Contactos pessoais de emergência de cada utilizador.
 * Quando um SOS é acionado, os contactos com conta NavegaJá recebem
 * uma notificação FCM com a localização GPS do utilizador em apuros.
 * Para contactos sem conta, o app envia SMS/WhatsApp directamente.
 */
@Entity('personal_contacts')
export class PersonalContact {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', length: 100 })
  name: string; // "Mãe", "João Silva"

  @Column({ type: 'varchar', length: 20 })
  phone: string; // para o app abrir SMS/WhatsApp

  /** UUID do utilizador NavegaJá com este telefone, se existir — notificado via FCM */
  @Column({ name: 'linked_user_id', type: 'uuid', nullable: true })
  linkedUserId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
