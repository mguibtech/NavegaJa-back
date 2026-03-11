import {
  Controller,
  Post,
  Delete,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, Roles } from '../common/roles.guard';
import { NotificationsService } from './notifications.service';
import { RegisterTokenDto } from './dto/register-token.dto';

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Post('register-token')
  @ApiOperation({
    summary: 'Registrar token FCM do dispositivo',
    description:
      'Guarda o token FCM para receber push notifications. Chamar após login.',
  })
  @ApiResponse({ status: 200, description: 'Token registrado com sucesso' })
  async registerToken(
    @Request() req: AuthenticatedRequest,
    @Body() dto: RegisterTokenDto,
  ) {
    await this.notificationsService.registerToken(req.user.sub, dto.fcmToken);
    return { message: 'Token registrado com sucesso' };
  }

  @Delete('unregister-token')
  @ApiOperation({
    summary: 'Remover token FCM (logout)',
    description: 'Remove o token FCM do dispositivo. Chamar ao fazer logout.',
  })
  @ApiResponse({ status: 200, description: 'Token removido com sucesso' })
  async unregisterToken(@Request() req: AuthenticatedRequest) {
    await this.notificationsService.unregisterToken(req.user.sub);
    return { message: 'Token removido com sucesso' };
  }

  @Post('test')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({
    summary: 'Enviar notificação de teste (Admin)',
    description:
      'Envia uma notificação de teste para o próprio dispositivo do admin.',
  })
  @ApiResponse({ status: 200, description: 'Notificação de teste enviada' })
  async sendTest(@Request() req: AuthenticatedRequest) {
    await this.notificationsService.sendToUser(req.user.sub, {
      title: '🔔 Teste NavegaJá',
      body: 'Push notifications funcionando corretamente!',
      data: { type: 'test' },
    });
    return { message: 'Notificação de teste enviada' };
  }
}
