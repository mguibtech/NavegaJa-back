import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsUrl } from 'class-validator';
import { CaptainDocumentType } from '../document-change-request.entity';

export class CreateDocumentChangeRequestDto {
  @ApiProperty({ enum: CaptainDocumentType })
  @IsEnum(CaptainDocumentType, { message: 'Tipo de documento inválido' })
  documentType: CaptainDocumentType;

  @ApiProperty({
    example:
      'https://storage.googleapis.com/navegaja.appspot.com/documents/doc.pdf',
  })
  @IsNotEmpty({ message: 'URL do novo documento é obrigatória' })
  @IsUrl({ require_tld: false }, { message: 'URL do documento inválida' })
  newDocumentUrl: string;
}
