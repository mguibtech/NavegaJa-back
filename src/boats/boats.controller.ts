import { Controller, Post, Get, Param, Body, UseGuards, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { BoatsService } from './boats.service';
import { CreateBoatDto } from './dto/create-boat.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, Roles } from '../common/roles.guard';

@ApiTags('Boats')
@Controller('boats')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BoatsController {
  constructor(private boatsService: BoatsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('captain')
  @ApiOperation({ summary: 'Cadastrar embarcação (captain only)' })
  create(@Request() req: any, @Body() dto: CreateBoatDto) {
    return this.boatsService.create(req.user.sub, dto);
  }

  @Get('my-boats')
  @ApiOperation({ summary: 'Minhas embarcações' })
  myBoats(@Request() req: any) {
    return this.boatsService.findByOwner(req.user.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhes da embarcação' })
  findById(@Param('id') id: string) {
    return this.boatsService.findById(id);
  }
}
