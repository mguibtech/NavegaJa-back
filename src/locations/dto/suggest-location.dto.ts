import {
  IsString,
  IsNumber,
  IsOptional,
  MaxLength,
  Min,
  Max,
} from 'class-validator';

export class SuggestLocationDto {
  @IsString()
  @MaxLength(150)
  name: string;

  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  lng: number;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  municipio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  state?: string;
}
