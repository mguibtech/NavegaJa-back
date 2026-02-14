import { Controller, Get, UseGuards, Request, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { GamificationService } from './gamification.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Gamificação (NavegaCoins)')
@Controller('gamification')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class GamificationController {
  constructor(private gamificationService: GamificationService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Meus pontos, nível e desconto atual' })
  getStats(@Request() req: any) {
    return this.gamificationService.getUserStats(req.user.sub);
  }

  @Get('history')
  @ApiOperation({ summary: 'Histórico de transações de pontos' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  getHistory(
    @Request() req: any,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.gamificationService.getHistory(req.user.sub, page || 1, limit || 20);
  }

  @Get('leaderboard')
  @ApiOperation({ summary: 'Ranking dos usuários com mais NavegaCoins' })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  getLeaderboard(@Query('limit') limit?: number) {
    return this.gamificationService.getLeaderboard(limit || 10);
  }
}
