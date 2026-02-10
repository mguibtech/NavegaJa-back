import { Controller, Get, Patch, Param, Body, UseGuards, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

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

  @Get(':id')
  @ApiOperation({ summary: 'Buscar usuário por ID' })
  findById(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Patch('profile')
  @ApiOperation({ summary: 'Atualizar perfil' })
  updateProfile(@Request() req: any, @Body() data: any) {
    return this.usersService.updateProfile(req.user.sub, data);
  }
}
