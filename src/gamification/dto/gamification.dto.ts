import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class ReferralDto {
  @ApiProperty({ example: 'NVJ-A1B2C3', description: 'Código de indicação de um amigo' })
  @IsString({ message: 'O código de indicação deve ser um texto' })
  @IsNotEmpty({ message: 'O código de indicação é obrigatório' })
  referralCode: string;
}
