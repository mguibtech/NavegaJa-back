import { IsString, IsNotEmpty, IsInt, IsOptional, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChildPassengerDto {
  @ApiProperty({ example: 'Ana', required: false, description: 'Nome da criança (opcional)' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ example: 5, description: 'Idade da criança (0–17)' })
  @IsInt()
  @Min(0, { message: 'Idade não pode ser negativa.' })
  @Max(17, { message: 'Use este campo apenas para menores de 18 anos.' })
  age: number;
}

export class ExtraPassengerDto {
  @ApiProperty({ example: 'Maria Santos', description: 'Nome completo do passageiro' })
  @IsString()
  @IsNotEmpty({ message: 'Nome do passageiro é obrigatório.' })
  name: string;

  @ApiProperty({ example: '987.654.321-00', description: 'CPF do passageiro' })
  @IsString()
  @IsNotEmpty({ message: 'CPF do passageiro é obrigatório.' })
  cpf: string;
}
