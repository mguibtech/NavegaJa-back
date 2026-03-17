import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import {
  CaptainDocumentType,
  DocumentChangeRequestStatus,
} from '../document-change-request.entity';

export class QueryDocumentChangeRequestDto {
  @ApiPropertyOptional({ enum: DocumentChangeRequestStatus })
  @IsOptional()
  @IsEnum(DocumentChangeRequestStatus, { message: 'Status inválido' })
  status?: DocumentChangeRequestStatus;

  @ApiPropertyOptional({ enum: CaptainDocumentType })
  @IsOptional()
  @IsEnum(CaptainDocumentType, { message: 'Tipo de documento inválido' })
  documentType?: CaptainDocumentType;

  @ApiPropertyOptional({
    description: 'Disponível apenas para administradores',
    example: 'uuid-do-capitao',
  })
  @IsOptional()
  @IsUUID('4', { message: 'userId inválido' })
  userId?: string;
}
