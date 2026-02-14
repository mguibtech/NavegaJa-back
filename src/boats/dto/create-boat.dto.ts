import { IsString, IsNotEmpty, IsNumber, IsOptional, IsArray } from 'class-validator';
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

  @ApiProperty({ required: false, example: 'Mercury 150HP' })
  @IsString()
  @IsOptional()
  model?: string;

  @ApiProperty({ required: false, example: 2022 })
  @IsNumber()
  @IsOptional()
  year?: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  photoUrl?: string;

  @ApiProperty({ required: false, example: ['wifi', 'banheiro', 'colete', 'som', 'cobertura'] })
  @IsArray()
  @IsOptional()
  amenities?: string[];

  @ApiProperty({ required: false, example: ['https://...foto1.jpg', 'https://...foto2.jpg'] })
  @IsArray()
  @IsOptional()
  photos?: string[];

  @ApiProperty({ required: false, example: 'AM-1234' })
  @IsString()
  @IsOptional()
  registrationNum?: string;
}
