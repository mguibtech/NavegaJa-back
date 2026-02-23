import { Controller, Get, Patch, Param, Body, UseGuards, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UpdateProfileDto } from './dto/update-profile.dto';

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('profile')
  @ApiOperation({ summary: 'Perfil do usuário logado' })
  getProfile(@Request() req: any) {
    return this.usersService.findById(req.user.sub);
  }

  @Patch('profile')
  @ApiOperation({
    summary: 'Atualizar perfil do usuário logado',
    description: 'Permite atualizar nome, email, avatar, cidade e estado. Campos não enviados são mantidos.',
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
  updateProfile(@Request() req: any, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(req.user.sub, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar usuário por ID' })
  findById(@Param('id') id: string) {
    return this.usersService.findById(id);
  }
}
