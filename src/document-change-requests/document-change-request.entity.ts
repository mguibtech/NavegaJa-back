import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

export enum CaptainDocumentType {
  SELFIE = 'SELFIE',
  LICENSE_NAVIGATION = 'LICENCA_NAVEGACAO',
  SAFETY_CERTIFICATE = 'CERTIFICADO_SEGURANCA',
}

export enum DocumentChangeRequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

@Entity('document_change_requests')
@Index(['userId', 'documentType', 'status'])
export class DocumentChangeRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({
    name: 'document_type',
    type: 'enum',
    enum: CaptainDocumentType,
  })
  documentType: CaptainDocumentType;

  @Column({ name: 'current_document_url', type: 'text', nullable: true })
  currentDocumentUrl: string | null;

  @Column({ name: 'new_document_url', type: 'text' })
  newDocumentUrl: string;

  @Column({
    type: 'enum',
    enum: DocumentChangeRequestStatus,
    default: DocumentChangeRequestStatus.PENDING,
  })
  status: DocumentChangeRequestStatus;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason: string | null;

  @Column({ name: 'reviewed_at', type: 'timestamp', nullable: true })
  reviewedAt: Date | null;

  @Column({ name: 'reviewed_by', nullable: true })
  reviewedBy: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reviewed_by' })
  reviewer: User | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
