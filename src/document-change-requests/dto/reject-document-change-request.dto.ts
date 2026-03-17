import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RejectDocumentChangeRequestDto {
  @ApiPropertyOptional({
    example: 'Documento ilegível ou divergente do cadastro.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  rejectionReason?: string;
}
