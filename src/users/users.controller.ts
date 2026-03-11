import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, Roles } from '../common/roles.guard';
import { UpdateProfileDto } from './dto/update-profile.dto';

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('profile')
  @ApiOperation({ summary: 'Perfil do usuário logado' })
  getProfile(@Request() req: AuthenticatedRequest) {
    return this.usersService.findById(req.user.sub);
  }

  @Patch('profile')
  @ApiOperation({
    summary: 'Atualizar perfil do usuário logado',
    description:
      'Permite atualizar nome, email, avatar, cidade e estado. Campos não enviados são mantidos.',
  })
  @ApiResponse({
    status: 200,
    description: 'Perfil atualizado',
    schema: {
      example: {
        id: 'uuid',
        name: 'João Silva',
        email: 'joao@email.com',
        city: 'Parintins',
        state: 'AM',
        avatarUrl: 'https://cdn.../avatar.jpg',
      },
    },
  })
  updateProfile(
    @Request() req: AuthenticatedRequest,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(req.user.sub, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar usuário por ID' })
  findById(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  // ── KYC — Verificação de Identidade do Capitão ────────────────────────────

  @Post('kyc/submit')
  @UseGuards(RolesGuard)
  @Roles('captain')
  @ApiOperation({
    summary: 'Enviar documentos para verificação KYC (captain only)',
    description:
      'Capitão envia selfie + habilitação + número RNAq para análise do admin',
  })
  submitKyc(
    @Request() req: AuthenticatedRequest,
    @Body()
    body: {
      selfieUrl: string;
      licensePhotoUrl: string;
      rnaqNumber?: string;
      certificatePhotoUrl?: string;
    },
  ) {
    return this.usersService.submitKyc(req.user.sub, body);
  }

  @Get('kyc/status')
  @UseGuards(RolesGuard)
  @Roles('captain')
  @ApiOperation({ summary: 'Ver status atual do KYC (captain only)' })
  getKycStatus(@Request() req: AuthenticatedRequest) {
    return this.usersService.getKycStatus(req.user.sub);
  }
}
