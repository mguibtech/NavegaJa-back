import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Coupon } from './coupon.entity';

export enum CtaAction {
  SEARCH = 'search',
  URL = 'url',
  DEEPLINK = 'deeplink',
}

@Entity('promotions')
export class Promotion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'varchar', name: 'image_url', length: 500 })
  imageUrl: string;

  @Column({ type: 'varchar', name: 'cta_text', length: 50, nullable: true })
  ctaText: string | null;

  @Column({ type: 'enum', name: 'cta_action', enum: CtaAction, nullable: true })
  ctaAction: CtaAction | null;

  @Column({ type: 'varchar', name: 'cta_value', length: 500, nullable: true })
  ctaValue: string | null;

  @Column({ type: 'varchar', name: 'background_color', length: 20, nullable: true, default: '#FF6B35' })
  backgroundColor: string;

  @Column({ type: 'varchar', name: 'text_color', length: 20, nullable: true, default: '#FFFFFF' })
  textColor: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'int', default: 0, comment: 'Maior prioridade aparece primeiro' })
  priority: number;

  @Column({ name: 'start_date', type: 'timestamp', nullable: true })
  startDate: Date | null;

  @Column({ name: 'end_date', type: 'timestamp', nullable: true })
  endDate: Date | null;

  @Column({ name: 'coupon_id', type: 'uuid', nullable: true })
  couponId: string | null;

  @ManyToOne(() => Coupon, { eager: false })
  @JoinColumn({ name: 'coupon_id' })
  coupon: Coupon | null;

  @Column({ name: 'from_city', type: 'varchar', length: 100, nullable: true, comment: 'Filtro: cidade de origem (opcional)' })
  fromCity: string | null;

  @Column({ name: 'to_city', type: 'varchar', length: 100, nullable: true, comment: 'Filtro: cidade de destino (opcional)' })
  toCity: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
