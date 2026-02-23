import { Controller, Post, Get, Param, Body, UseGuards, Request } from '@nestjs/common';
import {
  ApiBearerAuth, ApiTags, ApiOperation, ApiResponse,
} from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import { CreatePassengerReviewDto, CreateCaptainReviewDto } from './dto/create-review.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, Roles } from '../common/roles.guard';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Reviews')
@Controller('reviews')
@ApiBearerAuth()
export class ReviewsController {
  constructor(private reviewsService: ReviewsService) {}

  // ── Passageiro avalia Capitão + Barco ──────────────────────────────────────

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Passageiro avalia capitão e barco',
    description: 'Submete uma avaliação com estrelas e comentários para o capitão e (opcionalmente) para o barco. Só permitido após viagem CONCLUÍDA.',
  })
  @ApiResponse({ status: 201, description: 'Avaliação criada com sucesso' })
  @ApiResponse({ status: 400, description: 'Viagem não concluída ou já avaliada' })
  @ApiResponse({ status: 403, description: 'Passageiro não participou desta viagem' })
  createPassengerReview(
    @Request() req: any,
    @Body() dto: CreatePassengerReviewDto,
  ) {
    return this.reviewsService.createPassengerReview(req.user.sub, dto);
  }

  // ── Capitão avalia Passageiro ──────────────────────────────────────────────

  @Post('captain-review')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('captain')
  @ApiOperation({
    summary: 'Capitão avalia passageiro',
    description: 'O capitão da viagem avalia um passageiro. Só permitido após viagem CONCLUÍDA.',
  })
  @ApiResponse({ status: 201, description: 'Avaliação do passageiro criada' })
  @ApiResponse({ status: 400, description: 'Viagem não concluída ou já avaliada' })
  @ApiResponse({ status: 403, description: 'Utilizador não é capitão desta viagem' })
  createCaptainReview(
    @Request() req: any,
    @Body() dto: CreateCaptainReviewDto,
  ) {
    return this.reviewsService.createCaptainReview(req.user.sub, dto);
  }

  // ── Verificar elegibilidade ────────────────────────────────────────────────

  @Get('can-review/:tripId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Verificar se posso avaliar uma viagem',
    description: 'Retorna se o utilizador pode avaliar a viagem e o motivo. Útil para mostrar/esconder o botão de avaliação no app.',
  })
  canReview(@Request() req: any, @Param('tripId') tripId: string) {
    return this.reviewsService.canReview(req.user.sub, tripId);
  }

  // ── Listagens públicas ─────────────────────────────────────────────────────

  @Get('captain/:captainId')
  @Public()
  @ApiOperation({
    summary: 'Avaliações de um capitão',
    description: 'Retorna todas as avaliações recebidas por um capitão, com stats (média e distribuição de estrelas).',
  })
  findByCaptain(@Param('captainId') captainId: string) {
    return this.reviewsService.findByCaptain(captainId);
  }

  @Get('boat/:boatId')
  @Public()
  @ApiOperation({
    summary: 'Avaliações de um barco',
    description: 'Retorna todas as avaliações recebidas por um barco, com stats.',
  })
  findByBoat(@Param('boatId') boatId: string) {
    return this.reviewsService.findByBoat(boatId);
  }

  @Get('passenger/:passengerId')
  @Public()
  @ApiOperation({
    summary: 'Avaliações de um passageiro',
    description: 'Retorna todas as avaliações que um passageiro recebeu de capitães.',
  })
  findByPassenger(@Param('passengerId') passengerId: string) {
    return this.reviewsService.findByPassenger(passengerId);
  }

  @Get('trip/:tripId')
  @Public()
  @ApiOperation({
    summary: 'Todas as avaliações de uma viagem',
    description: 'Retorna todas as avaliações (passageiro→capitão/barco e capitão→passageiros) de uma viagem.',
  })
  findByTrip(@Param('tripId') tripId: string) {
    return this.reviewsService.findByTrip(tripId);
  }

  // ── Listagem privada ───────────────────────────────────────────────────────

  @Get('my')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Minhas avaliações escritas',
    description: 'Retorna todas as avaliações que o utilizador autenticado escreveu.',
  })
  findMyReviews(@Request() req: any) {
    return this.reviewsService.findMyReviews(req.user.sub);
  }
}
