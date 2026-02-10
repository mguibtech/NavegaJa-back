import { IsString, IsNotEmpty, MinLength, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../users/user.entity';

export class RegisterDto {
  @ApiProperty({ example: 'João Silva' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: '92991234567' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ enum: UserRole, example: UserRole.PASSENGER })
  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;
}

export class LoginDto {
  @ApiProperty({ example: '92991234567' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @IsNotEmpty()
  password: string;
}

export class RefreshTokenDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIs...' })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
