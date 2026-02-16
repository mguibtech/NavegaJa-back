import { IsString, IsNotEmpty, MinLength, IsEnum, IsOptional, IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../users/user.entity';

export class RegisterDto {
  @ApiProperty({ example: 'João Silva' })
  @IsString({ message: 'O nome deve ser um texto' })
  @IsNotEmpty({ message: 'O nome é obrigatório' })
  name: string;

  @ApiProperty({ example: '92991234567' })
  @IsString({ message: 'O telefone deve ser um texto' })
  @IsNotEmpty({ message: 'O telefone é obrigatório' })
  phone: string;

  @ApiProperty({ example: 'joao@email.com', required: false })
  @IsEmail({}, { message: 'E-mail inválido' })
  @IsOptional()
  email?: string;

  @ApiProperty({ example: '123456' })
  @IsString({ message: 'A senha deve ser um texto' })
  @MinLength(6, { message: 'A senha deve ter no mínimo 6 caracteres' })
  password: string;

  @ApiProperty({ enum: UserRole, example: UserRole.PASSENGER })
  @IsEnum(UserRole, { message: 'Perfil inválido' })
  @IsOptional()
  role?: UserRole;

  @ApiProperty({ example: '123.456.789-00', required: false })
  @IsString({ message: 'O CPF deve ser um texto' })
  @IsOptional()
  cpf?: string;

  @ApiProperty({ example: 'NVJ-A1B2C3', required: false, description: 'Código de indicação de um amigo' })
  @IsString({ message: 'O código de indicação deve ser um texto' })
  @IsOptional()
  referralCode?: string;
}

export class LoginDto {
  @ApiProperty({ example: '92991234567' })
  @IsString({ message: 'O telefone deve ser um texto' })
  @IsNotEmpty({ message: 'O telefone é obrigatório' })
  phone: string;

  @ApiProperty({ example: '123456' })
  @IsString({ message: 'A senha deve ser um texto' })
  @IsNotEmpty({ message: 'A senha é obrigatória' })
  password: string;
}

export class LoginWebDto {
  @ApiProperty({ example: 'admin@navegaja.com' })
  @IsEmail({}, { message: 'E-mail inválido' })
  @IsNotEmpty({ message: 'O e-mail é obrigatório' })
  email: string;

  @ApiProperty({ example: 'admin123' })
  @IsString({ message: 'A senha deve ser um texto' })
  @IsNotEmpty({ message: 'A senha é obrigatória' })
  password: string;
}

export class RefreshTokenDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIs...' })
  @IsString({ message: 'O token deve ser um texto' })
  @IsNotEmpty({ message: 'O refresh token é obrigatório' })
  refreshToken: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'joao@email.com' })
  @IsEmail({}, { message: 'E-mail inválido' })
  @IsNotEmpty({ message: 'O e-mail é obrigatório' })
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty({ example: 'joao@email.com' })
  @IsEmail({}, { message: 'E-mail inválido' })
  @IsNotEmpty({ message: 'O e-mail é obrigatório' })
  email: string;

  @ApiProperty({ example: '123456' })
  @IsString({ message: 'O código deve ser um texto' })
  @IsNotEmpty({ message: 'O código é obrigatório' })
  code: string;

  @ApiProperty({ example: 'novaSenha123' })
  @IsString({ message: 'A senha deve ser um texto' })
  @MinLength(6, { message: 'A senha deve ter no mínimo 6 caracteres' })
  newPassword: string;
}
