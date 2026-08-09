import {
  IsString,
  IsNotEmpty,
  MinLength,
  MaxLength,
  IsOptional,
  IsEmail,
  Length,
  IsEnum,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IsCpfValid } from '../../common/validators/is-cpf-valid.validator';
import { Gender } from '../../users/user.entity';

/** Registo público via app mobile — cria sempre PASSAGEIRO */
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

  @ApiProperty({ example: '123.456.789-00' })
  @IsString({ message: 'O CPF deve ser um texto' })
  @IsNotEmpty({ message: 'O CPF é obrigatório' })
  @IsCpfValid()
  cpf: string;

  @ApiProperty({ example: 'Manaus' })
  @IsString({ message: 'A cidade deve ser um texto' })
  @IsNotEmpty({ message: 'A cidade é obrigatória' })
  // Texto livre por desenho: quem mora em comunidade ribeirinha digita a
  // localidade. O limite acompanha a coluna users.city (varchar(100)) para
  // devolver 400 em vez de estourar no banco.
  @MaxLength(100, { message: 'A cidade deve ter no máximo 100 caracteres' })
  city: string;

  @ApiProperty({ example: 'AM', required: false })
  @IsString()
  @Length(2, 2, { message: 'O estado deve ter 2 letras (UF)' })
  @IsOptional()
  state?: string;

  @ApiProperty({ example: 'NVJ-A1B2C3', required: false })
  @IsString()
  @IsOptional()
  referralCode?: string;

  @ApiProperty({ enum: Gender, example: 'M', required: false })
  @IsEnum(Gender, { message: 'Gênero inválido. Use M, F ou other' })
  @IsOptional()
  gender?: Gender;
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

export class LoginWithOtpDto {
  @ApiProperty({
    example: 'eyJhbGciOiJSUzI1NiIs...',
    description:
      'ID token devolvido pelo Firebase Authentication após o utilizador confirmar o código SMS no app. O telefone verificado é lido do token — o cliente não envia o número.',
  })
  @IsString({ message: 'O token deve ser um texto' })
  @IsNotEmpty({ message: 'O ID token é obrigatório' })
  idToken: string;
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
