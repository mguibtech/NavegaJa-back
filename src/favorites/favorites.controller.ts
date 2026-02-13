import { Controller, Get, Post, Delete, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiQuery, ApiOkResponse, ApiBody } from '@nestjs/swagger';
import { FavoritesService } from './favorites.service';
import { CreateFavoriteDto, FavoriteResponseDto, CheckFavoriteDto } from './dto/favorite.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FavoriteType } from './favorite.entity';

@ApiTags('Favorites')
@Controller('favorites')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class FavoritesController {
  constructor(private favoritesService: FavoritesService) {}

  @Post()
  @ApiOperation({ summary: 'Adicionar item aos favoritos (destino, barco ou capitão)' })
  @ApiOkResponse({ type: FavoriteResponseDto })
  create(@Request() req: any, @Body() dto: CreateFavoriteDto) {
    return this.favoritesService.create(req.user.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar favoritos do usuário' })
  @ApiQuery({ name: 'type', enum: FavoriteType, required: false, description: 'Filtrar por tipo (destination, boat, captain)' })
  @ApiOkResponse({ type: [FavoriteResponseDto] })
  findAll(@Request() req: any, @Query('type') type?: FavoriteType) {
    return this.favoritesService.findAll(req.user.sub, type);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remover item dos favoritos' })
  async remove(@Request() req: any, @Param('id') id: string) {
    await this.favoritesService.remove(req.user.sub, id);
    return { message: 'Favorito removido com sucesso' };
  }

  @Post('check')
  @ApiOperation({ summary: 'Verificar se item está favoritado' })
  @ApiOkResponse({ type: CheckFavoriteDto })
  @ApiBody({ type: CreateFavoriteDto })
  check(@Request() req: any, @Body() dto: CreateFavoriteDto) {
    return this.favoritesService.check(req.user.sub, dto);
  }

  @Post('toggle')
  @ApiOperation({ summary: 'Adicionar ou remover favorito (toggle)' })
  toggle(@Request() req: any, @Body() dto: CreateFavoriteDto) {
    return this.favoritesService.toggleFavorite(req.user.sub, dto);
  }
}
