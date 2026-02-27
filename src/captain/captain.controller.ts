import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { CaptainService } from './captain.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, Roles } from '../common/roles.guard';

@ApiTags('Captain Analytics')
@Controller('captain')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('captain')
@ApiBearerAuth()
export class CaptainController {
  constructor(private captainService: CaptainService) {}

  @Get('analytics')
  @ApiOperation({ summary: 'Resumo analítico do capitão (receita, viagens, avaliação)' })
  getAnalytics(@Request() req: any) {
    return this.captainService.getAnalytics(req.user.sub);
  }

  @Get('analytics/revenue')
  @ApiOperation({ summary: 'Receita por dia (últimos 7, 30 ou 90 dias)' })
  @ApiQuery({ name: 'period', required: false, enum: ['7d', '30d', '90d'], example: '30d' })
  getRevenue(@Request() req: any, @Query('period') period?: '7d' | '30d' | '90d') {
    return this.captainService.getRevenueSeries(req.user.sub, period || '30d');
  }

  @Get('analytics/routes')
  @ApiOperation({ summary: 'Rotas mais lucrativas do capitão' })
  getRoutes(@Request() req: any) {
    return this.captainService.getTopRoutes(req.user.sub);
  }

  @Get('analytics/passengers')
  @ApiOperation({ summary: 'Passageiros recorrentes (2+ viagens)' })
  getPassengers(@Request() req: any) {
    return this.captainService.getRecurringPassengers(req.user.sub);
  }
}
