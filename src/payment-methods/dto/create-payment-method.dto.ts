import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsInt,
  IsBoolean,
  IsOptional,
  Min,
  Max,
  Matches,
  Length,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CardType } from '../payment-method.entity';

export class CreatePaymentMethodDto {
  @ApiProperty({
    example: '4111111111111111',
    description:
      'Número completo do cartão (13-19 dígitos). Usado apenas para detectar bandeira e extrair os últimos 4 dígitos — nunca armazenado.',
  })
  @IsString()
  @Matches(/^\d{13,19}$/, { message: 'Número do cartão inválido' })
  cardNumber: string;

  @ApiProperty({
    example: 'JOÃO DA SILVA',
    description: 'Nome do titular conforme impresso no cartão',
  })
  @IsString()
  @IsNotEmpty()
  @Length(2, 255)
  holderName: string;

  @ApiProperty({ example: 12, description: 'Mês de validade (1-12)' })
  @IsInt()
  @Min(1)
  @Max(12)
  expiryMonth: number;

  @ApiProperty({
    example: 2029,
    description: 'Ano de validade (4 dígitos, ex: 2029)',
  })
  @IsInt()
  @Min(2024)
  expiryYear: number;

  @ApiProperty({
    enum: CardType,
    example: CardType.CREDIT,
    description: 'Tipo: crédito ou débito',
  })
  @IsEnum(CardType)
  type: CardType;

  @ApiProperty({
    example: '123',
    description: 'CVV (3-4 dígitos). Validado mas nunca armazenado.',
  })
  @IsString()
  @Matches(/^\d{3,4}$/, { message: 'CVV inválido' })
  cvv: string;

  @ApiProperty({
    example: true,
    required: false,
    description: 'Definir como forma de pagamento padrão',
  })
  @IsBoolean()
  @IsOptional()
  setAsDefault?: boolean;
}
