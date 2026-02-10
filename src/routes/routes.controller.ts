import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { RoutesService } from './routes.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Routes')
@Controller('routes')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class RoutesController {
  constructor(private routesService: RoutesService) {}

  @Get()
  @ApiOperation({ summary: 'Listar todas as rotas' })
  findAll() {
    return this.routesService.findAll();
  }

  @Get('search')
  @ApiOperation({ summary: 'Buscar rotas por origem/destino' })
  @ApiQuery({ name: 'origin', required: false })
  @ApiQuery({ name: 'dest', required: false })
  search(@Query('origin') origin?: string, @Query('dest') dest?: string) {
    return this.routesService.search(origin, dest);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhes de uma rota' })
  findById(@Param('id') id: string) {
    return this.routesService.findById(id);
  }
}
