import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import {
  RegisterDto,
  LoginDto,
  LoginWithOtpDto,
  LoginWebDto,
  RefreshTokenDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from './dto/auth.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @Throttle({ strict: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Cadastrar novo usuário' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @Throttle({ strict: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Login com telefone e senha (App Mobile)' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('login-otp')
  @Throttle({ strict: { limit: 5, ttl: 60000 } })
  @ApiOperation({
    summary: 'Login com código SMS (App Mobile)',
    description:
      'Recebe o ID token do Firebase gerado após a confirmação do código SMS e devolve os mesmos tokens do login por senha. Responde 404 com code PHONE_NOT_REGISTERED quando o telefone verificado ainda não tem cadastro.',
  })
  loginWithOtp(@Body() dto: LoginWithOtpDto) {
    return this.authService.loginWithPhoneOtp(dto);
  }

  @Post('login-web')
  @Throttle({ strict: { limit: 5, ttl: 60000 } })
  @ApiOperation({
    summary: 'Login com e-mail e senha (Dashboard Web)',
    description:
      'Endpoint exclusivo para administradores. APENAS usuários com role admin podem acessar o dashboard web.',
  })
  loginWeb(@Body() dto: LoginWebDto) {
    return this.authService.loginWeb(dto);
  }

  @Post('refresh')
  @Throttle({ strict: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Renovar tokens usando refresh token' })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('forgot-password')
  @Throttle({ strict: { limit: 3, ttl: 60000 } })
  @ApiOperation({
    summary: 'Solicitar código de recuperação de senha por e-mail',
  })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('reset-password')
  @Throttle({ strict: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Redefinir senha com código recebido por e-mail' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Get('me')
  @SkipThrottle()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Dados do usuário logado' })
  getMe(@Request() req: AuthenticatedRequest) {
    return this.authService.getMe(req.user.sub);
  }
}
