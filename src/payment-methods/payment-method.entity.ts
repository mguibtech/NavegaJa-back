import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

export enum CardType {
  CREDIT = 'credit_card',
  DEBIT  = 'debit_card',
}

export enum CardBrand {
  VISA       = 'visa',
  MASTERCARD = 'mastercard',
  ELO        = 'elo',
  HIPERCARD  = 'hipercard',
  AMEX       = 'amex',
  OTHER      = 'other',
}

@Entity('payment_methods')
export class PaymentMethod {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'enum', enum: CardType })
  type: CardType;

  @Column({ type: 'enum', enum: CardBrand })
  brand: CardBrand;

  @Column({ length: 4 })
  last4: string;

  @Column({ name: 'holder_name', length: 255 })
  holderName: string;

  @Column({ name: 'expiry_month', type: 'int' })
  expiryMonth: number;

  @Column({ name: 'expiry_year', type: 'int' })
  expiryYear: number;

  @Column({ name: 'is_default', type: 'boolean', default: false })
  isDefault: boolean;

  /**
   * Token/ID do cartão no gateway externo (Stripe, PagSeguro, MercadoPago, etc.).
   * Null enquanto não houver integração.
   */
  @Column({ name: 'external_id', type: 'varchar', length: 255, nullable: true })
  externalId: string | null;

  /**
   * Nome do gateway: 'stripe' | 'pagseguro' | 'mercadopago' | null
   */
  @Column({ name: 'external_provider', type: 'varchar', length: 50, nullable: true })
  externalProvider: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
