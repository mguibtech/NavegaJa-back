import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { StopReviewsService } from './stop-reviews.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Stop Reviews')
@Controller('stop-reviews')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class StopReviewsController {
  constructor(private stopReviewsService: StopReviewsService) {}

  @Post()
  @ApiOperation({ summary: 'Avaliar porto / ponto de parada' })
  create(
    @Request() req: AuthenticatedRequest,
    @Body()
    body: {
      locationName: string;
      rating: number;
      comment?: string;
      photos?: string[];
      tripId?: string;
      lat?: number;
      lng?: number;
    },
  ) {
    return this.stopReviewsService.create(req.user.sub, body);
  }

  @Get()
  @Public()
  @ApiOperation({ summary: 'Avaliações de um local (ex: ?location=Parintins)' })
  @ApiQuery({ name: 'location', required: true })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  findByLocation(
    @Query('location') location: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.stopReviewsService.findByLocation(
      location,
      page || 1,
      limit || 20,
    );
  }

  @Get('top')
  @Public()
  @ApiOperation({ summary: 'Top locais por avaliação média' })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  getTop(@Query('limit') limit?: number) {
    return this.stopReviewsService.getTopLocations(limit || 10);
  }

  @Get('my')
  @ApiOperation({ summary: 'Minhas avaliações de paradas' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getMyReviews(
    @Request() req: AuthenticatedRequest,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.stopReviewsService.findMyReviews(
      req.user.sub,
      page || 1,
      limit || 20,
    );
  }
}
