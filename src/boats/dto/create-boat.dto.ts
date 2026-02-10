import { IsString, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateBoatDto {
  @ApiProperty({ example: 'Estrela do Rio' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'lancha', description: 'lancha | voadeira | balsa | recreio' })
  @IsString()
  @IsNotEmpty()
  type: string;

  @ApiProperty({ example: 20 })
  @IsNumber()
  capacity: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  photoUrl?: string;

  @ApiProperty({ required: false, example: 'AM-1234' })
  @IsString()
  @IsOptional()
  registrationNum?: string;
}
