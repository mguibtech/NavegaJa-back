import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

export enum CouponType {
  PERCENTAGE = 'percentage',
  FIXED = 'fixed',
}

@Entity('coupons')
export class Coupon {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 50 })
  code: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'enum', enum: CouponType })
  type: CouponType;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  value: number;

  @Column({ name: 'min_purchase', type: 'decimal', precision: 10, scale: 2, nullable: true })
  minPurchase: number | null;

  @Column({ name: 'max_discount', type: 'decimal', precision: 10, scale: 2, nullable: true })
  maxDiscount: number | null;

  @Column({ name: 'usage_limit', type: 'int', nullable: true })
  usageLimit: number | null;

  @Column({ name: 'usage_count', type: 'int', default: 0 })
  usageCount: number;

  @Column({ name: 'valid_from', type: 'timestamp', nullable: true })
  validFrom: Date | null;

  @Column({ name: 'valid_until', type: 'timestamp', nullable: true })
  validUntil: Date | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'first_purchase_only', type: 'boolean', default: false })
  firstPurchaseOnly: boolean;

  @Column({ name: 'from_city', type: 'varchar', length: 100, nullable: true, comment: 'Filtro: cidade de origem (null = todas)' })
  fromCity: string | null;

  @Column({ name: 'to_city', type: 'varchar', length: 100, nullable: true, comment: 'Filtro: cidade de destino (null = todas)' })
  toCity: string | null;

  @Column({ name: 'min_weight', type: 'decimal', precision: 6, scale: 2, nullable: true, comment: 'Peso mínimo em kg para encomendas (null = sem mínimo)' })
  minWeight: number | null;

  @Column({ name: 'max_weight', type: 'decimal', precision: 6, scale: 2, nullable: true, comment: 'Peso máximo em kg para encomendas (null = sem máximo)' })
  maxWeight: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
