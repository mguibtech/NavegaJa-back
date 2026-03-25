import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
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
  @ApiOperation({
    summary: 'Resumo analítico do capitão (receita, viagens, avaliação)',
  })
  @ApiResponse({
    status: 200,
    description: 'Resumo consolidado do capitÃ£o autenticado',
    schema: {
      example: {
        totalTrips: 42,
        completedTrips: 38,
        totalRevenue: 18450.75,
        averageRating: 4.9,
      },
    },
  })
  getAnalytics(@Request() req: AuthenticatedRequest) {
    return this.captainService.getAnalytics(req.user.sub);
  }

  @Get('analytics/revenue')
  @ApiOperation({ summary: 'Receita por dia (últimos 7, 30 ou 90 dias)' })
  @ApiQuery({
    name: 'period',
    required: false,
    enum: ['7d', '30d', '90d'],
    example: '30d',
  })
  @ApiResponse({
    status: 200,
    description: 'SÃ©rie de receita agrupada por dia',
    schema: {
      example: {
        period: '30d',
        labels: ['01/03', '02/03'],
        total: [320.5, 480],
      },
    },
  })
  getRevenue(
    @Request() req: AuthenticatedRequest,
    @Query('period') period?: '7d' | '30d' | '90d',
  ) {
    return this.captainService.getRevenueSeries(req.user.sub, period || '30d');
  }

  @Get('analytics/routes')
  @ApiOperation({ summary: 'Rotas mais lucrativas do capitão' })
  @ApiResponse({
    status: 200,
    description: 'Ranking das rotas mais rentÃ¡veis do capitÃ£o',
    schema: {
      example: [
        {
          origin: 'Manaus',
          destination: 'Parintins',
          totalTrips: 12,
          totalRevenue: 5400,
        },
      ],
    },
  })
  getRoutes(@Request() req: AuthenticatedRequest) {
    return this.captainService.getTopRoutes(req.user.sub);
  }

  @Get('analytics/passengers')
  @ApiOperation({ summary: 'Passageiros recorrentes (2+ viagens)' })
  @ApiResponse({
    status: 200,
    description: 'Passageiros com recorrÃªncia no capitÃ£o autenticado',
    schema: {
      example: [
        {
          passengerId: 'uuid',
          name: 'Maria',
          totalTrips: 4,
        },
      ],
    },
  })
  getPassengers(@Request() req: AuthenticatedRequest) {
    return this.captainService.getRecurringPassengers(req.user.sub);
  }
}
